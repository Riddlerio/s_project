"""호야와 대화하기 API. 기존 쿠키 인증·CSRF·Origin 검사를 그대로 쓰고, 아동은 자기 대화만 쓴다.

turn 요청은 멱등이다. 브라우저가 발화 1회마다 clientRequestId를 만들고, 서버는 제공자 호출 전에
turn을 PROCESSING으로 예약한다. 같은 요청 ID의 재시도는 저장된 결과(또는 처리 중 202)를 받고
제공자를 다시 부르지 않는다.
"""
import hashlib
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import require_student
from ..config import settings
from ..db import get_db
from ..models import Account, Child, HoyaChatSession, HoyaChatTurn, TherapistRule, TrainingGoal, now
from ..training.content import conversation_candidates
from .evidence import classify_speech
from .policy import HoyaConversationPolicy, allowed_cue
from .prompt.prompt_builder import HoyaDialogueContext
from .providers.demo_provider import OPENING, opening_text
from .schemas import RECENT_TURNS, HoyaChatStartInput, HoyaChatTurnInput, HoyaDialogueResponse
from .service import HoyaDialogueService, generates_replies, select_provider
from .transitions import NEXT_ACTIVITY, TRANSITION_TEXT, should_transition

router = APIRouter(prefix="/api/hoya/chat")
policy = HoyaConversationPolicy()


def dialogue_service() -> HoyaDialogueService:
    """요청마다 현재 설정으로 제공자를 고른다. 테스트는 이 의존성을 바꿔 가짜 제공자를 쓴다."""
    return HoyaDialogueService(*select_provider(settings))


def _owned(db: Session, session_id: str, account: Account) -> HoyaChatSession:
    session = db.get(HoyaChatSession, session_id)
    # 다른 아동의 대화는 있는지도 알려 주지 않는다.
    if session is None or session.child_id != account.child_id:
        raise HTTPException(404, "대화를 찾을 수 없습니다")
    return session


def _turns(db: Session, session_id: str) -> list[HoyaChatTurn]:
    return list(db.scalars(select(HoyaChatTurn).where(HoyaChatTurn.session_id == session_id)
                           .order_by(HoyaChatTurn.turn_index)).all())


def _public(session: HoyaChatSession, turns: list[HoyaChatTurn]) -> dict:
    done = [turn for turn in turns if turn.status == "COMPLETED"]
    return {"sessionId": session.id, "mode": session.mode, "status": session.status, "turnCount": len(done),
            "nextTurnIndex": (turns[-1].turn_index if turns else 0) + 1, "maxTurns": settings.hoya_chat_max_turns,
            "openingText": session.summary_json.get("opening", OPENING), "lastHoyaText": done[-1].hoya_text if done else None,
            "generatedReplies": generates_replies(settings)}


def _next_activity(session: HoyaChatSession, turn_index: int) -> str | None:
    first = session.summary_json.get("nextActivityFromTurnIndex")
    return NEXT_ACTIVITY if isinstance(first, int) and turn_index >= first else None


def _completed(session: HoyaChatSession, turn: HoyaChatTurn) -> dict:
    # 아동 화면에는 전환 신호 하나만 더한다. 근거·전략·제공자·횟수는 보내지 않는다.
    return {"status": "COMPLETED", "turnIndex": turn.turn_index, "clientRequestId": turn.client_request_id,
            "text": turn.hoya_text or "", "nextTurnIndex": turn.turn_index + 1, "sessionComplete": turn.session_complete,
            "nextActivity": _next_activity(session, turn.turn_index)}


def _processing(turn: HoyaChatTurn) -> JSONResponse:
    """원래 요청이 아직 제공자를 기다리는 중이다. 새로 호출하지 않고 잠시 뒤 같은 요청으로 다시 묻게 한다."""
    return JSONResponse(status_code=202, content={"status": "PROCESSING", "turnIndex": turn.turn_index,
                                                  "clientRequestId": turn.client_request_id, "retryAfterMs": 500})


def _stale(turn: HoyaChatTurn) -> bool:
    # 제공자 호출은 timeout으로 끝나므로, 그보다 충분히 오래 PROCESSING이면 서버가 중단된 것으로 본다.
    limit = max(settings.hoya_chat_stale_sec, settings.hoya_chat_timeout_sec + 5)
    updated = (turn.updated_at or turn.created_at).replace(tzinfo=None)
    return (now().replace(tzinfo=None) - updated).total_seconds() > limit


def _context(db: Session, session: HoyaChatSession, turn: HoyaChatTurn) -> HoyaDialogueContext:
    goal = db.get(TrainingGoal, session.goal_id)
    child = db.get(Child, session.child_id)
    rules = db.scalars(select(TherapistRule).where(TherapistRule.child_id == child.id, TherapistRule.active == True)).all()
    previous = [row for row in _turns(db, session.id) if row.turn_index < turn.turn_index and row.status == "COMPLETED"]
    recent = []
    for row in previous[-RECENT_TURNS:]:
        if row.child_transcript:
            recent.append({"speaker": "child", "text": row.child_transcript})
        if row.hoya_text:
            recent.append({"speaker": "hoya", "text": row.hoya_text})
    if not previous:
        # 별명 인사는 아동 화면에만 보인다. 제공자 context에는 식별 정보를 넣지 않는다.
        recent.append({"speaker": "hoya", "text": OPENING})
    return HoyaDialogueContext(
        age_band=child.age_band, target_phoneme=goal.target_phoneme, word_position=goal.word_position, level=goal.level,
        strategy=turn.strategy, evidence=turn.speech_evidence,
        target_lexicon=conversation_candidates(goal.target_phoneme, goal.word_position, goal.excluded_words, goal.priority_targets),
        allowed_cue=allowed_cue(goal, rules),
        child_transcript=turn.child_transcript if turn.speech_evidence != "NO_SPEECH" else None,
        recent_turns=recent, turn_index=turn.turn_index)


def _finish(db: Session, session: HoyaChatSession, turn: HoyaChatTurn, reply: HoyaDialogueResponse) -> dict:
    """PROCESSING인 예약만 COMPLETED로 바꾼다. 이미 다른 요청이 끝냈으면 그 결과를 그대로 쓴다."""
    db.refresh(session)
    final = turn.turn_index >= settings.hoya_chat_max_turns
    finished = now()
    evidence = [row.speech_evidence for row in _turns(db, session.id)
                if row.turn_index < turn.turn_index and row.status == "COMPLETED"] + [turn.speech_evidence]
    elapsed = (finished.replace(tzinfo=None) - session.started_at.replace(tzinfo=None)).total_seconds()
    transition = _next_activity(session, turn.turn_index) is not None or should_transition(evidence, elapsed)
    # 시간·근거를 다시 계산해도 재시도 응답이 달라지지 않도록, 문구와 최초 전환 턴을 같은 transaction에 저장한다.
    text = TRANSITION_TEXT if transition else reply.text
    changed = db.execute(update(HoyaChatTurn).where(HoyaChatTurn.id == turn.id, HoyaChatTurn.status == "PROCESSING").values(
        status="COMPLETED", hoya_text=text, strategy=reply.strategy, target_words=[] if transition else reply.target_words,
        provider=reply.provider, model_name=reply.model, fallback_reason=reply.fallback_reason,
        session_complete=final or session.status != "active", updated_at=finished)).rowcount
    if changed:
        summary = {**session.summary_json, "turnCount": turn.turn_index}
        if transition and "nextActivityFromTurnIndex" not in summary:
            summary["nextActivityFromTurnIndex"] = turn.turn_index
        session.summary_json = summary
        # 마지막 허용 turn은 같은 transaction에서 서버가 대화를 끝낸다. 브라우저가 /complete를 못 보내도 된다.
        if final and session.status == "active":
            session.status, session.ended_at = "completed", finished
    db.commit()
    db.refresh(turn)
    db.refresh(session)
    return _completed(session, turn)


@router.post("/sessions")
def start_chat(body: HoyaChatStartInput, db: Session = Depends(get_db), account: Account = Depends(require_student)):
    child = db.get(Child, account.child_id)
    if not child.guardian_consent_at:
        raise HTTPException(403, "보호자 동의가 필요합니다")
    goal = db.scalar(select(TrainingGoal).where(TrainingGoal.child_id == child.id, TrainingGoal.status == "active"))
    if goal is None:
        raise HTTPException(409, "활성 목표가 없습니다")
    for old in db.scalars(select(HoyaChatSession).where(HoyaChatSession.child_id == child.id,
                                                        HoyaChatSession.status == "active")).all():
        old.status, old.ended_at = "aborted", now()
    session = HoyaChatSession(child_id=child.id, goal_id=goal.id, mode=body.mode, is_seed=child.is_seed,
                              summary_json={"opening": opening_text(child.hero_name), "turnCount": 0})
    db.add(session)
    db.commit()
    return _public(session, [])


@router.get("/sessions/{session_id}")
def chat_detail(session_id: str, db: Session = Depends(get_db), account: Account = Depends(require_student)):
    session = _owned(db, session_id, account)
    return _public(session, _turns(db, session.id))


def request_fingerprint(body: HoyaChatTurnInput) -> str:
    """검증된 요청 내용의 canonical JSON SHA-256. 원본 HTTP 본문이 아니라 검증 뒤 값을 쓰므로 key 순서·공백과 무관하다.
    아동·계정 id, play code, 이름, 비밀 값은 넣지 않는다(요청 본문에 없다)."""
    canonical = {"turnIndex": body.turn_index, "transcript": body.transcript, "alternatives": body.alternatives,
                 "recognizer": body.recognizer, "acoustic": body.acoustic.model_dump(by_alias=True, exclude_none=True)}
    text = json.dumps(canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _same_request(turn: HoyaChatTurn, body: HoyaChatTurnInput, transcript: str | None) -> bool:
    if turn.turn_index != body.turn_index:
        return False
    if turn.request_fingerprint is not None:
        return turn.request_fingerprint == request_fingerprint(body)
    # fingerprint가 없는 이전 행(개발 DB)이나 보존 기간이 지난 행은 번호와 문장을 정확히 비교한다. None도 값이다.
    return turn.child_transcript == transcript


def _existing(db: Session, session: HoyaChatSession, turn: HoyaChatTurn, body: HoyaChatTurnInput,
              transcript: str | None, service: HoyaDialogueService):
    """같은 요청 ID의 재시도. 제공자를 다시 부르지 않는다."""
    # 요청 ID는 발화 1회에만 쓴다. 내용이 다른 요청에 같은 ID가 오면 섞지 않고 거부한다.
    if not _same_request(turn, body, transcript):
        raise HTTPException(409, "REQUEST_ID_REUSED")
    if turn.status == "COMPLETED":
        return _completed(session, turn)
    if not _stale(turn):
        return _processing(turn)
    # 서버 중단 등으로 멈춘 예약: 외부 제공자를 다시 부르지 않고 DEMO 응답으로 마무리해 대화를 잇는다.
    return _finish(db, session, turn, service.fallback(_context(db, session, turn), "STALE_PROCESSING"))


def _by_request(db: Session, session: HoyaChatSession, request_id: str) -> HoyaChatTurn | None:
    return db.scalar(select(HoyaChatTurn).where(HoyaChatTurn.session_id == session.id,
                                                HoyaChatTurn.client_request_id == request_id))


@router.post("/sessions/{session_id}/turns")
async def chat_turn(session_id: str, body: HoyaChatTurnInput, db: Session = Depends(get_db),
                    account: Account = Depends(require_student), service: HoyaDialogueService = Depends(dialogue_service)):
    session = _owned(db, session_id, account)
    transcript = body.transcript.strip() if body.transcript else None
    found = _by_request(db, session, body.client_request_id)
    if found is not None:
        # 응답만 유실된 경우의 복구. 마지막 turn 뒤 끝난 대화여도 저장된 결과를 돌려준다.
        return _existing(db, session, found, body, transcript, service)
    if session.status != "active":
        raise HTTPException(409, "끝난 대화입니다")
    turns = _turns(db, session.id)
    if turns and turns[-1].status == "PROCESSING" and _stale(turns[-1]):
        # 서버 중단으로 멈춘 이전 예약을 요청한 브라우저가 사라져도 대화가 막히지 않게, 제공자 없이 DEMO로 마무리한다.
        _finish(db, session, turns[-1], service.fallback(_context(db, session, turns[-1]), "STALE_PROCESSING"))
        turns = _turns(db, session.id)
        if session.status != "active":
            raise HTTPException(409, "끝난 대화입니다")
    # 순서가 어긋나거나 이전 turn이 아직 처리 중이면 받지 않는다(중복 호출·비용 방지).
    if body.turn_index != len(turns) + 1 or (turns and turns[-1].status != "COMPLETED"):
        raise HTTPException(409, "대화 순서가 맞지 않습니다")
    if body.turn_index > settings.hoya_chat_max_turns:
        raise HTTPException(409, "오늘 대화는 여기까지예요")
    goal = db.get(TrainingGoal, session.goal_id)
    rules = db.scalars(select(TherapistRule).where(TherapistRule.child_id == session.child_id, TherapistRule.active == True)).all()
    acoustic = body.acoustic.model_dump(by_alias=True, exclude_none=True)
    acoustic["source"] = "keyboard" if session.mode == "demo" else "microphone"
    evidence = classify_speech(transcript, acoustic, goal)
    strategy = policy.decide(evidence, [turn.speech_evidence for turn in turns], allowed_cue(goal, rules))
    # 제공자를 부르기 전에 turn을 예약하고 commit한다. 같은 turn·요청 ID는 unique 제약으로 한 요청만 예약에 성공한다.
    turn = HoyaChatTurn(session_id=session.id, turn_index=body.turn_index, client_request_id=body.client_request_id,
                        request_fingerprint=request_fingerprint(body), status="PROCESSING", child_transcript=transcript, recognizer=body.recognizer,
                        speech_evidence=evidence, strategy=strategy, target_words=[])
    db.add(turn)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        found = _by_request(db, session, body.client_request_id)
        if found is not None:
            return _existing(db, session, found, body, transcript, service)
        raise HTTPException(409, "대화 순서가 맞지 않습니다")
    context = _context(db, session, turn)
    try:
        reply = await service.reply(context)
    except Exception:  # 서비스가 제공자 오류를 이미 대체하지만, 예약이 PROCESSING으로 남지 않게 한 번 더 막는다.
        reply = service.fallback(context, "PROVIDER_ERROR")
    return _finish(db, session, turn, reply)


@router.post("/sessions/{session_id}/complete")
def complete_chat(session_id: str, db: Session = Depends(get_db), account: Account = Depends(require_student)):
    """대화 끝내기. 이미 끝난 대화에 다시 불러도 같은 결과다."""
    session = _owned(db, session_id, account)
    if session.status == "active":
        session.status, session.ended_at = "completed", now()
        db.commit()
    return _public(session, _turns(db, session.id))

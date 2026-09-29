"""호야와 대화하기 API. 기존 쿠키 인증·CSRF·Origin 검사를 그대로 쓰고, 아동은 자기 대화만 쓴다."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
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
from .providers.demo_provider import OPENING
from .schemas import RECENT_TURNS, HoyaChatStartInput, HoyaChatTurnInput
from .service import HoyaDialogueService, select_provider

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


def _public(session: HoyaChatSession, turn_count: int, last_text: str | None) -> dict:
    return {"sessionId": session.id, "mode": session.mode, "status": session.status, "turnCount": turn_count,
            "maxTurns": settings.hoya_chat_max_turns, "openingText": session.summary_json.get("opening", OPENING),
            "lastHoyaText": last_text}


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
                              summary_json={"opening": OPENING, "turnCount": 0})
    db.add(session)
    db.commit()
    return {**_public(session, 0, None), "hoyaActions": ["WAVE"]}


@router.get("/sessions/{session_id}")
def chat_detail(session_id: str, db: Session = Depends(get_db), account: Account = Depends(require_student)):
    session = _owned(db, session_id, account)
    turns = _turns(db, session.id)
    return _public(session, len(turns), turns[-1].hoya_text if turns else None)


@router.post("/sessions/{session_id}/turns")
async def chat_turn(session_id: str, body: HoyaChatTurnInput, db: Session = Depends(get_db),
                    account: Account = Depends(require_student), service: HoyaDialogueService = Depends(dialogue_service)):
    session = _owned(db, session_id, account)
    if session.status != "active":
        raise HTTPException(409, "끝난 대화입니다")
    turns = _turns(db, session.id)
    # 같은 발화를 두 번 보내거나 순서가 어긋나면 받지 않는다(중복 호출·비용 방지).
    if body.turn_index != len(turns) + 1:
        raise HTTPException(409, "대화 순서가 맞지 않습니다")
    if body.turn_index > settings.hoya_chat_max_turns:
        raise HTTPException(409, "오늘 대화는 여기까지예요")
    goal = db.get(TrainingGoal, session.goal_id)
    child = db.get(Child, session.child_id)
    rules = db.scalars(select(TherapistRule).where(TherapistRule.child_id == child.id, TherapistRule.active == True)).all()
    acoustic = body.acoustic.model_dump(by_alias=True, exclude_none=True)
    acoustic["source"] = "keyboard" if session.mode == "demo" else "microphone"
    transcript = body.transcript.strip() if body.transcript else None
    evidence = classify_speech(transcript, acoustic, goal)
    cue = allowed_cue(goal, rules)
    strategy = policy.decide(evidence, [turn.speech_evidence for turn in turns], cue)
    lexicon = conversation_candidates(goal.target_phoneme, goal.word_position, goal.excluded_words, goal.priority_targets)
    recent = []
    for turn in turns[-RECENT_TURNS:]:
        if turn.child_transcript:
            recent.append({"speaker": "child", "text": turn.child_transcript})
        if turn.hoya_text:
            recent.append({"speaker": "hoya", "text": turn.hoya_text})
    if not turns:
        recent.append({"speaker": "hoya", "text": session.summary_json.get("opening", OPENING)})
    context = HoyaDialogueContext(age_band=child.age_band, target_phoneme=goal.target_phoneme,
                                  word_position=goal.word_position, level=goal.level, strategy=strategy,
                                  evidence=evidence, target_lexicon=lexicon, allowed_cue=cue,
                                  child_transcript=transcript if evidence != "NO_SPEECH" else None,
                                  recent_turns=recent, turn_index=body.turn_index)
    reply = await service.reply(context)
    db.add(HoyaChatTurn(session_id=session.id, turn_index=body.turn_index, child_transcript=transcript,
                        hoya_text=reply.text, recognizer=body.recognizer, speech_evidence=evidence,
                        strategy=reply.strategy, target_words=reply.target_words, provider=reply.provider,
                        model_name=reply.model, fallback_reason=reply.fallback_reason))
    session.summary_json = {**session.summary_json, "turnCount": body.turn_index}
    try:
        db.commit()
    except IntegrityError:  # 같은 turn이 동시에 들어온 경우 하나만 저장한다.
        db.rollback()
        raise HTTPException(409, "대화 순서가 맞지 않습니다")
    # 아동 화면에는 근거·전략·제공자 같은 내부 정보를 보내지 않는다.
    return {"turnIndex": body.turn_index, "text": reply.text, "hoyaActions": reply.hoya_actions,
            "nextTurnIndex": body.turn_index + 1, "sessionComplete": body.turn_index >= settings.hoya_chat_max_turns}


@router.post("/sessions/{session_id}/complete")
def complete_chat(session_id: str, db: Session = Depends(get_db), account: Account = Depends(require_student)):
    session = _owned(db, session_id, account)
    if session.status == "active":
        session.status, session.ended_at = "completed", now()
        db.commit()
    turns = _turns(db, session.id)
    return _public(session, len(turns), turns[-1].hoya_text if turns else None)

import asyncio
import secrets
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import Depends, FastAPI, Header, HTTPException, Response, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .config import settings
from .db import Base, engine, get_db, SessionLocal
from .enums import LEVEL_ORDER
from .models import (AIRecommendation, ActivityRecommendation, Account, AuditEvent, ClinicalObservation, ClinicalVerification, CookieSession, LoginFailure, Child, GameEvent, HoyaChatSession, HoyaChatTurn, ProgressMetric, SpeechAnalysis,
                     Therapist, TherapistFeedback, TherapistRule, TrainingDecision, TrainingGoal,
                     TrainingPlan, TrainingSession, Utterance, now)
from .schemas import (ActivityRecommendationDecisionInput, ChildInput, CompleteInput, DemoLoginInput, FeedbackInput, GoalInput, LoginInput, ObservationDecisionInput, StartActivityInput,
                      RecommendationDecisionInput, UtteranceInput)
from .security import hash_password, hash_token, verify_dummy_password, verify_password
from .maintenance import purge_expired_chat_text, purge_expired_transcripts, retention_loop
from .auth import COOKIE_NAME, create_session, current_account, owned_child, require_student, require_therapist, require_admin
from .seed import seed
from .demo import demo_account, is_demo_account
from . import static_site
from .session_state import activity_state, completion_state, state_guard
from .analysis.progress import recompute
from .analysis.recommendation import recommend
from .analysis.insights import generate_insights
from .analysis.translation import therapist_text
from .training.rewards import award
from .clinical.observation_builder import build_observation
from .clinical.activity_recommendation import propose_activity
from .games.rounds import GAME_ROUNDS, effective_round, next_difficulty, public_round
from .games.evaluation import evaluate_round
from .games.conversation import quest_reply
from .training.content import items
from .hoya.api import router as hoya_chat_router
from .therapist_planning.api import router as session_planning_router
from .therapist_insights.api import router as therapist_insights_router
from .hoya.schema_compat import upgrade_hoya_chat_schema
from .adventure.api import router as adventure_router
from .adventure import service as adventure_service
from .games.round_rewards import round_reward
from .games import crossing


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    # PR #4 초기 개발 DB의 호야 대화 표를 현재 구조로 옮긴다(자료 보존). 이미 최신이면 아무것도 하지 않는다.
    upgrade_hoya_chat_schema(engine)
    if settings.secret_key == "dev-only-change-me":
        logging.warning("개발용 SECRET_KEY가 사용 중입니다. 운영 환경에서는 변경하세요.")
    with SessionLocal() as db:
        purge_expired_transcripts(db, settings.transcript_retention_days)
        purge_expired_chat_text(db, settings.transcript_retention_days)
    if settings.seed_demo_data:
        with SessionLocal() as db:
            seed(db)
    task = None
    if settings.transcript_purge_interval_hours > 0:
        task = asyncio.create_task(retention_loop(SessionLocal, settings.transcript_retention_days,
                                                  settings.transcript_purge_interval_hours * 3600))
    yield
    if task:
        task.cancel()


app = FastAPI(title="Speech Hero API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins.split(","), allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def limit_body(request: Request, call_next):
    origin = request.headers.get("origin")
    allowed = {value.strip() for value in settings.cors_origins.split(",")}
    if origin and origin not in allowed:
        return JSONResponse(status_code=403, content={"detail": "허용되지 않은 출처"})
    length = request.headers.get("content-length")
    if length is not None:
        if not length.isdecimal():
            return JSONResponse(status_code=400, content={"detail": "잘못된 Content-Length"})
        if int(length) > 65536:
            return JSONResponse(status_code=413, content={"detail": "요청 본문이 너무 큽니다"})
    size = 0
    chunks = []
    async for chunk in request.stream():
        size += len(chunk)
        if size > 65536:
            return JSONResponse(status_code=413, content={"detail": "요청 본문이 너무 큽니다"})
        chunks.append(chunk)
    request._body = b"".join(chunks)
    return await call_next(request)


# 마지막에 등록한 미들웨어가 가장 바깥에서 실행된다. 403·413 같은 조기 응답에도 보안 헤더가 붙는다.
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    frontend = static_site.is_frontend_path(path)
    # 해시가 붙은 빌드 파일만 오래 캐시한다. HTML과 API 응답은 저장하지 않는다.
    response.headers["Cache-Control"] = ("public, max-age=31536000, immutable"
                                         if frontend and path.startswith("/assets/") and response.status_code == 200 else "no-store")
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    # API는 아무것도 불러오지 않는 정책, 화면(HTML·정적 파일)은 React/Vite/three.js가 동작하는 정책이다. 둘 다 framing 금지.
    response.headers["Content-Security-Policy"] = static_site.FRONTEND_CSP if frontend else settings.content_security_policy
    return response


@app.exception_handler(RequestValidationError)
async def safe_validation_error(_request: Request, exc: RequestValidationError):
    # 입력값과 예외 컨텍스트에는 아동의 발화 내용이 포함될 수 있다.
    errors = [{key: value for key, value in error.items() if key not in {"input", "ctx"}} for error in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": errors})


def public(model, fields):
    return {field: getattr(model, field) for field in fields}


def goal_data(goal):
    return public(goal, ["id", "child_id", "version", "parent_goal_id", "status", "target_phoneme", "target_sound", "word_position", "level", "min_level", "session_duration_min", "repetition_target", "priority", "preferred_cue", "excluded_words", "excluded_games", "priority_targets", "note", "source", "source_recommendation_id"])


def child_data(child):
    return public(child, ["id", "child_code", "hero_name", "age_band", "play_code", "xp", "collection_json", "is_seed"])


def rec_data(rec):
    return public(rec, ["id", "child_id", "session_id", "rule_id", "observation", "evidence", "suggestion_text", "suggested_goal", "rationale", "confidence", "status"])


def activity_rec_data(rec):
    return public(rec, ["id", "child_id", "activity", "clinical_purpose", "reason", "evidence", "confidence", "status", "selected_activity", "decision_note", "created_at", "decided_at"])


def clinical_eligible(session) -> bool:
    """실제 음성 모드의 비샘플 세션만 임상 검증 통계에 들어간다."""
    return session is not None and session.mode == "real" and not session.is_seed


def legacy_recommendation_allowed(session) -> bool:
    """legacy 목표 추천(R1–R5)은 임상 근거 회기나 seed 시연 회기에서만 만든다.

    실제 아동의 DEMO 연습은 수락 시 목표를 바꾸는 추천을 만들지 않는다. seed 시연 자료는 샘플로 표시된다.
    """
    return session is not None and (clinical_eligible(session) or session.is_seed)


def rec_payload(db, rec):
    session = db.get(TrainingSession, rec.session_id)
    return {**rec_data(rec), "provenance": {"sessionMode": session.mode if session else None,
                                            "sessionIsSeed": bool(session and session.is_seed),
                                            "clinicalEligible": clinical_eligible(session),
                                            "demoPractice": not legacy_recommendation_allowed(session)}}


def observation_data(observation, session=None):
    eligible = clinical_eligible(session)
    return {**observation_fields(observation), "is_demo": not eligible, "clinical_eligible": eligible}


def observation_fields(observation):
    return public(observation, ["id", "session_id", "utterance_id", "round_index", "round_id", "difficulty", "activity",
                                "target_phoneme", "word_position", "generalization_level", "attempt_number",
                                "cue_type", "independence", "duration_ms", "audio_quality", "ai_result",
                                "ai_confidence", "possible_error_pattern", "evidence", "provenance",
                                "verification_state", "created_at"])


def current_goal(db, child_id):
    return db.scalar(select(TrainingGoal).where(TrainingGoal.child_id == child_id, TrainingGoal.status == "active"))


therapist_auth = require_therapist


def play_session(db, session_id, account):
    session = db.get(TrainingSession, session_id)
    # account가 없는 경우는 서버 내부 DEMO seed 호출뿐이다.
    if not session or (account is not None and account.child_id != session.child_id):
        raise HTTPException(404, "세션을 찾을 수 없습니다")
    return session


def save_events(db, session, drafts, utterance_id=None, item=None, goal=None, analysis=None):
    result = []
    for draft in drafts:
        event = GameEvent(session_id=session.id, utterance_id=utterance_id, type=draft["type"], payload=draft.get("payload", {}), therapist_text=therapist_text(draft["type"], draft.get("payload", {}), item, goal, analysis))
        db.add(event)
        db.flush()
        result.append({"id": event.id, "type": event.type, "at": event.created_at.isoformat() if event.created_at else now().isoformat(), "payload": event.payload})
    return result


def create_goal(db, child, values, source="manual", recommendation_id=None):
    previous = current_goal(db, child.id)
    data = {key: getattr(previous, key) for key in GoalInput.model_fields} if previous else GoalInput().model_dump()
    data.update(values)
    if data["level"] not in [v.value for v in LEVEL_ORDER] or data["min_level"] not in [v.value for v in LEVEL_ORDER] or LEVEL_ORDER.index(data["min_level"]) > LEVEL_ORDER.index(data["level"]):
        raise HTTPException(422, "최소 단계가 목표 단계보다 높습니다")
    if previous:
        previous.status = "superseded"
    goal = TrainingGoal(child_id=child.id, version=previous.version + 1 if previous else 1, parent_goal_id=previous.id if previous else None, source=source, source_recommendation_id=recommendation_id, **data)
    db.add(goal)
    for rule in db.scalars(select(TherapistRule).where(TherapistRule.child_id == child.id, TherapistRule.active == True)).all():
        if rule.params.get("scope") == "until_level_change" and rule.level_at_creation != goal.level:
            rule.active, rule.deactivated_reason = False, "goal level changed"
    db.flush()
    return goal


@app.get("/api/system/info")
def system_info():
    return {"version": "0.2.0", "modes": ["real", "demo"], "analysisMethod": "baseline_acoustic_and_asr_v2",
            "pronunciationProvider": "BASELINE", "clinicalValidation": False,
            "notice": "Web Speech API 사용 시 브라우저 제공업체 서버로 음성이 전송될 수 있습니다. 원본 음성은 이 서버에 저장하지 않습니다."}


@app.post("/api/auth/login")
def login(body: LoginInput, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    username = body.username.lower()
    keys = {"ip": hash_token(f"ip:{ip}"), "user": hash_token(f"user:{username}"), "pair": hash_token(f"pair:{ip}:{username}")}
    limits = {"ip": settings.login_max_failures_ip, "user": settings.login_max_failures_username,
              "pair": settings.login_max_failures_pair}
    since = now() - timedelta(minutes=settings.login_window_minutes)
    db.execute(delete(LoginFailure).where(LoginFailure.created_at < since))
    for kind, key in keys.items():
        recent = db.scalar(select(func.count()).select_from(LoginFailure)
                           .where(LoginFailure.key_hash == key, LoginFailure.created_at >= since))
        if recent >= limits[kind]:
            db.commit()
            raise HTTPException(429, "잠시 후 다시 시도해 주세요")
    user = db.scalar(select(Account).where(Account.username == body.username))
    valid = (verify_password(body.password, user.password_salt, user.password_hash) if user
             else verify_dummy_password(body.password))
    # DEMO 모드가 꺼져 있으면 기존 DB에 남은 샘플 계정도 비밀번호와 관계없이 로그인할 수 없다.
    if valid and not settings.seed_demo_data and is_demo_account(db, user):
        valid = False
    if not valid:
        for key in keys.values():
            db.add(LoginFailure(key_hash=key))
        db.add(AuditEvent(actor_id=user.id if user else keys["pair"][:36], action="LOGIN_FAILURE",
                          resource_id=user.id if user else keys["pair"][:36], result="DENIED"))
        db.commit()
        raise HTTPException(401, "로그인 정보가 올바르지 않습니다")
    # 성공하면 해당 아이디 기준 실패만 지운다. IP 기준 실패는 창이 지날 때까지 남긴다.
    db.execute(delete(LoginFailure).where(LoginFailure.key_hash.in_([keys["user"], keys["pair"]])))
    return start_cookie_session(db, response, user, "LOGIN_SUCCESS")


def start_cookie_session(db, response: Response, user: Account, action: str) -> dict:
    token, csrf = create_session(db, user)
    db.add(AuditEvent(actor_id=user.id, action=action, resource_id=user.id, result="SUCCESS"))
    db.commit()
    response.set_cookie(COOKIE_NAME, token, httponly=True, secure=settings.cookie_secure,
                        samesite="strict", max_age=12 * 3600, path="/api")
    return {"role": user.role, "csrfToken": csrf}


@app.get("/api/config/public")
def public_config():
    return {"demoModeEnabled": settings.seed_demo_data}


@app.post("/api/auth/demo-login")
def demo_login(body: DemoLoginInput, response: Response, db: Session = Depends(get_db)):
    """DEMO 모드에서만 샘플 계정 세션을 만든다. 비밀번호는 브라우저로 전달하지 않는다."""
    if not settings.seed_demo_data:
        raise HTTPException(404)
    user = demo_account(db, body.role)
    if user is None:
        raise HTTPException(404)
    result = start_cookie_session(db, response, user, "DEMO_LOGIN")
    return {**result, "username": user.username}


@app.post("/api/auth/logout", status_code=204)
def logout(request: Request, response: Response, account: Account = Depends(current_account), db: Session = Depends(get_db)):
    db.execute(delete(CookieSession).where(CookieSession.token_hash == hash_token(request.cookies[COOKIE_NAME])))
    db.add(AuditEvent(actor_id=account.id, action="LOGOUT", resource_id=account.id, result="SUCCESS"))
    db.commit()
    response.delete_cookie(COOKIE_NAME, path="/api")
    response.status_code = 204
    return response


@app.get("/api/auth/me")
def auth_me(account: Account = Depends(current_account)):
    return {"id": account.id, "role": account.role}


@app.get("/api/admin/health")
def admin_health(_account: Account = Depends(require_admin)):
    return {"status": "ok"}


@app.get("/api/children")
def children(db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    return [child_data(c) for c in db.scalars(select(Child).where(Child.therapist_id == therapist.id)).all()]


@app.post("/api/children")
def add_child(body: ChildInput, db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    count = len(db.scalars(select(Child)).all()) + 1
    play_code = secrets.token_hex(3).upper()
    while db.scalar(select(Child.id).where(Child.play_code == play_code)):
        play_code = secrets.token_hex(3).upper()
    child = Child(child_code=f"C-{count:04d}", hero_name=body.hero_name, age_band=body.age_band, therapist_id=therapist.id, play_code=play_code, guardian_consent_at=now() if body.guardian_consent else None)
    db.add(child)
    db.flush()
    initial_password = secrets.token_urlsafe(16)
    salt = secrets.token_hex(16)
    db.add(Account(username=play_code, password_salt=salt,
                   password_hash=hash_password(initial_password, salt), role="STUDENT", child_id=child.id))
    create_goal(db, child, {})
    db.commit()
    return {**child_data(child), "initialPassword": initial_password}


@app.get("/api/children/{child_id}")
def child_detail(child_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    child = owned_child(db, child_id, therapist)
    goals = db.scalars(select(TrainingGoal).where(TrainingGoal.child_id == child.id).order_by(TrainingGoal.version.desc())).all()
    sessions = db.scalars(select(TrainingSession).where(TrainingSession.child_id == child.id).order_by(TrainingSession.started_at.desc())).all()
    rules = db.scalars(select(TherapistRule).where(TherapistRule.child_id == child.id, TherapistRule.active == True)).all()
    return {"child": child_data(child), "currentGoal": goal_data(goals[0]) if goals else None, "goalHistory": [goal_data(g) for g in goals], "sessions": [{"id": s.id, "mode": s.mode, "isSeed": s.is_seed, "startedAt": s.started_at, "status": s.status, "summary": s.summary_json, "goalVersion": db.get(TrainingGoal, s.goal_id).version, "metric": ({"attempts": m.attempts, "successRate": m.success_rate, "firstTrySuccessRate": m.first_try_success_rate} if (m := db.scalar(select(ProgressMetric).where(ProgressMetric.session_id == s.id))) else None)} for s in sessions], "activeRules": [public(r, ["id", "rule_type", "params", "active"]) for r in rules]}


@app.get("/api/children/{child_id}/goals")
def goals(child_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    owned_child(db, child_id, therapist)
    return [goal_data(g) for g in db.scalars(select(TrainingGoal).where(TrainingGoal.child_id == child_id).order_by(TrainingGoal.version.desc())).all()]


@app.post("/api/children/{child_id}/goals")
def add_goal(child_id: str, body: GoalInput, db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    child = owned_child(db, child_id, therapist)
    goal = create_goal(db, child, body.model_dump())
    db.commit()
    return goal_data(goal)


@app.delete("/api/children/{child_id}/speech-data", status_code=204)
def delete_speech_data(child_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    owned_child(db, child_id, therapist)
    ids = db.scalars(select(TrainingSession.id).where(TrainingSession.child_id == child_id)).all()
    utterance_ids = db.scalars(select(Utterance.id).where(Utterance.session_id.in_(ids))).all() if ids else []
    # 발화에서 파생된 임상 관찰·치료사 검증·활동 제안도 함께 지운다. 참조하는 행부터 삭제한다.
    observation_ids = db.scalars(select(ClinicalObservation.id).where(ClinicalObservation.child_id == child_id)).all()
    if observation_ids:
        db.execute(delete(ClinicalVerification).where(ClinicalVerification.observation_id.in_(observation_ids)))
        db.execute(delete(ClinicalObservation).where(ClinicalObservation.id.in_(observation_ids)))
    db.execute(delete(ActivityRecommendation).where(ActivityRecommendation.child_id == child_id))
    # 호야 대화 문장도 아동 음성에서 나온 자료다. 턴을 먼저 지우고 대화 세션을 지운다.
    chat_ids = db.scalars(select(HoyaChatSession.id).where(HoyaChatSession.child_id == child_id)).all()
    if chat_ids:
        db.execute(delete(HoyaChatTurn).where(HoyaChatTurn.session_id.in_(chat_ids)))
        db.execute(delete(HoyaChatSession).where(HoyaChatSession.id.in_(chat_ids)))
    if utterance_ids:
        db.execute(delete(SpeechAnalysis).where(SpeechAnalysis.utterance_id.in_(utterance_ids)))
    if ids:
        for model in (TrainingDecision, GameEvent, ProgressMetric, AIRecommendation):
            db.execute(delete(model).where(model.session_id.in_(ids)))
    if utterance_ids:
        db.execute(delete(Utterance).where(Utterance.id.in_(utterance_ids)))
    if ids:
        adventure_service.remove_session_links(db, ids)
        db.execute(delete(TrainingSession).where(TrainingSession.id.in_(ids)))
    db.add(AuditEvent(actor_id=therapist.id, action="SPEECH_DATA_DELETED", resource_id=child_id, result="SUCCESS"))
    db.commit()
    return Response(status_code=204)


@app.post("/api/play/sessions/{session_id}/complete")
@state_guard
def complete(session_id: str, body: CompleteInput, db: Session = Depends(get_db), account: Account | None = Depends(require_student),
             x_activity_lease: str | None = Header(default=None)):
    child_id = account.child_id if account is not None else play_session(db, session_id, account).child_id
    adventure_service.serialize_child(db, child_id)
    session = play_session(db, session_id, account)
    lease = adventure_service.check_lease(db, session, x_activity_lease, allow_paused=True)
    child = db.get(Child, session.child_id)
    state = completion_state(session)
    if session.status == "completed":
        return session.summary_json
    if (lease is not None or state.get("activityGame") == crossing.GAME) and state.get("activityGame") and not state.get("roundsComplete"):
        raise HTTPException(409, "다섯 라운드를 마친 뒤 모험을 완료할 수 있습니다")
    # 보호된 V2 회기는 숨김·중단 시간을 포함하는 브라우저 벽시계 대신 서버의 활동 시간을 쓴다.
    elapsed_sec = body.elapsed_sec
    if lease is not None:
        adventure_service.accrue_active_time(lease, session, now())
        elapsed_sec = max(0, int(lease.active_elapsed_sec or 0))
    goal = db.get(TrainingGoal, session.goal_id)
    stage_index = state.get("stageIndex", 0)
    metric = recompute(db, session, goal, elapsed_sec)
    if state.get("activityGame") == crossing.GAME:
        # 재시도 뒤 성공해도 XP·배지·카드·재료를 발급하지 않는 별도 완료 경계다.
        summary = {"totalAttempts": state.get("totalAttempts", 0),
                   "durationSec": max(0, elapsed_sec), "sessionComplete": True}
        session.summary_json = summary
        session.insight_json = ["음향 근사 관찰입니다. 치료사가 확인해 주세요."]
        session.status, session.ended_at = "completed", now()
        db.commit()
        return summary
    if not state.get("activityGame") and legacy_recommendation_allowed(session):
        recommend(db, session, goal, metric)
    child.xp += state.get("xp", 0)
    utterances = db.execute(select(Utterance, SpeechAnalysis).join(SpeechAnalysis, SpeechAnalysis.utterance_id == Utterance.id).where(Utterance.session_id == session.id)).all()
    stages = db.get(TrainingPlan, session.plan_id).plan_json["stages"]
    stats = {"monsterStagesCleared": sum(stage["game"] == "monster_tower" for stage in stages[:stage_index + 1]), "beamSuccesses": sum(u.game == "magic_beam" and a.final_result == "success" for u, a in utterances), "retryThenSuccessCount": sum(u.game != "magic_beam" and u.attempt_index > 1 and a.final_result == "success" for u, a in utterances)}
    collection, new_badges, new_cards = award(child.collection_json, stats)
    child.collection_json = collection
    summary = {"totalXp": state.get("xp", 0), "heroLevel": child.xp // 100 + 1, "badges": collection["badges"], "monsterCards": collection["monsterCards"], "newBadges": new_badges, "newMonsterCards": new_cards, "levelDownCount": metric.level_down_count, "durationSec": elapsed_sec,
               "roundStars": state.get("roundStars", []),
               "materialsEarned": adventure_service.materials_earned(db, session.id)}
    session.summary_json = summary
    session.insight_json = (["게임 완료. 임상 관찰은 치료사 확인이 필요합니다."] if state.get("activityGame")
                            else generate_insights(db, session, goal, metric))
    session.status, session.ended_at = "completed", now()
    db.commit()
    return summary


@app.get("/api/play/children/{play_code}/profile")
def play_profile(play_code: str, db: Session = Depends(get_db), account: Account = Depends(require_student)):
    child = db.scalar(select(Child).where(Child.play_code == play_code.upper()))
    if not child:
        raise HTTPException(404)
    if account.child_id != child.id:
        raise HTTPException(404)
    collection = child.collection_json or {}
    return {"heroName": child.hero_name, "heroLevel": child.xp // 100 + 1, "xp": child.xp, "badges": collection.get("badges", []), "monsterCards": collection.get("monsterCards", []), "assignedActivity": collection.get("assignedActivity"), "mapProgress": len(db.scalars(select(TrainingSession).where(TrainingSession.child_id == child.id, TrainingSession.status == "completed")).all())}


@app.get("/api/me/home")
def character_home(db: Session = Depends(get_db), account: Account = Depends(require_student)):
    child = db.get(Child, account.child_id)
    return {"heroName": child.hero_name, "heroLevel": child.xp // 100 + 1,
            "tapCount": (child.collection_json or {}).get("hoyaTaps", 0),
            "assignedActivity": (child.collection_json or {}).get("assignedActivity")}


@app.post("/api/me/character/tap")
def character_tap(db: Session = Depends(get_db), account: Account = Depends(require_student)):
    child = db.get(Child, account.child_id)
    count = (child.collection_json or {}).get("hoyaTaps", 0) + 1
    child.collection_json = {**(child.collection_json or {}), "hoyaTaps": count}
    db.commit()
    lines = ("안녕! 나는 두두야.", "오늘도 같이 모험하자!", "네 목소리를 들을 준비가 됐어.",
             "천천히 해도 괜찮아.", "같이 별을 찾으러 가자!")
    return {"line": lines[(count - 1) % len(lines)], "tapCount": count}


@app.post("/api/activities")
def start_activity(body: StartActivityInput, db: Session = Depends(get_db), account: Account = Depends(require_student)):
    child = db.get(Child, account.child_id)
    if not child.guardian_consent_at:
        raise HTTPException(403, "보호자 동의가 필요합니다")
    goal = current_goal(db, child.id)
    if not goal:
        raise HTTPException(409, "활성 목표가 없습니다")
    definitions = GAME_ROUNDS[body.game]
    if body.game == crossing.GAME:
        plan_stages = crossing.build_stages(goal)
    else:
        plan_stages = []
        used = set()
        for definition in definitions:
            level = "syllable" if body.game == "monster_adventure" and definition.index == 1 else "short_sentence" if body.game == "monster_adventure" and definition.index == 5 else "word"
            candidates = items(goal.target_phoneme, level, goal.word_position)
            # 같은 세션 안에서는 앞 라운드와 다른 단어를 고른다. 모두 쓰였으면 순서대로 다시 쓴다.
            rotated = candidates[(definition.index - 1) % len(candidates):] + candidates[:(definition.index - 1) % len(candidates)] if candidates else []
            text = next((c["displayText"] for c in rotated if c["displayText"] not in used), rotated[0]["displayText"] if rotated else goal.target_sound)
            used.add(text)
            item = {"itemId": secrets.token_hex(8), "displayText": text, "level": level if body.game == "monster_adventure" else definition.generalization_level.lower(),
                    "game": body.game, "beamTargetMs": definition.target_ms, "pictureKey": text}
            plan_stages.append({"game": body.game, "level": item["level"], "round": public_round(definition), "items": [item]})
    plan = TrainingPlan(goal_id=goal.id, child_id=child.id,
                        plan_json={"stages": plan_stages, "nextSlot": 5, "rationale": ["V2_ROUND_ACTIVITY"]},
                        rationale_json=["V2_ROUND_ACTIVITY"])
    db.add(plan)
    db.flush()
    first = plan_stages[0]["items"][0]
    state = {"activityGame": body.game, "roundIndex": 1, "roundAttempt": 1, "roundAttemptsUsed": 0,
             "roundSuccesses": 0, "roundEvaluated": 0, "listenAgainCount": 0, "roundStartedAt": now().isoformat(),
             "difficulty": 2, "difficultyIncreases": 0, "lowStreak": 0, "difficultyDecreased": False,
             "currentCue": "AUDITORY_MODEL" if definitions[0].elicitation_type == "DIRECT_IMITATION" else "NONE",
             "currentItem": first, "totalAttempts": 0, "xp": 0, "stageIndex": 0,
             "roundDefinition": {**public_round(definitions[0], 2), "independence": "MODELED" if definitions[0].elicitation_type == "DIRECT_IMITATION" else "INDEPENDENT"}}
    if body.game == crossing.GAME:
        state.update(itemIndexInRound=1, stripeIndex=1, itemAttemptsUsed=0, modelCue=True)
        crossing.update_cue(state, model=True)
    state["magicBeamRound"] = adventure_service.round_magic_beam(db, state, child.id)
    session = TrainingSession(child_id=child.id, goal_id=goal.id, plan_id=plan.id, mode=body.mode, is_seed=child.is_seed,
                              play_token_hash=hash_token(secrets.token_urlsafe(32)), runtime_state=state)
    db.add(session)
    db.flush()
    events = save_events(db, session, [{"type": "SESSION_START", "payload": {"activity": body.game}},
                                        {"type": "ROUND_START", "payload": crossing.child_round(definitions[0]) if body.game == crossing.GAME else public_round(definitions[0], 2)},
                                        {"type": "TARGET_PRESENTED", "payload": {"item": first}}], item=first, goal=goal)
    db.commit()
    if body.game == crossing.GAME:
        return {**adventure_service.activity_payload(db, session), "events": events}
    return {"sessionId": session.id, "game": body.game, "mode": body.mode, "heroName": child.hero_name,
            "rounds": [public_round(definition) for definition in definitions], "currentRound": public_round(definitions[0], 2),
            "firstItem": first, "events": events}


@app.get("/api/activities/{session_id}")
@state_guard
def current_activity(session_id: str, db: Session = Depends(get_db), account: Account = Depends(require_student)):
    session = play_session(db, session_id, account)
    state = activity_state(session)
    game = state["activityGame"]
    if session.status != "active":
        raise HTTPException(409, "활성 게임이 아닙니다")
    return adventure_service.activity_payload(db, session)


@app.post("/api/activities/{session_id}/utterances")
@state_guard
def activity_utterance(session_id: str, body: UtteranceInput, db: Session = Depends(get_db), account: Account = Depends(require_student),
                       x_activity_lease: str | None = Header(default=None)):
    adventure_service.serialize_child(db, account.child_id)
    session = play_session(db, session_id, account)
    state = activity_state(session)
    if session.status != "active" or state.get("roundsComplete"):
        raise HTTPException(409, "활성 게임이 아닙니다")
    lease = adventure_service.check_lease(db, session, x_activity_lease)
    adventure_service.check_attack(db, session, state, body.attack)
    if lease is not None:
        adventure_service.heartbeat(db, session, x_activity_lease)
    round_index = state["roundIndex"]
    if body.round_index != round_index or body.item_id != state["currentItem"]["itemId"] or body.attempt_index != state["roundAttempt"]:
        raise HTTPException(409, "현재 라운드 또는 항목과 일치하지 않습니다")
    definition = (crossing.definition_for_item(state) if state["activityGame"] == crossing.GAME else
                  effective_round(GAME_ROUNDS[state["activityGame"]][round_index - 1], state["difficulty"]))
    goal = db.get(TrainingGoal, session.goal_id)
    acoustic = body.acoustic.model_dump(by_alias=True, exclude_none=True)
    acoustic["source"] = "keyboard" if session.mode == "demo" else "microphone"
    analysis = evaluate_round(definition, state["currentItem"], body.transcript, acoustic, goal)
    item = state["currentItem"]
    utterance = Utterance(session_id=session.id, item_id=item["itemId"], item_text=item["displayText"],
                          level=item["level"], game=state["activityGame"], stage_index=round_index - 1,
                          attempt_index=state["roundAttempt"], transcript=body.transcript,
                          alternatives=body.alternatives, recognizer=body.recognizer, acoustic=acoustic)
    db.add(utterance)
    db.flush()
    db.add(SpeechAnalysis(utterance_id=utterance.id, target_phones=analysis.target_phones,
                          observed_phones=analysis.observed_phones, alignment=analysis.alignment,
                          ai_score=analysis.score, ai_result=analysis.result, target_status=analysis.target_status,
                          substitute_symbol=analysis.substitute_symbol, pattern_tags=analysis.pattern_tags,
                          final_score=analysis.score, final_result=analysis.result))
    if analysis.result != "not_target_attempt":
        db.add(build_observation(session, utterance, goal, analysis, acoustic, state))
    if state["activityGame"] == crossing.GAME:
        stages = db.get(TrainingPlan, session.plan_id).plan_json["stages"]
        drafts = crossing.advance(state, analysis.result, stages, now())
        session.runtime_state = state
        events = save_events(db, session, drafts, utterance.id, item, goal, analysis)
        db.commit()
        finished = bool(state.get("roundsComplete"))
        return {"events": events, "result": analysis.result,
                "nextItem": None if finished else state["currentItem"],
                "nextAttemptIndex": state["roundAttempt"],
                "currentRound": None if finished else crossing.child_round(crossing.definition_for_item(state)),
                **crossing.cursor(state)}
    drafts = []
    if analysis.result == "no_speech":
        drafts.append({"type": "NO_SPEECH", "payload": {}})
    elif analysis.result == "uncertain":
        if state["listenAgainCount"] >= 2:
            drafts.append({"type": "ITEM_ADVANCE", "payload": {"reason": "UNCERTAIN_SKIP"}})
            drafts.append({"type": "REWARD", "payload": {"xp": 2, "reason": "ATTEMPT"}})
            state["roundAttemptsUsed"] += 1
            state["listenAgainCount"] = 0
        else:
            drafts.append({"type": "LISTEN_AGAIN", "payload": {}})
            state["listenAgainCount"] += 1
    elif analysis.result in {"target_observed", "not_target_attempt"}:
        state["roundAttemptsUsed"] += 1
        drafts.append({"type": "STORY_CONTINUE", "payload": {"targetObserved": analysis.result == "target_observed"}})
    else:
        state["roundAttemptsUsed"] += 1
        state["roundEvaluated"] += 1
        state["totalAttempts"] += 1
        if analysis.result == "success":
            state["roundSuccesses"] += 1
            drafts.extend([{"type": "TARGET_SUCCESS", "payload": {}}, {"type": "REWARD", "payload": {"xp": 10}}])
        else:
            drafts.append({"type": "TARGET_RETRY", "payload": {"cue": "gentle"}})
    state["xp"] += sum(draft["payload"].get("xp", 0) for draft in drafts)
    elapsed = (now() - datetime.fromisoformat(state["roundStartedAt"])).total_seconds()
    neutral_skip = any(draft["type"] == "ITEM_ADVANCE" for draft in drafts)
    clear = state["roundSuccesses"] > 0 or neutral_skip or (state["activityGame"] == "conversation_quest" and analysis.result in {"target_observed", "not_target_attempt"}) or state["roundAttemptsUsed"] >= definition.attempts or elapsed >= definition.time_limit_sec
    finished = False
    if clear:
        game_reward = {"index": round_index, **round_reward(state["roundSuccesses"], state["roundEvaluated"])}
        material = adventure_service.award_material(db, session, round_index)
        reward_payload = {**game_reward, "doneAttempts": state["roundAttemptsUsed"]}
        if material is not None:
            reward_payload["material"] = material
        drafts.append({"type": "ROUND_CLEAR", "payload": reward_payload})
        state["roundStars"] = [*state.get("roundStars", []), game_reward]
        if round_index == 5:
            finished = True
            state["roundsComplete"] = True
            drafts.append({"type": "SESSION_COMPLETE", "payload": {"totalXp": state["xp"], "badges": [], "monsterCards": []}})
            next_item = None
            next_round = None
        else:
            state["difficulty"], state["difficultyIncreases"], state["lowStreak"], state["difficultyDecreased"] = next_difficulty(
                state["difficulty"], state["roundSuccesses"], state["roundEvaluated"],
                state["difficultyIncreases"], state["lowStreak"], state["difficultyDecreased"])
            round_index += 1
            next_round = GAME_ROUNDS[state["activityGame"]][round_index - 1]
            next_item = {**db.get(TrainingPlan, session.plan_id).plan_json["stages"][round_index - 1]["items"][0],
                         "beamTargetMs": effective_round(next_round, state["difficulty"]).target_ms}
            state.update(roundIndex=round_index, stageIndex=round_index - 1, currentItem=next_item,
                         roundAttempt=1, roundAttemptsUsed=0, roundSuccesses=0, roundEvaluated=0,
                         listenAgainCount=0, roundStartedAt=now().isoformat(),
                         currentCue="AUDITORY_MODEL" if next_round.elicitation_type == "DIRECT_IMITATION" else "NONE",
                         roundDefinition={**public_round(next_round, state["difficulty"]), "independence": "MODELED" if next_round.elicitation_type == "DIRECT_IMITATION" else "INDEPENDENT"})
            # 철회는 이 시점(다음 라운드 시작)부터 적용한다.
            state["magicBeamRound"] = adventure_service.round_magic_beam(db, state, session.child_id)
            drafts.extend([{"type": "ROUND_START", "payload": public_round(next_round, state["difficulty"])},
                           {"type": "TARGET_PRESENTED", "payload": {"item": next_item}}])
    else:
        next_item = item
        next_round = GAME_ROUNDS[state["activityGame"]][round_index - 1]
        if analysis.result not in {"uncertain", "no_speech"}:
            state["roundAttempt"] += 1
    session.runtime_state = state
    events = save_events(db, session, drafts, utterance.id, item, goal, analysis)
    db.commit()
    return {"events": events, "nextItem": next_item, "nextAttemptIndex": state["roundAttempt"],
            "currentRound": public_round(next_round, state["difficulty"]) if next_round else None, "sessionComplete": finished,
            "attack": body.attack,
            "magicBeamAvailable": not finished and adventure_service.magic_beam_available(db, state, session.child_id),
            "dialogue": quest_reply(definition.index, body.transcript) if state["activityGame"] == "conversation_quest" and analysis.result in {"target_observed", "not_target_attempt"} else None}


@app.get("/api/dashboard/overview")
def overview(db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    children = db.scalars(select(Child).where(Child.therapist_id == therapist.id)).all()
    child_ids = [c.id for c in children]
    sessions = db.scalars(select(TrainingSession).where(TrainingSession.child_id.in_(child_ids)).order_by(TrainingSession.started_at.desc()).limit(10)).all() if child_ids else []
    pending = db.scalars(select(AIRecommendation).where(AIRecommendation.child_id.in_(child_ids), AIRecommendation.status == "pending")).all() if child_ids else []
    # 수정 전에 저장된 DEMO 연습 기반 추천(과거 행)은 대기 수와 목록에서 뺀다. 생성 경계만으로는 과거 행을 막지 못한다.
    pending = [r for r in pending if legacy_recommendation_allowed(db.get(TrainingSession, r.session_id))]
    return {"activeChildren": [{**child_data(c), "currentGoal": goal_data(current_goal(db, c.id)), "pendingRecommendations": sum(r.child_id == c.id for r in pending)} for c in children], "recentSessions": [{"id": s.id, "childId": s.child_id, "mode": s.mode, "isSeed": s.is_seed, "startedAt": s.started_at, "status": s.status} for s in sessions], "pendingRecommendations": [rec_payload(db, r) for r in pending]}


@app.get("/api/children/{child_id}/recommendations")
def recommendations(child_id: str, status: str | None = None, db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    owned_child(db, child_id, therapist)
    query = select(AIRecommendation).where(AIRecommendation.child_id == child_id)
    if status:
        query = query.where(AIRecommendation.status == status)
    return [rec_payload(db, r) for r in db.scalars(query.order_by(AIRecommendation.created_at.desc())).all()]


@app.get("/api/children/{child_id}/activity-recommendations")
def activity_recommendations(child_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    owned_child(db, child_id, therapist)
    rows = db.scalars(select(ActivityRecommendation).where(ActivityRecommendation.child_id == child_id)
                      .order_by(ActivityRecommendation.created_at.desc())).all()
    return [activity_rec_data(row) for row in rows]


@app.post("/api/children/{child_id}/activity-recommendations")
def generate_activity_recommendation(child_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    owned_child(db, child_id, therapist)
    pending = db.scalar(select(ActivityRecommendation).where(ActivityRecommendation.child_id == child_id,
                                                               ActivityRecommendation.status == "PENDING"))
    if pending:
        return {"status": "PENDING", "recommendation": activity_rec_data(pending)}
    proposal = propose_activity(db, child_id)
    if proposal is None:
        return {"status": "INSUFFICIENT_DATA", "recommendation": None}
    rec = ActivityRecommendation(child_id=child_id, activity=proposal["activity"],
                                 clinical_purpose=proposal["clinicalPurpose"], reason=proposal["reason"],
                                 evidence=proposal["evidence"], confidence=proposal["confidence"])
    db.add(rec)
    db.commit()
    return {"status": "PENDING", "recommendation": activity_rec_data(rec)}


@app.post("/api/activity-recommendations/{recommendation_id}/decision")
def decide_activity_recommendation(recommendation_id: str, body: ActivityRecommendationDecisionInput,
                                   db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    rec = db.get(ActivityRecommendation, recommendation_id)
    if rec is None:
        raise HTTPException(404)
    child = owned_child(db, rec.child_id, therapist)
    if rec.status != "PENDING":
        raise HTTPException(409, "이미 처리한 제안입니다")
    if body.action == "modify" and (body.modified_game is None or not body.note.strip()):
        raise HTTPException(422, "수정할 게임과 이유가 필요합니다")
    if body.action == "reject" and not body.note.strip():
        raise HTTPException(422, "거절 사유가 필요합니다")
    if body.action != "reject":
        child.collection_json = {**(child.collection_json or {}),
                                 "assignedActivity": body.modified_game if body.action == "modify" else rec.activity}
    rec.status = {"accept": "ACCEPTED", "modify": "MODIFIED", "reject": "REJECTED"}[body.action]
    rec.selected_activity = None if body.action == "reject" else body.modified_game if body.action == "modify" else rec.activity
    rec.decision_note = body.note
    rec.decided_at = now()
    rec.decided_by = therapist.id
    db.add(AuditEvent(actor_id=therapist.id, action=f"RECOMMENDATION_{rec.status}",
                      resource_id=rec.id, result="SUCCESS"))
    db.commit()
    return activity_rec_data(rec)


@app.get("/api/sessions/{session_id}")
def session_detail(session_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    session = db.get(TrainingSession, session_id)
    if not session:
        raise HTTPException(404)
    owned_child(db, session.child_id, therapist)
    utterances = db.scalars(select(Utterance).where(Utterance.session_id == session.id).order_by(Utterance.created_at)).all()
    decisions = db.scalars(select(TrainingDecision).where(TrainingDecision.session_id == session.id).order_by(TrainingDecision.created_at)).all()
    events = db.scalars(select(GameEvent).where(GameEvent.session_id == session.id).order_by(GameEvent.created_at)).all()
    metrics = db.scalars(select(ProgressMetric).where(ProgressMetric.session_id == session.id)).all()
    recs = db.scalars(select(AIRecommendation).where(AIRecommendation.session_id == session.id)).all()
    goal = db.get(TrainingGoal, session.goal_id)
    rules = db.scalars(select(TherapistRule).where(TherapistRule.child_id == session.child_id, TherapistRule.active == True)).all()
    return {"session": {"id": session.id, "mode": session.mode, "activityGame": session.runtime_state.get("activityGame"), "isSeed": session.is_seed, "status": session.status, "startedAt": session.started_at, "endedAt": session.ended_at, "durationSec": session.summary_json.get("durationSec"), "goalVersion": goal.version, "summary": session.summary_json}, "goal": goal_data(goal), "plan": db.get(TrainingPlan, session.plan_id).plan_json, "utterances": [{"id": u.id, "itemText": u.item_text, "level": u.level, "game": u.game, "recognizer": u.recognizer, "stageIndex": u.stage_index, "acoustic": u.acoustic, "createdAt": u.created_at, "transcript": u.transcript, "attemptIndex": u.attempt_index, "analysis": public(db.scalar(select(SpeechAnalysis).where(SpeechAnalysis.utterance_id == u.id)), ["ai_score", "ai_result", "final_score", "final_result", "target_status", "substitute_symbol", "pattern_tags", "therapist_override", "rule_applied_id", "method"])} for u in utterances], "decisions": [public(d, ["id", "decision_type", "reason_codes", "reason_text", "inputs_snapshot", "from_level", "to_level"]) for d in decisions], "events": [public(e, ["id", "type", "payload", "therapist_text", "utterance_id", "created_at"]) for e in events], "metrics": [public(m, ["attempts", "successes", "retries", "hints", "first_try_success_rate", "mean_score", "level_down_count"]) for m in metrics], "insight": session.insight_json, "recommendations": [rec_payload(db, r) for r in recs], "activeRules": [public(r, ["id", "rule_type", "params"]) for r in rules]}


@app.get("/api/sessions/{session_id}/timeline")
def session_timeline(session_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    session = db.get(TrainingSession, session_id)
    if session is None:
        raise HTTPException(404)
    owned_child(db, session.child_id, therapist)
    events = db.scalars(select(GameEvent).where(GameEvent.session_id == session_id).order_by(GameEvent.created_at)).all()
    observations = db.scalars(select(ClinicalObservation).where(ClinicalObservation.session_id == session_id).order_by(ClinicalObservation.created_at)).all()
    return {"events": [public(event, ["id", "type", "payload", "utterance_id", "created_at"]) for event in events],
            "observations": [observation_data(observation, session) for observation in observations]}


@app.get("/api/sessions/{session_id}/clinical-summary")
def clinical_summary(session_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    session = db.get(TrainingSession, session_id)
    if session is None:
        raise HTTPException(404)
    owned_child(db, session.child_id, therapist)
    game = session.runtime_state.get("activityGame")
    definitions = GAME_ROUNDS.get(game, ())
    observations = db.scalars(select(ClinicalObservation).where(ClinicalObservation.session_id == session_id)).all()
    rows = []
    for definition in definitions:
        all_round = [row for row in observations if row.round_index == definition.index]
        sample = all_round if clinical_eligible(session) else []
        verified = 0
        verified_evaluated = 0
        verified_observed = 0
        verified_success = 0
        for row in sample:
            latest = db.scalar(select(ClinicalVerification).where(ClinicalVerification.observation_id == row.id)
                               .order_by(ClinicalVerification.created_at.desc(), ClinicalVerification.id.desc()))
            if latest and latest.action in {"confirm", "correct"}:
                verified += 1
                value = latest.correction.get("result") if latest.action == "correct" else row.ai_result
                # 불확실·무발화·대화 속 목표 관찰은 정오 판정이 아니므로 비율의 분모에 넣지 않는다.
                if value in {"success", "retry"}:
                    verified_evaluated += 1
                    verified_success += value == "success"
                elif value == "target_observed":
                    verified_observed += 1
        # totalObservedN: 실제 음성 관찰 전체. evaluableN: AI가 success/retry로 판정한 표본만.
        # 불확실·무발화·대화 속 목표 관찰은 평가 가능한 표본 수를 늘리지 않는다. 자료 없음은 0점이 아니다.
        evaluable = sum(row.ai_result in {"success", "retry"} for row in sample)
        rows.append({"roundIndex": definition.index, "roundId": definition.id,
                     "clinicalFocus": definition.clinical_focus,
                     "totalObservedN": len(sample), "evaluableN": evaluable, "demoN": len(all_round) - len(sample),
                     "aiSupportedSuccesses": sum(row.ai_result == "success" for row in sample),
                     "uncertainN": sum(row.ai_result == "uncertain" for row in sample),
                     "noSpeechN": sum(row.ai_result == "no_speech" for row in sample),
                     "targetObservedN": sum(row.ai_result == "target_observed" for row in sample),
                     "verifiedN": verified, "verifiedEvaluatedN": verified_evaluated,
                     "verifiedObservedN": verified_observed, "verifiedSuccesses": verified_success,
                     "verifiedRate": round(100 * verified_success / verified_evaluated, 1) if verified_evaluated else None,
                     "limitedData": evaluable < 5})
    return {"game": game, "rounds": rows}


@app.get("/api/observations/{observation_id}")
def observation_detail(observation_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    observation = db.get(ClinicalObservation, observation_id)
    if observation is None:
        raise HTTPException(404)
    owned_child(db, observation.child_id, therapist)
    decisions = db.scalars(select(ClinicalVerification).where(ClinicalVerification.observation_id == observation_id).order_by(ClinicalVerification.created_at)).all()
    return {"observation": observation_data(observation, db.get(TrainingSession, observation.session_id)),
            "decisions": [public(row, ["id", "action", "correction", "note", "created_at"]) for row in decisions]}


@app.post("/api/observations/{observation_id}/decision")
def decide_observation(observation_id: str, body: ObservationDecisionInput, db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    observation = db.get(ClinicalObservation, observation_id)
    if observation is None:
        raise HTTPException(404)
    owned_child(db, observation.child_id, therapist)
    if body.action == "correct" and body.corrected_result is None:
        raise HTTPException(422, "교정 결과가 필요합니다")
    if body.action == "reject" and not body.note.strip():
        raise HTTPException(422, "거부 사유가 필요합니다")
    correction = {"result": body.corrected_result} if body.action == "correct" else {}
    db.add(ClinicalVerification(observation_id=observation.id, therapist_id=therapist.id,
                                action=body.action, correction=correction, note=body.note))
    session = db.get(TrainingSession, observation.session_id)
    state = {"confirm": "CONFIRMED", "correct": "CORRECTED", "reject": "REJECTED"}[body.action]
    # DEMO 관찰도 검토할 수 있지만 임상 검증 자료로 승격하지 않도록 상태를 구분한다.
    observation.verification_state = state if clinical_eligible(session) else f"DEMO_{state}"
    db.add(AuditEvent(actor_id=therapist.id, action=f"THERAPIST_{body.action.upper()}",
                      resource_id=observation.id, result="SUCCESS"))
    db.commit()
    return observation_data(observation, session)


@app.post("/api/recommendations/{recommendation_id}/decision")
def decide_recommendation(recommendation_id: str, body: RecommendationDecisionInput, db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    rec = db.get(AIRecommendation, recommendation_id)
    if not rec:
        raise HTTPException(404)
    child = owned_child(db, rec.child_id, therapist)
    if rec.status != "pending":
        raise HTTPException(409, "이미 처리한 추천입니다")
    if body.action not in ("accept", "modify", "reject") or (body.action == "reject" and not body.note.strip()):
        raise HTTPException(422, "결정 또는 거절 사유가 필요합니다")
    if body.action != "reject" and not legacy_recommendation_allowed(db.get(TrainingSession, rec.session_id)):
        # 수정 전에 저장된 DEMO 연습 기반 추천은 목표를 바꾸지 못한다. 거절(기록)만 할 수 있다.
        raise HTTPException(409, "DEMO 연습에서 나온 추천은 목표에 반영할 수 없습니다. 거절만 할 수 있습니다")
    goal = None
    if body.action != "reject":
        patch = rec.suggested_goal if body.action == "accept" else body.modified_goal
        if patch is None:
            raise HTTPException(422, "수정 목표가 필요합니다")
        from pydantic.alias_generators import to_camel
        fields = {key: patch[to_camel(key)] if to_camel(key) in patch else patch[key] for key in GoalInput.model_fields if key in patch or to_camel(key) in patch}
        goal = create_goal(db, child, fields, "recommendation" if body.action == "accept" else "recommendation_modified", rec.id)
    rec.status, rec.decided_at = {"accept": "accepted", "modify": "modified", "reject": "rejected"}[body.action], now()
    feedback = TherapistFeedback(therapist_id=therapist.id, child_id=child.id, kind="recommendation_decision", recommendation_id=rec.id, action=body.action, payload=body.model_dump(), note=body.note, resulting_goal_id=goal.id if goal else None)
    db.add(feedback)
    db.commit()
    return {"recommendation": rec_data(rec), "feedback": {"id": feedback.id, "action": feedback.action}, "newGoal": goal_data(goal) if goal else None}


@app.post("/api/utterances/{utterance_id}/feedback")
def utterance_feedback(utterance_id: str, body: FeedbackInput, db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    utterance = db.get(Utterance, utterance_id)
    if not utterance:
        raise HTTPException(404)
    session = db.get(TrainingSession, utterance.session_id)
    child = owned_child(db, session.child_id, therapist)
    analysis = db.scalar(select(SpeechAnalysis).where(SpeechAnalysis.utterance_id == utterance.id))
    goal = db.get(TrainingGoal, session.goal_id)
    if body.action not in ("not_error", "allowed_at_stage", "cue_needed", "manual_score", "note"):
        raise HTTPException(422)
    if body.action == "manual_score" and (body.score is None or not 0 <= body.score <= 100):
        raise HTTPException(422, "0~100 점수가 필요합니다")
    if body.action == "cue_needed" and not body.cue:
        raise HTTPException(422, "단서 종류가 필요합니다")
    if body.action in ("not_error", "allowed_at_stage"):
        analysis.final_result, analysis.therapist_override = "success", True
    if body.action == "manual_score":
        analysis.final_score, analysis.therapist_override = body.score, True
    feedback = TherapistFeedback(therapist_id=therapist.id, child_id=child.id, kind="utterance_correction", utterance_id=utterance.id, action=body.action, payload=body.model_dump(), note=body.note)
    db.add(feedback)
    db.flush()
    rule = None
    if body.action == "cue_needed":
        rule = TherapistRule(child_id=child.id, rule_type="CUE_OVERRIDE", params={"cue": body.cue}, level_at_creation=goal.level, source_feedback_id=feedback.id)
    elif body.action == "allowed_at_stage":
        rule = TherapistRule(child_id=child.id, rule_type="ACCEPT_SUBSTITUTION", params={"phoneme": goal.target_phoneme, "substitute": analysis.substitute_symbol, "scope": "until_level_change"}, level_at_creation=goal.level, source_feedback_id=feedback.id)
    elif body.action == "not_error" and body.create_rule and utterance.transcript:
        rule = TherapistRule(child_id=child.id, rule_type="ACCEPT_WORD_VARIANT", params={"item_text": utterance.item_text, "variant": utterance.transcript}, level_at_creation=goal.level, source_feedback_id=feedback.id)
    if rule:
        db.add(rule)
        db.flush()
        feedback.resulting_rule_id = rule.id
    recompute(db, session, goal, session.summary_json.get("durationSec", 0))
    db.commit()
    return {"feedback": {"id": feedback.id, "action": feedback.action}, "analysis": public(analysis, ["ai_score", "ai_result", "final_score", "final_result", "therapist_override"]), "rule": public(rule, ["id", "rule_type", "params"]) if rule else None}


@app.post("/api/rules/{rule_id}/deactivate")
def deactivate_rule(rule_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    rule = db.get(TherapistRule, rule_id)
    if not rule:
        raise HTTPException(404)
    owned_child(db, rule.child_id, therapist)
    rule.active, rule.deactivated_reason = False, "therapist"
    db.commit()
    return public(rule, ["id", "rule_type", "params", "active"])


app.include_router(hoya_chat_router)
app.include_router(session_planning_router)
app.include_router(therapist_insights_router)
app.include_router(adventure_router)


# 반드시 마지막에 등록한다. 위의 /api 경로가 먼저 일치하고, 나머지 GET만 프로덕션 SPA로 간다.
@app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
def frontend(path: str):
    return static_site.serve(settings.frontend_dist, path)

import secrets
import logging
from contextlib import asynccontextmanager
from datetime import timedelta

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .config import settings
from .db import Base, engine, get_db, SessionLocal
from .enums import LEVEL_ORDER
from .models import (AIRecommendation, AuthToken, Child, GameEvent, ProgressMetric, SpeechAnalysis,
                     Therapist, TherapistFeedback, TherapistRule, TrainingDecision, TrainingGoal,
                     TrainingPlan, TrainingSession, Utterance, now)
from .schemas import (ChildInput, CompleteInput, FeedbackInput, GoalInput, LoginInput,
                      RecommendationDecisionInput, StartInput, UtteranceInput)
from .security import hash_token, issue_token, verify_password
from .seed import seed
from .speech.pipeline import analyze
from .training.plan_generator import generate_plan
from .training.policy import decide
from .analysis.progress import recompute
from .analysis.recommendation import recommend
from .analysis.insights import generate_insights
from .analysis.translation import reason_text, therapist_text
from .training.rewards import award


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    if settings.secret_key == "dev-only-change-me":
        logging.warning("개발용 SECRET_KEY가 사용 중입니다. 운영 환경에서는 변경하세요.")
    with SessionLocal() as db:
        expired = db.scalars(select(Utterance).where(Utterance.created_at < now() - timedelta(days=settings.transcript_retention_days))).all()
        for utterance in expired:
            utterance.transcript = None
            utterance.alternatives = []
        db.commit()
    if settings.seed_demo_data:
        with SessionLocal() as db:
            seed(db)
    yield


app = FastAPI(title="Speech Hero API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins.split(","), allow_methods=["*"], allow_headers=["*"])


def public(model, fields):
    return {field: getattr(model, field) for field in fields}


def goal_data(goal):
    return public(goal, ["id", "child_id", "version", "parent_goal_id", "status", "target_phoneme", "target_sound", "word_position", "level", "min_level", "session_duration_min", "repetition_target", "priority", "preferred_cue", "excluded_words", "excluded_games", "priority_targets", "note", "source", "source_recommendation_id"])


def child_data(child):
    return public(child, ["id", "child_code", "hero_name", "age_band", "play_code", "xp", "collection_json", "is_seed"])


def rec_data(rec):
    return public(rec, ["id", "child_id", "session_id", "rule_id", "observation", "evidence", "suggestion_text", "suggested_goal", "rationale", "confidence", "status"])


def current_goal(db, child_id):
    return db.scalar(select(TrainingGoal).where(TrainingGoal.child_id == child_id, TrainingGoal.status == "active"))


def therapist_auth(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> Therapist:
    token = (authorization or "").removeprefix("Bearer ")
    row = db.get(AuthToken, hash_token(token)) if token else None
    if not row or row.expires_at.replace(tzinfo=None) < now().replace(tzinfo=None):
        raise HTTPException(401, "로그인이 필요합니다")
    return db.get(Therapist, row.therapist_id)


def owned_child(db, child_id, therapist):
    child = db.get(Child, child_id)
    if not child or child.therapist_id != therapist.id:
        raise HTTPException(404, "아동을 찾을 수 없습니다")
    return child


def play_session(db, session_id, token):
    session = db.get(TrainingSession, session_id)
    if not session or not token or session.play_token_hash != hash_token(token):
        raise HTTPException(401, "세션 인증에 실패했습니다")
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
    return {"version": "0.1.0", "modes": ["real", "demo"], "analysisMethod": "asr_text_alignment_v1", "notice": "Web Speech API 사용 시 브라우저 제공업체 서버로 음성이 전송될 수 있습니다. 원본 음성은 이 서버에 저장하거나 전송하지 않습니다."}


@app.post("/api/auth/login")
def login(body: LoginInput, db: Session = Depends(get_db)):
    user = db.scalar(select(Therapist).where(Therapist.username == body.username))
    if not user or not verify_password(body.password, user.password_salt, user.password_hash):
        raise HTTPException(401, "로그인 정보가 올바르지 않습니다")
    return {"token": issue_token(db, user.id), "therapist": {"id": user.id, "displayName": user.display_name}}


@app.post("/api/auth/logout", status_code=204)
def logout(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    if authorization:
        db.execute(delete(AuthToken).where(AuthToken.token_hash == hash_token(authorization.removeprefix("Bearer "))))
        db.commit()
    return Response(status_code=204)


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
    create_goal(db, child, {})
    db.commit()
    return child_data(child)


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
    if utterance_ids:
        db.execute(delete(SpeechAnalysis).where(SpeechAnalysis.utterance_id.in_(utterance_ids)))
        db.execute(delete(Utterance).where(Utterance.id.in_(utterance_ids)))
    if ids:
        for model in (TrainingDecision, GameEvent, ProgressMetric, AIRecommendation):
            db.execute(delete(model).where(model.session_id.in_(ids)))
        db.execute(delete(TrainingSession).where(TrainingSession.id.in_(ids)))
    db.commit()
    return Response(status_code=204)


@app.post("/api/play/start")
def start(body: StartInput, db: Session = Depends(get_db)):
    child = db.scalar(select(Child).where(Child.play_code == body.play_code.upper()))
    if not child:
        raise HTTPException(404, "모험 코드를 찾을 수 없습니다")
    if not child.guardian_consent_at:
        raise HTTPException(403, "보호자 동의가 필요합니다")
    if body.mode not in ("real", "demo"):
        raise HTTPException(422, "모드가 올바르지 않습니다")
    goal = current_goal(db, child.id)
    if not goal:
        raise HTTPException(409, "훈련 목표가 없습니다")
    for old in db.scalars(select(TrainingSession).where(TrainingSession.child_id == child.id, TrainingSession.status == "active")).all():
        old.status = "aborted"
    history = [s.summary_json for s in db.scalars(select(TrainingSession).where(TrainingSession.child_id == child.id, TrainingSession.status == "completed").order_by(TrainingSession.started_at)).all()]
    rules = db.scalars(select(TherapistRule).where(TherapistRule.child_id == child.id, TherapistRule.active == True)).all()
    plan_json = generate_plan(goal, history, rules)
    plan = TrainingPlan(goal_id=goal.id, child_id=child.id, plan_json=plan_json, rationale_json=plan_json["rationale"])
    db.add(plan)
    db.flush()
    token = secrets.token_urlsafe(32)
    first_stage = plan_json["stages"][0]
    first_item = first_stage["items"][0]
    state = {"currentLevel": first_item["level"], "stageIndex": 0, "queue": first_stage["items"][1:], "currentItem": first_item, "itemAttempt": 1, "successStreak": 0, "targetRetryStreak": 0, "resumeItem": None, "totalAttempts": 0, "xp": 0, "beamTargetMs": 1500, "nextSlot": plan_json["nextSlot"], "pendingBigAttack": False}
    session = TrainingSession(child_id=child.id, goal_id=goal.id, plan_id=plan.id, mode=body.mode, play_token_hash=hash_token(token), runtime_state=state)
    db.add(session)
    db.flush()
    db.add(TrainingDecision(session_id=session.id, decision_type="PLAN_GENERATED", reason_codes=plan_json["rationale"], reason_text=reason_text(plan_json["rationale"]), inputs_snapshot={"goalId": goal.id, "goalVersion": goal.version, "ruleIds": [r.id for r in rules]}))
    events = save_events(db, session, [{"type": "SESSION_START", "payload": {}}, {"type": "STAGE_START", "payload": {"stageIndex": 0, "game": first_stage["game"], "itemCount": len(first_stage["items"])}}, {"type": "TARGET_PRESENTED", "payload": {"item": first_item}}], item=first_item, goal=goal)
    db.commit()
    return {"sessionId": session.id, "playToken": token, "heroName": child.hero_name, "mode": body.mode, "plan": {"stages": [{"game": s["game"], "itemCount": len(s["items"])} for s in plan_json["stages"]]}, "firstItem": first_item, "events": events}


@app.post("/api/play/sessions/{session_id}/utterances")
def play_utterance(session_id: str, body: UtteranceInput, x_play_token: str | None = Header(default=None), db: Session = Depends(get_db)):
    session = play_session(db, session_id, x_play_token)
    if session.status != "active":
        raise HTTPException(409, "완료된 세션입니다")
    state = dict(session.runtime_state)
    item = state["currentItem"]
    if body.item_id != item["itemId"] or body.attempt_index != state["itemAttempt"]:
        raise HTTPException(409, "현재 항목 또는 시도 번호가 일치하지 않습니다")
    goal = db.get(TrainingGoal, session.goal_id)
    rules = db.scalars(select(TherapistRule).where(TherapistRule.child_id == session.child_id, TherapistRule.active == True)).all()
    analysis = analyze(item, body.transcript, body.acoustic, goal, rules)
    utterance = Utterance(session_id=session.id, item_id=item["itemId"], item_text=item["displayText"], level=item["level"], game=item["game"], stage_index=state["stageIndex"], attempt_index=state["itemAttempt"], transcript=body.transcript, alternatives=body.alternatives, recognizer=body.recognizer, acoustic=body.acoustic)
    db.add(utterance)
    db.flush()
    db.add(SpeechAnalysis(utterance_id=utterance.id, target_phones=analysis.target_phones, observed_phones=analysis.observed_phones, alignment=analysis.alignment, ai_score=analysis.score, ai_result=analysis.result, target_status=analysis.target_status, substitute_symbol=analysis.substitute_symbol, pattern_tags=analysis.pattern_tags, rule_applied_id=analysis.rule_applied_id, final_score=analysis.score, final_result=analysis.result))
    total = state["totalAttempts"] + (analysis.result != "no_speech")
    state["voicedMs"] = body.acoustic.get("voicedMs", 0)
    previous = db.scalar(select(TrainingSession).where(TrainingSession.child_id == session.child_id, TrainingSession.status == "completed").order_by(TrainingSession.started_at.desc()))
    output = decide(goal, item, analysis, state, body.elapsed_sec, total, rules, previous.summary_json if previous else None)
    for draft in output.decisions:
        db.add(TrainingDecision(session_id=session.id, utterance_id=utterance.id, decision_type=draft["type"], from_level=draft["fromLevel"], to_level=draft["toLevel"], reason_codes=draft["reasonCodes"], reason_text=reason_text(draft["reasonCodes"]), inputs_snapshot={"goalId": goal.id, "goalVersion": goal.version, "successStreak": state["successStreak"], "targetRetryStreak": state["targetRetryStreak"], "ruleIds": [r.id for r in rules]}))
    drafts = output.events
    if not output.next_item and not output.session_complete:
        plan = db.get(TrainingPlan, session.plan_id).plan_json
        next_stage_index = state["stageIndex"] + 1
        if next_stage_index < len(plan["stages"]):
            stage = plan["stages"][next_stage_index]
            output.next_item = {**stage["items"][0], "beamTargetMs": output.beam_target_ms} if stage["game"] == "magic_beam" else stage["items"][0]
            output.queue = stage["items"][1:]
            output.advanced = True
            if stage["game"] == "monster_tower":
                output.next_level = stage["level"]
                output.resume_item = None
                output.success_streak = 0
                output.target_retry_streak = 0
                output.pending_big_attack = False
            state["stageIndex"] = next_stage_index
            drafts.append({"type": "STAGE_START", "payload": {"stageIndex": next_stage_index, "game": stage["game"], "itemCount": len(stage["items"])}})
        else:
            output.session_complete = True
            drafts.append({"type": "SESSION_COMPLETE", "payload": {"totalXp": 0, "badges": [], "monsterCards": []}})
    if output.next_item and (output.advanced or output.next_item["itemId"] != item["itemId"]):
        drafts.append({"type": "TARGET_PRESENTED", "payload": {"item": output.next_item}})
    xp = sum(e["payload"].get("xp", 0) for e in drafts)
    for draft in drafts:
        if draft["type"] == "SESSION_COMPLETE":
            draft["payload"].update(totalXp=state["xp"] + xp, badges=db.get(Child, session.child_id).collection_json.get("badges", []), monsterCards=db.get(Child, session.child_id).collection_json.get("monsterCards", []))
    advanced = output.advanced or bool(output.next_item and output.next_item["itemId"] != item["itemId"])
    state.update({"currentLevel": output.next_level, "queue": output.queue, "resumeItem": output.resume_item, "successStreak": output.success_streak, "targetRetryStreak": output.target_retry_streak, "currentItem": output.next_item, "itemAttempt": 1 if advanced else state["itemAttempt"] + (analysis.result != "no_speech"), "totalAttempts": total, "xp": state["xp"] + xp, "nextSlot": output.next_slot, "beamTargetMs": output.beam_target_ms, "pendingBigAttack": output.pending_big_attack})
    state.pop("voicedMs", None)
    session.runtime_state = state
    events = save_events(db, session, drafts, utterance.id, item, goal, analysis)
    db.commit()
    return {"events": events, "nextItem": output.next_item, "nextAttemptIndex": state["itemAttempt"], "sessionComplete": output.session_complete}


@app.post("/api/play/sessions/{session_id}/complete")
def complete(session_id: str, body: CompleteInput, x_play_token: str | None = Header(default=None), db: Session = Depends(get_db)):
    session = play_session(db, session_id, x_play_token)
    child = db.get(Child, session.child_id)
    if session.status == "completed":
        return session.summary_json
    goal = db.get(TrainingGoal, session.goal_id)
    state = session.runtime_state
    metric = recompute(db, session, goal, body.elapsed_sec)
    recommend(db, session, goal, metric)
    child.xp += state.get("xp", 0)
    utterances = db.execute(select(Utterance, SpeechAnalysis).join(SpeechAnalysis, SpeechAnalysis.utterance_id == Utterance.id).where(Utterance.session_id == session.id)).all()
    stages = db.get(TrainingPlan, session.plan_id).plan_json["stages"]
    stats = {"monsterStagesCleared": sum(stage["game"] == "monster_tower" for stage in stages[:state["stageIndex"] + 1]), "beamSuccesses": sum(u.game == "magic_beam" and a.final_result == "success" for u, a in utterances), "retryThenSuccessCount": sum(u.game != "magic_beam" and u.attempt_index > 1 and a.final_result == "success" for u, a in utterances)}
    collection, new_badges, new_cards = award(child.collection_json, stats)
    child.collection_json = collection
    summary = {"totalXp": state.get("xp", 0), "heroLevel": child.xp // 100 + 1, "badges": collection["badges"], "monsterCards": collection["monsterCards"], "newBadges": new_badges, "newMonsterCards": new_cards, "levelDownCount": metric.level_down_count, "durationSec": body.elapsed_sec}
    session.summary_json = summary
    session.insight_json = generate_insights(db, session, goal, metric)
    session.status, session.ended_at = "completed", now()
    db.commit()
    return summary


@app.get("/api/play/children/{play_code}/profile")
def play_profile(play_code: str, db: Session = Depends(get_db)):
    child = db.scalar(select(Child).where(Child.play_code == play_code.upper()))
    if not child:
        raise HTTPException(404)
    collection = child.collection_json or {}
    return {"heroName": child.hero_name, "heroLevel": child.xp // 100 + 1, "xp": child.xp, "badges": collection.get("badges", []), "monsterCards": collection.get("monsterCards", []), "mapProgress": len(db.scalars(select(TrainingSession).where(TrainingSession.child_id == child.id, TrainingSession.status == "completed")).all())}


@app.get("/api/dashboard/overview")
def overview(db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    children = db.scalars(select(Child).where(Child.therapist_id == therapist.id)).all()
    child_ids = [c.id for c in children]
    sessions = db.scalars(select(TrainingSession).where(TrainingSession.child_id.in_(child_ids)).order_by(TrainingSession.started_at.desc()).limit(10)).all() if child_ids else []
    pending = db.scalars(select(AIRecommendation).where(AIRecommendation.child_id.in_(child_ids), AIRecommendation.status == "pending")).all() if child_ids else []
    return {"activeChildren": [{**child_data(c), "currentGoal": goal_data(current_goal(db, c.id)), "pendingRecommendations": sum(r.child_id == c.id for r in pending)} for c in children], "recentSessions": [{"id": s.id, "childId": s.child_id, "mode": s.mode, "isSeed": s.is_seed, "startedAt": s.started_at, "status": s.status} for s in sessions], "pendingRecommendations": [rec_data(r) for r in pending]}


@app.get("/api/children/{child_id}/recommendations")
def recommendations(child_id: str, status: str | None = None, db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    owned_child(db, child_id, therapist)
    query = select(AIRecommendation).where(AIRecommendation.child_id == child_id)
    if status:
        query = query.where(AIRecommendation.status == status)
    return [rec_data(r) for r in db.scalars(query.order_by(AIRecommendation.created_at.desc())).all()]


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
    return {"session": {"id": session.id, "mode": session.mode, "isSeed": session.is_seed, "status": session.status, "startedAt": session.started_at, "endedAt": session.ended_at, "durationSec": session.summary_json.get("durationSec"), "goalVersion": goal.version, "summary": session.summary_json}, "goal": goal_data(goal), "plan": db.get(TrainingPlan, session.plan_id).plan_json, "utterances": [{"id": u.id, "itemText": u.item_text, "level": u.level, "game": u.game, "recognizer": u.recognizer, "stageIndex": u.stage_index, "acoustic": u.acoustic, "createdAt": u.created_at, "transcript": u.transcript, "attemptIndex": u.attempt_index, "analysis": public(db.scalar(select(SpeechAnalysis).where(SpeechAnalysis.utterance_id == u.id)), ["ai_score", "ai_result", "final_score", "final_result", "target_status", "substitute_symbol", "pattern_tags", "therapist_override", "rule_applied_id", "method"])} for u in utterances], "decisions": [public(d, ["id", "decision_type", "reason_codes", "reason_text", "inputs_snapshot", "from_level", "to_level"]) for d in decisions], "events": [public(e, ["id", "type", "payload", "therapist_text", "utterance_id", "created_at"]) for e in events], "metrics": [public(m, ["attempts", "successes", "retries", "hints", "first_try_success_rate", "mean_score", "level_down_count"]) for m in metrics], "insight": session.insight_json, "recommendations": [rec_data(r) for r in recs], "activeRules": [public(r, ["id", "rule_type", "params"]) for r in rules]}


@app.get("/api/children/{child_id}/progress")
def progress(child_id: str, limit: int = 20, db: Session = Depends(get_db), therapist: Therapist = Depends(therapist_auth)):
    owned_child(db, child_id, therapist)
    rows = db.execute(select(TrainingSession, ProgressMetric, TrainingGoal).join(ProgressMetric, ProgressMetric.session_id == TrainingSession.id).join(TrainingGoal, TrainingGoal.id == TrainingSession.goal_id).where(TrainingSession.child_id == child_id, ProgressMetric.level == "all").order_by(TrainingSession.started_at.desc()).limit(limit)).all()[::-1]
    sessions = []
    word_performance = {}
    for index, (s, m, g) in enumerate(rows, 1):
        sessions.append({"sessionId": s.id, "index": index, "date": s.started_at.isoformat(), "mode": s.mode, "isSeed": s.is_seed, "goalVersion": g.version, "phoneme": g.target_phoneme, "firstTrySuccessRate": m.first_try_success_rate, "successRate": m.success_rate, "meanScore": m.mean_score, "aiMeanScore": m.ai_mean_score, "retryRate": round(100 * m.retries / max(1, m.attempts), 1), "hintRate": round(100 * m.hints / max(1, m.attempts), 1), "noSpeechRate": round(100 * m.no_speech / max(1, m.attempts + m.no_speech), 1), "levelMix": {"syllable": 0, "word": 0, "short_sentence": 0}, "durationSec": m.duration_sec})
        for u, a in db.execute(select(Utterance, SpeechAnalysis).join(SpeechAnalysis, SpeechAnalysis.utterance_id == Utterance.id).where(Utterance.session_id == s.id)).all():
            if u.level in sessions[-1]["levelMix"]:
                sessions[-1]["levelMix"][u.level] += 1
            if u.game != "magic_beam":
                data = word_performance.setdefault(u.item_text, {"text": u.item_text, "phoneme": g.target_phoneme, "scores": [], "retries": 0, "patternTags": []})
                data["scores"].append(a.final_score)
                data["retries"] += a.final_result == "retry"
                data["patternTags"].extend(a.pattern_tags)
    series = [{"phoneme": p, "points": [{"sessionIndex": s["index"], "successRate": s["successRate"]} for s in sessions if s["phoneme"] == p]} for p in ("ㅅ", "ㅈ", "ㄹ")]
    words = [{"text": d["text"], "phoneme": d["phoneme"], "meanScore": round(sum(d["scores"]) / len(d["scores"]), 1), "attempts": len(d["scores"]), "retries": d["retries"], "patternTags": sorted(set(d["patternTags"]))} for d in word_performance.values()]
    goals = db.scalars(select(TrainingGoal).where(TrainingGoal.child_id == child_id).order_by(TrainingGoal.version)).all()
    interventions = []
    for goal in goals[1:]:
        before = [s["firstTrySuccessRate"] for s in sessions if s["goalVersion"] == goal.version - 1][-2:]
        after = [s["firstTrySuccessRate"] for s in sessions if s["goalVersion"] == goal.version][:2]
        b = round(sum(before) / len(before), 1) if before else None
        a = round(sum(after) / len(after), 1) if after else None
        interventions.append({"goalVersion": goal.version, "at": goal.created_at.isoformat(), "source": goal.source, "summary": f"v{goal.version}: {goal.level}", "before": b, "after": a, "delta": round(a - b, 1) if a is not None and b is not None else None})
    return {"sessions": sessions, "phonemeSeries": series, "wordPerformance": words, "interventions": interventions}


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

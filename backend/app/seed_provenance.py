"""Phase 1 수정 전에 잘못 표시된 seed 출처 행 수리. 기본은 미리 보기이고 `apply_repair`만 DB를 바꾼다.

수정 전 코드는 seed(샘플) 아동의 회기를 is_seed=False로 저장할 수 있었다(PRODUCT_REALITY_MATRIX 1절).
- 그런 게임 회기·대화 회기를 is_seed=True로 고친다. 임상 근거·계획·추천 집계는 회기 표시로 판단하므로 자동으로 빠진다.
- 그 회기 관찰의 치료사 검토 상태(CONFIRMED·CORRECTED·REJECTED)는 지금 코드가 비임상 회기에 쓰는 DEMO_ 상태로 맞춘다.
- 치료사 검토 기록(ClinicalVerification)은 추가만 하는 기록이라 지우거나 바꾸지 않는다.
"""
import json

from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from .models import AuditEvent, Child, ClinicalObservation, HoyaChatSession, TrainingSession

VERIFIED_STATES = {"CONFIRMED", "CORRECTED", "REJECTED"}
REPAIR_ACTION = "SEED_PROVENANCE_REPAIR"


def plan_repair(db: Session) -> dict:
    """바꿀 행만 찾는다. DB는 바꾸지 않는다. 예전 스키마 DB에 없는 표는 건너뛰고 missingTables에 적는다."""
    tables = set(inspect(db.get_bind()).get_table_names())
    missing = sorted({"children", "training_sessions", "hoya_chat_sessions", "clinical_observations"} - tables)
    seed_children = select(Child.id).where(Child.is_seed.is_(True))
    sessions = db.scalars(select(TrainingSession.id).where(
        TrainingSession.child_id.in_(seed_children), TrainingSession.is_seed.is_(False))).all()         if {"children", "training_sessions"} <= tables else []
    chats = db.scalars(select(HoyaChatSession.id).where(
        HoyaChatSession.child_id.in_(seed_children), HoyaChatSession.is_seed.is_(False))).all()         if {"children", "hoya_chat_sessions"} <= tables else []
    observations = db.execute(select(ClinicalObservation.id, ClinicalObservation.verification_state).where(
        ClinicalObservation.session_id.in_(sessions),
        ClinicalObservation.verification_state.in_(VERIFIED_STATES))).all() if sessions and "clinical_observations" in tables else []
    return {"trainingSessions": sorted(sessions), "chatSessions": sorted(chats), "missingTables": missing,
            "observations": sorted((row_id, state, f"DEMO_{state}") for row_id, state in observations)}


def summary(plan: dict) -> dict:
    states = {}
    for _row_id, old, new in plan["observations"]:
        states[f"{old}->{new}"] = states.get(f"{old}->{new}", 0) + 1
    return {"trainingSessions": len(plan["trainingSessions"]), "chatSessions": len(plan["chatSessions"]),
            "observationStates": states, "missingTables": plan["missingTables"]}


def apply_repair(db: Session) -> dict:
    """한 트랜잭션 안에서 부른다. 다시 실행해도 바뀔 것이 없으면 아무것도 하지 않는다(멱등)."""
    plan = plan_repair(db)
    counts = summary(plan)
    if not (plan["trainingSessions"] or plan["chatSessions"]):
        return counts
    for session in db.scalars(select(TrainingSession).where(TrainingSession.id.in_(plan["trainingSessions"]))):
        session.is_seed = True
    for chat in db.scalars(select(HoyaChatSession).where(HoyaChatSession.id.in_(plan["chatSessions"]))):
        chat.is_seed = True
    new_states = {row_id: new for row_id, _old, new in plan["observations"]}
    for observation in db.scalars(select(ClinicalObservation).where(ClinicalObservation.id.in_(new_states))):
        observation.verification_state = new_states[observation.id]
    db.add(AuditEvent(actor_id="system", action=REPAIR_ACTION, resource_id="seed-provenance",
                      result=json.dumps(counts, ensure_ascii=False)[:500]))
    return counts

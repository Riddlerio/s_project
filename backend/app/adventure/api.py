"""두두 모험 API. 기존 인증·CSRF·소유권 의존성을 그대로 적용한다."""
from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import owned_child, require_student, require_therapist
from ..db import get_db
from ..models import Account, ActivityLease, Therapist, TrainingSession
from ..session_state import activity_state, state_guard
from . import service
from .schemas import ClaimInput, CraftInput, SkillDecisionInput

router = APIRouter(prefix="/api")


@router.get("/children/{child_id}/skills/magic_beam")
def get_skill(child_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(require_therapist)):
    owned_child(db, child_id, therapist)
    return service.skill_status(db, child_id)


def _decision(child_id, body, db, therapist, action):
    service.serialize_child(db, child_id)
    owned_child(db, child_id, therapist)
    result = service.decide_skill(db, child_id, therapist, action, body)
    db.commit()
    return result


@router.post("/children/{child_id}/skills/magic_beam/grant")
def grant_skill(child_id: str, body: SkillDecisionInput, db: Session = Depends(get_db),
                therapist: Therapist = Depends(require_therapist)):
    return _decision(child_id, body, db, therapist, "GRANT")


@router.post("/children/{child_id}/skills/magic_beam/revoke")
def revoke_skill(child_id: str, body: SkillDecisionInput, db: Session = Depends(get_db),
                 therapist: Therapist = Depends(require_therapist)):
    return _decision(child_id, body, db, therapist, "REVOKE")


@router.get("/me/skills")
def my_skills(db: Session = Depends(get_db), account: Account = Depends(require_student)):
    return {"magicBeam": service.has_magic_beam(db, account.child_id)}


@router.get("/me/adventure")
def my_adventure(db: Session = Depends(get_db), account: Account = Depends(require_student)):
    return service.inventory(db, account.child_id)


@router.post("/me/adventure/craft")
def make_food(body: CraftInput, db: Session = Depends(get_db), account: Account = Depends(require_student)):
    child_id = account.child_id
    service.serialize_child(db, child_id)
    result = service.craft(db, child_id, body)
    db.commit()
    return result


@router.get("/me/activities/active")
@state_guard
def active_activities(db: Session = Depends(get_db), account: Account = Depends(require_student)):
    sessions = db.scalars(select(TrainingSession).where(TrainingSession.child_id == account.child_id,
                                                       TrainingSession.status == "active")
                          .order_by(TrainingSession.started_at.desc())).all()
    activities = []
    for session in sessions:
        if "activityGame" not in (session.runtime_state or {}):
            continue
        state = activity_state(session)
        complete = bool(state.get("roundsComplete"))
        activities.append({"sessionId": session.id, "game": state["activityGame"], "mode": session.mode,
                           "roundIndex": state["roundIndex"],
                           "completedRounds": list(range(1, 6 if complete else state["roundIndex"])),
                           "paused": service.lease_paused(db.get(ActivityLease, session.id))})
    return {"activities": activities}


@router.post("/activities/{session_id}/claim")
@state_guard
def claim(session_id: str, body: ClaimInput, db: Session = Depends(get_db),
          account: Account = Depends(require_student), x_activity_lease: str | None = Header(default=None)):
    child_id = account.child_id
    service.serialize_child(db, child_id)
    session = service.owned_activity(db, session_id, child_id)
    result = service.claim_activity(db, session, x_activity_lease, body.takeover)
    db.commit()
    return result


@router.post("/activities/{session_id}/heartbeat")
@state_guard
def heartbeat(session_id: str, db: Session = Depends(get_db), account: Account = Depends(require_student),
              x_activity_lease: str | None = Header(default=None)):
    child_id = account.child_id
    service.serialize_child(db, child_id)
    session = service.owned_activity(db, session_id, child_id)
    service.heartbeat(db, session, x_activity_lease)
    db.commit()
    return {"ok": True}


@router.post("/activities/{session_id}/pause")
@state_guard
def pause(session_id: str, db: Session = Depends(get_db), account: Account = Depends(require_student),
          x_activity_lease: str | None = Header(default=None)):
    child_id = account.child_id
    service.serialize_child(db, child_id)
    session = service.owned_activity(db, session_id, child_id)
    service.pause(db, session, x_activity_lease)
    db.commit()
    return {"ok": True}

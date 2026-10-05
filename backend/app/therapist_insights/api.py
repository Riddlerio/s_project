from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import owned_child, require_therapist
from ..db import get_db
from ..models import Therapist, TrainingSession
from .conversation import conversation_insights
from .service import goal_trends, session_insights

router = APIRouter(prefix="/api", tags=["therapist-insights"])


@router.get("/children/{child_id}/goal-trends")
def read_goal_trends(child_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(require_therapist)):
    child = owned_child(db, child_id, therapist)
    return goal_trends(db, child)


@router.get("/sessions/{session_id}/insights")
def read_session_insights(session_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(require_therapist)):
    session = db.get(TrainingSession, session_id)
    if session is None:
        raise HTTPException(404, "회기를 찾을 수 없습니다")
    child = owned_child(db, session.child_id, therapist)
    return session_insights(db, child, session)


@router.get("/children/{child_id}/conversation-insights")
def read_child_conversation_insights(child_id: str, db: Session = Depends(get_db),
                                     therapist: Therapist = Depends(require_therapist)):
    child = owned_child(db, child_id, therapist)
    return conversation_insights(db, child)


@router.get("/sessions/{session_id}/conversation-insights")
def read_game_child_conversation_insights(session_id: str, db: Session = Depends(get_db),
                                          therapist: Therapist = Depends(require_therapist)):
    session = db.get(TrainingSession, session_id)
    if session is None:
        raise HTTPException(404, "회기를 찾을 수 없습니다")
    child = owned_child(db, session.child_id, therapist)
    return conversation_insights(db, child)

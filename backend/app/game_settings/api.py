from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..adventure.service import serialize_child
from ..auth import owned_child, require_therapist
from ..db import get_db
from ..models import Therapist
from .schemas import GameSettingsInput
from .service import game_settings, update_game_settings

router = APIRouter(prefix="/api/therapist/children", tags=["game-settings"])


@router.get("/{child_id}/game-settings")
def read_game_settings(child_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(require_therapist)):
    owned_child(db, child_id, therapist)
    return game_settings(db, child_id)


@router.put("/{child_id}/game-settings")
def save_game_settings(child_id: str, body: GameSettingsInput, db: Session = Depends(get_db),
                       therapist: Therapist = Depends(require_therapist)):
    owned_child(db, child_id, therapist)
    serialize_child(db, child_id)
    result = update_game_settings(db, child_id, therapist, body.daeguCrossing)
    db.commit()
    return result

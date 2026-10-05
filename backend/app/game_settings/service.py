from datetime import timezone

from ..models import AuditEvent, Therapist, now
from .models import ChildGameSettings
from .schemas import DEFAULT_ALLOW_FASTER, DEFAULT_START_BPM


def rhythm_snapshot(db, child_id):
    row = db.get(ChildGameSettings, child_id)
    return {"startBpm": row.start_bpm if row else DEFAULT_START_BPM,
            "allowFaster": row.allow_faster if row else DEFAULT_ALLOW_FASTER}


def game_settings(db, child_id):
    row = db.get(ChildGameSettings, child_id)
    therapist = db.get(Therapist, row.updated_by) if row else None
    at = row.updated_at.replace(tzinfo=timezone.utc) if row and row.updated_at.tzinfo is None else row.updated_at if row else None
    return {"daeguCrossing": {**rhythm_snapshot(db, child_id),
                              "updatedAt": at.isoformat() if at else None,
                              "updatedBy": therapist.display_name if therapist else None}}


def update_game_settings(db, child_id, therapist, rhythm):
    therapist_id = therapist.id
    row = db.get(ChildGameSettings, child_id)
    if row is not None and row.start_bpm == rhythm.startBpm and row.allow_faster == rhythm.allowFaster:
        return game_settings(db, child_id)
    if row is None:
        row = ChildGameSettings(child_id=child_id)
        db.add(row)
    row.start_bpm = rhythm.startBpm
    row.allow_faster = rhythm.allowFaster
    row.updated_at = now()
    row.updated_by = therapist_id
    db.add(AuditEvent(actor_id=therapist_id, action="GAME_SETTINGS_UPDATE", resource_id=child_id, result="SUCCESS"))
    db.flush()
    return game_settings(db, child_id)

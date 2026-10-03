"""스킬 권한·진행 기기·참여 재료를 임상 평가와 분리해 저장한다."""
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..games.rounds import GAME_ROUNDS, public_round
from ..models import (ActivityLease, AuditEvent, Child, CraftEvent, EpisodeProgress,
                      RoundMaterialReward, SkillGrant, Therapist, TrainingSession, now)
from ..security import hash_token
from ..session_state import activity_state

LEASE_TIMEOUT_SEC = 45


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def serialize_child(db: Session, child_id: str):
    """SQLite에서는 읽기 전에 쓰기 예약을 잡는다. 다른 DB는 아동 행 잠금으로 직렬화한다."""
    connection = db.connection()
    if connection.dialect.name == "sqlite":
        # 인증 의존성의 SELECT는 SQLAlchemy 논리 transaction만 연다.
        # 이미 실제 transaction이면 쓰기 예약을 보유한 호출자의 transaction을 유지한다.
        if not connection.connection.driver_connection.in_transaction:
            connection.exec_driver_sql("BEGIN IMMEDIATE")
    else:
        db.execute(select(Child).where(Child.id == child_id).with_for_update())
    db.expire_all()


def skill_events(db, child_id):
    return db.scalars(select(SkillGrant).where(SkillGrant.child_id == child_id,
                                              SkillGrant.skill == "magic_beam")
                      .order_by(SkillGrant.created_at.desc(), SkillGrant.id.desc())).all()


def has_magic_beam(db, child_id):
    events = skill_events(db, child_id)
    return bool(events and events[0].action == "GRANT")


def skill_status(db, child_id):
    events = skill_events(db, child_id)
    latest = events[0] if events else None
    granted = bool(latest and latest.action == "GRANT")
    def therapist_name(event):
        therapist = db.get(Therapist, event.therapist_id)
        return therapist.display_name if therapist else "치료사"
    return {"skill": "magic_beam", "granted": granted,
            "therapistName": therapist_name(latest) if latest else None,
            "grantedAt": utc(latest.created_at).isoformat() if granted else None,
            "evidenceKind": latest.evidence_kind if latest else None,
            "note": latest.note if latest else "",
            "history": [{"action": event.action, "therapistName": therapist_name(event),
                         "at": utc(event.created_at).isoformat(),
                         "evidenceKind": event.evidence_kind, "note": event.note} for event in events]}


def decide_skill(db, child_id, therapist, action, body):
    granted = has_magic_beam(db, child_id)
    if granted == (action == "GRANT"):
        return skill_status(db, child_id)
    event = SkillGrant(child_id=child_id, therapist_id=therapist.id, skill="magic_beam",
                       action=action, evidence_kind=body.evidence_kind, note=body.note)
    db.add(event)
    db.flush()
    db.add(AuditEvent(actor_id=therapist.id, action="SKILL_" + action,
                      resource_id=child_id, result="SUCCESS"))
    db.flush()
    return skill_status(db, child_id)


def round_magic_beam(db, state, child_id):
    """새 라운드를 열 때의 승인 상태. 라운드가 끝날 때까지 이 값을 유지한다."""
    return state.get("activityGame") == "monster_adventure" and has_magic_beam(db, child_id)


def magic_beam_available(db, state, child_id):
    """이번 라운드에서 매직빔을 고를 수 있는지. 승인은 즉시, 철회는 다음 라운드부터 적용한다."""
    return state.get("activityGame") == "monster_adventure" and (
        bool(state.get("magicBeamRound")) or has_magic_beam(db, child_id))


def check_attack(db, session, state, attack):
    available = magic_beam_available(db, state, session.child_id)
    if available:
        # 라운드 도중 승인됐더라도 아이가 본 선택지는 그 라운드가 끝날 때까지 유지한다.
        state["magicBeamRound"] = True
    if attack == "basic":
        return
    if state.get("activityGame") != "monster_adventure":
        raise HTTPException(422, "매직빔 전투 스킬은 몬스터 모험에서 사용할 수 있습니다")
    if not available:
        raise HTTPException(403, "치료사가 승인한 스킬이 아닙니다")


def owned_activity(db, session_id, child_id):
    session = db.get(TrainingSession, session_id)
    if not session or session.child_id != child_id:
        raise HTTPException(404, "세션을 찾을 수 없습니다")
    activity_state(session)
    if session.status != "active":
        raise HTTPException(409, "활성 게임이 아닙니다")
    return session


def lease_paused(lease, at=None):
    at = at or now()
    return bool(lease and (lease.paused_at is not None or
                           (utc(at) - utc(lease.heartbeat_at)).total_seconds() >= LEASE_TIMEOUT_SEC))


def check_lease(db, session, token, *, allow_paused=False):
    lease = db.get(ActivityLease, session.id)
    if lease is None:
        return None  # 이전 API·개발 DB는 claim 이후에 한 기기 진행 계약을 적용한다.
    if not token or not hmac.compare_digest(hash_token(token), lease.token_hash):
        raise HTTPException(409, "다른 기기에서 진행 중입니다. 이어받기를 선택해 주세요")
    if not allow_paused and lease_paused(lease):
        raise HTTPException(409, "중단된 모험을 다시 이어받아 주세요")
    return lease


def accrue_active_time(lease, session, at):
    if lease.paused_at is None and not session.runtime_state.get("roundsComplete"):
        elapsed = (utc(at) - utc(lease.heartbeat_at)).total_seconds()
        if 0 <= elapsed < LEASE_TIMEOUT_SEC:
            lease.active_elapsed_sec = (lease.active_elapsed_sec or 0.0) + elapsed


def activity_payload(db, session):
    state = activity_state(session)
    game = state["activityGame"]
    child = db.get(Child, session.child_id)
    complete = bool(state.get("roundsComplete"))
    return {"sessionId": session.id, "game": game, "mode": session.mode,
            "heroName": child.hero_name,
            "rounds": [public_round(definition) for definition in GAME_ROUNDS[game]],
            "currentRound": public_round(GAME_ROUNDS[game][state["roundIndex"] - 1], state["difficulty"]),
            "firstItem": state["currentItem"], "nextAttemptIndex": state["roundAttempt"],
            "completedRounds": list(range(1, 6 if complete else state["roundIndex"])),
            "sessionComplete": complete,
            "magicBeamAvailable": not complete and magic_beam_available(db, state, session.child_id)}


def claim_activity(db, session, token, takeover):
    lease = db.get(ActivityLease, session.id)
    at = now()
    if lease is not None:
        matches = bool(token and hmac.compare_digest(hash_token(token), lease.token_hash))
        if not matches and not takeover:
            raise HTTPException(409, "다른 기기에서 진행 중입니다. 이어받기를 선택해 주세요")
        # 이어받기는 입력을 새로 여는 경계다. 마지막 서버 확인 이후 공백은
        # 짧은 연결 끊김이라도 참여 시간으로 추정하지 않는다.
        pause_start = lease.paused_at or lease.heartbeat_at
        if pause_start is not None and not session.runtime_state.get("roundsComplete"):
            state = activity_state(session)
            paused_seconds = max(0.0, (utc(at) - utc(pause_start)).total_seconds())
            started = datetime.fromisoformat(state["roundStartedAt"])
            state["roundStartedAt"] = (utc(started) + timedelta(seconds=paused_seconds)).isoformat()
            session.runtime_state = state
        lease.paused_at = None
        lease.heartbeat_at = at
    else:
        # 이전 버전에는 중단 시각이 없다. 승인된 정책대로 현재 라운드
        # 시간만 새로 시작하고 항목·시도·완료 라운드는 그대로 둔다.
        if not session.runtime_state.get("roundsComplete"):
            state = activity_state(session)
            state["roundStartedAt"] = at.isoformat()
            session.runtime_state = state
        lease = ActivityLease(session_id=session.id, child_id=session.child_id,
                              token_hash="", heartbeat_at=at, active_elapsed_sec=0.0)
        db.add(lease)
    issued = secrets.token_urlsafe(32)
    lease.token_hash = hash_token(issued)
    db.flush()
    return {**activity_payload(db, session), "leaseToken": issued}


def heartbeat(db, session, token):
    lease = check_lease(db, session, token)
    if lease is None:
        raise HTTPException(409, "모험을 먼저 이어받아 주세요")
    at = now()
    accrue_active_time(lease, session, at)
    lease.heartbeat_at = at


def pause(db, session, token):
    lease = check_lease(db, session, token, allow_paused=True)
    if lease is None:
        raise HTTPException(409, "모험을 먼저 이어받아 주세요")
    if lease.paused_at is None:
        at = now()
        expired = lease_paused(lease, at)
        accrue_active_time(lease, session, at)
        lease.paused_at = lease.heartbeat_at if expired else at
        lease.heartbeat_at = at


def progress(db, child_id, *, create=False):
    row = db.get(EpisodeProgress, child_id)
    if row is None and create:
        row = EpisodeProgress(child_id=child_id, inventory_json={"rice": 0, "tuna": 0},
                              crafted_json={"tunaSushi": 0})
        db.add(row)
        db.flush()
    return row


def inventory(db, child_id):
    row = progress(db, child_id)
    return {"inventory": {"rice": (row.inventory_json if row else {}).get("rice", 0),
                          "tuna": (row.inventory_json if row else {}).get("tuna", 0)},
            "crafted": {"tunaSushi": (row.crafted_json if row else {}).get("tunaSushi", 0)}}


def award_material(db, session, round_index):
    material = {"magic_beam": "rice", "monster_adventure": "tuna"}.get(session.runtime_state["activityGame"])
    if round_index not in {2, 4} or material is None:
        return None
    previous = db.scalar(select(RoundMaterialReward).where(
        RoundMaterialReward.session_id == session.id, RoundMaterialReward.round_index == round_index))
    if previous:
        return previous.material
    row = progress(db, session.child_id, create=True)
    row.inventory_json = {**row.inventory_json, material: row.inventory_json.get(material, 0) + 1}
    db.add(RoundMaterialReward(child_id=session.child_id, session_id=session.id,
                              round_index=round_index, material=material))
    db.flush()
    return material


def materials_earned(db, session_id):
    rows = db.scalars(select(RoundMaterialReward).where(RoundMaterialReward.session_id == session_id)).all()
    return {"rice": sum(row.material == "rice" for row in rows), "tuna": sum(row.material == "tuna" for row in rows)}


def remove_session_links(db, session_ids):
    """기존 발화 자료 삭제 API의 세션 삭제를 새 외래키가 막지 않도록 참조만 정리한다."""
    if session_ids:
        db.execute(delete(ActivityLease).where(ActivityLease.session_id.in_(session_ids)))
        db.execute(delete(RoundMaterialReward).where(RoundMaterialReward.session_id.in_(session_ids)))


def craft(db, child_id, body):
    previous = db.scalar(select(CraftEvent).where(CraftEvent.child_id == child_id,
                                                 CraftEvent.request_id == body.request_id))
    if previous:
        if previous.recipe != body.recipe:
            raise HTTPException(409, "같은 제작 요청 ID를 다른 물건에 사용할 수 없습니다")
        return previous.result_json
    row = progress(db, child_id, create=True)
    if row.inventory_json.get("rice", 0) < 1 or row.inventory_json.get("tuna", 0) < 1:
        raise HTTPException(409, "밥과 참치가 하나씩 필요해요")
    row.inventory_json = {**row.inventory_json, "rice": row.inventory_json["rice"] - 1,
                          "tuna": row.inventory_json["tuna"] - 1}
    row.crafted_json = {**row.crafted_json, "tunaSushi": row.crafted_json.get("tunaSushi", 0) + 1}
    result = inventory(db, child_id)
    db.add(CraftEvent(child_id=child_id, request_id=body.request_id, recipe=body.recipe,
                     result_json=result))
    db.flush()
    return result

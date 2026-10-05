"""명시적으로 만든 로컬 DEMO 리허설 DB의 계정과 오늘 기록만 관리한다."""
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
import secrets

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from .models import (Account, ActivityLease, ActivityRecommendation, AIRecommendation, AuditEvent, Child,
                     ClinicalObservation, ClinicalVerification, GameEvent, HoyaChatSession, HoyaChatTurn,
                     ProgressMetric, RoundMaterialReward, SpeechAnalysis, Therapist, TherapistFeedback,
                     TrainingDecision, TrainingGoal, TrainingSession, Utterance, now)
from .security import hash_password

THERAPIST_USERNAME = "demo-showcase"
PLAY_CODE = "DEMO-CROSSING"
CHILD_CODE = "DEMO-CROSSING-01"
DEMO_PASSWORD = "speechhero"
PROVISION_ACTION = "DEMO_REHEARSAL_PROVISIONED_V1"
PROVISION_RESULT = "LOCAL_DEMO_ONLY"
SEOUL = timezone(timedelta(hours=9), "Asia/Seoul")


class DemoSafetyError(ValueError):
    """DEMO 전용임을 증명할 수 없으면 쓰기를 거부한다."""


def local_database_path(value: str | Path) -> Path:
    raw = str(value)
    if raw.startswith(("//", "\\\\")) or "://" in raw:
        raise DemoSafetyError("네트워크·DB URL 대신 로컬 SQLite 파일 경로를 지정하세요.")
    path = Path(raw).expanduser().resolve()
    if path.drive.startswith("\\\\") or any(":" in part for part in path.parts[1:]):
        raise DemoSafetyError("네트워크 경로·대체 스트림은 허용하지 않습니다.")
    if path.suffix.lower() not in {".db", ".sqlite", ".sqlite3"}:
        raise DemoSafetyError("로컬 SQLite 파일 확장자(.db, .sqlite, .sqlite3)가 필요합니다.")
    return path


def _require_demo(db: Session, demo_enabled: bool) -> None:
    if not demo_enabled:
        raise DemoSafetyError("SEED_DEMO_DATA=true에서만 DEMO 리허설 자료를 변경할 수 있습니다.")
    bind = db.get_bind()
    if bind.dialect.name != "sqlite" or not bind.url.database or bind.url.database == ":memory:" or bind.url.query:
        raise DemoSafetyError("명시적으로 지정한 로컬 SQLite 파일 DB만 허용합니다.")
    if not local_database_path(bind.url.database).is_file():
        raise DemoSafetyError("기존 로컬 SQLite 파일이 필요합니다.")


def _identity(db: Session) -> Child:
    markers = db.scalars(select(AuditEvent).where(AuditEvent.action == PROVISION_ACTION)).all()
    if len(markers) != 1 or markers[0].result != PROVISION_RESULT:
        raise DemoSafetyError("전용 provision 기록이 없는 DB는 초기화할 수 없습니다.")
    marker = markers[0]
    child = db.get(Child, marker.resource_id)
    therapist = db.get(Therapist, marker.actor_id)
    accounts = db.scalars(select(Account).where(Account.username.in_([THERAPIST_USERNAME, PLAY_CODE]))).all()
    therapist_account = next((row for row in accounts if row.username == THERAPIST_USERNAME), None)
    student_account = next((row for row in accounts if row.username == PLAY_CODE), None)
    if (child is None or not child.is_seed or child.child_code != CHILD_CODE or child.play_code != PLAY_CODE
            or therapist is None or therapist.username != THERAPIST_USERNAME or child.therapist_id != therapist.id
            or therapist_account is None or therapist_account.role != "THERAPIST"
            or therapist_account.therapist_id != therapist.id or therapist_account.child_id is not None
            or student_account is None or student_account.role != "STUDENT"
            or student_account.child_id != child.id or student_account.therapist_id is not None):
        raise DemoSafetyError("DEMO 아동·계정·담당 치료사 소유권 표시가 일치하지 않습니다.")
    return child


def provision_demo_child(db: Session, *, demo_enabled: bool) -> dict:
    """새 전용 DB 초기화 과정에서 호출한다. 기존 seed를 변경하거나 기존 목표를 덮어쓰지 않는다."""
    _require_demo(db, demo_enabled)
    if db.scalar(select(AuditEvent.id).where(AuditEvent.action == PROVISION_ACTION)):
        child = _identity(db)
        return {"childId": child.id, "therapistId": child.therapist_id,
                "therapistUsername": THERAPIST_USERNAME, "studentUsername": PLAY_CODE}
    # 일반 자료가 섞인 DB를 DEMO DB로 승격하지 않는다.
    for model in (Child, TrainingSession, HoyaChatSession):
        if db.scalar(select(model.id).where(model.is_seed.is_(False)).limit(1)):
            raise DemoSafetyError("실제 대상·비샘플 기록이 있는 DB는 DEMO로 provision할 수 없습니다.")
    for model in (TrainingSession, HoyaChatSession):
        if db.scalar(select(model.id).where(model.mode != "demo").limit(1)):
            raise DemoSafetyError("실제 모드 기록이 있는 DB는 DEMO로 provision할 수 없습니다.")
    if (db.scalar(select(Therapist.id).where(Therapist.username == THERAPIST_USERNAME))
            or db.scalar(select(Account.id).where(Account.username.in_([THERAPIST_USERNAME, PLAY_CODE])))
            or db.scalar(select(Child.id).where(or_(Child.child_code == CHILD_CODE, Child.play_code == PLAY_CODE)))):
        raise DemoSafetyError("동일한 계정·아동 식별자가 이미 있어 덮어쓰지 않습니다.")
    salt = secrets.token_hex(16)
    therapist = Therapist(username=THERAPIST_USERNAME, display_name="시연 전용 DEMO 치료사",
                          password_salt=salt, password_hash=hash_password(DEMO_PASSWORD, salt))
    db.add(therapist)
    db.flush()
    child = Child(child_code=CHILD_CODE, hero_name="두두친구", therapist_id=therapist.id, play_code=PLAY_CODE,
                  guardian_consent_at=now(), is_seed=True)
    db.add(child)
    db.flush()
    student_salt = secrets.token_hex(16)
    db.add_all([
        Account(username=THERAPIST_USERNAME, role="THERAPIST", therapist_id=therapist.id,
                password_salt=salt, password_hash=therapist.password_hash),
        Account(username=PLAY_CODE, role="STUDENT", child_id=child.id,
                password_salt=student_salt, password_hash=hash_password(DEMO_PASSWORD, student_salt)),
        TrainingGoal(child_id=child.id, version=1, target_phoneme="ㅅ", target_sound="사", level="syllable",
                     min_level="syllable", preferred_cue="auditory_model", repetition_target=10,
                     source="demo_rehearsal", note="시연 전용 DEMO 목표. 실제 임상 자료가 아닙니다."),
        AuditEvent(actor_id=therapist.id, resource_id=child.id, action=PROVISION_ACTION, result=PROVISION_RESULT),
    ])
    db.flush()
    return {"childId": child.id, "therapistId": therapist.id,
            "therapistUsername": THERAPIST_USERNAME, "studentUsername": PLAY_CODE}


def _protect_references(db, child, session_ids, utterance_ids, observation_ids):
    # 다른 날짜·아동의 기록이 비정상적으로 같은 발화를 가리키더라도 함께 지우지 않는다.
    for model in (ClinicalObservation, ProgressMetric, RoundMaterialReward, ActivityLease):
        if db.scalar(select(model).where(model.session_id.in_(session_ids), model.child_id != child.id).limit(1)):
            raise DemoSafetyError("다른 아동의 기록이 삭제 대상 회기를 참조합니다.")
    observations = db.scalars(select(ClinicalObservation).where(
        or_(ClinicalObservation.session_id.in_(session_ids), ClinicalObservation.utterance_id.in_(utterance_ids)))).all()
    if any(row.session_id not in session_ids or row.utterance_id not in utterance_ids for row in observations):
        raise DemoSafetyError("관찰과 발화의 회기 소속이 일치하지 않습니다.")

    if any(row.verification_state not in {"PENDING", "DEMO_PENDING", "DEMO_CONFIRMED", "DEMO_CORRECTED", "DEMO_REJECTED"}
           for row in observations):
        raise DemoSafetyError("임상 검증 상태의 관찰은 DEMO 초기화에서 지우지 않습니다.")
    if db.scalar(select(ClinicalVerification.id).where(
            ClinicalVerification.observation_id.in_(observation_ids),
            ClinicalVerification.therapist_id != child.therapist_id).limit(1)):
        raise DemoSafetyError("다른 치료사의 검증 기록이 있어 초기화를 거부합니다.")
    for model in (GameEvent, TrainingDecision):
        if db.scalar(select(model.id).where(model.utterance_id.in_(utterance_ids),
                                           model.session_id.not_in(session_ids)).limit(1)):
            raise DemoSafetyError("다른 회기가 삭제 대상 발화를 참조합니다.")
    # 추천·피드백·목표는 초기화 범위가 아니다. 보존 자료의 근거 링크를 끊지 않는다.
    if (db.scalar(select(AIRecommendation.id).where(AIRecommendation.session_id.in_(session_ids)).limit(1))
            or db.scalar(select(TherapistFeedback.id).where(TherapistFeedback.utterance_id.in_(utterance_ids)).limit(1))):
        raise DemoSafetyError("삭제 대상에 연결된 추천·피드백이 있어 초기화를 거부합니다.")
    for rec in db.scalars(select(ActivityRecommendation)).all():
        if any(item.get("sessionId") in session_ids or item.get("observationId") in observation_ids
               for item in (rec.evidence or []) if isinstance(item, dict)):
            raise DemoSafetyError("활동 제안의 보존 근거가 삭제 대상 기록을 참조합니다.")


def reset_today(engine, *, demo_enabled: bool, current_time: datetime | None = None, include_mic: bool = False) -> dict:
    """한국시간 오늘 시작한 전용 아동의 seed·DEMO 회기만 한 트랜잭션에서 지운다.

    include_mic=True면 같은 전용 seed 아동의 오늘 마이크(real 모드) 회기도 지운다. 시연은 마이크로 하므로 리허설을
    반복할 때 쓴다. 전용 DB·전용 아동·seed·오늘·임상 검증 전 기록이라는 나머지 제한은 그대로다.
    """
    instant = current_time or now()
    if instant.tzinfo is None:
        raise DemoSafetyError("초기화 기준 시각에는 시간대가 필요합니다.")
    day = instant.astimezone(SEOUL).date()
    start = datetime.combine(day, time.min, tzinfo=SEOUL).astimezone(timezone.utc).replace(tzinfo=None)
    end = start + timedelta(days=1)
    with Session(engine) as db, db.begin():
        _require_demo(db, demo_enabled)
        # SQLite 쓰기 잠금으로 검증과 삭제 사이 다른 회기의 삽입·변경을 막는다.
        db.connection().exec_driver_sql("BEGIN IMMEDIATE")
        child = _identity(db)
        def today(model):
            modes = ("demo", "real") if include_mic else ("demo",)
            return (model.child_id == child.id, model.is_seed.is_(True), model.mode.in_(modes),
                    model.started_at >= start, model.started_at < end)
        session_ids = set(db.scalars(select(TrainingSession.id).where(*today(TrainingSession))).all())
        chat_ids = set(db.scalars(select(HoyaChatSession.id).where(*today(HoyaChatSession))).all())
        utterance_ids = set(db.scalars(select(Utterance.id).where(Utterance.session_id.in_(session_ids))).all())
        observation_ids = set(db.scalars(select(ClinicalObservation.id).where(
            ClinicalObservation.session_id.in_(session_ids))).all())
        _protect_references(db, child, session_ids, utterance_ids, observation_ids)
        counts = {}
        def remove(model, condition):
            counts[model.__tablename__] = db.execute(delete(model).where(condition)).rowcount
        remove(HoyaChatTurn, HoyaChatTurn.session_id.in_(chat_ids))
        remove(HoyaChatSession, HoyaChatSession.id.in_(chat_ids))
        remove(ClinicalVerification, ClinicalVerification.observation_id.in_(observation_ids))
        remove(ClinicalObservation, ClinicalObservation.id.in_(observation_ids))
        remove(SpeechAnalysis, SpeechAnalysis.utterance_id.in_(utterance_ids))
        remove(GameEvent, GameEvent.session_id.in_(session_ids))
        remove(TrainingDecision, TrainingDecision.session_id.in_(session_ids))
        remove(ProgressMetric, ProgressMetric.session_id.in_(session_ids))
        remove(RoundMaterialReward, RoundMaterialReward.session_id.in_(session_ids))
        remove(ActivityLease, ActivityLease.session_id.in_(session_ids))
        remove(Utterance, Utterance.id.in_(utterance_ids))
        remove(TrainingSession, TrainingSession.id.in_(session_ids))
        # 기존 감사 기록·계정·목표·실행 계획·소지품은 보존한다.
        db.add(AuditEvent(actor_id=child.therapist_id, resource_id=child.id,
                          action="DEMO_REHEARSAL_RESET", result=f"SEOUL_{day.isoformat()}"))
        return {"date": day.isoformat(), "timeZone": "Asia/Seoul", "childId": child.id, "includeMic": include_mic, "deleted": counts}

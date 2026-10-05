"""전용 DEMO 계정과 리허설 초기화의 날짜·출처·소유권·트랜잭션 경계를 검증한다."""
from datetime import datetime, timedelta, timezone
import importlib.util
from pathlib import Path

import pytest
from sqlalchemy import event, func, select
from sqlalchemy.orm import Session

from app import main as api_module
from app.db import Base, make_engine
from app.demo import demo_account, is_demo_account
from app.demo_seed import (CHILD_CODE, DEMO_PASSWORD, PLAY_CODE, PROVISION_ACTION, THERAPIST_USERNAME,
                           DemoSafetyError, provision_demo_child, reset_today)
from app.models import (Account, ActivityLease, ActivityRecommendation, AuditEvent, Child,
                        ClinicalObservation, ClinicalVerification, GameEvent, HoyaChatSession, HoyaChatTurn,
                        ProgressMetric, RoundMaterialReward, SpeechAnalysis, Therapist, TrainingDecision,
                        TrainingGoal, TrainingPlan, TrainingSession, Utterance)
from app.security import verify_password
from app.seed import seed
from app.therapist_planning.proposal import propose_plan
from app.clinical.activity_recommendation import propose_activity
from test_api_flow import api, auth
from test_therapist_planning import add_child, add_session

UTC = timezone.utc
TODAY = datetime(2026, 10, 5, 0, 30, tzinfo=UTC)
MIDNIGHT = datetime(2026, 10, 4, 15, tzinfo=UTC)


@pytest.fixture
def demo_db(tmp_path):
    engine = make_engine(f"sqlite:///{(tmp_path / 'rehearsal.db').as_posix()}")
    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    with Session(engine) as db, db.begin():
        identity = provision_demo_child(db, demo_enabled=True)
    yield engine, identity
    engine.dispose()


def game_record(db, child_id, started_at, *, mode="demo", is_seed=True):
    child = db.get(Child, child_id)
    goal = db.scalar(select(TrainingGoal).where(TrainingGoal.child_id == child_id))
    plan = TrainingPlan(child_id=child_id, goal_id=goal.id, plan_json={})
    db.add(plan)
    db.flush()
    session = TrainingSession(child_id=child_id, goal_id=goal.id, plan_id=plan.id, mode=mode, is_seed=is_seed,
                              play_token_hash="test", started_at=started_at)
    db.add(session)
    db.flush()
    utterance = Utterance(session_id=session.id, item_id="s", item_text="사", level="syllable",
                          game="daegu_crossing", recognizer="demo_script")
    db.add(utterance)
    db.flush()
    observation = ClinicalObservation(session_id=session.id, utterance_id=utterance.id, child_id=child_id,
                                      activity="daegu_crossing", target_phoneme="ㅅ", word_position="initial",
                                      generalization_level="SYLLABLE", attempt_number=1, cue_type="AUDITORY_MODEL",
                                      independence="MODELED", audio_quality="UNKNOWN", ai_result="success",
                                      ai_confidence="LOW", verification_state="DEMO_CONFIRMED")
    db.add(observation)
    db.flush()
    db.add_all([
        ClinicalVerification(observation_id=observation.id, therapist_id=child.therapist_id, action="confirm"),
        SpeechAnalysis(utterance_id=utterance.id, ai_result="success", target_status="observed", final_result="success"),
        GameEvent(session_id=session.id, utterance_id=utterance.id, type="TEST"),
        TrainingDecision(session_id=session.id, utterance_id=utterance.id, decision_type="TEST",
                         reason_codes=[], reason_text="시연"),
        ProgressMetric(child_id=child_id, session_id=session.id, goal_id=goal.id, phoneme="ㅅ", position="initial"),
        RoundMaterialReward(child_id=child_id, session_id=session.id, round_index=1, material="rice"),
        ActivityLease(session_id=session.id, child_id=child_id, token_hash="test"),
    ])
    return session.id, observation.id


def chat_record(db, child_id, started_at, *, mode="demo", is_seed=True):
    goal = db.scalar(select(TrainingGoal).where(TrainingGoal.child_id == child_id))
    chat = HoyaChatSession(child_id=child_id, goal_id=goal.id, mode=mode, is_seed=is_seed, started_at=started_at)
    db.add(chat)
    db.flush()
    db.add(HoyaChatTurn(session_id=chat.id, turn_index=1, recognizer="demo_script",
                       speech_evidence="TARGET_OBSERVED", strategy="FOLLOW_UP"))
    return chat.id


def row_counts(db):
    return {table.name: db.scalar(select(func.count()).select_from(table)) for table in Base.metadata.sorted_tables}


def test_provision_keeps_original_seed_and_uses_existing_demo_access_gate(api, monkeypatch):
    client, sessions = api
    with sessions() as db:
        original = {row.id: (row.hero_name, row.therapist_id) for row in db.scalars(select(Child)).all()}
        original_sessions = db.scalar(select(func.count()).select_from(TrainingSession))
        identity = provision_demo_child(db, demo_enabled=True)
        db.commit()
        child = db.get(Child, identity["childId"])
        goal = db.scalar(select(TrainingGoal).where(TrainingGoal.child_id == child.id))
        assert child.child_code == CHILD_CODE and child.hero_name == "두두친구" and child.is_seed
        assert (goal.target_phoneme, goal.level, goal.preferred_cue) == ("ㅅ", "syllable", "auditory_model")
        assert goal.repetition_target == 10
        own = db.scalars(select(Account).where(Account.username.in_([THERAPIST_USERNAME, PLAY_CODE]))).all()
        assert len(own) == 2 and all(is_demo_account(db, account) for account in own)
        assert all(verify_password(DEMO_PASSWORD, account.password_salt, account.password_hash) for account in own)
        assert child.therapist_id not in {value[1] for value in original.values()}
        assert demo_account(db, "THERAPIST").username == "demo"
        assert demo_account(db, "STUDENT").username == "HERO01"
        seed(db)  # 서버 재시작의 기존 seed는 새 목표·아동을 덮어쓰지 않는다.
        assert all((db.get(Child, key).hero_name, db.get(Child, key).therapist_id) == value
                   for key, value in original.items())
        assert db.scalar(select(func.count()).select_from(TrainingSession)) == original_sessions
        goal.level = "word"
        db.commit()
        again = provision_demo_child(db, demo_enabled=True)
        db.commit()
        assert again == identity and db.get(TrainingGoal, goal.id).level == "word"
    for username, endpoint in [(THERAPIST_USERNAME, "/api/children"), (PLAY_CODE, f"/api/play/children/{PLAY_CODE}/profile")]:
        monkeypatch.setattr(api_module.settings, "seed_demo_data", True)
        assert client.post("/api/auth/login", json={"username": username, "password": DEMO_PASSWORD}).status_code == 200
        monkeypatch.setattr(api_module.settings, "seed_demo_data", False)
        assert client.get(endpoint).status_code == 401  # 기존 쿠키도 무효
        assert client.post("/api/auth/login", json={"username": username, "password": DEMO_PASSWORD}).status_code == 401


def test_reset_only_today_seoul_demo_records_and_preserves_accounts_goals_other_data(demo_db):
    engine, identity = demo_db
    child_id = identity["childId"]
    with Session(engine) as db, db.begin():
        target = game_record(db, child_id, MIDNIGHT)[0]
        chat = chat_record(db, child_id, MIDNIGHT)
        preserved_games = [
            game_record(db, child_id, MIDNIGHT - timedelta(microseconds=1))[0],
            game_record(db, child_id, MIDNIGHT + timedelta(days=1))[0],
            game_record(db, child_id, TODAY, mode="real")[0],
            game_record(db, child_id, TODAY, is_seed=False)[0],
        ]
        preserved_chats = [
            chat_record(db, child_id, MIDNIGHT - timedelta(microseconds=1)),
            chat_record(db, child_id, MIDNIGHT + timedelta(days=1)),
            chat_record(db, child_id, TODAY, mode="real"),
            chat_record(db, child_id, TODAY, is_seed=False),
        ]
        other = Child(child_code="OTHER", hero_name="다른 아동", therapist_id=identity["therapistId"],
                      play_code="OTHER", is_seed=True)
        db.add(other)
        db.flush()
        db.add(TrainingGoal(child_id=other.id, version=1))
        db.flush()
        preserved_games.append(game_record(db, other.id, TODAY)[0])
        preserved_chats.append(chat_record(db, other.id, TODAY))
        db.flush()
        before = row_counts(db)
    result = reset_today(engine, demo_enabled=True, current_time=TODAY)
    assert result["date"] == "2026-10-05" and result["timeZone"] == "Asia/Seoul"
    assert result["deleted"]["training_sessions"] == result["deleted"]["hoya_chat_sessions"] == 1
    assert all(value == 1 for value in result["deleted"].values())
    with Session(engine) as db:
        assert db.get(TrainingSession, target) is None and db.get(HoyaChatSession, chat) is None
        assert all(db.get(TrainingSession, sid) for sid in preserved_games)
        assert all(db.get(HoyaChatSession, sid) for sid in preserved_chats)
        after = row_counts(db)
        for name in ("accounts", "children", "therapists", "training_goals", "training_plans"):
            assert after[name] == before[name]
        assert not db.connection().exec_driver_sql("PRAGMA foreign_key_check").all()
    assert not any(reset_today(engine, demo_enabled=True, current_time=TODAY)["deleted"].values())


@pytest.mark.parametrize("damage", ["disabled", "marker", "ownership", "not_seed", "account"])
def test_reset_rejects_production_or_invalid_identity_without_changes(demo_db, damage):
    engine, identity = demo_db
    with Session(engine) as db, db.begin():
        game_record(db, identity["childId"], TODAY)
        if damage == "marker":
            db.scalar(select(AuditEvent).where(AuditEvent.action == PROVISION_ACTION)).action = "UNMARKED"
        elif damage == "ownership":
            db.get(Child, identity["childId"]).child_code = "NOT-DEMO"
        elif damage == "not_seed":
            db.get(Child, identity["childId"]).is_seed = False
        elif damage == "account":
            db.scalar(select(Account).where(Account.username == PLAY_CODE)).role = "ADMIN"
        db.flush()
        before = row_counts(db)
    with pytest.raises(DemoSafetyError):
        reset_today(engine, demo_enabled=damage != "disabled", current_time=TODAY)
    with Session(engine) as db:
        assert row_counts(db) == before


def test_preserved_recommendation_references_refuse_whole_reset(demo_db):
    engine, identity = demo_db
    with Session(engine) as db, db.begin():
        sid, oid = game_record(db, identity["childId"], TODAY)
        chat_record(db, identity["childId"], TODAY)
        db.add(ActivityRecommendation(child_id=identity["childId"], activity="sky_climb", clinical_purpose="시연",
                                      reason="보존", confidence="LOW", evidence=[{"sessionId": sid, "observationId": oid}]))
        db.flush()
        before = row_counts(db)
    with pytest.raises(DemoSafetyError, match="보존 근거"):
        reset_today(engine, demo_enabled=True, current_time=TODAY)
    with Session(engine) as db:
        assert row_counts(db) == before


def test_reset_rolls_back_all_deletions_if_late_delete_fails(demo_db):
    engine, identity = demo_db
    with Session(engine) as db, db.begin():
        game_record(db, identity["childId"], TODAY)
        chat_record(db, identity["childId"], TODAY)
        db.flush()
        before = row_counts(db)
    def fail_delete(_connection, _cursor, statement, _parameters, _context, _many):
        if statement.startswith("DELETE FROM training_sessions"):
            raise RuntimeError("강제 삭제 실패")
    event.listen(engine, "before_cursor_execute", fail_delete)
    try:
        with pytest.raises(RuntimeError, match="강제 삭제 실패"):
            reset_today(engine, demo_enabled=True, current_time=TODAY)
    finally:
        event.remove(engine, "before_cursor_execute", fail_delete)
    with Session(engine) as db:
        assert row_counts(db) == before


def test_provision_refuses_non_seed_database_without_mutation(demo_db):
    engine, identity = demo_db
    with Session(engine) as db, db.begin():
        db.scalar(select(AuditEvent).where(AuditEvent.action == PROVISION_ACTION)).action = "UNMARKED"
        db.get(Child, identity["childId"]).is_seed = False
    with Session(engine) as db:
        before = row_counts(db)
        with pytest.raises(DemoSafetyError, match="비샘플"):
            provision_demo_child(db, demo_enabled=True)
        db.rollback()
        assert row_counts(db) == before


def test_cli_requires_demo_mode_new_file_and_provision_marker(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location("demo_rehearsal_script",
                                                 Path(__file__).resolve().parents[1] / "scripts" / "demo_rehearsal.py")
    script = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(script)
    path = tmp_path / "cli-demo.db"
    monkeypatch.setattr(script.settings, "seed_demo_data", False)
    with pytest.raises(DemoSafetyError, match="SEED_DEMO_DATA"):
        script.main(["provision", "--database", str(path)])
    assert not path.exists()
    monkeypatch.setattr(script.settings, "seed_demo_data", True)
    with pytest.raises(DemoSafetyError, match="기존 provision"):
        script.main(["reset-today", "--database", str(path)])
    result = script.main(["provision", "--database", str(path)])
    assert result["studentUsername"] == PLAY_CODE
    before = path.read_bytes()
    with pytest.raises(DemoSafetyError, match="기존 DB"):
        script.main(["provision", "--database", str(path)])
    assert path.read_bytes() == before
    result = script.main(["reset-today", "--database", str(path)])
    assert not any(result["deleted"].values())


def test_hidden_magic_beam_is_not_a_new_activity_recommendation(api):
    client, sessions = api
    child = add_child(client, auth(client), "추천 검사")
    sid = add_session(sessions, child, ["success", "retry"], level="SOUND")
    with sessions() as db:
        for row in db.scalars(select(ClinicalObservation).where(ClinicalObservation.session_id == sid)).all():
            row.evidence = {"acoustic": {"bestRunMs": 1000}}
        db.commit()
        assert propose_activity(db, child)["activity"] == "sky_climb"


@pytest.mark.parametrize("hint", [None, "magic_beam"])
def test_phoneme_fallback_does_not_propose_hidden_game(hint):
    goal = {"level": "syllable", "minLevel": "phoneme", "targetPhoneme": "ㅅ", "wordPosition": "initial",
            "sessionDurationMin": 10, "repetitionTarget": 20, "preferredCue": "auditory_model",
            "priorityTargets": [], "excludedWords": []}
    metrics = {"sufficient": True, "evaluableN": 5, "verifiedN": 5, "uncertainN": 0, "noSpeechN": 0,
               "pendingReviewN": 0, "byLevel": [{"level": "syllable", "evaluableN": 5, "successRate": 20}]}
    proposal = propose_plan(goal, metrics, hint)
    assert proposal["form"]["startLevel"] == "phoneme"
    assert proposal["form"]["steps"][1]["activity"] == "sky_climb"



@pytest.mark.parametrize("damage", ["clinical_state", "other_therapist"])
def test_reset_never_deletes_clinical_or_other_therapist_verification(demo_db, damage):
    engine, identity = demo_db
    with Session(engine) as db, db.begin():
        _sid, oid = game_record(db, identity["childId"], TODAY)
        db.flush()
        if damage == "clinical_state":
            db.get(ClinicalObservation, oid).verification_state = "CONFIRMED"
        else:
            other = Therapist(username="different", display_name="다른 치료사", password_hash="test", password_salt="test")
            db.add(other)
            db.flush()
            db.scalar(select(ClinicalVerification).where(ClinicalVerification.observation_id == oid)).therapist_id = other.id
        db.flush()
        before = row_counts(db)
    with pytest.raises(DemoSafetyError):
        reset_today(engine, demo_enabled=True, current_time=TODAY)
    with Session(engine) as db:
        assert row_counts(db) == before
        assert db.scalar(select(ClinicalVerification).where(ClinicalVerification.observation_id == oid)) is not None


def test_reset_refuses_cross_child_observation(demo_db):
    engine, identity = demo_db
    with Session(engine) as db, db.begin():
        _sid, oid = game_record(db, identity["childId"], TODAY)
        other = Child(child_code="OTHER", hero_name="다른 아동", therapist_id=identity["therapistId"],
                      play_code="OTHER", is_seed=True)
        db.add(other)
        db.flush()
        db.get(ClinicalObservation, oid).child_id = other.id
        db.flush()
        before = row_counts(db)
    with pytest.raises(DemoSafetyError, match="다른 아동"):
        reset_today(engine, demo_enabled=True, current_time=TODAY)
    with Session(engine) as db:
        assert row_counts(db) == before


def test_nonlocal_memory_and_naive_time_are_refused(demo_db):
    from app.demo_seed import local_database_path
    for path in ("postgresql://server/db", "//server/shared/test.db", "local.txt"):
        with pytest.raises(DemoSafetyError):
            local_database_path(path)
    engine = make_engine("sqlite://")
    try:
        with Session(engine) as db:
            with pytest.raises(DemoSafetyError, match="SQLite"):
                provision_demo_child(db, demo_enabled=True)
    finally:
        engine.dispose()
    file_engine, _identity = demo_db
    with pytest.raises(DemoSafetyError, match="시간대"):
        reset_today(file_engine, demo_enabled=True, current_time=TODAY.replace(tzinfo=None))


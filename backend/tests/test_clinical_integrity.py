"""치료사 확인 비율의 의미와 음성 자료 삭제 범위를 검증한다."""

import pytest
from sqlalchemy import func, select, text

from app import main as api_module
from app.models import (AIRecommendation, ActivityRecommendation, AuditEvent, Child, ClinicalObservation, ClinicalVerification,
                        SpeechAnalysis, TrainingSession, Utterance)
from test_api_flow import api, auth, real_child_auth, student_auth


GOOD = {"durationMs": 1300, "activeMs": 1200, "voicedMs": 1200, "noiseFloorDb": -60, "meanRmsDb": -35}
SUCCESS = {**GOOD, "bestRunMs": 1200, "fricationMs": 1200}
RETRY = {**GOOD, "bestRunMs": 300, "fricationMs": 1200}
UNCERTAIN = {"durationMs": 1200, "activeMs": 1000, "noiseFloorDb": -60, "meanRmsDb": -55}


def _post(client, headers, session_id, item_id, attempt, acoustic, transcript=None):
    response = client.post(f"/api/activities/{session_id}/utterances", headers=headers,
                           json={"roundIndex": 1, "itemId": item_id, "attemptIndex": attempt,
                                 "transcript": transcript, "acoustic": acoustic})
    assert response.status_code == 200, response.text
    return response.json()


def _decide_all(client, session_id, body):
    therapist = auth(client)
    observations = client.get(f"/api/sessions/{session_id}/timeline", headers=therapist).json()["observations"]
    for observation in observations:
        response = client.post(f"/api/observations/{observation['id']}/decision", headers=therapist,
                               json=body(observation) if callable(body) else body)
        assert response.status_code == 200, response.text
    return therapist, observations


def _round1(client, therapist, session_id):
    return client.get(f"/api/sessions/{session_id}/clinical-summary", headers=therapist).json()["rounds"][0]


def test_confirmed_uncertain_is_not_counted_as_failure(api):
    client, _ = api
    student, created = real_child_auth(client)
    started = client.post("/api/activities", headers=student, json={"game": "magic_beam", "mode": "real"}).json()
    _post(client, student, started["sessionId"], started["firstItem"]["itemId"], 1, UNCERTAIN)
    therapist, observations = _decide_all(client, started["sessionId"], {"action": "confirm"})
    assert [row["ai_result"] for row in observations] == ["uncertain"]
    row = _round1(client, therapist, started["sessionId"])
    assert row["verifiedN"] == 1
    assert row["verifiedEvaluatedN"] == 0
    assert row["verifiedRate"] is None


def test_correction_to_uncertain_or_no_speech_is_excluded_from_rate(api):
    client, _ = api
    student, created = real_child_auth(client)
    started = client.post("/api/activities", headers=student, json={"game": "magic_beam", "mode": "real"}).json()
    _post(client, student, started["sessionId"], started["firstItem"]["itemId"], 1, RETRY)
    _post(client, student, started["sessionId"], started["firstItem"]["itemId"], 2, RETRY)
    results = iter(["uncertain", "no_speech"])
    therapist, observations = _decide_all(client, started["sessionId"],
                                          lambda _row: {"action": "correct", "correctedResult": next(results)})
    assert len(observations) == 2
    row = _round1(client, therapist, started["sessionId"])
    assert row["verifiedN"] == 2
    assert row["verifiedEvaluatedN"] == 0
    assert row["verifiedRate"] is None


def test_rate_uses_only_success_and_retry_as_denominator(api):
    client, _ = api
    student, created = real_child_auth(client)
    started = client.post("/api/activities", headers=student, json={"game": "magic_beam", "mode": "real"}).json()
    session_id, item_id = started["sessionId"], started["firstItem"]["itemId"]
    _post(client, student, session_id, item_id, 1, UNCERTAIN)  # 다시 듣기: 시도 번호 유지
    _post(client, student, session_id, item_id, 1, RETRY)
    result = _post(client, student, session_id, item_id, 2, SUCCESS)
    assert any(event["type"] == "ROUND_CLEAR" for event in result["events"])
    therapist, observations = _decide_all(client, session_id, {"action": "confirm"})
    assert sorted(row["ai_result"] for row in observations) == ["retry", "success", "uncertain"]
    row = _round1(client, therapist, session_id)
    assert row["verifiedN"] == 3
    assert row["verifiedEvaluatedN"] == 2
    assert row["verifiedSuccesses"] == 1
    assert row["verifiedRate"] == 50.0


def test_confirmed_conversation_target_observation_is_not_zero_percent(api):
    client, _ = api
    student, created = real_child_auth(client)
    started = client.post("/api/activities", headers=student,
                          json={"game": "conversation_quest", "mode": "real"}).json()
    _post(client, student, started["sessionId"], started["firstItem"]["itemId"], 1, SUCCESS, transcript="사과")
    therapist, observations = _decide_all(client, started["sessionId"], {"action": "confirm"})
    assert [row["ai_result"] for row in observations] == ["target_observed"]
    row = _round1(client, therapist, started["sessionId"])
    assert row["verifiedObservedN"] == 1
    assert row["verifiedEvaluatedN"] == 0
    assert row["verifiedRate"] is None


def test_speech_data_deletion_removes_derived_clinical_records(api):
    client, sessions = api
    student, created = real_child_auth(client)
    started = client.post("/api/activities", headers=student, json={"game": "magic_beam", "mode": "real"}).json()
    _post(client, student, started["sessionId"], started["firstItem"]["itemId"], 1, SUCCESS)
    therapist, observations = _decide_all(client, started["sessionId"], {"action": "confirm"})
    with sessions() as db:
        child_id = created["id"]
        other_id = db.query(Child).filter(Child.child_code == "C-0002").one().id
        other_before = db.scalar(select(func.count()).select_from(ClinicalObservation)
                                 .where(ClinicalObservation.child_id == other_id))
    assert other_before > 0
    proposed = client.post(f"/api/children/{child_id}/activity-recommendations", headers=therapist).json()
    assert proposed["status"] == "PENDING"

    response = client.delete(f"/api/children/{child_id}/speech-data", headers=therapist)
    assert response.status_code == 204

    with sessions() as db:
        assert not db.scalars(select(ClinicalObservation).where(ClinicalObservation.child_id == child_id)).all()
        assert not db.scalars(select(ClinicalVerification).where(
            ClinicalVerification.observation_id.in_([row["id"] for row in observations]))).all()
        assert not db.scalars(select(ActivityRecommendation).where(ActivityRecommendation.child_id == child_id)).all()
        assert not db.scalars(select(TrainingSession).where(TrainingSession.child_id == child_id)).all()
        assert db.scalar(select(func.count()).select_from(Utterance)
                         .where(Utterance.session_id == started["sessionId"])) == 0
        assert db.scalar(select(func.count()).select_from(SpeechAnalysis)
                         .where(SpeechAnalysis.utterance_id.notin_(select(Utterance.id)))) == 0
        assert db.execute(text("PRAGMA foreign_key_check")).all() == []
        assert db.scalar(select(func.count()).select_from(ClinicalObservation)
                         .where(ClinicalObservation.child_id == other_id)) == other_before
        assert db.query(AuditEvent).filter(AuditEvent.action == "SPEECH_DATA_DELETED",
                                           AuditEvent.resource_id == child_id).count() == 1
    assert client.get(f"/api/observations/{observations[0]['id']}", headers=therapist).status_code == 404


def test_unassigned_therapist_cannot_delete_speech_data(api):
    client, sessions = api
    from app.models import Account, Therapist
    from app.security import hash_password
    salt = "33" * 16
    with sessions() as db:
        child_id = db.query(Child).filter(Child.child_code == "C-0001").one().id
        before = db.scalar(select(func.count()).select_from(ClinicalObservation)
                           .where(ClinicalObservation.child_id == child_id))
        therapist = Therapist(username="other", display_name="다른 치료사", password_salt=salt,
                              password_hash=hash_password("validpass", salt))
        db.add(therapist)
        db.flush()
        db.add(Account(username="other", password_salt=salt, password_hash=therapist.password_hash,
                       role="THERAPIST", therapist_id=therapist.id))
        db.commit()
    login = client.post("/api/auth/login", json={"username": "other", "password": "validpass"})
    headers = {"X-CSRF-Token": login.json()["csrfToken"]}
    assert client.delete(f"/api/children/{child_id}/speech-data", headers=headers).status_code == 404
    with sessions() as db:
        assert db.scalar(select(func.count()).select_from(ClinicalObservation)
                         .where(ClinicalObservation.child_id == child_id)) == before


# ---- 출처(provenance): seed 아동의 회기는 모드와 관계없이 임상 근거가 아니다 ----

def _session(sessions, session_id):
    with sessions() as db:
        return db.get(TrainingSession, session_id)


def _start(client, headers, mode, game="magic_beam"):
    response = client.post("/api/activities", headers=headers, json={"game": game, "mode": mode})
    assert response.status_code == 200, response.text
    return response.json()


def test_seed_child_real_session_keeps_seed_provenance(api):
    client, sessions = api
    started = _start(client, student_auth(client), "real")
    session = _session(sessions, started["sessionId"])
    assert session.mode == "real" and session.is_seed is True
    assert api_module.clinical_eligible(session) is False


@pytest.mark.parametrize("mode,eligible", [("real", True), ("demo", False)])
def test_real_child_session_provenance_by_mode(api, mode, eligible):
    client, sessions = api
    headers, _child = real_child_auth(client)
    started = _start(client, headers, mode)
    session = _session(sessions, started["sessionId"])
    assert session.is_seed is False and session.mode == mode
    assert api_module.clinical_eligible(session) is eligible


def _confirmed_seed_real_observations(client):
    student = student_auth(client)
    started = _start(client, student, "real")
    _post(client, student, started["sessionId"], started["firstItem"]["itemId"], 1, SUCCESS)
    therapist, observations = _decide_all(client, started["sessionId"], {"action": "confirm"})
    return therapist, started, observations


def test_seed_real_observation_review_is_recorded_as_demo(api):
    client, _ = api
    _therapist, _started, observations = _confirmed_seed_real_observations(client)
    assert observations and all(row["is_demo"] and not row["clinical_eligible"] for row in observations)
    with api[1]() as db:
        states = {row.verification_state for row in db.scalars(select(ClinicalObservation).where(
            ClinicalObservation.session_id == _started["sessionId"])).all()}
    assert states == {"DEMO_CONFIRMED"}


def test_seed_real_session_is_not_planning_or_activity_evidence(api):
    client, sessions = api
    therapist, started, _observations = _confirmed_seed_real_observations(client)
    child_id = _session(sessions, started["sessionId"]).child_id
    context = client.get(f"/api/children/{child_id}/planning-context", headers=therapist).json()
    assert context["metrics"]["verifiedN"] == 0 and context["metrics"]["window"]["realSessionN"] == 0
    assert context["evidenceAvailability"]["demoExcludedN"] >= 1
    assert client.post(f"/api/children/{child_id}/activity-recommendations", headers=therapist).json()["status"] == "INSUFFICIENT_DATA"
    assert _round1(client, therapist, started["sessionId"])["verifiedN"] == 0


def test_real_child_real_session_is_still_clinical_evidence(api):
    client, sessions = api
    headers, child = real_child_auth(client)
    started = _start(client, headers, "real")
    _post(client, headers, started["sessionId"], started["firstItem"]["itemId"], 1, SUCCESS)
    therapist, _ = _decide_all(client, started["sessionId"], {"action": "confirm"})
    context = client.get(f"/api/children/{child['id']}/planning-context", headers=therapist).json()
    assert context["metrics"]["verifiedN"] == 1 and context["metrics"]["window"]["realSessionN"] == 1


# ---- legacy 추천(D안): 기존 모험은 2026-10-04 제거됐다. 과거 추천 행의 표시·결정 규칙은 그대로 지킨다 ----

def _completed(client, headers, mode):
    started = _start(client, headers, mode)
    response = client.post(f"/api/play/sessions/{started['sessionId']}/complete", headers=headers, json={"elapsedSec": 30})
    assert response.status_code == 200, response.text
    return started["sessionId"]


def _recommendations(sessions, session_id):
    with sessions() as db:
        return db.scalars(select(AIRecommendation).where(AIRecommendation.session_id == session_id)).all()


def _past_recommendation(sessions, child_id, session_id, suggested_goal=None):
    """수정 전 코드나 기존 모험이 남긴 과거 추천 행을 흉내 낸다."""
    with sessions() as db:
        rec = AIRecommendation(child_id=child_id, session_id=session_id, goal_id=_session(sessions, session_id).goal_id,
                               rule_id="R2", observation="과거 행", evidence=[], suggestion_text="",
                               suggested_goal=suggested_goal or {}, rationale="", confidence="low")
        db.add(rec)
        db.commit()
        return rec.id


@pytest.mark.parametrize("mode", ["demo", "real"])
def test_five_round_activity_never_creates_legacy_recommendation(api, mode):
    client, sessions = api
    headers, _child = real_child_auth(client)
    assert _recommendations(sessions, _completed(client, headers, mode)) == []


def test_legacy_recommendation_exposes_provenance_and_dashboard_skips_demo_practice(api):
    client, sessions = api
    headers, child = real_child_auth(client)
    demo = _completed(client, headers, "demo")
    real = _completed(client, headers, "real")
    _past_recommendation(sessions, child["id"], demo)
    _past_recommendation(sessions, child["id"], real)
    therapist = auth(client)
    rows = client.get(f"/api/children/{child['id']}/recommendations", headers=therapist).json()
    by_session = {row["session_id"]: row for row in rows}
    assert by_session[demo]["provenance"] == {"sessionMode": "demo", "sessionIsSeed": False, "clinicalEligible": False, "demoPractice": True}
    assert by_session[real]["provenance"]["clinicalEligible"] is True
    overview = client.get("/api/dashboard/overview", headers=therapist).json()
    card = next(row for row in overview["activeChildren"] if row["id"] == child["id"])
    assert card["pendingRecommendations"] == sum(row["session_id"] == real and row["status"] == "pending" for row in rows)


def test_provenance_audit_counts_legacy_rows_without_writing(api):
    import hashlib
    import importlib.util
    from pathlib import Path
    spec = importlib.util.spec_from_file_location("audit_seed_provenance", Path(__file__).resolve().parents[1] / "scripts" / "audit_seed_provenance.py")
    audit_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(audit_module)
    client, sessions = api
    started = _start(client, student_auth(client), "real")
    _post(client, student_auth(client), started["sessionId"], started["firstItem"]["itemId"], 1, SUCCESS)
    with sessions() as db:
        # 수정 전 코드가 남긴 과거 행을 흉내 낸다: seed 아동의 실제 회기가 비seed로, 관찰이 CONFIRMED로 저장됨.
        db.get(TrainingSession, started["sessionId"]).is_seed = False
        for row in db.scalars(select(ClinicalObservation).where(ClinicalObservation.session_id == started["sessionId"])):
            row.verification_state = "CONFIRMED"
        db.commit()
    database = Path(str(sessions.kw["bind"].url.database))
    before = hashlib.sha256(database.read_bytes()).hexdigest()
    engine = audit_module.read_only_engine(f"sqlite:///{database.as_posix()}")
    with audit_module.Session(engine) as db:
        result = audit_module.audit(db)
        with pytest.raises(Exception):  # 읽기 전용 연결은 쓰기를 거부한다.
            db.execute(text("UPDATE training_sessions SET is_seed = 1"))
            db.commit()
    engine.dispose()
    assert result["seedChildSessionsMarkedNonSeed"].get("real") == 1
    assert result["clinicallyContaminatedObservations"] == 1
    assert hashlib.sha256(database.read_bytes()).hexdigest() == before


def _metric_session(db, child_id, mode, is_seed, first_try, status="completed", days_ago=1):
    from datetime import timedelta
    from app.models import ProgressMetric, TrainingGoal, TrainingPlan, now
    goal = db.scalar(select(TrainingGoal).where(TrainingGoal.child_id == child_id, TrainingGoal.status == "active"))
    plan = TrainingPlan(goal_id=goal.id, child_id=child_id, plan_json={})
    db.add(plan)
    db.flush()
    session = TrainingSession(child_id=child_id, goal_id=goal.id, plan_id=plan.id, mode=mode, is_seed=is_seed,
                              play_token_hash="x" * 64, status=status, started_at=now() - timedelta(days=days_ago))
    db.add(session)
    db.flush()
    metric = ProgressMetric(child_id=child_id, session_id=session.id, goal_id=goal.id, phoneme="ㅅ", position="initial",
                            attempts=10, successes=9, first_try_success_rate=first_try, success_rate=90)
    db.add(metric)
    db.flush()
    return session, goal, metric


@pytest.mark.parametrize("previous_mode,expect_r2", [("demo", False), ("real", True)])
def test_r2_compares_only_sessions_of_the_same_provenance(api, previous_mode, expect_r2):
    from app.analysis.recommendation import recommend
    client, sessions = api
    _headers, child = real_child_auth(client)
    with sessions() as db:
        # 이전 회기(DEMO 또는 실제)와 이번 실제 회기 모두 첫 시도 성공률 90%. R2 기준값(80)은 바꾸지 않는다.
        _metric_session(db, child["id"], previous_mode, False, 90.0, days_ago=2)
        current, goal, metric = _metric_session(db, child["id"], "real", False, 90.0, status="active", days_ago=0)
        rules = {rec.rule_id for rec in recommend(db, current, goal, metric)}
    assert ("R2" in rules) is expect_r2


def test_demo_practice_recommendation_can_only_be_rejected(api):
    client, sessions = api
    headers, child = real_child_auth(client)
    demo = _completed(client, headers, "demo")
    rec_id = _past_recommendation(sessions, child["id"], demo, {"level": "short_sentence"})
    therapist = auth(client)
    versions = lambda: [g["version"] for g in client.get(f"/api/children/{child['id']}/goals", headers=therapist).json()]
    before = versions()
    for body in ({"action": "accept"}, {"action": "modify", "modifiedGoal": {"level": "word"}}):
        assert client.post(f"/api/recommendations/{rec_id}/decision", headers=therapist, json=body).status_code == 409
    assert versions() == before
    rejected = client.post(f"/api/recommendations/{rec_id}/decision", headers=therapist, json={"action": "reject", "note": "DEMO 연습"})
    assert rejected.status_code == 200 and rejected.json()["newGoal"] is None and versions() == before


def test_seed_showcase_recommendation_can_still_be_accepted(api):
    client, sessions = api
    with sessions() as db:
        child = db.scalar(select(Child).where(Child.play_code == "HERO01"))
        session = db.scalar(select(TrainingSession).where(TrainingSession.child_id == child.id, TrainingSession.is_seed.is_(True)))
        child_id, session_id = child.id, session.id
    rec_id = _past_recommendation(sessions, child_id, session_id, {"level": "syllable"})
    response = client.post(f"/api/recommendations/{rec_id}/decision", headers=auth(client), json={"action": "accept"})
    assert response.status_code == 200

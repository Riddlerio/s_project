"""임시 SQLite DB에서 아동 발화와 치료사 의사결정 루프를 검증한다."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app import main as api_module
from app.db import Base, get_db, make_engine
from app.models import Account, ActivityRecommendation, AIRecommendation, AuditEvent, Child, ClinicalObservation, ClinicalVerification, CookieSession, Therapist, TherapistFeedback, TrainingGoal, TrainingPlan, TrainingSession, now
from app.models import Utterance
from app.security import hash_password
from datetime import timedelta


@pytest.fixture
def api(tmp_path, monkeypatch):
    monkeypatch.setattr(api_module.settings, "cookie_secure", False)
    monkeypatch.setattr(api_module.settings, "seed_demo_data", True)
    engine = make_engine(f"sqlite:///{(tmp_path / 'test.db').as_posix()}")
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr(api_module, "engine", engine)
    monkeypatch.setattr(api_module, "SessionLocal", sessions)

    def test_db():
        with sessions() as db:
            yield db

    api_module.app.dependency_overrides[get_db] = test_db
    with TestClient(api_module.app) as client:
        yield client, sessions
    api_module.app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


def auth(client):
    response = client.post("/api/auth/login", json={"username": "demo", "password": "speechhero"})
    assert response.status_code == 200
    return {"X-CSRF-Token": response.json()["csrfToken"]}


def student_auth(client, code="HERO01"):
    response = client.post("/api/auth/login", json={"username": code, "password": "speechhero"})
    assert response.status_code == 200
    return {"X-CSRF-Token": response.json()["csrfToken"]}


@pytest.mark.parametrize("acoustic", [
    {"bestRunMs": "900"}, {"voicedMs": "x"}, {"clippingRatio": 1.5},
    {"meanHfRatio": -0.1}, {"audioBase64": "private"},
    {"durationMs": 100, "bestRunMs": 500},
])
def test_invalid_acoustic_is_rejected_without_echo_or_storage(api, acoustic):
    client, sessions = api
    play_headers = student_auth(client)
    start = client.post("/api/play/start", headers=play_headers, json={"playCode": "HERO01", "mode": "demo"}).json()
    item = start["firstItem"]
    result = client.post(f"/api/play/sessions/{start['sessionId']}/utterances",
                         headers=play_headers,
                         json={"itemId": item["itemId"], "acoustic": acoustic})
    assert result.status_code == 422, result.text
    assert "private" not in result.text
    assert "\"input\"" not in result.text
    with sessions() as db:
        assert not db.scalars(select(Utterance).where(Utterance.session_id == start["sessionId"])).all()


def test_large_utterance_is_rejected(api):
    client, _ = api
    result = client.post("/api/play/sessions/any/utterances", data="x" * 70000,
                         headers={"Content-Type": "application/json"})
    assert result.status_code == 413


@pytest.mark.parametrize("acoustic", [
    {"meanCentroidHz": 5000}, {"meanCentroidHz": 8000}, {"durationMs": 12000},
])
def test_valid_browser_acoustic_range(api, acoustic):
    client, _ = api
    play_headers = student_auth(client)
    start = client.post("/api/play/start", headers=play_headers, json={"playCode": "HERO01", "mode": "demo"}).json()
    item = start["firstItem"]
    response = client.post(f"/api/play/sessions/{start['sessionId']}/utterances",
                           headers=play_headers,
                           json={"itemId": item["itemId"], "acoustic": acoustic})
    assert response.status_code == 200, response.text


def test_malformed_content_length_and_chunked_oversize(api):
    client, _ = api
    malformed = client.post("/api/play/start", content=b"{}", headers={"Content-Length": "invalid"})
    assert malformed.status_code == 400
    chunked = client.post("/api/play/start", content=(b"x" * 70000 for _ in range(1)),
                          headers={"Transfer-Encoding": "chunked"})
    assert chunked.status_code == 413


def test_no_speech_does_not_consume_retry_state(api):
    client, sessions = api
    play_headers = student_auth(client)
    start = client.post("/api/play/start", headers=play_headers, json={"playCode": "HERO01", "mode": "real"}).json()
    item = start["firstItem"]
    response = client.post(f"/api/play/sessions/{start['sessionId']}/utterances",
                           headers=play_headers,
                           json={"itemId": item["itemId"], "acoustic": {"activeMs": 0,
                                 "durationMs": 100, "noiseFloorDb": -60, "meanRmsDb": -60}})
    assert response.status_code == 200, response.text
    assert any(e["type"] == "NO_SPEECH" for e in response.json()["events"])
    with sessions() as db:
        state = db.get(TrainingSession, start["sessionId"]).runtime_state
        assert state["listenAgainCount"] == 0
        assert state["itemAttempt"] == 1


def test_utterance_analysis_decision_dashboard_feedback(api):
    client, sessions = api
    assert client.get("/api/dashboard/overview").status_code == 401
    headers = auth(client)
    overview = client.get("/api/dashboard/overview", headers=headers).json()
    assert overview["activeChildren"]
    child = next(c for c in overview["activeChildren"] if c["child_code"] == "C-0001")
    initial_goal = child["currentGoal"]["version"]
    play_headers = student_auth(client)
    start = client.post("/api/play/start", headers=play_headers, json={"playCode": "HERO01", "mode": "demo"}).json()
    assert start["firstItem"]["game"] == "monster_tower"
    item = start["firstItem"]
    result = client.post(f"/api/play/sessions/{start['sessionId']}/utterances", headers=play_headers,
                         json={"itemId": item["itemId"], "attemptIndex": 1, "transcript": "따과",
                               "recognizer": "demo_script", "acoustic": {"durationMs": 900, "voicedMs": 900,
                               "meanRmsDb": -20, "peakRmsDb": -12, "source": "microphone"}, "elapsedSec": 8})
    assert result.status_code == 200
    assert any(e["type"] in ("TARGET_RETRY", "HINT_REQUIRED") for e in result.json()["events"])
    headers = auth(client)
    detail = client.get(f"/api/sessions/{start['sessionId']}", headers=headers).json()
    assert detail["utterances"][0]["analysis"]["method"]
    assert detail["decisions"]
    utterance_id = detail["utterances"][0]["id"]
    feedback = client.post(f"/api/utterances/{utterance_id}/feedback", headers=headers,
                           json={"action": "not_error", "note": "치료사 확인"})
    assert feedback.status_code == 200
    assert feedback.json()["analysis"]["final_result"] == "success"
    play_headers = student_auth(client)
    assert client.post(f"/api/play/sessions/{start['sessionId']}/complete", headers=play_headers,
                       json={"elapsedSec": 8}).status_code == 200
    headers = auth(client)
    progress = client.get(f"/api/children/{child['id']}/progress", headers=headers).json()
    assert any(row["sessionId"] == start["sessionId"] for row in progress["sessions"])
    with sessions() as db:
        assert db.get(Utterance, utterance_id).acoustic["source"] == "keyboard"
        assert db.scalar(select(TherapistFeedback).where(TherapistFeedback.utterance_id == utterance_id))
        assert db.get(TrainingSession, start["sessionId"]).status == "completed"
        assert db.scalar(select(TrainingGoal).where(TrainingGoal.child_id == child["id"], TrainingGoal.status == "active")).version == initial_goal


@pytest.mark.parametrize("action,expected", [("accept", "accepted"), ("modify", "modified"), ("reject", "rejected")])
def test_recommendation_requires_therapist_and_persists_decision(api, action, expected):
    client, sessions = api
    headers = auth(client)
    with sessions() as db:
        child = db.scalar(select(Child).where(Child.child_code == "C-0001"))
        goal = db.scalar(select(TrainingGoal).where(TrainingGoal.child_id == child.id, TrainingGoal.status == "active"))
        source = db.scalar(select(TrainingSession).where(TrainingSession.child_id == child.id))
        recommendation = AIRecommendation(child_id=child.id, session_id=source.id, goal_id=goal.id,
                                          rule_id=f"test-{action}", observation="반복 관찰", evidence=[],
                                          suggestion_text="음절부터 시작", suggested_goal={"level": "syllable"},
                                          rationale="테스트", confidence="low")
        db.add(recommendation)
        db.commit()
        rec_id, child_id, previous_version = recommendation.id, child.id, goal.version
    body = {"action": action, "note": "치료사 검토"}
    if action == "modify":
        body["modifiedGoal"] = {"level": "word", "sessionDurationMin": 15}
    assert client.post(f"/api/recommendations/{rec_id}/decision", json=body).status_code == 403
    response = client.post(f"/api/recommendations/{rec_id}/decision", headers=headers, json=body)
    assert response.status_code == 200, response.text
    assert response.json()["recommendation"]["status"] == expected
    with sessions() as db:
        assert db.get(AIRecommendation, rec_id).status == expected
        assert db.scalar(select(TherapistFeedback).where(TherapistFeedback.recommendation_id == rec_id)).action == action
        active = db.scalar(select(TrainingGoal).where(TrainingGoal.child_id == child_id, TrainingGoal.status == "active"))
        assert active.version == previous_version + (action != "reject")


def test_cookie_role_idor_csrf_and_logout(api):
    client, sessions = api
    assert client.post("/api/play/start", json={"playCode": "HERO01"}).status_code == 401
    assert client.get("/api/dashboard/overview").status_code == 401
    assert client.post("/api/auth/login", json={"username": "HERO01", "password": "wrong"}).status_code == 401
    login = client.post("/api/auth/login", json={"username": "HERO01", "password": "speechhero", "admin": True})
    assert login.status_code == 200
    assert login.json()["role"] == "STUDENT"
    assert "token" not in login.json()
    assert "HttpOnly" in login.headers["set-cookie"]
    assert "SameSite=strict" in login.headers["set-cookie"]
    csrf = {"X-CSRF-Token": login.json()["csrfToken"]}
    assert client.get("/api/admin/health").status_code == 403
    assert client.get("/api/dashboard/overview").status_code == 403
    assert client.get("/api/play/children/HERO02/profile").status_code == 404
    assert client.post("/api/play/start", headers=csrf, json={"playCode": "HERO02"}).status_code == 404
    assert client.post("/api/play/start", json={"playCode": "HERO01"}).status_code == 403
    assert client.post("/api/play/start", headers={**csrf, "Origin": "https://evil.example"},
                       json={"playCode": "HERO01"}).status_code == 403
    assert client.post("/api/play/start", headers={**csrf, "Host": "evil.example", "Origin": "http://evil.example"},
                       json={"playCode": "HERO01"}).status_code == 403
    assert client.post("/api/auth/logout", headers=csrf).status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_expired_session_and_unassigned_therapist(api):
    client, sessions = api
    student_auth(client)
    with sessions() as db:
        for row in db.query(CookieSession).all():
            row.expires_at = now() - timedelta(seconds=1)
        salt = "11" * 16
        therapist = Therapist(username="other", display_name="다른 치료사",
                              password_salt=salt, password_hash=hash_password("validpass", salt))
        db.add(therapist)
        db.flush()
        db.add(Account(username="other", password_salt=salt, password_hash=therapist.password_hash,
                       role="THERAPIST", therapist_id=therapist.id))
        db.commit()
    assert client.get("/api/auth/me").status_code == 401
    login = client.post("/api/auth/login", json={"username": "other", "password": "validpass"})
    assert login.status_code == 200
    with sessions() as db:
        child_id = db.query(Child).filter(Child.child_code == "C-0001").one().id
    assert client.get(f"/api/children/{child_id}").status_code == 404
    assert client.get("/api/admin/health").status_code == 403


def test_last_item_uncertain_skip_completes_session(api):
    client, sessions = api
    headers = student_auth(client)
    start = client.post("/api/play/start", headers=headers,
                        json={"playCode": "HERO01", "mode": "real"}).json()
    with sessions() as db:
        session = db.get(TrainingSession, start["sessionId"])
        stages = db.get(TrainingPlan, session.plan_id).plan_json["stages"]
        last = {**stages[-1]["items"][-1], "game": "magic_beam", "beamTargetMs": 1500}
        state = dict(session.runtime_state)
        state.update(currentItem=last, queue=[], stageIndex=len(stages) - 1, itemAttempt=1,
                     listenAgainCount=0)
        session.runtime_state = state
        db.commit()
    events = []
    for _ in range(3):
        result = client.post(f"/api/play/sessions/{start['sessionId']}/utterances", headers=headers,
                             json={"itemId": last["itemId"], "acoustic": {
                                 "activeMs": 1200, "durationMs": 1300, "bestRunMs": 900,
                                 "fricationMs": 900, "noiseFloorDb": -60, "meanRmsDb": -56,
                                 "snrDb": 50}})
        assert result.status_code == 200, result.text
        events.append(result.json())
    assert not events[0]["sessionComplete"]
    assert not events[1]["sessionComplete"]
    assert events[2]["sessionComplete"]
    assert {event["type"] for event in events[2]["events"]} >= {"ITEM_ADVANCE", "SESSION_COMPLETE"}
    with sessions() as db:
        state = db.get(TrainingSession, start["sessionId"]).runtime_state
        assert state["totalAttempts"] == 0


def test_clinical_observation_and_append_only_verification(api):
    client, sessions = api
    play_headers = student_auth(client)
    start = client.post("/api/play/start", headers=play_headers,
                        json={"playCode": "HERO01", "mode": "demo"}).json()
    item = start["firstItem"]
    response = client.post(f"/api/play/sessions/{start['sessionId']}/utterances", headers=play_headers,
                           json={"itemId": item["itemId"], "acoustic": {"durationMs": 900}})
    assert response.status_code == 200
    assert client.get(f"/api/sessions/{start['sessionId']}/timeline").status_code == 403
    therapist_headers = auth(client)
    timeline = client.get(f"/api/sessions/{start['sessionId']}/timeline", headers=therapist_headers).json()
    assert len(timeline["observations"]) == 1
    observation = timeline["observations"][0]
    assert observation["provenance"]["aiResult"] == "AI_ESTIMATED"
    assert observation["provenance"]["acoustic"] == "CLIENT_REPORTED"
    assert "xp" not in observation["evidence"]
    response = client.post(f"/api/observations/{observation['id']}/decision", headers=therapist_headers,
                           json={"action": "correct", "correctedResult": "retry", "note": "관찰 교정"})
    assert response.status_code == 200
    detail = client.get(f"/api/observations/{observation['id']}").json()
    assert detail["observation"]["ai_result"] == observation["ai_result"]
    assert detail["observation"]["verification_state"] == "DEMO_CORRECTED"  # DEMO 검토는 임상 검증으로 승격하지 않는다.
    assert detail["observation"]["is_demo"] is True
    assert detail["decisions"][0]["correction"] == {"result": "retry"}
    summary = client.get(f"/api/sessions/{start['sessionId']}/clinical-summary").json()
    assert summary["rounds"] == []  # 기존 모험은 V2 5라운드 정의가 없다.
    with sessions() as db:
        assert db.query(ClinicalObservation).filter(ClinicalObservation.session_id == start["sessionId"]).count() == 1
        assert db.query(ClinicalVerification).filter(ClinicalVerification.observation_id == observation["id"]).count() == 1
        assert db.query(AuditEvent).filter(AuditEvent.action == "THERAPIST_CORRECT", AuditEvent.resource_id == observation["id"]).count() == 1


def test_login_rate_limit_and_admin_role_from_database(api):
    client, sessions = api
    for _ in range(5):
        assert client.post("/api/auth/login", json={"username": "demo", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"username": "demo", "password": "speechhero"}).status_code == 429
    salt = "22" * 16
    with sessions() as db:
        db.add(Account(username="admin", password_salt=salt, password_hash=hash_password("strongpassword", salt), role="ADMIN"))
        db.commit()
    login = client.post("/api/auth/login", json={"username": "admin", "password": "strongpassword"})
    assert login.status_code == 200
    assert login.json()["role"] == "ADMIN"
    assert client.get("/api/admin/health").status_code == 200
    assert client.get("/api/dashboard/overview").status_code == 403


def test_character_home_requires_student_and_tap_csrf(api):
    client, _ = api
    assert client.get("/api/me/home").status_code == 401
    student = student_auth(client)
    assert client.get("/api/me/home").status_code == 200
    assert client.post("/api/me/character/tap").status_code == 403
    assert client.post("/api/me/character/tap", headers=student).json()["tapCount"] == 1
    auth(client)
    assert client.get("/api/me/home").status_code == 403


def test_secure_cookie_flag_in_production_setting(api, monkeypatch):
    client, _ = api
    monkeypatch.setattr(api_module.settings, "cookie_secure", True)
    response = client.post("/api/auth/login", json={"username": "demo", "password": "speechhero"})
    assert response.status_code == 200
    assert "Secure" in response.headers["set-cookie"]


@pytest.mark.parametrize("acoustic", [
    {"durationMs": -1}, {"meanCentroidHz": 24001}, {"durationMs": 60001},
    {"snrDb": 181}, {"meanRmsDb": -161}, {"clippingRatio": -0.1},
    {"sustainSegmentsMs": [10, -1]}, {"nested": {"secret": "private"}},
])
def test_acoustic_boundaries_reject_without_policy_mutation(api, acoustic):
    client, sessions = api
    headers = student_auth(client)
    started = client.post("/api/play/start", headers=headers, json={"playCode": "HERO01"}).json()
    item = started["firstItem"]
    with sessions() as db:
        before = db.get(TrainingSession, started["sessionId"]).runtime_state.copy()
    response = client.post(f"/api/play/sessions/{started['sessionId']}/utterances", headers=headers,
                           json={"itemId": item["itemId"], "acoustic": acoustic})
    assert response.status_code == 422
    assert "private" not in response.text
    with sessions() as db:
        assert db.get(TrainingSession, started["sessionId"]).runtime_state == before
        assert not db.scalars(select(Utterance).where(Utterance.session_id == started["sessionId"])).all()


@pytest.mark.parametrize("literal", ["NaN", "Infinity", "-Infinity"])
def test_nonfinite_json_is_rejected(api, literal):
    client, _ = api
    headers = student_auth(client)
    started = client.post("/api/play/start", headers=headers, json={"playCode": "HERO01"}).json()
    item_id = started["firstItem"]["itemId"]
    response = client.post(f"/api/play/sessions/{started['sessionId']}/utterances",
                           headers={**headers, "Content-Type": "application/json"},
                           content='{"itemId":"' + item_id + '","acoustic":{"durationMs":' + literal + '}}')
    assert 400 <= response.status_code < 500


def test_activity_recommendation_requires_verified_real_evidence_and_therapist_acceptance(api):
    client, sessions = api
    therapist = auth(client)
    with sessions() as db:
        child = db.query(Child).filter(Child.child_code == "C-0001").one()
        child_id = child.id
    no_data = client.post(f"/api/children/{child_id}/activity-recommendations", headers=therapist).json()
    assert no_data["status"] == "INSUFFICIENT_DATA"
    student = student_auth(client)
    assert client.post(f"/api/children/{child_id}/activity-recommendations", headers=student).status_code == 403
    start = client.post("/api/activities", headers=student, json={"game": "magic_beam", "mode": "real"}).json()
    result = client.post(f"/api/activities/{start['sessionId']}/utterances", headers=student,
                         json={"roundIndex": 1, "itemId": start["firstItem"]["itemId"],
                               "acoustic": {"durationMs": 1300, "activeMs": 1200, "voicedMs": 1200,
                                            "bestRunMs": 1200, "fricationMs": 1200,
                                            "noiseFloorDb": -60, "meanRmsDb": -35}})
    assert result.status_code == 200
    therapist = auth(client)
    observation = client.get(f"/api/sessions/{start['sessionId']}/timeline").json()["observations"][0]
    assert client.post(f"/api/observations/{observation['id']}/decision", headers=therapist,
                       json={"action": "confirm"}).status_code == 200
    proposed = client.post(f"/api/children/{child_id}/activity-recommendations", headers=therapist).json()
    assert proposed["status"] == "PENDING"
    rec = proposed["recommendation"]
    assert rec["clinical_purpose"] and rec["reason"] and rec["evidence"]
    assert rec["confidence"] == "LOW"
    with sessions() as db:
        assert db.get(Child, child_id).collection_json.get("assignedActivity") is None
    assert client.post(f"/api/activity-recommendations/{rec['id']}/decision", headers=therapist,
                       json={"action": "accept"}).status_code == 200
    with sessions() as db:
        assert db.get(Child, child_id).collection_json["assignedActivity"] == rec["activity"]
        assert db.get(ActivityRecommendation, rec["id"]).status == "ACCEPTED"

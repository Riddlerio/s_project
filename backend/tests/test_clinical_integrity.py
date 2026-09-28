"""치료사 확인 비율의 의미와 음성 자료 삭제 범위를 검증한다."""

from sqlalchemy import func, select, text

from app.models import (ActivityRecommendation, AuditEvent, Child, ClinicalObservation, ClinicalVerification,
                        SpeechAnalysis, TrainingSession, Utterance)
from test_api_flow import api, auth, student_auth


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
    student = student_auth(client)
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
    student = student_auth(client)
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
    student = student_auth(client)
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
    student = student_auth(client)
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
    student = student_auth(client)
    started = client.post("/api/activities", headers=student, json={"game": "magic_beam", "mode": "real"}).json()
    _post(client, student, started["sessionId"], started["firstItem"]["itemId"], 1, SUCCESS)
    therapist, observations = _decide_all(client, started["sessionId"], {"action": "confirm"})
    with sessions() as db:
        child_id = db.query(Child).filter(Child.child_code == "C-0001").one().id
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

from datetime import timedelta

from sqlalchemy import select

from app.models import Child, ClinicalObservation, ClinicalVerification, now
from test_api_flow import api, auth, student_auth
from test_therapist_planning import add_child, add_session, second_therapist


def test_trends_separate_sources_and_use_latest_decision(api):
    client, sessions = api
    headers = auth(client)
    child = add_child(client, headers, "추이")
    baseline = add_session(sessions, child, ["success", "retry"], days_ago=5)
    recent = add_session(sessions, child, ["retry", "uncertain", "no_speech", "target_observed"], audio="GOOD")
    add_session(sessions, child, ["success"], mode="demo")
    add_session(sessions, child, ["success"], is_seed=True)
    add_session(sessions, child, ["success"], decision=None)
    with sessions() as db:
        row = db.scalar(select(ClinicalObservation).where(ClinicalObservation.session_id == recent, ClinicalObservation.ai_result == "retry"))
        db.add(ClinicalVerification(observation_id=row.id, therapist_id=db.get(Child, child).therapist_id,
                                   action="correct", correction={"result": "success"}, created_at=now() + timedelta(seconds=1)))
        db.commit()
    result = client.get(f"/api/children/{child}/goal-trends").json()
    group = result["groups"][0]
    assert group["baseline"]["sessionId"] == baseline
    assert group["baseline"]["successRate"] == 50
    assert group["recentSummary"]["evaluableN"] == 1
    assert group["recentSummary"]["successRate"] == 100
    assert group["delta"] == 50
    assert [row["observationN"] for row in result["sources"]] == [7, 1, 1]
    assert group["recentSummary"]["cueCounts"] == {"VISUAL": 1}


def test_poor_audio_noise_and_rejection_are_excluded(api):
    client, sessions = api
    child = add_child(client, auth(client), "품질")
    session = add_session(sessions, child, ["success", "success", "retry"], audio="POOR")
    with sessions() as db:
        rows = db.scalars(select(ClinicalObservation).where(ClinicalObservation.session_id == session).order_by(ClinicalObservation.id)).all()
        rows[0].audio_quality = "FAIR"
        rows[0].evidence = {"acoustic": {"noiseFloorDb": -30, "meanRmsDb": -10, "durationMs": 1000}}
        rows[1].audio_quality = "GOOD"
        db.add(ClinicalVerification(observation_id=rows[1].id, therapist_id=db.get(Child, child).therapist_id,
                                   action="reject", note="근거 부족", created_at=now() + timedelta(seconds=1)))
        db.commit()
    result = client.get(f"/api/sessions/{session}/insights").json()
    assert result["summary"]["evaluableN"] == 0
    assert result["summary"]["successRate"] is None
    assert result["summary"]["excludedN"] == 3
    assert len(result["rounds"]) == 5
    assert "자료 없음" in result["note"]
    assert any("NOISY_FLOOR" in row["excludedReasons"] for row in result["observations"])
    assert any("REJECTED" in row["excludedReasons"] for row in result["observations"])


def test_empty_data_and_seed_child_never_become_real(api):
    client, sessions = api
    child = add_child(client, auth(client), "샘플")
    assert client.get(f"/api/children/{child}/goal-trends").json()["groups"] == []
    session = add_session(sessions, child, ["success"])
    with sessions() as db:
        db.get(Child, child).is_seed = True
        db.commit()
    result = client.get(f"/api/sessions/{session}/insights").json()
    assert result["source"] == "SAMPLE"
    assert result["summary"]["evaluableN"] == 0
    assert "연습 자료" in result["note"]
    assert client.get(f"/api/children/{child}/goal-trends").json()["groups"] == []


def test_grouping_baseline_and_recent_window(api):
    client, sessions = api
    child = add_child(client, auth(client), "기준선")
    first = add_session(sessions, child, ["success"], days_ago=10)
    for days_ago in range(7):
        add_session(sessions, child, ["retry"], days_ago=days_ago)
    add_session(sessions, child, ["success"], level="SYLLABLE")
    result = client.get(f"/api/children/{child}/goal-trends").json()
    word = next(group for group in result["groups"] if group["level"] == "word")
    assert word["baseline"]["sessionId"] == first
    assert len(word["recent"]) == 5
    assert word["recentSummary"]["evaluableN"] == 5
    assert word["delta"] == -100
    syllable = next(group for group in result["groups"] if group["level"] == "syllable")
    assert syllable["recent"] == [] and syllable["delta"] is None


def test_insights_ownership_and_roles(api):
    client, sessions = api
    child = add_child(client, auth(client), "보호")
    session = add_session(sessions, child, ["success"])
    paths = [f"/api/children/{child}/goal-trends", f"/api/sessions/{session}/insights"]
    second_therapist(client, sessions)
    for path in paths:
        assert client.get(path).status_code == 404
    student_auth(client)
    for path in paths:
        assert client.get(path).status_code == 403
    client.cookies.clear()
    for path in paths:
        assert client.get(path).status_code == 401


def test_phoneme_position_and_activity_are_not_pooled(api):
    client, sessions = api
    child = add_child(client, auth(client), "목표 분리")
    session = add_session(sessions, child, ["success"] * 4)
    with sessions() as db:
        rows = db.scalars(select(ClinicalObservation).where(ClinicalObservation.session_id == session)
                          .order_by(ClinicalObservation.id)).all()
        rows[1].target_phoneme = "ㅈ"
        rows[2].word_position = "final"
        rows[3].activity = "conversation_quest"
        db.commit()
    groups = client.get(f"/api/children/{child}/goal-trends").json()["groups"]
    assert len(groups) == 4
    assert all(group["baseline"]["evaluableN"] == 1 for group in groups)
    assert all(group["recentSummary"]["evaluableN"] == 0 for group in groups)


def test_note_reflects_existing_correction_api_without_mutating_observation(api):
    client, sessions = api
    headers = auth(client)
    child = add_child(client, headers, "교정")
    session = add_session(sessions, child, ["retry"], decision=None)
    path = f"/api/sessions/{session}/insights"
    before = client.get(path).json()
    observation = before["observations"][0]
    assert observation["included"] is False
    assert client.post(f"/api/observations/{observation['id']}/decision", headers=headers,
                       json={"action": "correct", "correctedResult": "success", "note": "직접 확인"}).status_code == 200
    after = client.get(path).json()
    assert after["summary"]["successRate"] == 100
    assert after["observations"][0]["aiResult"] == "retry"
    assert after["observations"][0]["result"] == "success"
    assert after["observations"][0]["provenance"] == "THERAPIST"
    assert "평가 가능 1건 중 성공 1건" in after["note"]
    assert client.get(path).json() == after

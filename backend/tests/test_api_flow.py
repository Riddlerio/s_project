"""임시 SQLite DB에서 아동 발화와 치료사 의사결정 루프를 검증한다."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app import main as api_module
from app.db import Base, get_db, make_engine
from app.models import AIRecommendation, Child, TherapistFeedback, TrainingGoal, TrainingSession


@pytest.fixture
def api(tmp_path, monkeypatch):
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
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_utterance_analysis_decision_dashboard_feedback(api):
    client, sessions = api
    headers = auth(client)
    assert client.get("/api/dashboard/overview").status_code == 401
    overview = client.get("/api/dashboard/overview", headers=headers).json()
    assert overview["activeChildren"]
    child = next(c for c in overview["activeChildren"] if c["child_code"] == "C-0001")
    initial_goal = child["currentGoal"]["version"]
    start = client.post("/api/play/start", json={"playCode": "HERO01", "mode": "demo"}).json()
    assert start["firstItem"]["game"] == "monster_tower"
    play_headers = {"X-Play-Token": start["playToken"]}
    item = start["firstItem"]
    result = client.post(f"/api/play/sessions/{start['sessionId']}/utterances", headers=play_headers,
                         json={"itemId": item["itemId"], "attemptIndex": 1, "transcript": "따과",
                               "recognizer": "demo_script", "acoustic": {"durationMs": 900, "voicedMs": 900,
                               "meanRmsDb": -20, "peakRmsDb": -12}, "elapsedSec": 8})
    assert result.status_code == 200
    assert any(e["type"] in ("TARGET_RETRY", "HINT_REQUIRED") for e in result.json()["events"])
    detail = client.get(f"/api/sessions/{start['sessionId']}", headers=headers).json()
    assert detail["utterances"][0]["analysis"]["method"]
    assert detail["decisions"]
    utterance_id = detail["utterances"][0]["id"]
    feedback = client.post(f"/api/utterances/{utterance_id}/feedback", headers=headers,
                           json={"action": "not_error", "note": "치료사 확인"})
    assert feedback.status_code == 200
    assert feedback.json()["analysis"]["final_result"] == "success"
    assert client.post(f"/api/play/sessions/{start['sessionId']}/complete", headers=play_headers,
                       json={"elapsedSec": 8}).status_code == 200
    progress = client.get(f"/api/children/{child['id']}/progress", headers=headers).json()
    assert any(row["sessionId"] == start["sessionId"] for row in progress["sessions"])
    with sessions() as db:
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
    assert client.post(f"/api/recommendations/{rec_id}/decision", json=body).status_code == 401
    response = client.post(f"/api/recommendations/{rec_id}/decision", headers=headers, json=body)
    assert response.status_code == 200, response.text
    assert response.json()["recommendation"]["status"] == expected
    with sessions() as db:
        assert db.get(AIRecommendation, rec_id).status == expected
        assert db.scalar(select(TherapistFeedback).where(TherapistFeedback.recommendation_id == rec_id)).action == action
        active = db.scalar(select(TrainingGoal).where(TrainingGoal.child_id == child_id, TrainingGoal.status == "active"))
        assert active.version == previous_version + (action != "reject")

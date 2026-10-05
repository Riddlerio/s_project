"""대화 회기 횟수는 출처별로 읽으며 게임 정확도에 합산하지 않는다."""
from datetime import timedelta

from sqlalchemy import select

from app.models import HoyaChatSession, HoyaChatTurn, TrainingGoal, now
from test_api_flow import api, auth, student_auth
from test_therapist_planning import add_child, add_session, second_therapist


def add_chat(sessions, child, *, mode="real", seed=False, ago=0):
    with sessions() as db:
        goal = db.scalar(select(TrainingGoal).where(TrainingGoal.child_id == child))
        chat = HoyaChatSession(child_id=child, goal_id=goal.id, mode=mode, is_seed=seed,
                               started_at=now() - timedelta(days=ago))
        db.add(chat)
        db.flush()
        for index, evidence in enumerate(["TARGET_OBSERVED", "TARGET_OBSERVED", "UNCERTAIN", "NO_SPEECH", "TARGET_OBSERVED"], 1):
            db.add(HoyaChatTurn(session_id=chat.id, turn_index=index, status="PROCESSING" if index == 5 else "COMPLETED",
                               recognizer="demo_script", speech_evidence=evidence,
                               strategy="CONTINUE_OR_EXPAND", child_transcript="비공개 문장"))
        db.commit()
        return chat.id


def test_chat_counts_exclude_processing_and_separate_sources(api):
    client, sessions = api
    child = add_child(client, auth(client), "대화기록")
    real = add_chat(sessions, child, ago=2)
    demo = add_chat(sessions, child, mode="demo", ago=1)
    sample = add_chat(sessions, child, seed=True)
    result = client.get(f"/api/children/{child}/conversation-insights")
    assert result.status_code == 200
    rows = result.json()["sessions"]
    assert [row["sessionId"] for row in rows] == [sample, demo, real]
    assert [row["source"] for row in rows] == ["SAMPLE", "DEMO", "REAL"]
    assert all(row["targetObservedN"] == 2 and row["completedTurnN"] == 4 for row in rows)
    assert all(row["uncertainN"] == row["noSpeechN"] == 1 for row in rows)
    assert "비공개 문장" not in result.text
    assert "successRate" not in result.text
    game = add_session(sessions, child, ["success"])
    assert client.get(f"/api/sessions/{game}/conversation-insights").json() == result.json()


def test_chat_insights_ownership_and_roles(api):
    client, sessions = api
    child = add_child(client, auth(client), "접근격리")
    game = add_session(sessions, child, [])
    add_chat(sessions, child)
    paths = [f"/api/children/{child}/conversation-insights", f"/api/sessions/{game}/conversation-insights"]
    second_therapist(client, sessions)
    for path in paths:
        assert client.get(path).status_code == 404
    student_auth(client)
    for path in paths:
        assert client.get(path).status_code == 403
    client.cookies.clear()
    for path in paths:
        assert client.get(path).status_code == 401


def test_chat_empty_and_latest_ten_sessions(api):
    client, sessions = api
    child = add_child(client, auth(client), "최근기록")
    path = f"/api/children/{child}/conversation-insights"
    assert client.get(path).json()["sessions"] == []
    ids = [add_chat(sessions, child, ago=index) for index in range(12)]
    assert [row["sessionId"] for row in client.get(path).json()["sessions"]] == ids[:10]

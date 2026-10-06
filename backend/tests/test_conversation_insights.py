"""대화 회기 횟수는 출처별로 읽으며 게임 정확도에 합산하지 않는다."""
from datetime import timedelta

from sqlalchemy import func, select

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
    assert result.json()["hiddenEmptyN"] == 0
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


def test_chat_hides_only_finished_zero_turn_sessions_for_both_routes(api):
    client, sessions = api
    child = add_child(client, auth(client), "세 대화 확인")
    with sessions() as db:
        goal = db.scalar(select(TrainingGoal).where(TrainingGoal.child_id == child))
        start = now()
        finished_empty = HoyaChatSession(child_id=child, goal_id=goal.id, mode="real",
                                         status="completed", started_at=start)
        finished_with_turn = HoyaChatSession(child_id=child, goal_id=goal.id, mode="real",
                                             status="completed", started_at=start + timedelta(minutes=1))
        active_empty = HoyaChatSession(child_id=child, goal_id=goal.id, mode="real",
                                       status="active", started_at=start + timedelta(minutes=2))
        db.add_all([finished_empty, finished_with_turn, active_empty])
        db.flush()
        for index, evidence in enumerate(["TARGET_OBSERVED", "UNCERTAIN", "NO_SPEECH"], 1):
            db.add(HoyaChatTurn(session_id=finished_with_turn.id, turn_index=index, status="COMPLETED",
                                recognizer="demo_script", speech_evidence=evidence,
                                strategy="CONTINUE_OR_EXPAND"))
        valid_id, active_id = finished_with_turn.id, active_empty.id
        db.commit()

    game = add_session(sessions, child, [])
    child_path = f"/api/children/{child}/conversation-insights"
    game_path = f"/api/sessions/{game}/conversation-insights"
    child_result = client.get(child_path)
    game_result = client.get(game_path)
    assert child_result.status_code == game_result.status_code == 200
    assert game_result.json() == child_result.json()
    payload = child_result.json()
    assert payload["hiddenEmptyN"] == 1
    assert [row["sessionId"] for row in payload["sessions"]] == [active_id, valid_id]
    assert payload["sessions"][0]["completedTurnN"] == 0
    assert {key: payload["sessions"][1][key] for key in
            ("completedTurnN", "targetObservedN", "uncertainN", "noSpeechN")} == {
                "completedTurnN": 3, "targetObservedN": 1, "uncertainN": 1, "noSpeechN": 1}
    with sessions() as db:
        assert db.scalar(select(func.count()).select_from(HoyaChatSession).where(
            HoyaChatSession.child_id == child)) == 3
    second_therapist(client, sessions)
    assert client.get(child_path).status_code == 404
    assert client.get(game_path).status_code == 404


def test_chat_hides_finished_empty_sessions_before_limit_without_deleting_them(api):
    client, sessions = api
    child = add_child(client, auth(client), "빈 대화 기록")
    valid_ids = [add_chat(sessions, child, ago=index + 1) for index in range(11)]
    with sessions() as db:
        goal = db.scalar(select(TrainingGoal).where(TrainingGoal.child_id == child))
        db.get(HoyaChatSession, valid_ids[0]).status = "completed"
        recent = now() + timedelta(days=1)
        finished_empty = HoyaChatSession(child_id=child, goal_id=goal.id, mode="real",
                                         status="completed", started_at=recent)
        aborted_empty = HoyaChatSession(child_id=child, goal_id=goal.id, mode="demo",
                                        status="aborted", started_at=recent + timedelta(minutes=1))
        processing_only = HoyaChatSession(child_id=child, goal_id=goal.id, mode="real",
                                          status="aborted", started_at=recent + timedelta(minutes=2))
        active_empty = HoyaChatSession(child_id=child, goal_id=goal.id, mode="real",
                                       status="active", started_at=recent + timedelta(minutes=3))
        db.add_all([finished_empty, aborted_empty, processing_only, active_empty])
        db.flush()
        hidden_ids = [finished_empty.id, aborted_empty.id, processing_only.id]
        active_id = active_empty.id
        db.add(HoyaChatTurn(session_id=processing_only.id, turn_index=1, status="PROCESSING",
                            recognizer="demo_script", speech_evidence="UNCERTAIN",
                            strategy="CONTINUE_OR_EXPAND"))
        db.commit()

    game = add_session(sessions, child, [])
    child_result = client.get(f"/api/children/{child}/conversation-insights")
    game_result = client.get(f"/api/sessions/{game}/conversation-insights")
    assert child_result.status_code == game_result.status_code == 200
    assert game_result.json() == child_result.json()
    payload = child_result.json()
    assert payload["hiddenEmptyN"] == 3
    assert [row["sessionId"] for row in payload["sessions"]] == [active_id, *valid_ids[:9]]
    assert payload["sessions"][0]["completedTurnN"] == 0
    assert payload["sessions"][1]["completedTurnN"] == 4
    with sessions() as db:
        assert all(db.get(HoyaChatSession, session_id) is not None for session_id in hidden_ids)
        assert db.scalar(select(HoyaChatTurn).where(HoyaChatTurn.session_id == processing_only.id)) is not None

import pytest
from types import SimpleNamespace
from sqlalchemy import select

from app.games.rounds import GAME_ROUNDS, next_difficulty
from app.games.evaluation import evaluate_round
from app.models import AIRecommendation, ClinicalObservation, TrainingSession
from test_api_flow import api, real_child_auth, student_auth


def test_all_games_have_five_distinct_rounds():
    assert len(GAME_ROUNDS) == 5
    for game, rounds in GAME_ROUNDS.items():
        assert len(rounds) == 5
        assert [r.index for r in rounds] == [1, 2, 3, 4, 5]
        assert len({r.id for r in rounds}) == 5
        assert all(r.child_title and r.clinical_focus and r.generalization_level and r.rule for r in rounds)


def test_difficulty_operating_rule_excludes_uncertain_and_limits_changes():
    assert next_difficulty(2, 2, 3, 0, 0, False) == (3, 1, 0, False)
    assert next_difficulty(4, 3, 3, 2, 0, False) == (4, 2, 0, False)
    assert next_difficulty(3, 0, 0, 0, 0, False) == (3, 0, 0, False)
    assert next_difficulty(3, 0, 3, 0, 0, False) == (3, 0, 1, False)
    assert next_difficulty(3, 0, 3, 0, 1, False) == (2, 0, 0, True)
    assert next_difficulty(2, 0, 3, 0, 1, True) == (2, 0, 2, True)


@pytest.mark.parametrize("game,round_index", [(game, index) for game in GAME_ROUNDS for index in range(1, 6)])
def test_each_round_separates_no_speech_and_poor_audio(game, round_index):
    definition = GAME_ROUNDS[game][round_index - 1]
    goal = SimpleNamespace(target_phoneme="ㅅ")
    item = {"game": game, "displayText": "사과"}
    silent = evaluate_round(definition, item, None, {"source": "microphone", "activeMs": 0}, goal)
    assert silent.result == "no_speech"
    noisy = evaluate_round(definition, item, "사과", {"source": "microphone", "activeMs": 1000,
                           "durationMs": 1200, "noiseFloorDb": -60, "meanRmsDb": -55}, goal)
    assert noisy.result == "uncertain"
    assert "POOR_AUDIO" in noisy.pattern_tags


@pytest.mark.parametrize("game", [game for game in GAME_ROUNDS if game != "daegu_crossing"])
def test_five_rounds_reach_session_complete_without_failure(api, game):
    client, sessions = api
    headers = student_auth(client)
    started = client.post("/api/activities", headers=headers, json={"game": game, "mode": "demo"})
    assert started.status_code == 200, started.text
    result = started.json()
    assert len(result["rounds"]) == 5
    for index in range(1, 6):
        round_def = GAME_ROUNDS[game][index - 1]
        item = result["nextItem"] if "nextItem" in result else result["firstItem"]
        acoustic = {"durationMs": 5000, "activeMs": 4000,
                    "voicedMs": 4000, "bestRunMs": 4000, "fricationMs": 4000,
                    "sustainSegmentsMs": [1600, 1600, 1600], "pauseTotalMs": 900,
                    "onsetFricationMs": 500, "voicedAfterFricationMs": 300, "energyMean01": 0.5}
        response = client.post(f"/api/activities/{started.json()['sessionId']}/utterances", headers=headers,
                               json={"roundIndex": index, "itemId": item["itemId"], "attemptIndex": 1,
                                     "transcript": item["displayText"], "acoustic": acoustic})
        assert response.status_code == 200, response.text
        result = response.json()
        assert any(event["type"] == "ROUND_CLEAR" for event in result["events"])
    assert result["sessionComplete"]
    assert any(event["type"] == "SESSION_COMPLETE" for event in result["events"])
    completed = client.post(f"/api/play/sessions/{started.json()['sessionId']}/complete", headers=headers,
                            json={"elapsedSec": 300})
    assert completed.status_code == 200, completed.text
    with sessions() as db:
        observations = db.scalars(select(ClinicalObservation).where(ClinicalObservation.session_id == started.json()["sessionId"])).all()
        assert {row.round_index for row in observations} == {1, 2, 3, 4, 5}
        assert db.get(TrainingSession, started.json()["sessionId"]).runtime_state["roundIndex"] == 5
        assert not db.scalars(select(AIRecommendation).where(AIRecommendation.session_id == started.json()["sessionId"])).all()


def test_round_index_is_server_authoritative(api):
    client, _ = api
    headers = student_auth(client)
    result = client.post("/api/activities", headers=headers, json={"game": "magic_beam"}).json()
    response = client.post(f"/api/activities/{result['sessionId']}/utterances", headers=headers,
                           json={"roundIndex": 5, "itemId": result["firstItem"]["itemId"]})
    assert response.status_code == 409


def test_activity_resume_uses_server_round_and_attempt(api):
    client, _ = api
    headers = student_auth(client)
    start = client.post("/api/activities", headers=headers, json={"game": "magic_beam"}).json()
    session_id = start["sessionId"]
    first = client.get(f"/api/activities/{session_id}", headers=headers).json()
    assert first["currentRound"]["index"] == 1
    assert first["firstItem"]["itemId"] == start["firstItem"]["itemId"]
    assert first["nextAttemptIndex"] == 1
    assert first["completedRounds"] == []
    response = client.post(f"/api/activities/{session_id}/utterances", headers=headers,
                           json={"roundIndex": 1, "itemId": first["firstItem"]["itemId"],
                                 "attemptIndex": 1, "acoustic": {"durationMs": 1400, "activeMs": 1200,
                                 "bestRunMs": 1200, "fricationMs": 1200}})
    assert response.status_code == 200
    resumed = client.get(f"/api/activities/{session_id}", headers=headers).json()
    assert resumed["currentRound"]["index"] == 2
    assert resumed["firstItem"]["itemId"] == response.json()["nextItem"]["itemId"]
    assert resumed["completedRounds"] == [1]


def test_activity_resume_cannot_access_another_child_session(api):
    client, _ = api
    first = student_auth(client, "HERO01")
    session_id = client.post("/api/activities", headers=first, json={"game": "magic_beam"}).json()["sessionId"]
    second = student_auth(client, "HERO02")
    assert client.get(f"/api/activities/{session_id}", headers=second).status_code == 404


def test_conversation_non_target_choice_advances_without_clinical_score(api):
    client, sessions = api
    headers = student_auth(client)
    started = client.post("/api/activities", headers=headers, json={"game": "conversation_quest"}).json()
    response = client.post(f"/api/activities/{started['sessionId']}/utterances", headers=headers,
                           json={"roundIndex": 1, "itemId": started["firstItem"]["itemId"],
                                 "transcript": "바나나", "acoustic": {"durationMs": 800}})
    assert response.status_code == 200
    result = response.json()
    assert result["currentRound"]["index"] == 2
    assert result["dialogue"]["provider"] == "DEMO_RULES"
    assert {event["type"] for event in result["events"]} >= {"STORY_CONTINUE", "ROUND_CLEAR"}
    assert not any(event["type"] == "TARGET_RETRY" for event in result["events"])
    with sessions() as db:
        assert not db.scalars(select(ClinicalObservation).where(ClinicalObservation.session_id == started["sessionId"])).all()


def test_rejected_observation_is_excluded_from_verified_metric(api):
    client, _ = api
    student, _child = real_child_auth(client)
    started = client.post("/api/activities", headers=student, json={"game": "magic_beam", "mode": "real"}).json()
    client.post(f"/api/activities/{started['sessionId']}/utterances", headers=student,
                json={"roundIndex": 1, "itemId": started["firstItem"]["itemId"],
                      "acoustic": {"durationMs": 1300, "activeMs": 1200, "voicedMs": 1200,
                                   "bestRunMs": 1200, "fricationMs": 1200,
                                   "noiseFloorDb": -60, "meanRmsDb": -35}}).raise_for_status()
    from test_api_flow import auth
    therapist = auth(client)
    timeline = client.get(f"/api/sessions/{started['sessionId']}/timeline").json()
    observation = timeline["observations"][0]
    assert client.post(f"/api/observations/{observation['id']}/decision", headers=therapist,
                       json={"action": "reject", "note": "잡음"}).status_code == 200
    summary = client.get(f"/api/sessions/{started['sessionId']}/clinical-summary").json()
    assert summary["rounds"][0]["totalObservedN"] == 1
    assert summary["rounds"][0]["evaluableN"] == 1
    assert summary["rounds"][0]["verifiedN"] == 0
    assert summary["rounds"][0]["verifiedRate"] is None


def test_demo_observation_is_visible_but_excluded_from_clinical_rate(api):
    client, _ = api
    student = student_auth(client)
    started = client.post("/api/activities", headers=student, json={"game": "magic_beam"}).json()
    client.post(f"/api/activities/{started['sessionId']}/utterances", headers=student,
                json={"roundIndex": 1, "itemId": started["firstItem"]["itemId"],
                      "acoustic": {"durationMs": 1300, "activeMs": 1200, "voicedMs": 1200,
                                   "bestRunMs": 1200, "fricationMs": 1200}}).raise_for_status()
    from test_api_flow import auth
    therapist = auth(client)
    timeline = client.get(f"/api/sessions/{started['sessionId']}/timeline", headers=therapist).json()
    observation_id = timeline["observations"][0]["id"]
    client.post(f"/api/observations/{observation_id}/decision", headers=therapist,
                json={"action": "confirm", "note": "데모 확인"}).raise_for_status()
    summary = client.get(f"/api/sessions/{started['sessionId']}/clinical-summary", headers=therapist).json()
    assert summary["rounds"][0]["totalObservedN"] == 0
    assert summary["rounds"][0]["evaluableN"] == 0
    assert summary["rounds"][0]["demoN"] == 1
    assert summary["rounds"][0]["verifiedN"] == 0
    assert summary["rounds"][0]["verifiedRate"] is None


def test_activity_uncertain_three_times_moves_to_next_round_neutrally(api):
    client, sessions = api
    headers = student_auth(client)
    started = client.post("/api/activities", headers=headers,
                          json={"game": "magic_beam", "mode": "real"}).json()
    responses = []
    for _ in range(3):
        response = client.post(f"/api/activities/{started['sessionId']}/utterances", headers=headers,
                               json={"roundIndex": 1, "itemId": started["firstItem"]["itemId"],
                                     "acoustic": {"durationMs": 1200, "activeMs": 1000,
                                                  "noiseFloorDb": -60, "meanRmsDb": -55}})
        assert response.status_code == 200, response.text
        responses.append(response.json())
    assert all(any(event["type"] == "LISTEN_AGAIN" for event in response["events"]) for response in responses[:2])
    assert responses[2]["currentRound"]["index"] == 2
    assert {event["type"] for event in responses[2]["events"]} >= {"ITEM_ADVANCE", "ROUND_CLEAR"}
    assert not any(event["type"] == "TARGET_RETRY" for response in responses for event in response["events"])
    with sessions() as db:
        assert db.get(TrainingSession, started["sessionId"]).runtime_state["totalAttempts"] == 0

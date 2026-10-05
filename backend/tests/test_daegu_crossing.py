"""10줄 진행과 음향 근사 경계, 임상 관찰·보상 분리를 검증한다."""
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.games.crossing import build_stages
from app.games.evaluation import evaluate_round
from app.games.rounds import GAME_ROUNDS
from app.models import Child, ClinicalObservation, GameEvent, RoundMaterialReward, TrainingGoal, TrainingSession, Utterance
from test_api_flow import api, auth, real_child_auth, student_auth

GOOD = {"durationMs": 700, "activeMs": 500, "onsetFricationMs": 60,
        "voicedAfterFricationMs": 80, "noiseFloorDb": -60, "meanRmsDb": -35}
RETRY = {**GOOD, "onsetFricationMs": 59}
QUIET = {"durationMs": 700, "activeMs": 0}
POOR = {**GOOD, "meanRmsDb": -55}


def start(client, headers, mode="demo"):
    response = client.post("/api/activities", headers=headers, json={"game": "daegu_crossing", "mode": mode})
    assert response.status_code == 200, response.text
    return response.json()


def request(current, acoustic=GOOD):
    item = current.get("nextItem", current.get("firstItem"))
    return {"roundIndex": current["roundIndex"], "itemId": item["itemId"],
            "attemptIndex": current["nextAttemptIndex"], "acoustic": acoustic}


def send(client, headers, sid, current, acoustic=GOOD):
    response = client.post(f"/api/activities/{sid}/utterances", headers=headers, json=request(current, acoustic))
    assert response.status_code == 200, response.text
    return response.json()


def goal(**changes):
    return SimpleNamespace(**{"target_phoneme": "ㅅ", "word_position": "initial", "level": "syllable",
                              "target_sound": "사", "excluded_words": [], **changes})


@pytest.mark.parametrize("onset,voiced,result", [(59, 80, "retry"), (60, 79, "retry"),
                                               (60, 80, "success"), (61, 81, "success"),
                                               (0, 80, "retry"), (60, 0, "retry")])
def test_onset_boundaries_are_inclusive(onset, voiced, result):
    analyzed = evaluate_round(GAME_ROUNDS["daegu_crossing"][0], {}, None,
                             {**GOOD, "source": "microphone", "onsetFricationMs": onset,
                              "voicedAfterFricationMs": voiced}, goal())
    assert analyzed.result == result


@pytest.mark.parametrize("acoustic,result", [
    (QUIET, "no_speech"), (POOR, "uncertain"),
    ({**GOOD, "onsetFricationMs": None}, "uncertain"),
    ({**GOOD, "voicedAfterFricationMs": None}, "uncertain"),
    ({"activeMs": 500, "onsetFricationMs": 60, "voicedAfterFricationMs": 80}, "uncertain"),
])
def test_quality_gate_and_missing_measurements_are_neutral(acoustic, result):
    analyzed = evaluate_round(GAME_ROUNDS["daegu_crossing"][0], {}, "사과",
                             {**acoustic, "source": "microphone"}, goal())
    assert analyzed.result == result


def test_exact_ten_item_schedule_levels_unique_ids_and_exclusions():
    stages = build_stages(goal())
    assert [len(stage["items"]) for stage in stages] == [2] * 5
    rows = [row for stage in stages for row in stage["items"]]
    assert len({row["itemId"] for row in rows}) == 10
    assert [row["displayText"] for row in rows] == ["사", "사", "사", "사", "소", "시", "사과", "수박", "수", "시소"]
    assert [row["level"] for row in rows] == ["syllable"] * 6 + ["word", "word", "syllable", "word"]
    assert all(row["game"] == "daegu_crossing" and row["pictureKey"] == row["displayText"] for row in rows)
    words = [row for stage in build_stages(goal(level="word")) for row in stage["items"]]
    assert [row["displayText"] for row in words] == ["사과", "사과", "사과", "사과", "소리", "시소", "사과", "수박", "수박", "시소"]
    assert all(row["level"] == "word" for row in words)
    excluded = build_stages(goal(excluded_words=["사", "사과"]))
    assert not {"사", "사과"} & {row["displayText"] for stage in excluded for row in stage["items"]}


@pytest.mark.parametrize("field,value", [("target_phoneme", "ㄹ"), ("word_position", "medial"),
                                         ("word_position", "final"), ("level", "short_sentence")])
def test_unsupported_goal_returns_422(api, field, value):
    client, sessions = api
    headers = student_auth(client)
    with sessions() as db:
        child = db.scalar(select(Child).where(Child.play_code == "HERO01"))
        current = db.scalar(select(TrainingGoal).where(TrainingGoal.child_id == child.id, TrainingGoal.status == "active"))
        setattr(current, field, value)
        db.commit()
    response = client.post("/api/activities", headers=headers, json={"game": "daegu_crossing"})
    assert response.status_code == 422
    assert "어두 /ㅅ/" in response.json()["detail"]


def assert_public(value):
    forbidden = {"clinicalFocus", "generalizationLevel", "elicitationType", "itemSource", "evidence",
                 "score", "aiScore", "successRate", "accuracy", "stars", "roundStars", "xp",
                 "totalXp", "badges", "monsterCards", "material", "materialsEarned", "reason"}
    if isinstance(value, dict):
        assert not forbidden & value.keys()
        for nested in value.values():
            assert_public(nested)
    elif isinstance(value, list):
        for nested in value:
            assert_public(nested)


def test_ten_stripes_complete_without_rewards_and_completion_is_idempotent(api):
    client, sessions = api
    headers = student_auth(client)
    current = start(client, headers)
    sid = current["sessionId"]
    with sessions() as db:
        child = db.get(Child, db.get(TrainingSession, sid).child_id)
        before = child.xp, child.collection_json
    assert_public(current)
    assert (current["roundIndex"], current["itemIndexInRound"], current["stripeIndex"], current["triesLeft"], current["modelCue"]) == (1, 1, 1, 3, True)
    # 재시도 뒤 성공을 포함해 기존 배지 경로로 새 보상이 생기지 않음을 확인한다.
    current = send(client, headers, sid, current, RETRY)
    for stripe in range(1, 11):
        current = send(client, headers, sid, current)
        assert_public(current)
        assert current["result"] == "success"
        assert current["sessionComplete"] == (stripe == 10)
        assert any(event["type"] == "ROUND_CLEAR" for event in current["events"]) == (stripe % 2 == 0)
        if stripe < 10:
            assert (current["stripeIndex"], current["roundIndex"], current["itemIndexInRound"]) == (stripe + 1, stripe // 2 + 1, stripe % 2 + 1)
            assert current["triesLeft"] == 3 and current["nextAttemptIndex"] == 1
            assert current["modelCue"] == (stripe < 2)
    assert (current["roundIndex"], current["itemIndexInRound"], current["stripeIndex"], current["triesLeft"], current["modelCue"]) == (5, 2, 10, 0, False)
    assert current["nextItem"] is None and current["currentRound"] is None
    resumed = client.get(f"/api/activities/{sid}", headers=headers).json()
    assert resumed["sessionComplete"] and resumed["firstItem"] is None and resumed["currentRound"] is None
    completed = client.post(f"/api/play/sessions/{sid}/complete", headers=headers, json={"elapsedSec": 300})
    assert completed.status_code == 200, completed.text
    assert completed.json() == {"totalAttempts": 11, "durationSec": 300, "sessionComplete": True}
    assert client.post(f"/api/play/sessions/{sid}/complete", headers=headers, json={"elapsedSec": 999}).json() == completed.json()
    with sessions() as db:
        state = db.get(TrainingSession, sid).runtime_state
        child = db.get(Child, db.get(TrainingSession, sid).child_id)
        assert (child.xp, child.collection_json) == before
        assert state["xp"] == 0 and state.get("roundStars", []) == []
        assert not db.scalars(select(RoundMaterialReward).where(RoundMaterialReward.session_id == sid)).all()
        assert not db.scalars(select(GameEvent).where(GameEvent.session_id == sid, GameEvent.type == "REWARD")).all()
        observations = db.scalars(select(ClinicalObservation).where(ClinicalObservation.session_id == sid)).all()
        assert len(observations) == 11
        assert {row.round_index for row in observations} == {1, 2, 3, 4, 5}


def test_retry_budget_neutral_streak_and_resume_are_independent(api):
    client, sessions = api
    headers = student_auth(client)
    current = start(client, headers, mode="real")
    sid = current["sessionId"]
    current = send(client, headers, sid, current, RETRY)
    assert current["triesLeft"] == 2 and current["nextAttemptIndex"] == 2
    for acoustic in (QUIET, POOR):
        current = send(client, headers, sid, current, acoustic)
        assert current["triesLeft"] == 2 and current["stripeIndex"] == 1
    resumed = client.get(f"/api/activities/{sid}", headers=headers).json()
    assert resumed["firstItem"] == current["nextItem"]
    assert (resumed["triesLeft"], resumed["nextAttemptIndex"]) == (2, 4)
    current = send(client, headers, sid, resumed, RETRY)
    assert current["triesLeft"] == 1 and current["nextAttemptIndex"] == 5
    for acoustic in (QUIET, POOR):
        current = send(client, headers, sid, current, acoustic)
        assert current["stripeIndex"] == 1 and current["triesLeft"] == 1
    current = send(client, headers, sid, current, RETRY)
    assert current["stripeIndex"] == 2 and current["triesLeft"] == 3 and current["nextAttemptIndex"] == 1
    with sessions() as db:
        assert db.get(TrainingSession, sid).runtime_state["totalAttempts"] == 3
        assert len(db.scalars(select(ClinicalObservation).where(ClinicalObservation.session_id == sid)).all()) == 7


@pytest.mark.parametrize("acoustic", [QUIET, POOR])
def test_three_neutral_inputs_advance_one_stripe_without_consuming_tries(api, acoustic):
    client, sessions = api
    headers = student_auth(client)
    current = start(client, headers, mode="real")
    sid = current["sessionId"]
    for n in range(3):
        current = send(client, headers, sid, current, acoustic)
        assert current["triesLeft"] == 3 and current["stripeIndex"] == (2 if n == 2 else 1)
        assert not any(event["type"] in {"TARGET_RETRY", "REWARD", "ROUND_CLEAR"} for event in current["events"])
    with sessions() as db:
        assert db.get(TrainingSession, sid).runtime_state["totalAttempts"] == 0


def test_claim_takeover_replay_and_ownership_preserve_cursor(api):
    client, sessions = api
    headers = student_auth(client)
    current = start(client, headers)
    sid = current["sessionId"]
    claimed = client.post(f"/api/activities/{sid}/claim", headers=headers, json={}).json()
    lease_headers = {**headers, "X-Activity-Lease": claimed["leaseToken"]}
    current = send(client, lease_headers, sid, claimed, QUIET)
    assert client.post(f"/api/activities/{sid}/utterances", headers=lease_headers, json=request(claimed, QUIET)).status_code == 409
    assert client.post(f"/api/activities/{sid}/pause", headers=lease_headers).status_code == 200
    takeover = client.post(f"/api/activities/{sid}/claim", headers=headers, json={"takeover": True}).json()
    assert takeover["firstItem"] == current["nextItem"]
    assert (takeover["stripeIndex"], takeover["nextAttemptIndex"], takeover["triesLeft"]) == (1, 2, 3)
    assert takeover["leaseToken"] != claimed["leaseToken"]
    assert client.post(f"/api/activities/{sid}/utterances", headers=lease_headers, json=request(takeover)).status_code == 409
    other = student_auth(client, "HERO02")
    assert client.get(f"/api/activities/{sid}", headers=other).status_code == 404
    with sessions() as db:
        assert len(db.scalars(select(Utterance).where(Utterance.session_id == sid)).all()) == 1


def test_early_completion_rejected_even_without_lease(api):
    client, _ = api
    headers = student_auth(client)
    current = start(client, headers)
    assert client.post(f"/api/play/sessions/{current['sessionId']}/complete", headers=headers, json={}).status_code == 409


@pytest.mark.parametrize("field,value", [("itemIndexInRound", 3), ("stripeIndex", 11), ("stripeIndex", 2)])
def test_corrupted_crossing_cursor_rejected(api, field, value):
    client, sessions = api
    headers = student_auth(client)
    current = start(client, headers)
    with sessions() as db:
        session = db.get(TrainingSession, current["sessionId"])
        session.runtime_state = {**session.runtime_state, field: value}
        db.commit()
    assert client.get(f"/api/activities/{current['sessionId']}", headers=headers).status_code == 409


def test_real_observations_capture_actual_level_cue_source_and_neutral_exclusion(api):
    client, sessions = api
    headers, child = real_child_auth(client)
    with sessions() as db:
        current_goal = db.scalar(select(TrainingGoal).where(TrainingGoal.child_id == child["id"], TrainingGoal.status == "active"))
        current_goal.level = "syllable"
        db.commit()
    current = start(client, headers, mode="real")
    sid = current["sessionId"]
    for _ in range(2):
        current = send(client, headers, sid, current)
    current = send(client, headers, sid, current, QUIET)
    assert current["modelCue"]
    current = send(client, headers, sid, current)
    assert not current["modelCue"]
    while not current["sessionComplete"]:
        current = send(client, headers, sid, current)
    with sessions() as db:
        observations = db.scalars(select(ClinicalObservation).where(ClinicalObservation.session_id == sid)
                                 .order_by(ClinicalObservation.created_at)).all()
        assert len(observations) == 11
        assert observations[0].cue_type == "AUDITORY_MODEL" and observations[0].independence == "MODELED"
        assert observations[2].cue_type == "VISUAL" and observations[2].ai_result == "no_speech"
        assert observations[3].cue_type == "AUDITORY_MODEL" and observations[3].evidence["elicitationType"] == "DIRECT_IMITATION"
        assert observations[4].cue_type == "VISUAL" and observations[4].independence == "INDEPENDENT"
        last = [row for row in observations if row.round_index == 5]
        assert [row.generalization_level for row in last] == ["SYLLABLE", "WORD"]
        assert [row.evidence["stripeIndex"] for row in last] == [9, 10]
        assert all(row.evidence["itemSource"] == "TRAINING_BANK" for row in observations)
        assert all(row.evidence["acoustic"]["source"] == "microphone" for row in observations)
    therapist = auth(client)
    summary = client.get(f"/api/sessions/{sid}/clinical-summary", headers=therapist).json()
    assert summary["rounds"][1]["totalObservedN"] == 3
    assert summary["rounds"][1]["evaluableN"] == 2
    assert summary["rounds"][1]["noSpeechN"] == 1


def test_all_neutral_session_finishes_with_zero_evaluable_attempts(api):
    client, sessions = api
    headers = student_auth(client)
    current = start(client, headers, mode="real")
    sid = current["sessionId"]
    for stripe in range(1, 11):
        for index, acoustic in enumerate((QUIET, POOR, QUIET), start=1):
            current = send(client, headers, sid, current, acoustic)
            assert current["triesLeft"] == (0 if current["sessionComplete"] else 3)
            assert current["nextAttemptIndex"] == (index + 1 if index < 3 else 3 if stripe == 10 else 1)
            assert current["stripeIndex"] == min(10, stripe + int(index == 3))
            assert not any(event["type"] in {"TARGET_RETRY", "TARGET_SUCCESS", "REWARD"} for event in current["events"])
    assert current["sessionComplete"]
    response = client.post(f"/api/play/sessions/{sid}/complete", headers=headers, json={"elapsedSec": 300})
    assert response.status_code == 200 and response.json()["totalAttempts"] == 0
    with sessions() as db:
        observations = db.scalars(select(ClinicalObservation).where(ClinicalObservation.session_id == sid)).all()
        assert len(observations) == 30
        assert {row.ai_result for row in observations} == {"no_speech", "uncertain"}
        assert db.get(TrainingSession, sid).runtime_state["totalAttempts"] == 0


def test_wall_clock_timeout_does_not_record_a_timing_miss_or_advance(api):
    from datetime import timedelta
    from app.models import now

    client, sessions = api
    headers = student_auth(client)
    current = start(client, headers)
    sid = current["sessionId"]
    with sessions() as db:
        session = db.get(TrainingSession, sid)
        session.runtime_state = {**session.runtime_state, "roundStartedAt": (now() - timedelta(minutes=10)).isoformat()}
        db.commit()
    response = client.post(f"/api/activities/{sid}/utterances", headers=headers,
                           json={**request(current, RETRY), "elapsedSec": 600})
    assert response.status_code == 200
    result = response.json()
    assert result["stripeIndex"] == 1 and result["triesLeft"] == 2
    assert [event["type"] for event in result["events"]] == ["TARGET_RETRY"]
    with sessions() as db:
        observed = db.scalar(select(ClinicalObservation).where(ClinicalObservation.session_id == sid))
        assert observed.ai_result == "retry"
        assert not {"timingMiss", "timingError", "pop", "popped"} & observed.evidence.keys()

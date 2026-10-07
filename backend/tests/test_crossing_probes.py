"""피드백 없는 일반화 확인의 권한·상태·낱말·중립 저장과 연습 집계 분리를 검증한다."""
from datetime import timedelta

import pytest
from sqlalchemy import select

from app.games.crossing import build_probes, build_stages, is_probe_observation
from app.models import ActivityLease, ClinicalObservation, GameEvent, ProgressMetric, TrainingGoal, TrainingPlan, TrainingSession, now
from test_api_flow import api, auth, real_child_auth, student_auth
from test_daegu_crossing import GOOD, POOR, QUIET, RETRY, assert_public, finish_lap, goal, request, send, start


def open_probes(client, headers, sid):
    return client.post(f"/api/activities/{sid}/probes", headers=headers)


def prepared(api, real=False):
    client, sessions = api
    headers, child = real_child_auth(client) if real else (student_auth(client), None)
    current = start(client, headers, mode="real" if real else "demo")
    sid = current["sessionId"]
    finish_lap(client, headers, sid, current)
    return client, sessions, headers, sid, child


def test_probe_selection_uses_bank_order_and_excludes_all_practice_and_goal_words():
    configured = goal(excluded_words=["사탕"])
    selected = build_probes(configured, build_stages(configured))
    assert [item["displayText"] for item in selected] == ["사자", "소풍", "수건"]
    assert all(item["level"] == "word" and item["game"] == "daegu_crossing" for item in selected)
    assert len({item["itemId"] for item in selected}) == 3
    assert not {"사과", "수박", "시소", "소리", "사탕"} & {item["displayText"] for item in selected}


def test_probe_selection_also_excludes_words_used_as_practice_replacements():
    configured = goal(level="word", excluded_words=["사과", "수박", "시소", "소리"])
    stages = build_stages(configured)
    assert {item["displayText"] for stage in stages for item in stage["items"]} == {"사자"}
    assert [item["displayText"] for item in build_probes(configured, stages)] == ["사탕", "소풍", "수건"]


def test_probe_requires_a_completed_lap_and_other_child_is_404(api):
    client, _ = api
    headers = student_auth(client)
    current = start(client, headers)
    sid = current["sessionId"]
    assert open_probes(client, headers, sid).status_code == 409
    send(client, headers, sid, current)
    assert open_probes(client, headers, sid).status_code == 409
    other, _ = real_child_auth(client)
    assert open_probes(client, other, sid).status_code == 404
    assert open_probes(client, other, "missing").status_code == 404


def test_probe_rejects_non_crossing_activity(api):
    client, _ = api
    headers = student_auth(client)
    current = client.post("/api/activities", headers=headers, json={"game": "monster_adventure"}).json()
    assert open_probes(client, headers, current["sessionId"]).status_code == 409


def test_probe_start_is_once_only_blocks_laps_and_resumes_without_model(api):
    client, sessions, headers, sid, _ = prepared(api)
    opened = open_probes(client, headers, sid)
    assert opened.status_code == 200, opened.text
    body = opened.json()
    assert_public(body)
    assert body["firstItem"]["displayText"] == "사자"
    assert (body["probeStarted"], body["probeComplete"], body["probeIndex"], body["probeTotal"]) == (True, False, 1, 3)
    assert (body["roundIndex"], body["stripeIndex"], body["modelCue"], body["triesLeft"], body["sessionComplete"]) == (5, 10, False, 2, False)
    assert [event["type"] for event in body["events"]] == ["PROBE_START"]
    assert client.get(f"/api/activities/{sid}", headers=headers).json()["firstItem"] == body["firstItem"]
    assert open_probes(client, headers, sid).status_code == 409
    assert client.post(f"/api/activities/{sid}/laps", headers=headers).status_code == 409
    with sessions() as db:
        assert len(db.scalars(select(GameEvent).where(GameEvent.session_id == sid, GameEvent.type == "PROBE_START")).all()) == 1


@pytest.mark.parametrize("acoustic,stored_result", [(GOOD, "success"), (RETRY, "retry")])
def test_probe_records_without_judgment_events_or_public_result(api, acoustic, stored_result):
    client, sessions, headers, sid, _ = prepared(api, real=True)
    current = open_probes(client, headers, sid).json()
    current = send(client, headers, sid, current, acoustic)
    assert "result" not in current and "score" not in current
    assert_public(current)
    assert [event["type"] for event in current["events"]] == ["PROBE_RECORDED"]
    assert current["probeIndex"] == 2 and current["nextItem"]["displayText"] == "사탕"
    assert not current["modelCue"] and current["triesLeft"] == 2
    with sessions() as db:
        rows = db.scalars(select(ClinicalObservation).where(ClinicalObservation.session_id == sid)).all()
        probes = [row for row in rows if is_probe_observation(row)]
        assert len(probes) == 1
        row = probes[0]
        assert row.ai_result == stored_result
        assert row.evidence["probe"] is True and row.evidence["elicitationType"] == "GENERALIZATION_PROBE"
        assert row.evidence["itemSource"] == "UNPRACTICED_BANK"
        assert row.cue_type == "PICTURE_PROMPT" and row.independence == "INDEPENDENT"
        assert row.generalization_level == "WORD" and row.round_id == "daegu_crossing.probe"


@pytest.mark.parametrize("acoustic", [QUIET, POOR])
def test_uncertain_or_no_speech_repeats_same_probe_once_then_advances(api, acoustic):
    client, sessions, headers, sid, _ = prepared(api, real=True)
    current = open_probes(client, headers, sid).json()
    first_item = current["firstItem"]
    first = send(client, headers, sid, current, acoustic)
    assert first["nextItem"] == first_item and first["probeIndex"] == 1
    assert first["nextAttemptIndex"] == 2 and first["triesLeft"] == 1
    assert "result" not in first and not first["modelCue"]
    assert [event["type"] for event in first["events"]] == ["PROBE_RECORDED"]
    # 똑같은 첫 제출을 다시 보내도 저장하지 않는다.
    assert client.post(f"/api/activities/{sid}/utterances", headers=headers, json=request(current, acoustic)).status_code == 409
    second = send(client, headers, sid, first, acoustic)
    assert second["probeIndex"] == 2 and second["nextItem"]["itemId"] != first_item["itemId"]
    assert second["nextAttemptIndex"] == 1 and second["triesLeft"] == 2
    assert [event["type"] for event in second["events"]] == ["PROBE_RECORDED"]
    with sessions() as db:
        probes = [row for row in db.scalars(select(ClinicalObservation).where(ClinicalObservation.session_id == sid)).all()
                  if is_probe_observation(row)]
        assert len(probes) == 2 and {row.attempt_number for row in probes} == {1, 2}


def test_three_probe_cards_complete_neutrally_and_leave_practice_attempt_count(api):
    client, sessions, headers, sid, _ = prepared(api, real=True)
    current = open_probes(client, headers, sid).json()
    for text in ("사자", "사탕", "소풍"):
        item = current.get("nextItem", current.get("firstItem"))
        assert item["displayText"] == text
        current = send(client, headers, sid, current)
        assert "result" not in current
        assert all(event["type"] in {"PROBE_RECORDED", "PROBE_COMPLETE"} for event in current["events"])
    assert current["probeComplete"] and current["sessionComplete"]
    assert current["nextItem"] is None and current["currentRound"] is None
    assert [event["type"] for event in current["events"]] == ["PROBE_RECORDED", "PROBE_COMPLETE"]
    assert open_probes(client, headers, sid).status_code == 409
    assert client.post(f"/api/activities/{sid}/laps", headers=headers).status_code == 409
    completed = client.post(f"/api/play/sessions/{sid}/complete", headers=headers, json={"elapsedSec": 200})
    assert completed.status_code == 200 and completed.json()["totalAttempts"] == 10
    assert client.post(f"/api/play/sessions/{sid}/complete", headers=headers, json={}).json() == completed.json()
    assert open_probes(client, headers, sid).status_code == 409
    with sessions() as db:
        metric = db.scalar(select(ProgressMetric).where(ProgressMetric.session_id == sid))
        assert metric.attempts == 10 and metric.successes == 10


@pytest.mark.parametrize("started_probe", [False, True])
def test_session_completion_allows_optional_or_partial_probe(api, started_probe):
    client, _, headers, sid, _ = prepared(api)
    if started_probe:
        open_probes(client, headers, sid)
    response = client.post(f"/api/play/sessions/{sid}/complete", headers=headers, json={})
    assert response.status_code == 200
    assert open_probes(client, headers, sid).status_code == 409


def test_no_available_probe_words_skips_cards_and_can_finish(api):
    client, sessions = api
    headers = student_auth(client)
    with sessions() as db:
        from app.models import Child
        child = db.scalar(select(Child).where(Child.play_code == "HERO01"))
        current_goal = db.scalar(select(TrainingGoal).where(TrainingGoal.child_id == child.id, TrainingGoal.status == "active"))
        current_goal.excluded_words = ["사자", "사탕", "소풍", "수건"]
        db.commit()
    current = start(client, headers)
    sid = current["sessionId"]
    finish_lap(client, headers, sid, current)
    body = open_probes(client, headers, sid).json()
    assert (body["probeTotal"], body["probeIndex"], body["probeComplete"], body["sessionComplete"]) == (0, 0, True, True)
    assert body["firstItem"] is None and body["currentRound"] is None
    assert client.post(f"/api/play/sessions/{sid}/complete", headers=headers, json={}).status_code == 200


def test_probe_start_uses_the_same_lease_and_pause_checks_as_laps(api):
    client, sessions, headers, sid, _ = prepared(api)
    claimed = client.post(f"/api/activities/{sid}/claim", headers=headers, json={}).json()
    leased = {**headers, "X-Activity-Lease": claimed["leaseToken"]}
    assert open_probes(client, headers, sid).status_code == 409
    assert open_probes(client, {**headers, "X-Activity-Lease": "wrong"}, sid).status_code == 409
    assert client.post(f"/api/activities/{sid}/pause", headers=leased).status_code == 200
    assert open_probes(client, leased, sid).status_code == 409
    reclaimed = client.post(f"/api/activities/{sid}/claim", headers=leased, json={}).json()
    leased = {**headers, "X-Activity-Lease": reclaimed["leaseToken"]}
    opened = open_probes(client, leased, sid)
    assert opened.status_code == 200
    with sessions() as db:
        db.get(ActivityLease, sid).heartbeat_at = now() - timedelta(minutes=2)
        db.commit()
    assert client.post(f"/api/activities/{sid}/utterances", headers=leased,
                       json=request(opened.json())).status_code == 409


@pytest.mark.parametrize("field,value", [("probeStarted", "true"), ("probeIndex", 4), ("probeAttemptsUsed", 3),
                                         ("probeComplete", True), ("probeItems", [{}])])
def test_corrupt_probe_state_is_409(api, field, value):
    client, sessions, headers, sid, _ = prepared(api)
    with sessions() as db:
        session = db.get(TrainingSession, sid)
        session.runtime_state = {**session.runtime_state, field: value}
        db.commit()
    assert open_probes(client, headers, sid).status_code == 409


def test_probe_start_rolls_back_a_corrupt_plan(api):
    client, sessions, headers, sid, _ = prepared(api)
    with sessions() as db:
        session = db.get(TrainingSession, sid)
        db.get(TrainingPlan, session.plan_id).plan_json = {"stages": [{}]}
        db.commit()
    assert open_probes(client, headers, sid).status_code == 409
    with sessions() as db:
        assert not db.get(TrainingSession, sid).runtime_state.get("probeStarted")
        assert not db.scalars(select(GameEvent).where(GameEvent.session_id == sid, GameEvent.type == "PROBE_START")).all()

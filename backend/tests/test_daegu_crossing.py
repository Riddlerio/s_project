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


# 2026-10-06: 시작 마찰 기준을 70ms에서 60ms로 한 칸 내렸다(바르게 말한 '사과'가 아이폰에서 자주 '다시'가 됨).
@pytest.mark.parametrize("onset,voiced,result", [(59, 80, "retry"), (60, 79, "retry"),
                                               (60, 80, "success"), (61, 81, "success"),
                                               (40, 200, "retry"), (0, 80, "retry"), (60, 0, "retry")])
def test_onset_boundaries_are_inclusive(onset, voiced, result):
    analyzed = evaluate_round(GAME_ROUNDS["daegu_crossing"][0], {}, None,
                             {**GOOD, "source": "microphone", "onsetFricationMs": onset,
                              "voicedAfterFricationMs": voiced}, goal())
    assert analyzed.result == result


@pytest.mark.parametrize("acoustic,result", [
    (QUIET, "no_speech"), (POOR, "uncertain"),
    ({**GOOD, "onsetFricationMs": None}, "uncertain"),
    ({**GOOD, "voicedAfterFricationMs": None}, "uncertain"),
    ({"activeMs": 500, "onsetFricationMs": 70, "voicedAfterFricationMs": 80}, "uncertain"),
    # 잡음보다 15dB 미만이면 판단하지 않는다(공용 음질 기준 8dB보다 이 게임만 엄격).
    ({**GOOD, "meanRmsDb": -45.1}, "uncertain"), ({**GOOD, "meanRmsDb": -45}, "success"),
])
def test_quality_gate_and_missing_measurements_are_neutral(acoustic, result):
    analyzed = evaluate_round(GAME_ROUNDS["daegu_crossing"][0], {}, "사과",
                             {**acoustic, "source": "microphone"}, goal())
    assert analyzed.result == result


# 화면 src/game/crossing/crossingFlow.test.ts의 MEASURED 표와 같은 실측값·같은 결과(2026-10-05, 2026-10-06 60ms로 조정).
# (이름, 길이, 시작 마찰, 마찰 뒤 유성, 평균 크기, 잡음, 결과). 2-#39·40은 표시 '아'였지만 실제로 '사'.
MEASURED = [
    ("#2 사", 880, 80, 357, -41.8, -67.2, "success"), ("#8 사", 840, 78.8, 534, -43.3, -67.2, "success"),
    ("#1 사(마찰 없음)", 2480, 0, 0, -38.1, -67.2, "retry"), ("#3 사(마찰 없음)", 440, 0, 0, -34.9, -67.2, "retry"),
    ("#6 사(바람 소리만)", 1659, 0, 0, -35.1, -67.2, "retry"), ("#7 사(작음)", 1556, 0, 0, -57.9, -67.2, "uncertain"),
    ("#9 다", 522, 0, 0, -32.6, -67.2, "retry"), ("#10 다", 3479, 0, 0, -46.1, -67.2, "retry"),
    ("#11 다", 758, 0, 0, -35.5, -67.2, "retry"), ("#12 다", 440, 0, 0, -35.9, -67.2, "retry"),
    ("#13 다", 401, 0, 0, -35.0, -67.2, "retry"), ("#14 다", 1239, 0, 0, -43.6, -67.2, "retry"),
    ("#15 스~ 뒤 모음", 5138, 1304, 276, -33.8, -67.2, "success"), ("#20 스~(작음)", 1480, 0, 0, -58.5, -67.2, "uncertain"),
    ("#21 스(마찰 60ms)", 360, 60, 218, -34.0, -63.5, "success"), ("#22 스(마찰 80ms)", 399, 79.9, 217, -35.5, -63.5, "success"),
    ("#23 스(마찰 40ms)", 382, 40, 238, -37.3, -63.5, "retry"), ("#27 스(마찰 99ms)", 460, 98.9, 297, -37.1, -63.5, "success"),
    ("#30 스~(작음)", 279, 0, 0, -51.7, -63.5, "uncertain"),
    ("2-#15 차", 519, 59.1, 355, -38.2, -62.8, "retry"), ("2-#16 차", 500, 39.2, 339, -40.0, -62.8, "retry"),
    ("2-#17 자", 519, 59, 378, -36.3, -62.8, "retry"), ("2-#18 자", 500, 39.5, 376, -38.6, -62.8, "retry"),
    ("2-#13 타", 541, 0, 0, -33.5, -62.8, "retry"), ("2-#34 아", 959, 0, 0, -32.4, -62.8, "retry"),
    ("2-#39 사(표시 아)", 758, 79.1, 276, -40.9, -62.8, "success"), ("2-#40 사(표시 아)", 458, 98, 257, -41.1, -62.8, "success"),
    ("2-#7 스", 579, 138.7, 355, -37.7, -62.8, "success"), ("2-#27 사(60ms)", 580, 60, 418, -35.5, -62.8, "success"),
]


@pytest.mark.parametrize("label,duration,onset,voiced,rms,noise,result", MEASURED, ids=[row[0] for row in MEASURED])
def test_measured_rows_match_client_rule(label, duration, onset, voiced, rms, noise, result):
    analyzed = evaluate_round(GAME_ROUNDS["daegu_crossing"][0], {}, None,
                             {"source": "microphone", "durationMs": duration, "activeMs": duration, "onsetFricationMs": onset,
                              "voicedAfterFricationMs": voiced, "meanRmsDb": rms, "noiseFloorDb": noise, "clippingRatio": 0}, goal())
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


def test_event_texts_for_crossing_are_korean_without_zero_score():
    from types import SimpleNamespace as NS
    from app.analysis.translation import therapist_text
    goal = NS(target_phoneme="ㅅ")
    assert therapist_text("ROUND_START", {"index": 2}) == "2라운드 시작"
    assert therapist_text("ROUND_CLEAR", {"index": 5}) == "5라운드 마침"
    assert therapist_text("ITEM_ADVANCE", {}) == "다음 항목으로"
    assert "실패 아님" in therapist_text("LISTEN_AGAIN", {})
    assert therapist_text("TARGET_PRESENTED", {"item": {"displayText": "사", "level": "syllable"}}) == "제시: 사 (음절)"
    # 음향 근사 게임은 점수가 0이라 점수를 적지 않는다. 점수가 있는 게임은 그대로 적는다.
    assert therapist_text("TARGET_SUCCESS", {}, {"displayText": "사"}, goal, NS(score=0)) == "목표 /ㅅ/ 성공 — 사"
    assert therapist_text("TARGET_SUCCESS", {}, {"displayText": "사과"}, goal, NS(score=92)) == "목표 /ㅅ/ 성공 — 사과 (점수 92)"

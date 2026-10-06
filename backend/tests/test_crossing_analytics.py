"""건너기 집계 API의 권한, 근거 분모, 자동 이유와 읽기 전용 계약을 검증한다."""
import sqlite3
from datetime import timedelta

import pytest
from sqlalchemy import select

from app.db import Base
from app.games.evaluation import ONSET_FRICATION_MS, ONSET_MIN_SNR_DB, VOICED_AFTER_FRICATION_MS
from app.models import Child, ClinicalObservation, ClinicalVerification, TrainingSession, Utterance, now
from test_api_flow import api, auth, student_auth
from test_crossing_insights import GOOD
from test_therapist_planning import add_child, add_session, second_therapist


def crossing_session(sessions, child_id, results, rhythm=None, **kwargs):
    """기존 관찰 fixture에 활동과 회기 시작 박자 스냅샷을 넣는다."""
    session_id = add_session(sessions, child_id, results, **kwargs)
    with sessions() as db:
        session = db.get(TrainingSession, session_id)
        session.runtime_state = {"activityGame": "daegu_crossing"}
        if rhythm is not None:
            session.runtime_state = {**session.runtime_state, "rhythm": rhythm}
        rows = list(db.scalars(select(ClinicalObservation).where(
            ClinicalObservation.session_id == session_id,
        ).order_by(ClinicalObservation.created_at, ClinicalObservation.id)))
        for row in rows:
            row.activity = "daegu_crossing"
            row.evidence = {"targetText": "따", "acoustic": dict(GOOD)}
            db.get(Utterance, row.utterance_id).game = "daegu_crossing"
        db.commit()
        return session_id, [row.id for row in rows]


def analytics(client, child_id):
    response = client.get(f"/api/therapist/children/{child_id}/crossing-analytics")
    assert response.status_code == 200, response.text
    return response.json()


def point(client, child_id, session_id):
    return next(row for row in analytics(client, child_id)["sessions"] if row["sessionId"] == session_id)


def test_endpoint_requires_a_therapist_and_child_ownership(api):
    client, sessions = api
    child_id = add_child(client, auth(client), "접근 권한")
    second_therapist(client, sessions)
    path = f"/api/therapist/children/{child_id}/crossing-analytics"
    assert client.get(path).status_code == 404
    assert client.get("/api/therapist/children/not-present/crossing-analytics").status_code == 404
    student_auth(client)
    assert client.get(path).status_code == 403
    client.cookies.clear()
    assert client.get(path).status_code == 401


def test_empty_child_has_no_sessions_and_no_mastery(api):
    client, _sessions = api
    child_id = add_child(client, auth(client), "자료 없음")
    body = analytics(client, child_id)
    assert body["sessions"] == []
    assert body["mastery"] == {"threshold": 0.8, "consecutiveSessions": 3, "met": False}
    assert any("DEMO" in note for note in body["notes"])


def test_only_crossing_observations_count_and_history_is_chronological(api):
    client, sessions = api
    child_id = add_child(client, auth(client), "활동 구분")
    add_session(sessions, child_id, ["success"])
    newer, newer_ids = crossing_session(sessions, child_id, ["success", "retry"], days_ago=1)
    older, _ = crossing_session(sessions, child_id, ["retry"], days_ago=2)
    empty, _ = crossing_session(sessions, child_id, [], days_ago=0)
    with sessions() as db:
        db.get(ClinicalObservation, newer_ids[1]).activity = "monster_adventure"
        db.commit()
    body = analytics(client, child_id)
    assert [row["sessionId"] for row in body["sessions"]] == [older, newer, empty]
    row = next(row for row in body["sessions"] if row["sessionId"] == newer)
    assert (row["attemptN"], row["reviewedN"], row["confirmedSuccessN"], row["confirmedRate"]) == (1, 1, 1, 1)
    empty_row = next(row for row in body["sessions"] if row["sessionId"] == empty)
    assert empty_row["attemptN"] == 0 and empty_row["confirmedRate"] is None


def test_same_start_time_has_a_stable_session_id_order(api):
    client, sessions = api
    child_id = add_child(client, auth(client), "동일 시작 시각")
    first, _ = crossing_session(sessions, child_id, ["success"])
    second, _ = crossing_session(sessions, child_id, ["retry"])
    with sessions() as db:
        started_at = now()
        for session_id in (first, second):
            db.get(TrainingSession, session_id).started_at = started_at
        db.commit()
    assert [row["sessionId"] for row in analytics(client, child_id)["sessions"]] == sorted([first, second])


def test_legacy_crossing_observations_are_kept_without_a_runtime_marker(api):
    client, sessions = api
    child_id = add_child(client, auth(client), "과거 활동 식별")
    session_id, _ = crossing_session(sessions, child_id, ["success"])
    with sessions() as db:
        db.get(TrainingSession, session_id).runtime_state = {}
        db.commit()
    row = point(client, child_id, session_id)
    assert row["attemptN"] == 1 and row["confirmedRate"] == 1


@pytest.mark.parametrize("mode,seed_session,seed_child,source", [
    ("demo", False, False, "DEMO"),
    ("real", True, False, "SAMPLE"),
    ("real", False, True, "SAMPLE"),
])
def test_demo_and_sample_sources_never_enter_the_clinical_denominator(api, mode, seed_session, seed_child, source):
    client, sessions = api
    child_id = add_child(client, auth(client), "임상 출처 구분")
    session_id, _ = crossing_session(sessions, child_id, ["success", "retry"], mode=mode, is_seed=seed_session)
    if seed_child:
        with sessions() as db:
            db.get(Child, child_id).is_seed = True
            db.commit()
    row = point(client, child_id, session_id)
    assert row["source"] == source
    assert row["attemptN"] == 2
    assert row["reviewedN"] == row["confirmedSuccessN"] == 0
    assert row["confirmedRate"] is None
    assert row["byLevel"]["word"] == {"reviewedN": 0, "confirmedSuccessN": 0}
    assert analytics(client, child_id)["mastery"]["met"] is False


def test_missing_verification_cannot_be_replaced_by_cached_state(api):
    client, sessions = api
    child_id = add_child(client, auth(client), "결정 기록 없음")
    session_id, ids = crossing_session(sessions, child_id, ["success", "retry"], decision=None)
    with sessions() as db:
        for observation_id in ids:
            db.get(ClinicalObservation, observation_id).verification_state = "CONFIRMED"
        db.commit()
    row = point(client, child_id, session_id)
    assert row["reviewedN"] == row["confirmedSuccessN"] == 0
    assert row["confirmedRate"] is None


def test_last_decision_and_corrected_result_determine_the_denominator(api):
    client, sessions = api
    child_id = add_child(client, auth(client), "최신 교정")
    session_id, ids = crossing_session(sessions, child_id, ["success", "retry", "success", "success", "retry"], decision=None)
    with sessions() as db:
        therapist_id = db.get(Child, child_id).therapist_id
        earlier = now() - timedelta(minutes=1)
        later = now()
        for observation_id in ids:
            db.add(ClinicalVerification(observation_id=observation_id, therapist_id=therapist_id,
                                        action="confirm", created_at=earlier))
        for observation_id, action, result in [
            (ids[0], "reject", None),
            (ids[1], "correct", "success"),
            (ids[2], "correct", "retry"),
            (ids[3], "correct", "uncertain"),
        ]:
            db.add(ClinicalVerification(observation_id=observation_id, therapist_id=therapist_id,
                                        action=action, correction={"result": result} if result else {}, created_at=later))
        db.commit()
    row = point(client, child_id, session_id)
    assert (row["reviewedN"], row["confirmedSuccessN"]) == (3, 1)
    assert row["confirmedRate"] == pytest.approx(1 / 3)


def test_same_decision_time_uses_the_last_id_and_rejection_removes_evidence(api):
    client, sessions = api
    child_id = add_child(client, auth(client), "동일 결정 시각")
    session_id, ids = crossing_session(sessions, child_id, ["success"], decision=None)
    with sessions() as db:
        therapist_id = db.get(Child, child_id).therapist_id
        timestamp = now()
        for decision_id, action in [("decision-z", "reject"), ("decision-a", "confirm")]:
            db.add(ClinicalVerification(id=decision_id, observation_id=ids[0], therapist_id=therapist_id,
                                        action=action, created_at=timestamp))
        db.commit()
    row = point(client, child_id, session_id)
    assert row["reviewedN"] == 0 and row["confirmedRate"] is None


def test_deferred_results_and_poor_audio_are_not_failures_in_the_denominator(api):
    client, sessions = api
    child_id = add_child(client, auth(client), "평가 보류")
    session_id, ids = crossing_session(sessions, child_id,
                                        ["success", "retry", "uncertain", "no_speech", "target_observed", "success"])
    with sessions() as db:
        db.get(ClinicalObservation, ids[-1]).audio_quality = "POOR"
        db.commit()
    row = point(client, child_id, session_id)
    assert (row["attemptN"], row["reviewedN"], row["confirmedSuccessN"], row["confirmedRate"]) == (6, 2, 1, 0.5)
    # 기존 회기 요약과 같이 자동 결과 불확실·무발화만 보류 건수로 센다.
    assert row["deferredN"] == 2


def test_therapist_correction_of_good_audio_uses_the_corrected_result(api):
    client, sessions = api
    child_id = add_child(client, auth(client), "보류 결과 교정")
    session_id, _ = crossing_session(sessions, child_id, ["uncertain"], decision="correct", audio="GOOD")
    row = point(client, child_id, session_id)
    assert (row["reviewedN"], row["confirmedSuccessN"], row["confirmedRate"]) == (1, 1, 1)


@pytest.mark.parametrize("result,audio", [("uncertain", "GOOD"), ("no_speech", "GOOD"),
                                         ("target_observed", "GOOD"), ("success", "POOR")])
def test_a_session_with_only_excluded_confirmed_records_has_no_rate(api, result, audio):
    client, sessions = api
    child_id = add_child(client, auth(client), "평가 가능 자료 없음")
    session_id, _ = crossing_session(sessions, child_id, [result], audio=audio)
    row = point(client, child_id, session_id)
    assert row["reviewedN"] == row["confirmedSuccessN"] == 0
    assert row["confirmedRate"] is None


def test_clinical_denominator_keeps_the_existing_planning_evidence_quality_rule(api):
    client, sessions = api
    child_id = add_child(client, auth(client), "계획 근거 규칙")
    session_id, ids = crossing_session(sessions, child_id, ["success"])
    with sessions() as db:
        # 원 관찰은 GOOD이므로 음향 경고를 별도 분모 규칙으로 추가하지 않는다.
        db.get(ClinicalObservation, ids[0]).evidence = {"acoustic": {
            **GOOD, "durationMs": 150, "clippingRatio": 0.03, "meanRmsDb": -50,
        }}
        db.commit()
    row = point(client, child_id, session_id)
    assert (row["reviewedN"], row["confirmedSuccessN"], row["confirmedRate"]) == (1, 1, 1)


def test_syllable_and_word_counts_use_the_same_clinical_filter(api):
    client, sessions = api
    child_id = add_child(client, auth(client), "음절 단어")
    session_id, ids = crossing_session(sessions, child_id, ["success", "retry", "success", "retry", "uncertain"])
    with sessions() as db:
        for observation_id in ids[:2]:
            db.get(ClinicalObservation, observation_id).generalization_level = "SYLLABLE"
        db.commit()
    row = point(client, child_id, session_id)
    assert row["byLevel"] == {
        "syllable": {"reviewedN": 2, "confirmedSuccessN": 1},
        "word": {"reviewedN": 2, "confirmedSuccessN": 1},
    }
    assert (row["reviewedN"], row["confirmedSuccessN"], row["confirmedRate"]) == (4, 2, 0.5)


@pytest.mark.parametrize("stored", [None, {}, {"startBpm": 84}, {"startBpm": "84", "allowFaster": True},
                                    {"startBpm": 74, "allowFaster": True}])
def test_missing_or_invalid_rhythm_does_not_use_current_child_settings(api, stored):
    client, sessions = api
    headers = auth(client)
    child_id = add_child(client, headers, "과거 박자 없음")
    session_id, _ = crossing_session(sessions, child_id, [], rhythm=stored)
    response = client.put(f"/api/therapist/children/{child_id}/game-settings", headers=headers,
                          json={"daeguCrossing": {"startBpm": 100, "allowFaster": False}})
    assert response.status_code == 200, response.text
    assert point(client, child_id, session_id)["rhythm"] is None


def test_valid_rhythm_is_the_session_snapshot(api):
    client, sessions = api
    headers = auth(client)
    child_id = add_child(client, headers, "과거 박자 보존")
    saved = {"startBpm": 92, "allowFaster": False}
    session_id, _ = crossing_session(sessions, child_id, ["success"], rhythm=saved)
    response = client.put(f"/api/therapist/children/{child_id}/game-settings", headers=headers,
                          json={"daeguCrossing": {"startBpm": 100, "allowFaster": True}})
    assert response.status_code == 200, response.text
    assert point(client, child_id, session_id)["rhythm"] == saved


def test_automatic_reasons_follow_onset_priority_and_evaluation_thresholds(api):
    client, sessions = api
    child_id = add_child(client, auth(client), "자동 이유")
    session_id, ids = crossing_session(sessions, child_id, ["retry", "retry", "retry", "success"], decision=None)
    acoustics = [
        {**GOOD, "onsetFricationMs": 0, "voicedAfterFricationMs": 0},
        {**GOOD, "onsetFricationMs": ONSET_FRICATION_MS - 1, "voicedAfterFricationMs": 0},
        {**GOOD, "onsetFricationMs": ONSET_FRICATION_MS, "voicedAfterFricationMs": VOICED_AFTER_FRICATION_MS - 1},
        {**GOOD, "onsetFricationMs": ONSET_FRICATION_MS, "voicedAfterFricationMs": VOICED_AFTER_FRICATION_MS},
    ]
    with sessions() as db:
        for observation_id, acoustic in zip(ids, acoustics):
            db.get(ClinicalObservation, observation_id).evidence = {"acoustic": acoustic}
        db.commit()
    row = point(client, child_id, session_id)
    assert row["autoReasons"] == {"ok": 1, "noFrication": 1, "shortFrication": 1, "noVowel": 1}
    assert row["confirmedRate"] is None


@pytest.mark.parametrize("result,acoustic,audio", [
    ("uncertain", GOOD, "GOOD"),
    ("no_speech", {"activeMs": 0}, "GOOD"),
    ("retry", {}, "GOOD"),
    ("success", {**GOOD, "voicedAfterFricationMs": None}, "GOOD"),
    ("success", GOOD, "POOR"),
    ("success", {**GOOD, "source": "keyboard"}, "GOOD"),
    ("retry", {**GOOD, "activeMs": 0}, "GOOD"),
    ("retry", {**GOOD, "onsetFricationMs": True}, "GOOD"),
    ("retry", {**GOOD, "durationMs": 299}, "GOOD"),
    ("retry", {**GOOD, "clippingRatio": 0.01}, "GOOD"),
    ("retry", {**GOOD, "meanRmsDb": GOOD["noiseFloorDb"] + ONSET_MIN_SNR_DB - 1}, "GOOD"),
    ("success", {key: value for key, value in GOOD.items() if key != "activeMs"}, "GOOD"),
    ("success", {key: value for key, value in GOOD.items() if key != "durationMs"}, "GOOD"),
])
def test_deferred_or_missing_acoustics_never_invent_automatic_reason_counts(api, result, acoustic, audio):
    client, sessions = api
    child_id = add_child(client, auth(client), "자동 이유 없는 자료")
    session_id, ids = crossing_session(sessions, child_id, [result], audio=audio)
    with sessions() as db:
        db.get(ClinicalObservation, ids[0]).evidence = {"acoustic": acoustic}
        db.commit()
    assert point(client, child_id, session_id)["autoReasons"] == {
        "ok": 0, "noFrication": 0, "shortFrication": 0, "noVowel": 0,
    }


def test_legacy_acoustic_source_and_missing_activity_values_remain_readable(api):
    client, sessions = api
    child_id = add_child(client, auth(client), "과거 음향 호환")
    session_id, ids = crossing_session(sessions, child_id, ["success"])
    acoustic = {key: value for key, value in GOOD.items() if key not in {"source", "activeMs"}}
    with sessions() as db:
        db.get(ClinicalObservation, ids[0]).evidence = {"acoustic": acoustic}
        db.commit()
    assert point(client, child_id, session_id)["autoReasons"]["ok"] == 1


@pytest.mark.parametrize("history,expected", [
    (["pass", "pass"], False),
    (["pass", "pass", "pass"], True),
    (["fail", "pass", "pass", "pass"], True),
    (["pass", "pass", "pass", "fail"], False),
    (["pass", "pass", "pass", "pending"], False),
])
def test_mastery_uses_the_latest_three_real_crossing_sessions(api, history, expected):
    client, sessions = api
    child_id = add_child(client, auth(client), "숙달 조건")
    for index, status in enumerate(history):
        results = ["success"] * (4 if status != "fail" else 3) + ["retry"] * (1 if status != "fail" else 2)
        crossing_session(sessions, child_id, results, days_ago=len(history) - index,
                         decision=None if status == "pending" else "confirm")
    # 다른 게임의 최근 회기는 건너기 연속 회기 조건을 끊지 않는다.
    add_session(sessions, child_id, ["retry"], days_ago=0)
    assert analytics(client, child_id)["mastery"] == {
        "threshold": 0.8, "consecutiveSessions": 3, "met": expected,
    }


def test_demo_and_seed_sessions_do_not_break_or_complete_the_mastery_run(api):
    client, sessions = api
    child_id = add_child(client, auth(client), "연속 실제 회기")
    for days_ago in (6, 4):
        crossing_session(sessions, child_id, ["success"] * 4 + ["retry"], days_ago=days_ago)
    crossing_session(sessions, child_id, ["retry"], mode="demo", days_ago=5)
    crossing_session(sessions, child_id, ["success"], is_seed=True, days_ago=3)
    assert analytics(client, child_id)["mastery"]["met"] is False
    crossing_session(sessions, child_id, ["success"] * 4 + ["retry"], days_ago=2)
    crossing_session(sessions, child_id, ["retry"], mode="demo", days_ago=1)
    assert analytics(client, child_id)["mastery"]["met"] is True


def test_another_child_observation_with_the_same_session_id_is_ignored(api):
    client, sessions = api
    headers = auth(client)
    child_id = add_child(client, headers, "관찰 격리")
    other_child_id = add_child(client, headers, "다른 아동")
    session_id, ids = crossing_session(sessions, child_id, ["success", "retry"])
    with sessions() as db:
        db.get(ClinicalObservation, ids[-1]).child_id = other_child_id
        db.commit()
    row = point(client, child_id, session_id)
    assert (row["attemptN"], row["reviewedN"], row["confirmedRate"]) == (1, 1, 1)


def database_snapshot(sessions):
    with sessions() as db:
        schema = db.connection().exec_driver_sql(
            "SELECT name, sql FROM sqlite_master WHERE type IN ('table', 'index') ORDER BY name",
        ).all()
        rows = {table.name: sorted(repr(row) for row in db.execute(select(table)).all())
                for table in Base.metadata.sorted_tables}
        return schema, rows


def test_repeated_get_does_not_change_any_database_rows_or_schema(api):
    client, sessions = api
    child_id = add_child(client, auth(client), "읽기 전용")
    crossing_session(sessions, child_id, ["success", "retry"], rhythm={"startBpm": 84, "allowFaster": True})
    before = database_snapshot(sessions)
    first = analytics(client, child_id)
    assert analytics(client, child_id) == first
    assert database_snapshot(sessions) == before


def test_large_history_fits_sqlites_legacy_bind_limit(api):
    client, sessions = api
    child_id = add_child(client, auth(client), "대량 회기 기록")
    session_id, _ids = crossing_session(sessions, child_id, ["success"] * 1001)
    with sessions() as db:
        first = db.get(TrainingSession, session_id)
        db.add_all([TrainingSession(
            child_id=child_id, goal_id=first.goal_id, plan_id=first.plan_id,
            mode="real", play_token_hash="a" * 64, status="completed",
            runtime_state={"activityGame": "daegu_crossing"},
        ) for _ in range(1000)])
        db.commit()
    # 구형 SQLite의 999개 bind 한도를 재현한다. 회기/관찰 id가 한 쿼리에 모두 들어가면 실패한다.
    with sessions() as db:
        connection = db.connection().connection.driver_connection
        previous_limit = connection.setlimit(sqlite3.SQLITE_LIMIT_VARIABLE_NUMBER, 999)
    try:
        body = analytics(client, child_id)
        assert len(body["sessions"]) == 1001
        row = next(row for row in body["sessions"] if row["sessionId"] == session_id)
        assert (row["attemptN"], row["reviewedN"], row["confirmedSuccessN"], row["confirmedRate"]) == (1001, 1001, 1001, 1)
    finally:
        connection.setlimit(sqlite3.SQLITE_LIMIT_VARIABLE_NUMBER, previous_limit)

"""대구대 자동 근거·검토 진행·회기 시작 박자를 임상 통계와 구분한다."""
from datetime import timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.games.evaluation import ONSET_FRICATION_MS, ONSET_MIN_SNR_DB, VOICED_AFTER_FRICATION_MS
from app.models import Child, ClinicalObservation, ClinicalVerification, TrainingSession, now
from app.therapist_insights.crossing_evidence import automatic_evidence
from test_api_flow import api, auth
from test_therapist_planning import add_child, add_session

GOOD = {"source": "microphone", "durationMs": 700, "activeMs": 500,
        "onsetFricationMs": ONSET_FRICATION_MS, "voicedAfterFricationMs": VOICED_AFTER_FRICATION_MS,
        "noiseFloorDb": -60, "meanRmsDb": -35}


def make_crossing(sessions, session_id, rhythm=None):
    with sessions() as db:
        session = db.get(TrainingSession, session_id)
        session.runtime_state = {"activityGame": "daegu_crossing", **({"rhythm": rhythm} if rhythm is not None else {})}
        observations = list(db.scalars(select(ClinicalObservation).where(ClinicalObservation.session_id == session_id)
                                      .order_by(ClinicalObservation.id)))
        for row in observations:
            row.activity = "daegu_crossing"
            row.evidence = {"targetText": "사", "acoustic": GOOD}
        db.commit()
        return [row.id for row in observations]


@pytest.mark.parametrize("mode,is_seed,source", [("real", False, "REAL"), ("demo", False, "DEMO"), ("real", True, "SAMPLE")])
def test_summary_counts_original_estimates_and_latest_review_separately(api, mode, is_seed, source):
    client, sessions = api
    child = add_child(client, auth(client), "박자 검토")
    sid = add_session(sessions, child, ["success", "retry", "uncertain", "no_speech", "success", "retry"],
                      mode=mode, is_seed=is_seed, decision=None)
    ids = make_crossing(sessions, sid, {"startBpm": 92, "allowFaster": False})
    with sessions() as db:
        # 생성 시각이 같은 관찰도 있으므로 원 결과별로 찾아 최신 결정의 의미를 검증한다.
        rows = [db.get(ClinicalObservation, oid) for oid in ids]
        success = [row for row in rows if row.ai_result == "success"]
        retry = [row for row in rows if row.ai_result == "retry"]
        uncertain = next(row for row in rows if row.ai_result == "uncertain")
        therapist = db.get(Child, child).therapist_id
        for row, action in [(success[0], "confirm"), (success[1], "confirm"), (retry[0], "correct"),
                            (retry[1], "reject"), (uncertain, "confirm")]:
            db.add(ClinicalVerification(observation_id=row.id, therapist_id=therapist, action=action,
                                       correction={"result": "success"} if action == "correct" else {}))
        db.add(ClinicalVerification(observation_id=success[0].id, therapist_id=therapist, action="reject",
                                   created_at=now() + timedelta(seconds=1)))
        db.commit()
        original = {row.id: (row.ai_result, row.evidence) for row in rows}
    response = client.get(f"/api/sessions/{sid}/insights")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["source"] == source
    assert body["crossingSummary"] == {"attemptN": 6, "autoSuccessN": 2, "deferredN": 2,
                                        "confirmedN": 3, "reviewTotalN": 6,
                                        "rhythm": {"startBpm": 92, "allowFaster": False},
                                        # 끝까지 건넌 판이 없는 진행 중 회기는 0판이다(판 반복, 2026-10-07).
                                        "lapN": 0}
    corrected = next(row for row in body["observations"] if row["verification"].endswith("CORRECTED"))
    assert corrected["aiResult"] == "retry" and corrected["result"] == "success"
    assert all(row["automaticEvidence"] for row in body["observations"])
    if source != "REAL":
        assert body["summary"]["evaluableN"] == 0
        assert body["summary"]["successRate"] is None
        assert all("DEMO·샘플" in row["automaticEvidence"][0] for row in body["observations"])
    with sessions() as db:
        assert {oid: (db.get(ClinicalObservation, oid).ai_result, db.get(ClinicalObservation, oid).evidence)
                for oid in ids} == original


@pytest.mark.parametrize("stored", [None, {"startBpm": 74, "allowFaster": True}, {"startBpm": 84},
                                    {"startBpm": "84", "allowFaster": True}])
def test_missing_or_invalid_historical_rhythm_is_not_replaced_with_current_defaults(api, stored):
    client, sessions = api
    child = add_child(client, auth(client), "과거 박자")
    sid = add_session(sessions, child, [], decision=None)
    make_crossing(sessions, sid, stored)
    body = client.get(f"/api/sessions/{sid}/insights").json()
    assert body["crossingSummary"] == {"attemptN": 0, "autoSuccessN": 0, "deferredN": 0,
                                        "confirmedN": 0, "reviewTotalN": 0, "rhythm": None, "lapN": 0}


def test_other_games_keep_their_existing_response(api):
    client, sessions = api
    child = add_child(client, auth(client), "다른 활동")
    sid = add_session(sessions, child, ["success"])
    body = client.get(f"/api/sessions/{sid}/insights").json()
    assert "crossingSummary" not in body
    assert all("automaticEvidence" not in row for row in body["observations"])


def explain(result, acoustic, source="REAL"):
    row = SimpleNamespace(ai_result=result, evidence={"acoustic": acoustic})
    return automatic_evidence(row, source)


def test_explanation_uses_evaluation_thresholds_and_reports_observed_absence():
    message = " ".join(explain("success", GOOD))
    assert f"기준 {ONSET_FRICATION_MS}ms" in message
    assert f"기준 {VOICED_AFTER_FRICATION_MS}ms" in message
    assert "바람 소리 확인" in message and "뒤 모음 확인" in message
    assert explain("retry", {**GOOD, "onsetFricationMs": 0, "voicedAfterFricationMs": 0}) == [
        "시작 바람 소리 없음.", "끝까지 모음 없음."]
    message = " ".join(explain("retry", {**GOOD, "onsetFricationMs": 40, "voicedAfterFricationMs": 50}))
    assert f"바람 소리 짧음(40ms, 현재 기준 {ONSET_FRICATION_MS}ms)" in message
    assert f"뒤 모음 짧음(50ms, 현재 기준 {VOICED_AFTER_FRICATION_MS}ms)" in message


@pytest.mark.parametrize("acoustic,reason", [
    ({**GOOD, "meanRmsDb": -50}, "작게 말해 판단 보류"),
    ({**GOOD, "clippingRatio": 0.03}, "소리가 찌그러져 판단 보류"),
    ({**GOOD, "durationMs": 150}, "녹음 구간이 너무 짧아 판단 보류"),
    ({**GOOD, "onsetFricationMs": None}, "측정값이 없어 판단 보류"),
    ({"source": "microphone", "activeMs": 500}, "주변 잡음 측정값이 없어 판단 보류"),
])
def test_uncertain_explanation_never_turns_quality_or_missing_data_into_articulation_failure(acoustic, reason):
    message = " ".join(explain("uncertain", acoustic))
    assert reason in message and "실패가 아닙니다" in message
    assert "바람 소리 없음" not in message and "모음 없음" not in message
    if "작게" in message:
        assert f"기준 {ONSET_MIN_SNR_DB}dB" in message


def test_no_speech_and_legacy_missing_values_are_not_invented_failures():
    message = " ".join(explain("no_speech", {"activeMs": 0}))
    assert "무발화는 실패가 아닙니다" in message and "바람 소리 없음" not in message
    message = " ".join(explain("retry", {}))
    assert "측정값이 없어 자동 추정 근거를 확인할 수 없습니다" in message
    assert "바람 소리 없음" not in message and "모음 없음" not in message


def test_demo_missing_input_does_not_invent_microphone_quality_reason():
    message = " ".join(explain("uncertain", {"source": "keyboard", "activeMs": 500}, "DEMO"))
    assert "측정값이 없어 판단 보류" in message
    assert "잡음" not in message and "작게 말해" not in message
    assert "DEMO·샘플" in message

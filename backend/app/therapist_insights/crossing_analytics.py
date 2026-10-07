"""대구대 건너기의 저장된 관찰·검토를 읽는다. 임상 결정과 게임 판정은 바꾸지 않는다."""
from collections import defaultdict
from math import isfinite

from pydantic import ValidationError
from sqlalchemy import select

from ..game_settings.schemas import DaeguCrossingRhythm
from ..games.evaluation import ONSET_FRICATION_MS, ONSET_MIN_SNR_DB, VOICED_AFTER_FRICATION_MS
from ..games.crossing import is_probe_observation
from ..models import ClinicalObservation, TrainingSession
from ..pronunciation.audio_quality import assess_audio_quality
from ..therapist_planning.evidence import filter_verified, latest_decisions
from .service import source_of

MASTERY_THRESHOLD = 0.8
MASTERY_CONSECUTIVE_SESSIONS = 3
NOTES = [
    "회기 간 변화는 치료 효과의 증명이 아닙니다.",
    "DEMO·샘플 회기는 확인 비율과 숙달 계산에서 제외합니다.",
    "확인 비율은 실제·비샘플 회기의 마지막 확인·교정 중 평가 가능한 기록만 계산하며, 자료가 없으면 null입니다.",
    "불확실·무발화·목표 관찰·음질 POOR는 확인 비율의 분모에서 제외하며 실패가 아닙니다.",
    "자동 추정 이유는 현재 음향 기준에 따른 설명이며 발음의 정오나 임상 판단이 아닙니다. 보류·음질 불량·측정 누락은 실패 유형에 넣지 않습니다.",
    "숙달 표시는 최신 실제 건너기 3회기의 확인 비율이 각각 80% 이상인 제품 규칙입니다. 자료 없음·기준 미달이면 표시하지 않으며 임상 숙달을 확정하지 않습니다.",
]


def _number(acoustic, key):
    value = acoustic.get(key)
    return value if type(value) in (int, float) and isfinite(value) else None


def _auto_reason(row):
    # 저장된 자동 결과가 보류이면 음향값만으로 실패 유형이나 성공을 만들어 내지 않는다.
    if row.ai_result not in {"success", "retry"} or row.audio_quality == "POOR":
        return None
    evidence = row.evidence if isinstance(row.evidence, dict) else {}
    acoustic = evidence.get("acoustic")
    if not isinstance(acoustic, dict) or acoustic.get("source") not in {None, "microphone"}:
        return None
    active_key = "activeMs" if "activeMs" in acoustic else "voicedMs" if "voicedMs" in acoustic else None
    if active_key is not None:
        active = _number(acoustic, active_key)
        if active is None or active <= 0:
            return None
    if acoustic.get("source") == "microphone" and (
        active_key is None or _number(acoustic, "durationMs") is None
    ):
        return None
    quality = assess_audio_quality(acoustic.get("noiseFloorDb"), acoustic.get("meanRmsDb"),
                                   acoustic.get("durationMs"), acoustic.get("clippingRatio"), acoustic.get("snrDb"))
    if quality["level"] == "POOR" or (
        acoustic.get("source") == "microphone" and quality["level"] == "UNKNOWN"
    ):
        return None
    if quality["snrDb"] is not None and quality["snrDb"] < ONSET_MIN_SNR_DB:
        return None
    onset, voiced = _number(acoustic, "onsetFricationMs"), _number(acoustic, "voicedAfterFricationMs")
    if onset is None or voiced is None or onset < 0 or voiced < 0:
        return None
    if onset == 0:
        return "noFrication"
    if onset < ONSET_FRICATION_MS:
        return "shortFrication"
    return "ok" if voiced >= VOICED_AFTER_FRICATION_MS else "noVowel"


def _session_point(session, child, rows, decisions):
    source = source_of(session, child)
    probes = [row for row in rows if is_probe_observation(row)]
    rows = [row for row in rows if not is_probe_observation(row)]
    verified, _ = filter_verified(rows, decisions) if source == "REAL" else ([], {})
    evaluable = [row for row in verified if row["result"] in {"success", "retry"} and row["audioQuality"] != "POOR"]
    successes = sum(row["result"] == "success" for row in evaluable)
    probe_verified, _ = filter_verified(probes, decisions) if source == "REAL" else ([], {})
    probe_evaluable = [row for row in probe_verified if row["result"] in {"success", "retry"} and row["audioQuality"] != "POOR"]
    probe_successes = sum(row["result"] == "success" for row in probe_evaluable)
    by_level = {level: {"reviewedN": 0, "confirmedSuccessN": 0} for level in ("syllable", "word")}
    for row in evaluable:
        counts = by_level.setdefault(row["level"], {"reviewedN": 0, "confirmedSuccessN": 0})
        counts["reviewedN"] += 1
        counts["confirmedSuccessN"] += row["result"] == "success"
    reasons = {key: 0 for key in ("ok", "noFrication", "shortFrication", "noVowel")}
    for row in rows:
        reason = _auto_reason(row)
        if reason is not None:
            reasons[reason] += 1
    # 박자는 기존 회기 요약과 같은 엄격한 스냅숏 검증을 쓴다. 현재 설정으로 채우지 않는다.
    state = session.runtime_state if isinstance(session.runtime_state, dict) else {}
    try:
        rhythm = DaeguCrossingRhythm.model_validate(state.get("rhythm")).model_dump()
    except ValidationError:
        rhythm = None
    return {
        "sessionId": session.id, "startedAt": session.started_at.isoformat(), "source": source,
        "rhythm": rhythm, "attemptN": len(rows),
        "deferredN": sum(row.ai_result in {"uncertain", "no_speech"} for row in rows),
        "reviewedN": len(evaluable), "confirmedSuccessN": successes,
        "confirmedRate": successes / len(evaluable) if evaluable else None,
        "byLevel": by_level, "autoReasons": reasons,
        "probe": {"reviewedN": len(probe_evaluable), "confirmedSuccessN": probe_successes,
                  "confirmedRate": probe_successes / len(probe_evaluable) if probe_evaluable else None},
    }


def crossing_analytics(db, child):
    sessions = list(db.scalars(select(TrainingSession).where(TrainingSession.child_id == child.id)
                              .order_by(TrainingSession.started_at, TrainingSession.id)).all())
    by_session = defaultdict(list)
    rows = []
    if sessions:
        rows = list(db.scalars(select(ClinicalObservation).join(
            TrainingSession, ClinicalObservation.session_id == TrainingSession.id,
        ).where(
            ClinicalObservation.child_id == child.id,
            TrainingSession.child_id == child.id,
            ClinicalObservation.activity == "daegu_crossing",
        ).order_by(ClinicalObservation.created_at, ClinicalObservation.id)).all())
        for row in rows:
            by_session[row.session_id].append(row)
    decisions = {}
    # 전체 이력의 관찰 수가 DB 바인딩 한도를 넘지 않도록 마지막 결정을 묶음으로 읽는다.
    for start in range(0, len(rows), 500):
        decisions.update(latest_decisions(db, rows[start:start + 500]))
    points = []
    for session in sessions:
        state = session.runtime_state if isinstance(session.runtime_state, dict) else {}
        if state.get("activityGame") == "daegu_crossing" or session.id in by_session:
            points.append(_session_point(session, child, by_session[session.id], decisions))
    # DEMO·샘플은 연속 회기에 섞지 않고, 최신 REAL의 자료 없음은 건너뛰지 않는다.
    latest_real = [point for point in points if point["source"] == "REAL"][-MASTERY_CONSECUTIVE_SESSIONS:]
    met = len(latest_real) == MASTERY_CONSECUTIVE_SESSIONS and all(
        point["confirmedRate"] is not None and point["confirmedRate"] >= MASTERY_THRESHOLD
        for point in latest_real
    )
    return {"sessions": points,
            "mastery": {"threshold": MASTERY_THRESHOLD, "consecutiveSessions": MASTERY_CONSECUTIVE_SESSIONS, "met": met},
            "notes": NOTES}

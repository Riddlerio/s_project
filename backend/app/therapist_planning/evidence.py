"""임상 근거 필터와 결정적 지표. LLM은 여기의 숫자를 다시 계산하지 않는다."""
from sqlalchemy import select

from ..models import ClinicalObservation, ClinicalVerification, TrainingSession

RECENT_SESSION_WINDOW = 5
MIN_EVALUABLE = 5

# 게임 라운드(SOUND/…)와 기존 모험(level.upper())의 일반화 단계 표기를 목표 단계 표기로 맞춘다.
LEVEL_ALIASES = {"SOUND": "phoneme", "PHONEME": "phoneme", "SYLLABLE": "syllable", "WORD": "word",
                 "SHORT_SENTENCE": "short_sentence", "SENTENCE": "short_sentence", "SPONTANEOUS": "spontaneous"}


def normalize_level(value: str | None) -> str:
    return LEVEL_ALIASES.get((value or "").upper(), "unknown")


def recent_real_sessions(db, child_id: str) -> list[TrainingSession]:
    """이 아동의 최근 실제 음성(비샘플) 회기. DEMO·seed 회기는 임상 근거가 아니다."""
    return list(db.scalars(select(TrainingSession).where(
        TrainingSession.child_id == child_id, TrainingSession.mode == "real", TrainingSession.is_seed.is_(False),
    ).order_by(TrainingSession.started_at.desc()).limit(RECENT_SESSION_WINDOW)).all())


def load_observations(db, child_id: str, sessions: list[TrainingSession]) -> list[ClinicalObservation]:
    ids = [session.id for session in sessions]
    if not ids:
        return []
    # child_id 조건을 함께 건다. 회기 id만으로 다른 아동의 관찰을 읽지 않는다.
    return list(db.scalars(select(ClinicalObservation).where(
        ClinicalObservation.child_id == child_id, ClinicalObservation.session_id.in_(ids),
    ).order_by(ClinicalObservation.created_at)).all())


def latest_decisions(db, observations) -> dict[str, ClinicalVerification]:
    ids = [row.id for row in observations]
    if not ids:
        return {}
    rows = db.scalars(select(ClinicalVerification).where(ClinicalVerification.observation_id.in_(ids))
                      .order_by(ClinicalVerification.created_at, ClinicalVerification.id)).all()
    return {row.observation_id: row for row in rows}  # 시간순으로 덮어써 마지막 결정만 남는다.


def filter_verified(observations, decisions) -> tuple[list[dict], dict]:
    """REAL 회기의 관찰 중 마지막 치료사 결정이 confirm/correct인 것만 근거로 쓴다.

    correct는 치료사가 교정한 결과를 쓴다. PENDING·REJECTED는 근거에서 빼고 건수만 남긴다.
    """
    verified, pending, rejected = [], 0, 0
    for row in observations:
        decision = decisions.get(row.id)
        if decision is None:
            pending += 1
            continue
        if decision.action == "reject":
            rejected += 1
            continue
        if decision.action not in {"confirm", "correct"}:
            pending += 1
            continue
        result = decision.correction.get("result") if decision.action == "correct" else row.ai_result
        verified.append({"observationId": row.id, "sessionId": row.session_id, "level": normalize_level(row.generalization_level),
                         "activity": row.activity, "cue": row.cue_type, "independence": row.independence,
                         "audioQuality": row.audio_quality, "result": result, "verification": decision.action.upper()})
    return verified, {"pendingReviewN": pending, "rejectedN": rejected}


def _rate(part: int, whole: int) -> float | None:
    return round(100 * part / whole, 1) if whole else None


def _level_stats(rows: list[dict]) -> dict:
    evaluable = [row for row in rows if row["result"] in {"success", "retry"}]
    success = sum(row["result"] == "success" for row in evaluable)
    return {"verifiedN": len(rows), "evaluableN": len(evaluable), "successN": success,
            "retryN": len(evaluable) - success, "successRate": _rate(success, len(evaluable)),
            "uncertainN": sum(row["result"] == "uncertain" for row in rows),
            "noSpeechN": sum(row["result"] == "no_speech" for row in rows),
            "targetObservedN": sum(row["result"] == "target_observed" for row in rows)}


def calculate_metrics(observations, verified: list[dict], review: dict, sessions) -> dict:
    """결정적 지표. 불확실·무발화·목표 관찰은 성공률 분모에 넣지 않는다. 자료 없음은 null이다."""
    overall = _level_stats(verified)
    levels = sorted({row["level"] for row in verified})
    counts = {}
    for key in ("cue", "independence"):
        counts[key] = {}
        for row in verified:
            counts[key][row[key]] = counts[key].get(row[key], 0) + 1
    by_session = {session.id: session for session in sessions}
    trend = []
    for session in reversed(sessions):
        rows = [row for row in verified if row["sessionId"] == session.id]
        stats = _level_stats(rows)
        trend.append({"sessionId": session.id, "startedAt": session.started_at.isoformat() if session.started_at else None,
                      "activity": (session.runtime_state or {}).get("activityGame"),
                      "evaluableN": stats["evaluableN"], "successRate": stats["successRate"]})
    return {
        "window": {"realSessionN": len(by_session), "maxSessions": RECENT_SESSION_WINDOW},
        "totalObservedN": len(observations),
        "poorAudioN": sum(row.audio_quality == "POOR" for row in observations),
        **review,
        **overall,
        "retryRate": _rate(overall["retryN"], overall["evaluableN"]),
        "byLevel": [{"level": level, **_level_stats([row for row in verified if row["level"] == level])} for level in levels],
        "cueCounts": counts["cue"],
        "independenceCounts": counts["independence"],
        "trend": trend,
        "sufficient": overall["evaluableN"] >= MIN_EVALUABLE,
    }

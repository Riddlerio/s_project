from collections import Counter, defaultdict
from datetime import timedelta, timezone
from math import isfinite

from sqlalchemy import select

from ..models import ClinicalObservation, TrainingSession
from ..games.crossing import is_probe_observation
from ..pronunciation.audio_quality import assess_audio_quality
from ..therapist_planning.evidence import filter_verified, latest_decisions, normalize_level
from .crossing_evidence import automatic_evidence, crossing_summary

LIMITATIONS = [
    "아동 음성 인식과 브라우저 음향 요약에는 오인식·기기·환경의 영향이 있습니다. 임상 진단이 아닙니다.",
    "실제·비샘플 회기에서 마지막 치료사 결정이 확인 또는 교정인 관찰만 비교합니다.",
    "불확실·무발화·목표 관찰·음질 POOR는 성공률 분모에서 제외하며 실패가 아닙니다.",
    "이 읽기 화면은 잡음·클리핑 등 품질 경고도 보수적으로 제외합니다. 기존 계획 제안 계산은 바꾸지 않습니다.",
    "활동·목표 음소·위치·수준이 같은 자료만 비교합니다. 단서 유형은 순서 척도가 아니므로 평균하지 않습니다.",
]
ACOUSTIC_KEYS = ("durationMs", "voicedMs", "bestRunMs", "fricationMs", "onsetLatencyMs", "onsetFricationMs", "voicedAfterFricationMs",
                 "meanRmsDb", "noiseFloorDb", "snrDb", "clippingRatio")
EXCLUDED_QUALITY = {"POOR", "LOW_SNR", "NOISY_FLOOR", "CLIPPING", "TOO_SHORT", "TOO_LONG", "INVALID_ACOUSTIC"}
SEOUL = timezone(timedelta(hours=9), "Asia/Seoul")


def source_of(session, child):
    return "SAMPLE" if child.is_seed or session.is_seed else "REAL" if session.mode == "real" else "DEMO"


def observation_view(row, decision, session, child):
    verified, _review = filter_verified([row], {row.id: decision} if decision else {})
    result = verified[0]["result"] if verified else row.ai_result
    source = source_of(session, child)
    acoustic = (row.evidence or {}).get("acoustic", {})
    quality = assess_audio_quality(acoustic.get("noiseFloorDb"), acoustic.get("meanRmsDb"),
                                   acoustic.get("durationMs"), acoustic.get("clippingRatio"), acoustic.get("snrDb"))
    flags = [result.upper()] if result in {"uncertain", "no_speech", "target_observed"} else []
    if row.audio_quality == "POOR":
        flags.append("POOR")
    flags.extend(quality["reasons"])
    reasons = []
    if source != "REAL":
        reasons.append(source)
    if not verified:
        reasons.append("REJECTED" if decision and decision.action == "reject" else "PENDING")
    if result not in {"success", "retry"}:
        reasons.append("NOT_EVALUABLE")
    reasons.extend(flag for flag in flags if flag in EXCLUDED_QUALITY)
    confirmed = bool(verified)
    state = {"confirm": "CONFIRMED", "correct": "CORRECTED", "reject": "REJECTED"}.get(
        decision.action if decision else "", "PENDING")
    view = {
        "id": row.id, "sessionId": session.id, "roundIndex": row.round_index, "attemptNumber": row.attempt_number,
        "targetText": (row.evidence or {}).get("targetText") or "발화", "targetPhoneme": row.target_phoneme,
        "wordPosition": row.word_position, "level": normalize_level(row.generalization_level), "activity": row.activity,
        "cue": row.cue_type, "independence": row.independence, "durationMs": row.duration_ms,
        "audioQuality": row.audio_quality, "aiResult": row.ai_result, "result": result, "source": source,
        "verification": state if source == "REAL" else f"DEMO_{state}",
        "provenance": "THERAPIST" if confirmed else "SYSTEM" if (row.provenance or {}).get("aiResult") == "SYSTEM_MEASURED" else "AI",
        "measurementSource": (row.provenance or {}).get("acoustic", "UNKNOWN"),
        "qualityFlags": sorted(set(flags)), "excludedReasons": sorted(set(reasons)), "included": not reasons,
        "reviewNote": decision.note if decision else "",
        "acoustic": {key: acoustic[key] for key in ACOUSTIC_KEYS
                     if type(acoustic.get(key)) in (int, float) and isfinite(acoustic[key])},
    }
    if row.activity == "daegu_crossing":
        view["automaticEvidence"] = automatic_evidence(row, source)
        view["isProbe"] = is_probe_observation(row)
    return view


def stats(rows):
    included = [row for row in rows if row["included"]]
    successes = sum(row["result"] == "success" for row in included)
    return {"observedN": len(rows), "evaluableN": len(included), "successN": successes,
            "excludedN": len(rows) - len(included),
            "successRate": round(100 * successes / len(included), 1) if included else None,
            "cueCounts": dict(sorted(Counter(row["cue"] for row in included).items()))}


def load_views(db, child, sessions):
    if not sessions:
        return []
    by_id = {session.id: session for session in sessions}
    rows = list(db.scalars(select(ClinicalObservation).where(
        ClinicalObservation.child_id == child.id, ClinicalObservation.session_id.in_(by_id),
    ).order_by(ClinicalObservation.created_at, ClinicalObservation.id)).all())
    decisions = latest_decisions(db, rows)
    return [observation_view(row, decisions.get(row.id), by_id[row.session_id], child) for row in rows]


def goal_trends(db, child):
    sessions = list(db.scalars(select(TrainingSession).where(TrainingSession.child_id == child.id)
                              .order_by(TrainingSession.started_at, TrainingSession.id)).all())
    rows = load_views(db, child, sessions)
    groups = defaultdict(list)
    for row in rows:
        if row["source"] == "REAL" and not row.get("isProbe"):
            groups[(row["targetPhoneme"], row["wordPosition"], row["level"], row["activity"])].append(row)
    trends = []
    for (phoneme, position, level, activity), group in sorted(groups.items()):
        by_session = defaultdict(list)
        for row in group:
            by_session[row["sessionId"]].append(row)
        points = [{"sessionId": session.id, "startedAt": session.started_at.isoformat(),
                   **stats(by_session[session.id])} for session in sessions if session.id in by_session]
        baseline = next((point for point in points if point["evaluableN"]), None)
        baseline_index = points.index(baseline) if baseline else -1
        recent = points[baseline_index + 1:][-5:] if baseline else points[-5:]
        recent_ids = {point["sessionId"] for point in recent}
        recent_stats = stats([row for row in group if row["sessionId"] in recent_ids])
        trends.append({"targetPhoneme": phoneme, "wordPosition": position, "level": level, "activity": activity,
                       "baseline": baseline, "recent": recent, "recentSummary": recent_stats,
                       "delta": round(recent_stats["successRate"] - baseline["successRate"], 1)
                       if baseline and recent_stats["successRate"] is not None else None})
    return {"groups": trends, "sources": [{"source": source,
            "sessionN": sum(source_of(session, child) == source for session in sessions),
            "observationN": sum(row["source"] == source for row in rows)} for source in ("REAL", "DEMO", "SAMPLE")],
            "limitations": LIMITATIONS, "baselineRule": "목표·활동별 첫 평가 가능 회기와 이후 최근 최대 5회기를 비교합니다. 기준선은 최근 집계에 중복하지 않습니다."}


def session_insights(db, child, session):
    rows = load_views(db, child, [session])
    practice = [row for row in rows if not row.get("isProbe")]
    total = stats(practice)
    rounds = [{"roundIndex": index, **stats([row for row in practice if row["roundIndex"] == index])}
              for index in sorted(set(range(1, 6)) | {row["roundIndex"] for row in practice})]
    source = source_of(session, child)
    source_label = {"REAL": "실제", "DEMO": "DEMO", "SAMPLE": "샘플"}[source]
    rate = f"{total['successRate']}%" if total["successRate"] is not None else "자료 없음"
    started_at = session.started_at
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    session_date = started_at.astimezone(SEOUL).date()
    note = (f"{session_date.isoformat()} {source_label} 회기: 관찰 {total['observedN']}건. "
            f"치료사 확인·교정 후 평가 가능 {total['evaluableN']}건 중 성공 {total['successN']}건({rate}). "
            f"분모 제외 {total['excludedN']}건(출처·검토 상태·평가 보류·음질 기준). "
            "불확실·무발화·음질 문제는 실패로 세지 않음. 임상 진단이나 치료 효과의 증명이 아님.")
    if source != "REAL":
        note += " 실제 임상 비교에 사용하지 않는 연습 자료."
    response = {"sessionId": session.id, "source": source, "observations": rows, "rounds": rounds,
                "summary": total, "note": note, "limitations": LIMITATIONS}
    if (session.runtime_state or {}).get("activityGame") == "daegu_crossing":
        response["crossingSummary"] = crossing_summary(rows, session)
    return response

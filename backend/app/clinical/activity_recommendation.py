from sqlalchemy import select

from ..models import ClinicalObservation, ClinicalVerification, TrainingSession


PURPOSES = {
    "magic_beam": "마찰음 지속 산출 관찰",
    "sky_climb": "발성 지속과 쉼 후 재개 관찰",
    "monster_adventure": "단어 안 목표 음소 산출 관찰",
    "conversation_quest": "맥락·자발 발화의 일반화 자료 수집",
}


def propose_activity(db, child_id: str) -> dict | None:
    rows = db.scalars(select(ClinicalObservation).join(
        TrainingSession, TrainingSession.id == ClinicalObservation.session_id
    ).where(
        ClinicalObservation.child_id == child_id,
        ClinicalObservation.verification_state.in_(["CONFIRMED", "CORRECTED"]),
        TrainingSession.mode == "real",
        TrainingSession.is_seed.is_(False),
    ).order_by(ClinicalObservation.created_at.desc()).limit(10)).all()
    if not rows:
        return None
    verified = []
    for row in rows:
        session = db.get(TrainingSession, row.session_id)
        if session is None or session.mode != "real" or session.is_seed:
            continue
        decision = db.scalar(select(ClinicalVerification).where(ClinicalVerification.observation_id == row.id)
                             .order_by(ClinicalVerification.created_at.desc(), ClinicalVerification.id.desc()))
        if decision is None or decision.action not in {"confirm", "correct"}:
            continue
        result = decision.correction.get("result") if decision.action == "correct" else row.ai_result
        verified.append((row, result))
    if not verified:
        return None
    # 지속 길이 평균은 success/retry로 확인된 평가 가능 관찰만 쓴다. 불확실·무발화의 음향값은 섞지 않는다.
    sound = [(row, result) for row, result in verified if row.generalization_level == "SOUND" and result in {"success", "retry"}]
    word = [(row, result) for row, result in verified if row.generalization_level in {"WORD", "SYLLABLE"} and result in {"success", "retry"}]
    sustained = [row.evidence.get("acoustic", {}).get("bestRunMs") for row, _ in sound]
    sustained = [value for value in sustained if type(value) in (int, float)]
    if len(sustained) >= 2 and sum(sustained) / len(sustained) < 1500:
        game = "sky_climb"
        reason = f"치료사 확인 SOUND 관찰 {len(sound)}건의 보고된 연속 발성 길이를 추가 관찰할 필요가 있습니다."
    elif len(word) >= 2 and sum(result == "success" for _, result in word) * 2 <= len(word):
        game = "monster_adventure"
        reason = f"치료사 확인 단어·음절 관찰 {len(word)}건에서 목표 산출을 다시 살펴볼 필요가 있습니다."
    elif not any(row.generalization_level == "SPONTANEOUS" for row, _ in verified):
        game = "conversation_quest"
        reason = "확인된 자발 발화 자료가 없어 대화 속 관찰 기회를 제안합니다. 자료 없음은 0점이 아닙니다."
    else:
        game = "sky_climb"
        reason = "확인된 발화 자료 다음으로 지속·쉼 후 재개를 관찰할 기회를 제안합니다."
    return {"activity": game, "clinicalPurpose": PURPOSES[game], "reason": reason,
            "evidence": [{"observationId": row.id, "sessionId": row.session_id,
                          "verificationState": row.verification_state} for row, _ in verified[:5]],
            "confidence": "MEDIUM" if len(verified) >= 5 else "LOW"}

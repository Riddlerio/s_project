REASONS = {"CONSECUTIVE_TARGET_RETRY": "목표 소리 재시도 3회 연속", "SUCCESS_STREAK_AT_REINFORCEMENT_LEVEL": "강화 단계에서 3회 연속 성공", "MAX_ATTEMPTS_REACHED": "항목 시도 횟수 도달", "REPETITION_TARGET_REACHED": "반복 목표 도달", "DURATION_REACHED": "세션 시간 도달", "PLAN_COMPLETED": "계획 완료", "SECOND_ATTEMPT": "두 번째 시도 안내", "THIRD_ATTEMPT": "세 번째 시도 힌트", "GOAL_BASED_PLAN": "치료사 목표 기반 계획", "PREVIOUS_SESSION_LEVEL_DOWN": "이전 세션 단계 하향 반영", "PREVIOUS_SESSION_SIMILAR_PATTERN": "이전 세션과 비슷한 재시도 양상", "THERAPIST_CUE_OVERRIDE": "치료사 단서 설정 적용", "BEAM_SUCCESS_EXTEND": "빔 발성 목표 시간 증가", "BEAM_SHORT_REDUCE": "빔 발성 목표 시간 감소", "PLAN_WARMUP": "도입 음절 연습", "priority:accuracy": "치료사 우선순위: 정확도", "priority:balanced": "치료사 우선순위: 균형", "priority:speed": "치료사 우선순위: 속도"}


def reason_text(codes):
    return " · ".join(REASONS.get(code, code) for code in codes)


def therapist_text(event_type, payload, item=None, goal=None, analysis=None):
    target = f"/{goal.target_phoneme}/" if goal else "목표 소리"
    label = item.get("displayText", "") if item else ""
    if event_type == "TARGET_PRESENTED":
        shown = payload.get("item", item or {})
        return f"제시: {shown.get('displayText', '')} ({shown.get('level', '')})"
    if event_type == "TARGET_RETRY":
        detail = f" · 관찰: {analysis.substitute_symbol} 대치 추정" if analysis and analysis.substitute_symbol else ""
        return f"목표 {target} 재시도 — {label}, 시도 {payload.get('attempt', '')}{detail}"
    if event_type == "TARGET_SUCCESS":
        score = f" (점수 {analysis.score})" if analysis else ""
        return f"목표 {target} 성공 — {label}{score}"
    if event_type in ("LEVEL_DOWN", "LEVEL_UP"):
        return f"난이도 {'하향' if event_type == 'LEVEL_DOWN' else '복귀'}: {payload.get('toLevel', '')}"
    if event_type == "HINT_REQUIRED":
        return f"단서 제공: {payload.get('cue', '')} · {payload.get('modelText', '')}"
    return {"NO_SPEECH": "인식 결과 없음 — 재요청", "ITEM_SKIPPED": "최대 시도 후 다음 항목", "STAGE_START": f"게임 시작: {payload.get('game', '')}", "SESSION_COMPLETE": "세션 완료", "REWARD": f"보상 +{payload.get('xp', 0)} XP", "SESSION_START": "세션 시작"}.get(event_type, event_type)

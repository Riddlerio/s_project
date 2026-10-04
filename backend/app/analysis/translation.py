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

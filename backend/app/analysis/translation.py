# 치료사 화면의 사건 기록에 영어 코드가 그대로 보이지 않게 단계 이름을 한국어로 적는다(src/therapist/planning.ts LEVEL_LABELS와 같음).
LEVEL_TEXT = {"phoneme": "음소", "syllable": "음절", "word": "단어", "short_sentence": "짧은 문장", "spontaneous": "자발 발화"}


def therapist_text(event_type, payload, item=None, goal=None, analysis=None):
    target = f"/{goal.target_phoneme}/" if goal else "목표 소리"
    label = item.get("displayText", "") if item else ""
    if event_type == "TARGET_PRESENTED":
        shown = payload.get("item", item or {})
        level = shown.get("level", "")
        return f"제시: {shown.get('displayText', '')} ({LEVEL_TEXT.get(level, level)})"
    if event_type == "TARGET_RETRY":
        detail = f" · 관찰: {analysis.substitute_symbol} 대치 추정" if analysis and analysis.substitute_symbol else ""
        return f"목표 {target} 재시도 — {label}, 시도 {payload.get('attempt', '')}{detail}"
    if event_type == "TARGET_SUCCESS":
        # 음향 근사 게임(대구대 건너기 등)은 점수가 없다(0). 점수 0을 성공 옆에 적으면 오해를 사므로 뺀다.
        score = f" (점수 {analysis.score})" if analysis and analysis.score else ""
        return f"목표 {target} 성공 — {label}{score}"
    if event_type in ("LEVEL_DOWN", "LEVEL_UP"):
        return f"난이도 {'하향' if event_type == 'LEVEL_DOWN' else '복귀'}: {payload.get('toLevel', '')}"
    if event_type == "HINT_REQUIRED":
        return f"단서 제공: {payload.get('cue', '')} · {payload.get('modelText', '')}"
    if event_type == "ROUND_START":
        return f"{payload['index']}라운드 시작" if payload.get("index") else "라운드 시작"
    if event_type == "LAP_START":
        return f"{payload.get('lap', '')}판째 시작(같은 회기에서 한 판 더)"
    if event_type == "SESSION_COMPLETE" and payload.get("lap"):
        return f"{payload['lap']}판 완료"
    if event_type == "ROUND_CLEAR":
        return f"{payload['index']}라운드 마침" if payload.get("index") else "라운드 마침"
    return {"NO_SPEECH": "인식 결과 없음 — 재요청", "LISTEN_AGAIN": "판단 보류 — 다시 듣기(실패 아님)", "ITEM_ADVANCE": "다음 항목으로",
            "ITEM_SKIPPED": "최대 시도 후 다음 항목", "STAGE_START": f"게임 시작: {payload.get('game', '')}", "SESSION_COMPLETE": "세션 완료", "REWARD": f"보상 +{payload.get('xp', 0)} XP", "SESSION_START": "세션 시작"}.get(event_type, event_type)

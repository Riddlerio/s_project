"""대구대 건너기의 10줄 진행. 게임 이동과 음향 근사 관찰을 분리한다."""
import secrets
from dataclasses import replace

from fastapi import HTTPException

from ..training.content import items
from .rounds import GAME_ROUNDS, public_round

GAME = "daegu_crossing"
ITEMS_PER_ROUND = 2
MAX_TRIES = 3
MAX_NEUTRAL_STREAK = 3
# 한 판(5라운드 10줄)을 마치면 같은 회기에서 처음부터 한 판 더 건널 수 있다(제품 규칙, 연습량 늘리기).
# 판마다 새 회기를 만들지 않으므로 치료사 화면의 회기·숙달 계산은 판 수만큼 늘지 않는다.
MAX_LAPS = 3


def build_stages(goal):
    # 이 근사는 /ㅅ/ 어두만 지원한다. 다른 목표에 같은 판정을 붙이지 않는다.
    if goal.target_phoneme != "ㅅ" or goal.word_position != "initial" or goal.level not in {"syllable", "word"}:
        raise HTTPException(422, "대구대 건너기는 어두 /ㅅ/의 음절·낱말 목표를 지원합니다")
    excluded = set(goal.excluded_words or ())
    syllables = [row for row in items("ㅅ", "syllable") if row["displayText"] not in excluded]
    words = [row for row in items("ㅅ", "word") if row["displayText"] not in excluded]
    if not words or (goal.level == "syllable" and not syllables):
        raise HTTPException(422, "목표의 제외 낱말 설정에서 사용할 연습 항목이 없습니다")

    def choose(bank, text):
        # 제외 항목은 다시 넣지 않고 같은 단계의 기존 항목으로 대체한다.
        return next((row for row in bank if row["displayText"] == text), bank[0])

    if goal.level == "word":
        # 낱말 목표에서는 마지막 혼합 구간도 목표 단계 아래로 낮추지 않는다.
        texts = (("사과", "사과"), ("사과", "사과"), ("소리", "시소"),
                 ("사과", "수박"), ("수박", "시소"))
        rows = [[choose(words, text) for text in pair] for pair in texts]
    else:
        rows = [[choose(syllables, text) for text in pair]
                for pair in (("사", "사"), ("사", "사"), ("소", "시"))]
        rows.extend([[choose(words, "사과"), choose(words, "수박")],
                     [choose(syllables, "수"), choose(words, "시소")]])
    stages = []
    for definition, selected in zip(GAME_ROUNDS[GAME], rows):
        stage_items = [{**row, "itemId": secrets.token_hex(8), "game": GAME} for row in selected]
        stages.append({"game": GAME, "level": stage_items[0]["level"],
                       "round": public_round(definition), "items": stage_items})
    return stages


def definition_for_item(state):
    definition = GAME_ROUNDS[GAME][state["roundIndex"] - 1]
    return replace(definition, generalization_level=state["currentItem"]["level"].upper())


def update_cue(state, *, model):
    """다음 표시 항목의 단서와 관찰 스냅숏을 함께 바꾼다."""
    definition = definition_for_item(state)
    state["modelCue"] = model
    cue = "AUDITORY_MODEL" if model else definition.prompt_type
    state["currentCue"] = cue
    state["roundDefinition"] = {**public_round(definition),
                                "elicitationType": "DIRECT_IMITATION" if model else definition.elicitation_type,
                                "independence": "MODELED" if model else "INDEPENDENT"}


def child_round(definition):
    # 기존 4게임의 payload는 유지하고 이 게임에서는 임상 근거·판정 기준을 내보내지 않는다.
    return {"index": definition.index, "id": definition.id, "childTitle": definition.child_title,
            "childPrompt": definition.child_prompt, "attempts": MAX_TRIES,
            "targetMs": 0, "endHoldMs": definition.end_hold_ms}


def cursor(state):
    complete = bool(state.get("roundsComplete"))
    return {"roundIndex": state["roundIndex"], "itemIndexInRound": state["itemIndexInRound"],
            "stripeIndex": state["stripeIndex"],
            "triesLeft": 0 if complete else MAX_TRIES - state["itemAttemptsUsed"],
            "modelCue": False if complete else state["modelCue"], "sessionComplete": complete,
            "lap": state.get("lap", 1), "maxLaps": MAX_LAPS}


def advance(state, result, stages, at):
    """발화 한 번을 반영한다. 무발화·불확실은 평가 시도나 보상을 만들지 않는다."""
    drafts = []
    neutral = result in {"uncertain", "no_speech"}
    if neutral:
        state["listenAgainCount"] += 1
        drafts.append({"type": "NO_SPEECH" if result == "no_speech" else "LISTEN_AGAIN", "payload": {}})
    else:
        state["listenAgainCount"] = 0
        state["itemAttemptsUsed"] += 1
        state["roundAttemptsUsed"] += 1
        state["roundEvaluated"] += 1
        state["totalAttempts"] += 1
        state["roundSuccesses"] += int(result == "success")
        drafts.append({"type": "TARGET_SUCCESS" if result == "success" else "TARGET_RETRY", "payload": {}})
    move = result == "success" or state["itemAttemptsUsed"] >= MAX_TRIES or state["listenAgainCount"] >= MAX_NEUTRAL_STREAK
    if not move:
        # 전송 순번은 평가 시도와 다르다. 중립 발화 재전송도 같은 번호로 두 번 저장하지 않는다.
        state["roundAttempt"] += 1
        update_cue(state, model=state["roundIndex"] == 1 or neutral)
        return drafts
    drafts.append({"type": "ITEM_ADVANCE", "payload": {}})
    if state["itemIndexInRound"] == ITEMS_PER_ROUND:
        drafts.append({"type": "ROUND_CLEAR", "payload": {"index": state["roundIndex"], "doneAttempts": state["roundAttemptsUsed"]}})
        if state["roundIndex"] == 5:
            state["roundsComplete"] = True
            state["modelCue"] = False
            drafts.append({"type": "SESSION_COMPLETE", "payload": {"totalAttempts": state["totalAttempts"], "lap": state.get("lap", 1)}})
            return drafts
        state.update(roundIndex=state["roundIndex"] + 1, stageIndex=state["stageIndex"] + 1,
                     itemIndexInRound=1, roundAttemptsUsed=0, roundSuccesses=0, roundEvaluated=0,
                     roundStartedAt=at.isoformat())
        drafts.append({"type": "ROUND_START", "payload": child_round(GAME_ROUNDS[GAME][state["roundIndex"] - 1])})
    else:
        state["itemIndexInRound"] += 1
    state["stripeIndex"] = (state["roundIndex"] - 1) * ITEMS_PER_ROUND + state["itemIndexInRound"]
    state.update(currentItem=stages[state["stageIndex"]]["items"][state["itemIndexInRound"] - 1],
                 itemAttemptsUsed=0, roundAttempt=1, listenAgainCount=0)
    update_cue(state, model=state["roundIndex"] == 1)
    drafts.append({"type": "TARGET_PRESENTED", "payload": {"item": state["currentItem"]}})
    return drafts


def next_lap(state, stages, at):
    """한 판을 마친 회기에서 첫 줄부터 다시 건넌다. 시도 수(totalAttempts)와 관찰은 같은 회기에 이어서 쌓인다."""
    lap = state.get("lap", 1) + 1
    state.update(lap=lap, roundsComplete=False, roundIndex=1, stageIndex=0, itemIndexInRound=1, stripeIndex=1,
                 roundAttempt=1, roundAttemptsUsed=0, roundSuccesses=0, roundEvaluated=0, itemAttemptsUsed=0,
                 listenAgainCount=0, roundStartedAt=at.isoformat(), currentItem=stages[0]["items"][0])
    update_cue(state, model=True)
    return [{"type": "LAP_START", "payload": {"lap": lap}},
            {"type": "ROUND_START", "payload": child_round(GAME_ROUNDS[GAME][0])},
            {"type": "TARGET_PRESENTED", "payload": {"item": state["currentItem"]}}]

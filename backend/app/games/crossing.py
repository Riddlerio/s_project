"""대구대 건너기의 20줄 진행. 게임 이동과 음향 근사 관찰을 분리한다."""
import secrets
from dataclasses import replace

from fastapi import HTTPException

from ..training.content import items
from .rounds import GAME_ROUNDS, public_round

GAME = "daegu_crossing"
ITEMS_PER_ROUND = 4
MAX_TRIES = 3
MAX_NEUTRAL_STREAK = 3


def build_stages(goal):
    # 이 근사는 /ㅅ/ 어두만 지원한다. 다른 목표에 같은 판정을 붙이지 않는다.
    if goal.target_phoneme != "ㅅ" or goal.word_position != "initial" or goal.level not in {"syllable", "word"}:
        raise HTTPException(422, "대구대 건너기는 어두 /ㅅ/의 음절·낱말 목표를 지원합니다")
    excluded = set(goal.excluded_words or ())
    syllables = [row for row in items("ㅅ", "syllable") if row["displayText"] not in excluded]
    words = [row for row in items("ㅅ", "word") if row["displayText"] not in excluded]
    preferred_words = {text: index for index, text in enumerate(("사과", "수박", "소리", "시소"))}
    words.sort(key=lambda row: preferred_words.get(row["displayText"], 4))
    if not words or (goal.level == "syllable" and not syllables):
        raise HTTPException(422, "목표의 제외 낱말 설정에서 사용할 연습 항목이 없습니다")
    base = words if goal.level == "word" else syllables
    repeated = next((row for row in base if row["displayText"] == goal.target_sound), base[0])
    varied = [base[index % len(base)] for index in range(ITEMS_PER_ROUND)]
    secrets.SystemRandom().shuffle(varied)
    word_set = [words[index % len(words)] for index in range(ITEMS_PER_ROUND)]
    # 낱말 목표에서는 마지막 혼합 구간도 목표 단계 아래로 낮추지 않는다.
    mixed = word_set if goal.level == "word" else [syllables[0], syllables[1 % len(syllables)], *word_set[:2]]
    rows = [[repeated] * ITEMS_PER_ROUND, [repeated] * ITEMS_PER_ROUND, varied, word_set, mixed]
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
            "stripeIndex": (state["roundIndex"] - 1) * ITEMS_PER_ROUND + state["itemIndexInRound"],
            "triesLeft": 0 if complete else MAX_TRIES - state["itemAttemptsUsed"],
            "modelCue": False if complete else state["modelCue"], "sessionComplete": complete}


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
            drafts.append({"type": "SESSION_COMPLETE", "payload": {"totalAttempts": state["totalAttempts"]}})
            return drafts
        state.update(roundIndex=state["roundIndex"] + 1, stageIndex=state["stageIndex"] + 1,
                     itemIndexInRound=1, roundAttemptsUsed=0, roundSuccesses=0, roundEvaluated=0,
                     roundStartedAt=at.isoformat())
        drafts.append({"type": "ROUND_START", "payload": child_round(GAME_ROUNDS[GAME][state["roundIndex"] - 1])})
    else:
        state["itemIndexInRound"] += 1
    state.update(currentItem=stages[state["stageIndex"]]["items"][state["itemIndexInRound"] - 1],
                 itemAttemptsUsed=0, roundAttempt=1, listenAgainCount=0)
    update_cue(state, model=state["roundIndex"] == 1)
    drafts.append({"type": "TARGET_PRESENTED", "payload": {"item": state["currentItem"]}})
    return drafts

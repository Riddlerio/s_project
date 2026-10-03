from dataclasses import dataclass, replace


# 쉼 후 재개(RE_ONSET)에서 한 발화 안의 쉼으로 인정하는 범위(ms). 상한은 그 라운드의 발화 종료 유예보다
# 짧아야 한다. 그보다 길게 쉬면 브라우저가 발화를 끝내므로 서버도 한 발화 안의 쉼으로 인정하지 않는다.
RE_ONSET_PAUSE_MS = (300, 2200)
RE_ONSET_END_HOLD_MS = 2500


@dataclass(frozen=True)
class RoundDefinition:
    id: str
    index: int
    child_title: str
    child_prompt: str
    clinical_focus: str
    task_type: str
    generalization_level: str
    elicitation_type: str
    prompt_type: str
    attempts: int
    time_limit_sec: int
    rule: str
    target_ms: int = 0
    # 모든 라운드 항목은 기존 훈련 단어 목록에서 고른다. 미훈련(novel) 단어를 보장하지 않는다.
    item_source: str = "TRAINING_BANK"
    # 발화 끝 판단 전 기다리는 시간. 쉼 후 재개를 보는 라운드는 한 발화 안에서 쉼을 허용한다.
    end_hold_ms: int = 700


def _round(game, index, title, prompt, focus, task, level, elicitation, prompt_type, attempts, rule, target=0, end_hold_ms=700):
    return RoundDefinition(f"{game}.r{index}", index, title, prompt, focus, task, level,
                           elicitation, prompt_type, attempts, 60 if game != "conversation_quest" else 90, rule, target,
                           end_hold_ms=end_hold_ms)


GAME_ROUNDS = {
    "magic_beam": (
        _round("magic_beam", 1, "마법 깨우기", "두두를 따라 스— 하고 말해줘!", "모델 후 /ㅅ/ 지속 산출", "SUSTAINED_PRODUCTION", "SOUND", "DIRECT_IMITATION", "AUDITORY_MODEL", 3, "FRICATION", 1000),
        _round("magic_beam", 2, "빔 쏘기", "혼자 힘으로 빔을 쏴 볼까?", "독립 지속 산출", "SUSTAINED_PRODUCTION", "SOUND", "PROMPTED_PRODUCTION", "VISUAL", 3, "FRICATION", 1500),
        _round("magic_beam", 3, "끊기지 않는 빔", "빛을 길게 이어 줘!", "연속성·쉼 관찰", "SUSTAINED_PRODUCTION", "SOUND", "PROMPTED_PRODUCTION", "VISUAL", 3, "CONTINUITY", 2000),
        _round("magic_beam", 4, "리듬 펄스", "스, 스, 스! 세 번 들려줘!", "반복 onset 안정성", "RHYTHM", "SOUND", "DIRECT_IMITATION", "AUDITORY_MODEL", 3, "PULSES", 500, 1200),
        _round("magic_beam", 5, "음절 빔", "사— 하고 말해줘!", "마찰음에서 모음으로 전이", "SUSTAINED_PRODUCTION", "SYLLABLE", "PROMPTED_PRODUCTION", "WORD_CARD", 3, "TRANSITION", 400),
    ),
    "sky_climb": (
        _round("sky_climb", 1, "구름 위로", "소리를 내며 첫 구름에 올라가자!", "발성 시작·짧은 지속", "SUSTAINED_PRODUCTION", "SOUND", "DIRECT_IMITATION", "AUDITORY_MODEL", 3, "SUSTAIN", 1000),
        _round("sky_climb", 2, "높이 날기", "소리를 길게 이어 보자!", "목표 음 독립 지속", "SUSTAINED_PRODUCTION", "SOUND", "PROMPTED_PRODUCTION", "VISUAL", 4, "SUSTAIN", 1500),
        _round("sky_climb", 3, "바람 조절", "바람을 고르게 불어 줘!", "발성 강도 유지 참고", "SUSTAINED_PRODUCTION", "SOUND", "PROMPTED_PRODUCTION", "VISUAL", 3, "ENERGY_BAND", 1500),
        _round("sky_climb", 4, "쉬고 다시", "잠깐 쉬었다가 다시 날아 보자!", "쉼 후 재개", "SUSTAINED_PRODUCTION", "SOUND", "DIRECT_IMITATION", "AUDITORY_MODEL", 5, "RE_ONSET", 1000, RE_ONSET_END_HOLD_MS),
        _round("sky_climb", 5, "정상 도착", "마지막 구름까지 길게 날아가자!", "최장 지속 관찰", "SUSTAINED_PRODUCTION", "SOUND", "PROMPTED_PRODUCTION", "VISUAL", 6, "SUSTAIN", 2500),
    ),
    "monster_adventure": (
        _round("monster_adventure", 1, "주문 따라 하기", "두두를 따라 말해줘!", "음절 수준 모방", "TARGET_PRODUCTION", "SYLLABLE", "DIRECT_IMITATION", "WORD_CARD", 3, "TARGET_WORD"),
        _round("monster_adventure", 2, "따라 말하는 마법", "말을 따라 하며 마법을 모으자!", "단어 모방", "TARGET_PRODUCTION", "WORD", "DIRECT_IMITATION", "WORD_CARD", 3, "TARGET_WORD"),
        _round("monster_adventure", 3, "그림 보고 마법", "그림을 보고 이름을 말해줘!", "독립 명명", "TARGET_PRODUCTION", "WORD", "SELF_GENERATED", "PICTURE_PROMPT", 3, "TARGET_WORD"),
        _round("monster_adventure", 4, "새 장면 몬스터", "몬스터에게 그림 이름을 알려줘!", "새 장면에서 훈련 단어 산출", "TARGET_PRODUCTION", "WORD", "SELF_GENERATED", "PICTURE_PROMPT", 3, "TARGET_WORD"),
        _round("monster_adventure", 5, "보스 몬스터", "짧은 말로 주문을 외워줘!", "구 수준 목표 음소 산출", "PHRASE_PRODUCTION", "PHRASE", "PROMPTED_PRODUCTION", "WORD_CARD", 2, "TARGET_WORD"),
    ),
    "conversation_quest": (
        _round("conversation_quest", 1, "소풍 준비", "사과랑 바나나 중에 뭐 챙길까?", "선택형 유도 산출", "CONTEXTUAL_PRODUCTION", "WORD", "PROMPTED_PRODUCTION", "MODELED_CHOICE", 2, "CONVERSATION"),
        _round("conversation_quest", 2, "무엇이 필요할까", "소풍에 뭐 가져갈까?", "그림 기반 자기 생성", "CONTEXTUAL_PRODUCTION", "WORD", "SELF_GENERATED", "OPEN_QUESTION", 2, "CONVERSATION"),
        _round("conversation_quest", 3, "가방 채우기", "두두한테 넣어 달라고 말해줘!", "운반구 속 산출", "CONTEXTUAL_PRODUCTION", "PHRASE", "CONVERSATIONAL", "SENTENCE_FRAME", 2, "CONVERSATION"),
        _round("conversation_quest", 4, "누구랑 갈까", "누구랑 갈까?", "문장 수준 응답", "CONTEXTUAL_PRODUCTION", "SENTENCE", "CONVERSATIONAL", "OPEN_QUESTION", 2, "CONVERSATION"),
        _round("conversation_quest", 5, "소풍 이야기", "소풍에서 뭐가 제일 재밌었어?", "자유 대화 중 자발 산출", "CONTEXTUAL_PRODUCTION", "SPONTANEOUS", "SPONTANEOUS", "OPEN_QUESTION", 2, "CONVERSATION"),
    ),
}


def effective_round(round_def: RoundDefinition, difficulty: int) -> RoundDefinition:
    if not round_def.target_ms or round_def.rule in {"PULSES", "TRANSITION"}:
        return round_def
    multiplier = 1 + 0.15 * (difficulty - 2)
    return replace(round_def, target_ms=max(800, min(3500, round(round_def.target_ms * multiplier))))


def public_round(round_def: RoundDefinition, difficulty: int | None = None) -> dict:
    if difficulty is not None:
        round_def = effective_round(round_def, difficulty)
    return {"index": round_def.index, "id": round_def.id, "childTitle": round_def.child_title,
            "childPrompt": round_def.child_prompt, "clinicalFocus": round_def.clinical_focus,
            "generalizationLevel": round_def.generalization_level, "elicitationType": round_def.elicitation_type,
            "attempts": round_def.attempts, "targetMs": round_def.target_ms,
            "itemSource": round_def.item_source, "endHoldMs": round_def.end_hold_ms,
            **({"difficulty": difficulty} if difficulty is not None else {})}


def next_difficulty(current: int, successes: int, evaluated: int, increases: int, low_streak: int, decreased: bool) -> tuple[int, int, int, bool]:
    if evaluated == 0:
        return current, increases, 0, decreased
    ratio = successes / evaluated
    if ratio >= 2 / 3 and increases < 2:
        return min(5, current + 1), increases + 1, 0, decreased
    if ratio <= 1 / 3:
        low_streak += 1
        if low_streak >= 2 and not decreased:
            return max(1, current - 1), increases, 0, True
        return current, increases, low_streak, decreased
    return current, increases, 0, decreased

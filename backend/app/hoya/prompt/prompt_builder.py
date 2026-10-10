"""호야 대화 제공자에게 넘길 최소 context와 메시지를 만든다.

신뢰하는 지시(system prompt, 서버가 정한 전략·목표)와 신뢰하지 않는 아동 발화를 서로 다른 메시지로 나눈다.
API key·비밀번호·play code·계정 id·원본 음성·아동 이름은 넣지 않는다.
"""
import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from ..schemas import SpeechEvidence, Strategy

SYSTEM_PROMPT_FILE = Path(__file__).with_name("system_prompt.md")

# 이번 차례에 할 일. 전략 목록을 주고 고르게 하면 모델이 아동 말에 맞춰 전략을 바꾸므로, 정해진 전략 하나만 풀어 쓴다.
STRATEGY_GUIDE: dict[str, str] = {
    "CONTINUE_OR_EXPAND": "아동 말에 반응하고 같은 이야기를 이어 가거나 조금 넓힌다.",
    "NATURAL_REELICITATION": "아동 말에 먼저 짧게 반응한 뒤, 지금 주제와 이어지는 질문 하나로 targetLexicon 낱말이 나올 기회를 만든다.",
    "WAIT_OR_SIMPLIFY": "소리가 없었다. 재촉하지 않고 기다려 주거나 더 쉬운 질문을 한다.",
    "SIMPLIFY": "잘 들리지 않은 일이 이어졌다. 고치라고 하지 않고 둘 중 하나를 고르는 쉬운 질문을 한다.",
    "ALLOWED_CUE": "두두가 자기 문장에서 targetLexicon 낱말 하나를 먼저 들려준 뒤 질문한다. 따라 하라고 시키지 않는다.",
}


@lru_cache
def system_prompt() -> str:
    return SYSTEM_PROMPT_FILE.read_text(encoding="utf-8")


@dataclass(frozen=True)
class HoyaDialogueContext:
    age_band: str
    target_phoneme: str
    word_position: str
    level: str
    strategy: Strategy
    evidence: SpeechEvidence
    target_lexicon: list[str]
    allowed_cue: str | None
    # 신뢰하지 않는 대화 내용. 오래된 것부터, 각 항목은 {"speaker": "child"|"hoya", "text": ...}.
    child_transcript: str | None
    recent_turns: list[dict] = field(default_factory=list)
    turn_index: int = 1


def trusted_context(context: HoyaDialogueContext) -> dict:
    return {
        "childContext": {"ageBand": context.age_band},
        "therapyContext": {"targetPhoneme": context.target_phoneme, "wordPosition": context.word_position,
                           "level": context.level, "allowedCue": context.allowed_cue},
        "conversationPolicy": {"strategy": context.strategy, "thisTurn": STRATEGY_GUIDE[context.strategy]},
        "speechEvidence": {"result": context.evidence},
        "targetLexicon": context.target_lexicon,
    }


def untrusted_content(context: HoyaDialogueContext) -> dict:
    return {"childTranscript": context.child_transcript, "recentTurns": context.recent_turns}


def build_messages(context: HoyaDialogueContext) -> list[dict]:
    """Responses API 입력. developer 메시지는 서버 값, user 메시지는 아동 대화 내용(UNTRUSTED)만 담는다."""
    return [
        {"role": "developer", "content": json.dumps(trusted_context(context), ensure_ascii=False)},
        {"role": "user", "content": json.dumps({"untrustedChildContent": untrusted_content(context)}, ensure_ascii=False)},
    ]

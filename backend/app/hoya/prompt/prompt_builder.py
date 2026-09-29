"""호야 대화 제공자에게 넘길 최소 context와 메시지를 만든다.

신뢰하는 지시(system prompt, 서버가 정한 전략·목표)와 신뢰하지 않는 아동 발화를 서로 다른 메시지로 나눈다.
API key·비밀번호·play code·계정 id·원본 음성·아동 이름은 넣지 않는다.
"""
import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import get_args

from ..schemas import HoyaChatAction, SpeechEvidence, Strategy

SYSTEM_PROMPT_FILE = Path(__file__).with_name("system_prompt.md")


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
        "conversationPolicy": {"strategy": context.strategy},
        "speechEvidence": {"result": context.evidence},
        "targetLexicon": context.target_lexicon,
        "allowedHoyaActions": list(get_args(HoyaChatAction)),
        "allowedStrategies": list(get_args(Strategy)),
    }


def untrusted_content(context: HoyaDialogueContext) -> dict:
    return {"childTranscript": context.child_transcript, "recentTurns": context.recent_turns}


def build_messages(context: HoyaDialogueContext) -> list[dict]:
    """Responses API 입력. developer 메시지는 서버 값, user 메시지는 아동 대화 내용(UNTRUSTED)만 담는다."""
    return [
        {"role": "developer", "content": json.dumps(trusted_context(context), ensure_ascii=False)},
        {"role": "user", "content": json.dumps({"untrustedChildContent": untrusted_content(context)}, ensure_ascii=False)},
    ]

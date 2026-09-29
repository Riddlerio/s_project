"""호야 대화의 요청·응답·제공자 출력 schema."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

from ..pronunciation.acoustic import AcousticSummary
from ..schemas_base import ApiModel


# 자유대화 근거 상태. 정해진 목표 단어가 없으므로 정오(success/failure)를 판정하지 않는다.
SpeechEvidence = Literal["TARGET_OBSERVED", "TARGET_NOT_OBSERVED", "UNCERTAIN", "NO_SPEECH"]
# 백엔드 정책이 정한 다음 대화 전략. LLM은 이 값을 바꿀 수 없다.
Strategy = Literal["CONTINUE_OR_EXPAND", "NATURAL_REELICITATION", "WAIT_OR_SIMPLIFY", "SIMPLIFY", "ALLOWED_CUE"]
# 대화 응답에 허용하는 호야 행동. 프런트엔드 HoyaAction의 부분집합이다.
HoyaChatAction = Literal["IDLE", "LISTENING", "TALKING", "THINKING", "WAVE", "CHEER", "ENCOURAGE", "WALK_TO", "PICK_UP"]

MAX_TRANSCRIPT_CHARS = 80
MAX_HOYA_TEXT_CHARS = 120
RECENT_TURNS = 5


class _Forbid(ApiModel):
    model_config = ConfigDict(alias_generator=ApiModel.model_config["alias_generator"], populate_by_name=True, extra="forbid")


class HoyaChatStartInput(_Forbid):
    mode: Literal["real", "demo"] = "demo"


class HoyaChatTurnInput(_Forbid):
    turn_index: StrictInt = Field(ge=1, le=1000)
    transcript: str | None = Field(default=None, max_length=MAX_TRANSCRIPT_CHARS)
    alternatives: list[str] = Field(default_factory=list, max_length=5)
    recognizer: Literal["web_speech", "demo_script"] = "demo_script"
    acoustic: AcousticSummary = Field(default_factory=AcousticSummary)

    @field_validator("alternatives")
    @classmethod
    def limit_alternatives(cls, values: list[str]) -> list[str]:
        if any(len(value) > MAX_TRANSCRIPT_CHARS for value in values):
            raise ValueError("대체 인식 결과가 너무 깁니다")
        return values


class ProviderOutput(BaseModel):
    """대화 제공자(LLM 또는 DEMO)가 돌려주는 값. 검증기를 통과해야 아동에게 전달된다."""
    model_config = ConfigDict(extra="forbid")
    text: str
    strategy: Strategy
    target_words: list[str] = Field(default_factory=list, max_length=6)
    hoya_actions: list[HoyaChatAction] = Field(default_factory=list, max_length=4)


class HoyaDialogueResponse(ApiModel):
    text: str
    strategy: Strategy
    target_words: list[str]
    hoya_actions: list[HoyaChatAction]
    provider: str
    model: str | None = None
    fallback_reason: str | None = None

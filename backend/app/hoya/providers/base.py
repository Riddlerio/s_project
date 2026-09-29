"""호야 대화 제공자 공통 인터페이스. 제공자만 바꾸면 OpenAI·Anthropic·Gemini·로컬 LLM을 붙일 수 있다."""
from typing import Protocol

from ..prompt.prompt_builder import HoyaDialogueContext
from ..schemas import ProviderOutput


class ProviderError(Exception):
    """제공자 실패. reason에는 아동 발화·key·프롬프트 같은 내용을 넣지 않는다."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


class HoyaDialogueProvider(Protocol):
    name: str
    model: str | None

    async def reply(self, context: HoyaDialogueContext) -> ProviderOutput: ...

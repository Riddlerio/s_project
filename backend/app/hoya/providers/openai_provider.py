"""OpenAI Responses API 제공자. 텍스트 생성 전용이며 tools를 넘기지 않는다.

모델 이름은 HOYA_CHAT_MODEL로만 정한다. key·프롬프트·아동 발화는 로그에 남기지 않는다.
"""
import asyncio
import logging
from functools import lru_cache
from typing import Literal

from pydantic import create_model

from ..prompt.prompt_builder import HoyaDialogueContext, build_messages, system_prompt
from ..schemas import ProviderOutput, Strategy
from .base import ProviderError

log = logging.getLogger(__name__)


@lru_cache
def output_format(strategy: Strategy) -> type[ProviderOutput]:
    """출력 schema의 strategy를 서버가 정한 값 하나로 묶는다. 모델이 다른 전략 이름을 적어 검증에서 걸러지는 일을 막는다."""
    return create_model(f"DuduReply{strategy.title().replace('_', '')}", __base__=ProviderOutput,
                        strategy=(Literal[strategy], ...))


class OpenAIProvider:
    name = "OPENAI"

    def __init__(self, api_key: str, model: str, timeout_sec: float = 8.0, client=None):
        if not api_key or not model:
            raise ProviderError("NOT_CONFIGURED")
        self.model = model
        self.timeout_sec = timeout_sec
        if client is None:
            from openai import AsyncOpenAI
            # 재시도하지 않는다. 실패하면 서비스가 곧바로 DemoProvider로 대체한다.
            client = AsyncOpenAI(api_key=api_key, timeout=timeout_sec, max_retries=0)
        self._client = client

    async def reply(self, context: HoyaDialogueContext) -> ProviderOutput:
        try:
            response = await asyncio.wait_for(self._client.responses.parse(
                model=self.model, instructions=system_prompt(), input=build_messages(context),
                text_format=output_format(context.strategy), max_output_tokens=400, store=False,
            ), timeout=self.timeout_sec)
        except asyncio.TimeoutError as error:
            raise ProviderError("TIMEOUT") from error
        except Exception as error:  # SDK 예외(연결·상태 코드·응답 형식)의 종류만 남긴다.
            reason = _reason(error)
            log.warning("호야 대화 제공자 호출 실패: %s", reason)
            raise ProviderError(reason) from error
        parsed = getattr(response, "output_parsed", None)
        if parsed is None:
            raise ProviderError("EMPTY_RESPONSE")
        return parsed if isinstance(parsed, ProviderOutput) else ProviderOutput.model_validate(parsed)


def _reason(error: Exception) -> str:
    try:
        import openai
    except ImportError:  # pragma: no cover
        return "PROVIDER_ERROR"
    if isinstance(error, openai.APITimeoutError):
        return "TIMEOUT"
    if isinstance(error, openai.APIStatusError):
        return f"HTTP_{error.status_code}"
    if isinstance(error, openai.APIConnectionError):
        return "CONNECTION"
    if isinstance(error, ValueError):  # JSON·schema 검증 실패(pydantic ValidationError 포함)
        return "INVALID_OUTPUT"
    return "PROVIDER_ERROR"

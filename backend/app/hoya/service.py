"""호야 대화 서비스: 제공자 선택, 응답 검증, 실패 시 DemoProvider 대체.

대체 응답은 대화를 이어 가기 위한 것이며 아동 발음의 성공·실패를 기록하지 않는다.
"""
import logging

from ..config import Settings
from .prompt.prompt_builder import HoyaDialogueContext
from .providers.base import HoyaDialogueProvider, ProviderError
from .providers.demo_provider import DemoProvider
from .schemas import HoyaDialogueResponse
from .validator import ValidationFailure, validate_output

log = logging.getLogger(__name__)


def generates_replies(config: Settings) -> bool:
    """외부 제공자가 두두의 답을 만들 설정인지. 그런 대화는 미리 녹음한 두두 음성 파일로 말할 수 없으므로,
    아동 화면은 이 값을 보고 인사부터 끝까지 같은 브라우저 음성으로 말한다."""
    return (config.hoya_chat_enabled and config.hoya_chat_provider == "openai"
            and bool(config.openai_api_key.get_secret_value().strip()) and bool(config.hoya_chat_model.strip()))


def select_provider(config: Settings) -> tuple[HoyaDialogueProvider | None, str | None]:
    """외부 제공자와, 쓸 수 없을 때의 사유를 돌려준다. None이면 DemoProvider만 쓴다."""
    if not config.hoya_chat_enabled:
        return None, None
    if config.hoya_chat_provider != "openai":
        return None, "UNSUPPORTED_PROVIDER"
    key = config.openai_api_key.get_secret_value().strip()
    if not key or not config.hoya_chat_model.strip():
        return None, "NOT_CONFIGURED"
    try:
        from .providers.openai_provider import OpenAIProvider
        return OpenAIProvider(key, config.hoya_chat_model.strip(), config.hoya_chat_timeout_sec), None
    except (ProviderError, ImportError):
        return None, "NOT_CONFIGURED"


class HoyaDialogueService:
    def __init__(self, provider: HoyaDialogueProvider | None = None, unavailable_reason: str | None = None):
        self.provider = provider
        self.unavailable_reason = unavailable_reason
        self.demo = DemoProvider()

    def _demo(self, context: HoyaDialogueContext, provider: str, reason: str | None) -> HoyaDialogueResponse:
        output = self.demo.reply_sync(context)
        return HoyaDialogueResponse(text=output.text, strategy=output.strategy, target_words=output.target_words,
                                    provider=provider, model=None, fallback_reason=reason)

    def fallback(self, context: HoyaDialogueContext, reason: str) -> HoyaDialogueResponse:
        """외부 제공자를 부르지 않고 DEMO 응답으로 turn을 마무리한다(멈춘 예약 복구 등)."""
        return self._demo(context, "DEMO_FALLBACK", reason)

    async def reply(self, context: HoyaDialogueContext) -> HoyaDialogueResponse:
        if self.provider is None:
            return self._demo(context, "DEMO" if self.unavailable_reason is None else "DEMO_FALLBACK", self.unavailable_reason)
        try:
            output = validate_output(await self.provider.reply(context), context.strategy, context.target_lexicon)
        except ProviderError as error:
            return self._demo(context, "DEMO_FALLBACK", error.reason)
        except ValidationFailure as error:
            log.info("호야 대화 응답이 검증을 통과하지 못해 DEMO 응답을 씁니다: %s", error.reason)
            return self._demo(context, "DEMO_FALLBACK", f"INVALID_{error.reason}")
        except Exception:  # 예상하지 못한 제공자 오류도 아동 화면을 깨지 않는다.
            log.warning("호야 대화 제공자 예외")
            return self._demo(context, "DEMO_FALLBACK", "PROVIDER_ERROR")
        return HoyaDialogueResponse(text=output.text, strategy=output.strategy, target_words=output.target_words,
                                    provider=self.provider.name, model=self.provider.model)

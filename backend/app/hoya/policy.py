"""호야 대화 전략을 정하는 결정적 정책. LLM은 여기서 정한 전략을 문장으로 표현만 한다."""
from .schemas import SpeechEvidence, Strategy
from .transitions import EASY_QUESTION_NO_SPEECH_TURNS, consecutive_no_speech

# 대화에서 실제로 줄 수 있는 치료사 허용 단서. 호야가 목표 단어를 자기 문장에서 자연스럽게 들려주는 것뿐이다.
# visual_mouth(입 모양 보기)·tactile_description(촉각 설명)은 음성 대화로 줄 수 없고,
# 치료사가 쓴 단서 문구도 없으므로 대화에서는 쓰지 않는다.
CHAT_ALLOWED_CUES = {"auditory_model"}


def allowed_cue(goal, rules=()) -> str | None:
    """기존 모험 정책과 같이 CUE_OVERRIDE 규칙이 목표의 preferred_cue보다 우선한다."""
    override = next((rule for rule in rules if rule.rule_type == "CUE_OVERRIDE" and rule.active), None)
    cue = (override.params.get("cue") if override else None) or goal.preferred_cue
    return cue if cue in CHAT_ALLOWED_CUES else None


class HoyaConversationPolicy:
    def decide(self, evidence: SpeechEvidence, previous: list[SpeechEvidence], cue: str | None) -> Strategy:
        """previous는 이번 발화 이전의 근거(오래된 것부터)다."""
        last = previous[-1] if previous else None
        if evidence == "NO_SPEECH":
            # 세 번째 무발화에는 그림 고르기로 쉽게 바꾼다. 다음 무발화의 게임 안내는 API가 맡는다.
            return "SIMPLIFY" if consecutive_no_speech([*previous, evidence]) >= EASY_QUESTION_NO_SPEECH_TURNS else "WAIT_OR_SIMPLIFY"
        if evidence == "TARGET_OBSERVED":
            return "CONTINUE_OR_EXPAND"
        if evidence == "UNCERTAIN":
            # 불확실이 반복되면 더 쉬운 질문으로 바꾼다. 아동 실패로 보지 않는다.
            return "SIMPLIFY" if last == "UNCERTAIN" else "NATURAL_REELICITATION"
        # 목표가 두 번 이어서 관찰되지 않았고 치료사가 허용한 단서가 있을 때만 청각 모델을 준다.
        if last == "TARGET_NOT_OBSERVED" and cue is not None:
            return "ALLOWED_CUE"
        return "NATURAL_REELICITATION"

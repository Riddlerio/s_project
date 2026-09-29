"""자유대화 발화를 기존 Speech Engine 규칙으로 요약한다. 발음 정오를 판정하지 않는다."""
from ..games.evaluation import evaluate_round
from ..games.rounds import GAME_ROUNDS
from ..speech.pipeline import acoustic_number
from .schemas import SpeechEvidence

# Conversation Quest의 자발 대화 라운드와 같은 CONVERSATION 규칙(음질 게이트 + 목표 음소 검출)을 쓴다.
_CONVERSATION_ROUND = GAME_ROUNDS["conversation_quest"][4]
_MAP = {"target_observed": "TARGET_OBSERVED", "not_target_attempt": "TARGET_NOT_OBSERVED",
        "uncertain": "UNCERTAIN", "no_speech": "NO_SPEECH"}


def classify_speech(transcript: str | None, acoustic: dict, goal) -> SpeechEvidence:
    result = evaluate_round(_CONVERSATION_ROUND, {}, transcript, acoustic, goal).result
    # 마이크가 소리를 들었는데 인식 문장이 없으면(ASR 실패·미지원) 무발화가 아니라 불확실이다.
    if result == "no_speech" and acoustic.get("source") == "microphone" \
            and acoustic_number(acoustic, "activeMs", acoustic_number(acoustic, "voicedMs")) > 0:
        return "UNCERTAIN"
    return _MAP.get(result, "UNCERTAIN")

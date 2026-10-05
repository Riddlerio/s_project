"""대화에서 게임으로 안내하는 제품 규칙. 목표 관찰 횟수는 발음 정확도가 아니다."""
from .schemas import SpeechEvidence

TARGET_ATTEMPTS = 10
MIN_CONVERSATION_SECONDS = 120
MAX_CONVERSATION_SECONDS = 300
EASY_QUESTION_NO_SPEECH_TURNS = 3
TRANSITION_NO_SPEECH_TURNS = 4
NEXT_ACTIVITY = "daegu_crossing"
TRANSITION_TEXT = "우리 게임 해 볼까? 아래 '대구대 건너기'를 눌러 볼래?"


def consecutive_no_speech(evidence: list[SpeechEvidence]) -> int:
    count = 0
    for value in reversed(evidence):
        if value != "NO_SPEECH":
            break
        count += 1
    return count


def should_transition(evidence: list[SpeechEvidence], elapsed_seconds: float) -> bool:
    """현재 턴까지의 서버 근거와 서버 시각만 쓴다. 불확실은 무발화로 세지 않는다."""
    return (
        (evidence.count("TARGET_OBSERVED") >= TARGET_ATTEMPTS and elapsed_seconds >= MIN_CONVERSATION_SECONDS)
        or elapsed_seconds >= MAX_CONVERSATION_SECONDS
        or consecutive_no_speech(evidence) >= TRANSITION_NO_SPEECH_TURNS
    )

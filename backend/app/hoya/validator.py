"""제공자 응답 검증. 안전을 system prompt 하나에만 맡기지 않는다. 통과하지 못하면 DemoProvider로 대체한다."""
import re

from .prompt.prompt_builder import system_prompt
from .schemas import MAX_HOYA_TEXT_CHARS, ProviderOutput, Strategy

# 평가·교정, 진단·효과 단정, 임의 치료 기법, 개인정보 요청, 지시문 노출에 해당하는 표현.
BLOCKED_PATTERNS = [
    (r"틀렸|잘못\s*(말|발음)|발음이\s*(이상|나빠|틀)|제대로\s*(말|발음)|다시\s*정확", "CORRECTION"),
    (r"진단|장애|치료\s*효과|나아졌|완치|정상\s*발음|발음\s*점수", "CLINICAL_CLAIM"),
    (r"혀|이빨|치아|잇몸|입술을|입\s*모양|입\s*운동|숨을|호흡|배에\s*힘|목을\s*만져|손을\s*대", "CLINICAL_CUE"),
    (r"주소|전화\s*번호|핸드폰|비밀\s*번호|아이디|계정|어느\s*학교|학교\s*이름|어디\s*살|사진", "PERSONAL_INFO"),
    (r"시스템\s*프롬프트|system\s*prompt|지시문|developer|규칙을\s*무시|instruction", "PROMPT_DISCLOSURE"),
    (r"바보|멍청|싫어해|혼나|못해|한심", "INAPPROPRIATE"),
]


class ValidationFailure(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def _prompt_fragments() -> list[str]:
    lines = [re.sub(r"\s+", "", line.strip("-[] ")) for line in system_prompt().splitlines()]
    return [line[:24] for line in lines if len(line) >= 24]


def validate_output(output: ProviderOutput, strategy: Strategy, lexicon: list[str]) -> ProviderOutput:
    text = (output.text or "").strip()
    if not text:
        raise ValidationFailure("EMPTY_TEXT")
    if len(text) > MAX_HOYA_TEXT_CHARS:
        raise ValidationFailure("TEXT_TOO_LONG")
    if output.strategy != strategy:
        raise ValidationFailure("STRATEGY_MISMATCH")
    if any(word not in lexicon for word in output.target_words):
        raise ValidationFailure("TARGET_OUTSIDE_LEXICON")
    if text.count("?") > 1:
        raise ValidationFailure("MULTIPLE_QUESTIONS")
    for pattern, reason in BLOCKED_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            raise ValidationFailure(reason)
    compact = re.sub(r"\s+", "", text)
    if any(fragment in compact for fragment in _prompt_fragments()):
        raise ValidationFailure("PROMPT_DISCLOSURE")
    return output.model_copy(update={"text": text})

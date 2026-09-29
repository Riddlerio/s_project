"""LLM 없이 쓰는 결정적 호야 대화. Conversation Quest의 DEMO_RULES(quest_reply)와 별개다.

아동 말의 주제에 먼저 반응하고, 전략에 맞춰 목표 음소가 나올 만한 질문 하나를 붙인다.
"""
from ..prompt.prompt_builder import HoyaDialogueContext
from ..schemas import ProviderOutput

OPENING = "안녕! 나는 호야야. 오늘 뭐 하고 놀았어?"

# (주제 단어, 반응, 음소별 이어 가는 질문). 질문은 그 주제를 유지하면서 목표 음소가 들어간 대답이 나오기 쉽게 고른다.
TOPICS = [
    (("학교", "유치원", "어린이집"), "학교 다녀왔구나!",
     {"ㅅ": "오늘 선생님이랑 어떤 수업 했어?", "ㅈ": "학교에서 제일 재미있었던 건 뭐야?", "ㄹ": "학교에서 누구랑 놀았어?"}),
    (("축구", "야구", "농구", "공놀이"), "{key}했구나!",
     {"ㅅ": "같이 뛴 선수가 있었어?", "ㅈ": "골 넣을 때 기분이 좋았어?", "ㄹ": "공이 어디로 굴러갔어?"}),
    (("수업", "미술", "그림", "만들"), "와, 재미있었겠다!",
     {"ㅅ": "무슨 색으로 했어?", "ㅈ": "그중에 제일 좋았던 건 뭐야?", "ㄹ": "그거 누구랑 같이 했어?"}),
    (("놀이터", "미끄럼", "그네", "시소"), "놀이터에서 놀았구나!",
     {"ㅅ": "시소도 탔어?", "ㅈ": "제일 재미있는 놀이기구는 뭐야?", "ㄹ": "누구랑 같이 놀았어?"}),
    (("먹", "간식", "밥", "과자", "사과", "수박"), "맛있었겠다!",
     {"ㅅ": "제일 좋아하는 과일은 뭐야?", "ㅈ": "주스도 마셨어?", "ㄹ": "라면도 좋아해?"}),
    (("엄마", "아빠", "가족", "동생", "형", "누나", "언니", "오빠", "친구"), "같이 있었구나!",
     {"ㅅ": "같이 무슨 놀이 했어?", "ㅈ": "같이 뭐 할 때 제일 재미있어?", "ㄹ": "같이 어디 놀러 갔어?"}),
]
GENERIC = ("그랬구나!", {"ㅅ": "그때 무슨 소리가 났어?", "ㅈ": "그거 재미있었어?", "ㄹ": "그다음에는 어디로 갔어?"})
WAIT = ["천천히 생각해도 괜찮아. 오늘 뭐 하고 놀았어?", "호야는 기다릴 수 있어. 좋아하는 놀이가 뭐야?",
        "괜찮아! 오늘 기분은 어때?"]


def _has_final(word: str) -> bool:
    code = ord(word[-1]) - 0xAC00
    return 0 <= code < 11172 and code % 28 != 0


def _topic(transcript: str | None):
    text = transcript or ""
    for keys, ack, questions in TOPICS:
        key = next((key for key in keys if key in text), None)
        if key:
            # 아동이 말한 주제 단어를 그대로 받아 준다("축구했어" → "축구했구나!").
            return ack.format(key=key), questions
    return GENERIC


class DemoProvider:
    name = "DEMO"
    model = None

    async def reply(self, context: HoyaDialogueContext) -> ProviderOutput:
        return self.reply_sync(context)

    def reply_sync(self, context: HoyaDialogueContext) -> ProviderOutput:
        phoneme = context.target_phoneme
        lexicon = context.target_lexicon
        word = lexicon[(context.turn_index - 1) % len(lexicon)] if lexicon else None
        strategy = context.strategy
        if strategy == "WAIT_OR_SIMPLIFY":
            return ProviderOutput(text=WAIT[(context.turn_index - 1) % len(WAIT)], strategy=strategy)
        if strategy == "SIMPLIFY":
            if len(lexicon) >= 2:
                first, second = lexicon[(context.turn_index - 1) % len(lexicon)], lexicon[context.turn_index % len(lexicon)]
                return ProviderOutput(text=f"호야가 잘 못 들었나 봐. {first}{'이' if _has_final(first) else '가'} 좋아, {second}{'이' if _has_final(second) else '가'} 좋아?",
                                      strategy=strategy, target_words=[first, second])
            return ProviderOutput(text="호야가 잘 못 들었나 봐. 좋아하는 놀이 하나만 알려 줄래?", strategy=strategy)
        # 불확실할 때는 인식 문장을 믿지 않으므로 주제 반응을 일반 문장으로 한다.
        ack, questions = _topic(context.child_transcript if context.evidence != "UNCERTAIN" else None)
        question = questions.get(phoneme, GENERIC[1].get(phoneme, "그다음엔 뭐 했어?"))
        if strategy == "ALLOWED_CUE" and word:
            # 치료사가 허용한 청각 모델: 호야가 자기 말 속에서 목표 단어를 먼저 들려준다. 따라 하라고 시키지 않는다.
            return ProviderOutput(text=f"{ack} 호야는 {word}{'을' if _has_final(word) else '를'} 좋아해. 너는 뭐 좋아해?",
                                  strategy=strategy, target_words=[word])
        if strategy == "CONTINUE_OR_EXPAND":
            return ProviderOutput(text=f"{ack} 더 이야기해 줄래?" if context.turn_index % 2 == 0 else f"{ack} {question}",
                                  strategy=strategy)
        return ProviderOutput(text=f"{ack} {question}", strategy=strategy)

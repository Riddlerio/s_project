"""LLM 없이 쓰는 결정적 두두 대화. Conversation Quest의 DEMO_RULES(quest_reply)와 별개다.

아동 말의 주제에 먼저 반응하고, 전략에 맞춰 목표 음소가 나올 만한 질문 하나를 붙인다.
/ㅅ/ 대화(2026-10-06): "오늘 뭐 하고 놀았어?"로 시작해, 아이가 말한 주제에서 /ㅅ/ 낱말이 나오기 쉬운 질문을 한다.
최근에 한 질문은 다시 하지 않는다. 고르기·빈칸·먼저 들려주기는 목표 음소가 두 번 연달아 나오지 않을 때만 돕는 데 쓴다.
"""
import re

from ...speech.g2p import SimpleKoreanG2P
from ...speech.normalization import normalize
from ..prompt.prompt_builder import HoyaDialogueContext
from ..schemas import ProviderOutput

FIRST_QUESTION = "오늘 뭐 하고 놀았어?"
OPENING = f"안녕~ 만나서 반가워! 나는 두두야. {FIRST_QUESTION}"


def opening_text(hero_name: str) -> str:
    """등록한 별명만 시작 인사에 넣는다. 제공자에게 별명을 전달하지 않는다. 부르는 말은 받침에 따라 아/야."""
    return f"안녕~ 만나서 반가워! {hero_name}{'아' if _has_final(hero_name) else '야'}. 나는 두두야. {FIRST_QUESTION}"


# 기존 conversation_candidates에 있는 낱말 중 허용된 것만 골라 쓴다.
S_CLOZE = {
    "사과": "빨갛고 동그란 과일은 사…?",
    "사자": "갈기가 있는 동물은 사…?",
    "소리": "귀로 듣는 것은 소…?",
    "수박": "초록 껍질 속 빨간 과일은 수…?",
    "시소": "놀이터에서 둘이 오르내리는 것은 시…?",
    "사탕": "달콤하게 먹는 간식은 사…?",
    "소풍": "도시락을 싸서 놀러 가는 건 소…?",
    "수건": "젖은 손을 닦는 것은 수…?",
}

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
    (("먹", "간식", "밥", "과자", "과일", "사과", "수박", "딸기", "바나나", "포도", "사탕"), "맛있었겠다!",
     {"ㅅ": "제일 좋아하는 과일은 뭐야?", "ㅈ": "주스도 마셨어?", "ㄹ": "라면도 좋아해?"}),
    (("엄마", "아빠", "가족", "동생", "형", "누나", "언니", "오빠", "친구"), "같이 있었구나!",
     {"ㅅ": "같이 무슨 놀이 했어?", "ㅈ": "같이 뭐 할 때 제일 재미있어?", "ㄹ": "같이 어디 놀러 갔어?"}),
]
GENERIC = ("그랬구나!", {"ㅅ": "그때 무슨 소리가 났어?", "ㅈ": "그거 재미있었어?", "ㄹ": "그다음에는 어디로 갔어?"})
WAIT = [f"천천히 생각해도 괜찮아. {FIRST_QUESTION}", "두두는 기다릴 수 있어. 좋아하는 놀이가 뭐야?",
        "괜찮아! 오늘 기분은 어때?"]

# /ㅅ/ 질문 순서: 주제 질문 → 같은 주제로 이어 가는 질문 → 어디에나 맞는 질문. 최근 3번 안에 한 질문은 건너뛴다.
# 모두 두두 음성 파일이 있다. 처음 질문("오늘 뭐 하고 놀았어?")은 /ㅅ/를 유도하지 않아 맨 뒤에 둔다.
S_FOLLOW_UPS = {
    "오늘 선생님이랑 어떤 수업 했어?": ("같이 무슨 놀이 했어?",),
    "같이 뛴 선수가 있었어?": ("그때 무슨 소리가 났어?",),
    "시소도 탔어?": ("같이 무슨 놀이 했어?", "그때 무슨 소리가 났어?"),
    "같이 무슨 놀이 했어?": ("그때 무슨 소리가 났어?",),
}
S_ANYWHERE = ("좋아하는 놀이가 뭐야?", "제일 좋아하는 과일은 뭐야?", "같이 무슨 놀이 했어?", FIRST_QUESTION)
RECENT_QUESTIONS = 3
# 도울 때 쓸 낱말: 지금 주제나 바로 앞 질문과 이어지는 낱말("시소도 탔어?" → 시소)을 먼저 쓴다.
S_HINTS = {"시소도 탔어?": "시소", "같이 무슨 놀이 했어?": "시소", "좋아하는 놀이가 뭐야?": "시소",
           "제일 좋아하는 과일은 뭐야?": "사과"}
# '소리'는 고르기·먼저 들려주기 문장이 어색해서("소리가 좋아, 사과가 좋아?") 돕는 낱말로 고르지 않는다.
HELP_SKIP = {"소리"}
# 첫 3턴에는 고르기·빈칸 질문을 하지 않는다. 그 전에는 서버가 허용한 먼저 들려주기(ALLOWED_CUE)를 한 번만 쓴다.
HELP_FROM_TURN = 4
# 화면 src/speech/duduClips.ts의 splitSentences와 같은 규칙.
_SENTENCE = re.compile(r"[^.!?]+[.!?]+|[^.!?]+$")


def _has_final(word: str) -> bool:
    code = ord(word[-1]) - 0xAC00
    return 0 <= code < 11172 and code % 28 != 0


def _sentences(text: str) -> list[str]:
    return [part.strip() for part in _SENTENCE.findall(text) if part.strip()]


def _has_target(text: str, phoneme: str) -> bool:
    # 서버가 대화 근거를 정하는 규칙(games/evaluation.py의 CONVERSATION)과 같다. 발음 정확도가 아니다.
    return any(phone.symbol == phoneme for phone in SimpleKoreanG2P().to_phonemes(normalize(text) or ""))


def _previous_child(recent_turns: list[dict]) -> str | None:
    """바로 앞 turn에 아동이 한 말. 첫 turn이거나 앞 turn이 무발화였으면(두두 말만 남음) None."""
    if len(recent_turns) >= 2 and recent_turns[-1].get("speaker") == "hoya" and recent_turns[-2].get("speaker") == "child":
        return recent_turns[-2].get("text") or None
    return None


def _is_help(text: str) -> bool:
    # 고르기("…가 좋아, …가 좋아?")·빈칸("…?")·먼저 들려주기("너도 말해 볼래?") 문장이 든 말
    return any(part.endswith(("…?", "좋아?")) or part == "너도 말해 볼래?" for part in _sentences(text))


def _helped_word(text: str, words: list[str]) -> str | None:
    """돕는 말에서 도운 낱말. 빈칸 문장은 그 답, 고르기·먼저 들려주기는 처음 나온 낱말."""
    answer = next((word for word, cloze in S_CLOZE.items() if cloze in text), None)
    if answer:
        return answer if answer in words else None
    found = sorted((text.find(word), word) for word in words if word in text)
    return found[0][1] if found else None


def _topic(transcript: str | None):
    text = transcript or ""
    for keys, ack, questions in TOPICS:
        key = next((key for key in keys if key in text), None)
        if key:
            # 아동이 말한 주제 단어를 그대로 받아 준다("축구했어" → "축구했구나!").
            return ack.format(key=key), questions
    return GENERIC


def _choice(lexicon: list[str], first: str) -> tuple[str, list[str]]:
    # 기본 데모는 사과/수박을 고른다. 치료사의 우선·제외 낱말 목록을 넘어가지는 않는다.
    others = [word for word in lexicon if word != first]
    second = "수박" if first == "사과" and "수박" in others else (others[0] if others else None)
    if second:
        return (f"{first}{'이' if _has_final(first) else '가'} 좋아, {second}{'이' if _has_final(second) else '가'} 좋아?", [first, second])
    return f"{first}{'이' if _has_final(first) else '가'} 좋아?", [first]


def _elicited_s_reply(context: HoyaDialogueContext, ack: str, topic_question: str | None) -> ProviderOutput:
    lexicon, strategy, turn = context.target_lexicon, context.strategy, context.turn_index
    dudu = [item.get("text") or "" for item in context.recent_turns if item.get("speaker") == "hoya"]
    last = _sentences(dudu[-1]) if dudu else []
    # 돕는 말(고르기·빈칸·먼저 들려주기)이 바로 앞에서부터 몇 번 이어졌는지. 이어질수록 단서를 늘린다.
    streak = 0
    for text in reversed(dudu):
        if not _is_help(text):
            break
        streak += 1
    # 목표 음소가 두 번 연달아 없었는지(이번 말과 바로 앞 말). 허용 단서가 없는 아동은 서버 전략만으로는 알 수 없다.
    previous = _previous_child(context.recent_turns)
    missed_twice = (context.evidence == "TARGET_NOT_OBSERVED" and previous is not None
                    and not _has_target(previous, context.target_phoneme))
    help_now = ((turn >= HELP_FROM_TURN and (missed_twice or strategy == "ALLOWED_CUE"))
                or (strategy == "ALLOWED_CUE" and streak == 0))
    # 인식이 불확실하면 아동 말을 되풀이하지 않는다. 관찰된 알려진 낱말만 바르게 다시 들려준다.
    spoken = next((word for word in lexicon if word in (context.child_transcript or "")), None) \
        if context.evidence == "TARGET_OBSERVED" else None
    if spoken:
        ack = f"맞아, {spoken}!"
    elif last and ack == last[0] and ack != GENERIC[0]:
        ack = GENERIC[0]  # 같은 주제 반응("놀이터에서 놀았구나!")을 연달아 하지 않는다.
    if not help_now:
        asked = {sentence for text in dudu[-RECENT_QUESTIONS:] for sentence in _sentences(text)}
        candidates = list(dict.fromkeys([*([topic_question] if topic_question else []),
                                         *S_FOLLOW_UPS.get(topic_question, ()), *S_ANYWHERE]))
        # 최근에 한 질문과, 아이가 방금 말한 낱말을 다시 묻는 질문("맞아, 시소! 시소도 탔어?")은 건너뛴다.
        fresh = [question for question in candidates if question not in asked and not (spoken and spoken in question)]
        question = (fresh or [question for question in candidates if question not in last] or candidates)[0]
        words = list(dict.fromkeys([*([spoken] if spoken else []), *(word for word in lexicon if word in question)]))
        return ProviderOutput(text=f"{ack} {question}", strategy=strategy, target_words=words)
    # 돕기: 같은 낱말로 단서를 늘린다. 고르기 → 빈칸 → (치료사가 허용했으면) 먼저 들려주기. 첫 3턴에는 먼저 들려주기만 쓴다.
    ladder = ("model",) if turn < HELP_FROM_TURN else \
        ("choice", "cloze", "model") if strategy == "ALLOWED_CUE" or context.allowed_cue == "auditory_model" else ("choice", "cloze")
    technique = ladder[streak % len(ladder)]
    pool = [word for word in lexicon if word not in HELP_SKIP] or lexicon
    # 낱말: 지금 주제 → 이어서 돕는 중이면 바로 앞에서 도운 낱말(한 바퀴를 돌면 바꿈) → 바로 앞 질문과 이어지는 낱말 → 차례대로
    carried = _helped_word(dudu[-1], pool) if streak % len(ladder) else None
    hint = S_HINTS.get(topic_question) or carried or (S_HINTS.get(last[-1]) if last else None)
    word = hint if hint in pool else pool[(turn - 1) % len(pool)]
    if technique == "model":
        question, targets = f"두두는 {word}{'을' if _has_final(word) else '를'} 좋아해. 너도 말해 볼래?", [word]
    elif technique == "cloze" and word in S_CLOZE:
        question, targets = S_CLOZE[word], [word]
    else:
        question, targets = _choice(lexicon, word)
    return ProviderOutput(text=f"{ack} {question}", strategy=strategy,
                          target_words=list(dict.fromkeys([*([spoken] if spoken else []), *targets])))


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
            if context.evidence == "NO_SPEECH":
                if lexicon:
                    question, targets = _choice(lexicon, lexicon[0])
                    return ProviderOutput(text=f"두두랑 그림을 보고 골라 보자. {question}", strategy=strategy, target_words=targets)
                return ProviderOutput(text="두두랑 그림을 보고 골라 보자. 좋아하는 놀이 하나를 골라 볼래?", strategy=strategy)
            if len(lexicon) >= 2:
                first, second = lexicon[(context.turn_index - 1) % len(lexicon)], lexicon[context.turn_index % len(lexicon)]
                return ProviderOutput(text=f"두두가 잘 못 들었나 봐. {first}{'이' if _has_final(first) else '가'} 좋아, {second}{'이' if _has_final(second) else '가'} 좋아?",
                                      strategy=strategy, target_words=[first, second])
            return ProviderOutput(text="두두가 잘 못 들었나 봐. 좋아하는 놀이 하나만 알려 줄래?", strategy=strategy)
        # 불확실할 때는 인식 문장을 믿지 않으므로 주제 반응을 일반 문장으로 한다.
        ack, questions = _topic(context.child_transcript if context.evidence != "UNCERTAIN" else None)
        question = questions.get(phoneme, GENERIC[1].get(phoneme, "그다음엔 뭐 했어?"))
        if phoneme == "ㅅ" and context.level in {"syllable", "word"} and lexicon:
            return _elicited_s_reply(context, ack, None if questions is GENERIC[1] else question)
        if strategy == "ALLOWED_CUE" and word:
            # 치료사가 허용한 청각 모델: 먼저 들려준 뒤 부담 없이 말할 기회를 권한다.
            return ProviderOutput(text=f"{ack} 두두는 {word}{'을' if _has_final(word) else '를'} 좋아해. 너도 말해 볼래?",
                                  strategy=strategy, target_words=[word])
        if strategy == "CONTINUE_OR_EXPAND":
            return ProviderOutput(text=f"{ack} 더 이야기해 줄래?" if context.turn_index % 2 == 0 else f"{ack} {question}",
                                  strategy=strategy)
        return ProviderOutput(text=f"{ack} {question}", strategy=strategy)

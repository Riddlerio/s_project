from itertools import count


BANK = {
    "ㅅ": {"syllable": ["사", "소", "수", "시", "서"], "word": ["사과", "사자", "소리", "수박", "시소", "사탕", "소풍", "수건"], "medial": ["가수", "우산", "이사", "가시"], "short_sentence": ["사과를 먹어요", "사자가 있어요", "소리가 나요", "수박이 커요"]},
    "ㅈ": {"syllable": ["자", "조", "주", "지"], "word": ["자동차", "주스", "조개", "지도"], "medial": ["모자", "의자", "과자"], "short_sentence": ["주스를 마셔요", "자동차가 가요"]},
    "ㄹ": {"syllable": ["라", "로", "루", "리"], "word": ["라면", "로봇", "리본", "루비"], "medial": ["다리", "오리", "우리"], "short_sentence": ["로봇이 걸어요", "오리가 헤엄쳐요"]},
}


def items(phoneme: str, level: str, position: str = "initial") -> list[dict]:
    key = "medial" if position == "medial" and level == "word" else level
    return [{"itemId": f"{phoneme}-{level}-{i}", "displayText": text, "level": level, "game": "monster_tower", "pictureKey": text.split(" ")[0]} for i, text in enumerate(BANK.get(phoneme, {}).get(key, []))]


def conversation_candidates(phoneme: str, position: str = "initial", excluded_words=(), priority_targets=(), limit: int = 6) -> list[str]:
    """호야 대화에서 자연스럽게 쓸 수 있는 목표 단어. BANK만 쓰며 제외 단어와 다른 음소 목록은 넣지 않는다."""
    bank = BANK.get(phoneme, {})
    words = bank.get("medial" if position == "medial" else "word", [])
    excluded = set(excluded_words or ())
    known = {word for key in ("word", "medial") for word in bank.get(key, [])}
    # 치료사가 우선 지정한 단어도 같은 음소의 BANK 단어일 때만 앞에 둔다.
    preferred = [word for word in (priority_targets or ()) if word in known]
    ordered = list(dict.fromkeys([*preferred, *words]))
    return [word for word in ordered if word not in excluded][:limit]

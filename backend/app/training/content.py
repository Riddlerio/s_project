from itertools import count


BANK = {
    "ㅅ": {"syllable": ["사", "소", "수", "시", "서"], "word": ["사과", "사자", "소리", "수박", "시소", "사탕", "소풍", "수건"], "medial": ["가수", "우산", "이사", "가시"], "short_sentence": ["사과를 먹어요", "사자가 있어요", "소리가 나요", "수박이 커요"]},
    "ㅈ": {"syllable": ["자", "조", "주", "지"], "word": ["자동차", "주스", "조개", "지도"], "medial": ["모자", "의자", "과자"], "short_sentence": ["주스를 마셔요", "자동차가 가요"]},
    "ㄹ": {"syllable": ["라", "로", "루", "리"], "word": ["라면", "로봇", "리본", "루비"], "medial": ["다리", "오리", "우리"], "short_sentence": ["로봇이 걸어요", "오리가 헤엄쳐요"]},
}


def items(phoneme: str, level: str, position: str = "initial") -> list[dict]:
    key = "medial" if position == "medial" and level == "word" else level
    return [{"itemId": f"{phoneme}-{level}-{i}", "displayText": text, "level": level, "game": "monster_tower", "pictureKey": text.split(" ")[0]} for i, text in enumerate(BANK.get(phoneme, {}).get(key, []))]


def beam_item(phoneme: str, target_ms: int = 1500) -> dict:
    return {"itemId": f"beam-{phoneme}", "displayText": "르~" if phoneme == "ㄹ" else "스~", "level": "phoneme", "game": "magic_beam", "pictureKey": "beam", "beamTargetMs": target_ms}


def model_text(display_text: str) -> str:
    return f"{display_text[:1]}~{display_text[1:]}" if display_text else ""

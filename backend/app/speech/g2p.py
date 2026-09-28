from dataclasses import dataclass


INITIAL = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
MEDIAL = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
FINAL = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"]
NEUTRAL = {"ㄲ": "ㄱ", "ㅋ": "ㄱ", "ㄳ": "ㄱ", "ㄺ": "ㄱ", "ㅅ": "ㄷ", "ㅆ": "ㄷ", "ㅈ": "ㄷ", "ㅊ": "ㄷ", "ㅌ": "ㄷ", "ㅎ": "ㄷ", "ㅍ": "ㅂ", "ㅄ": "ㅂ", "ㄵ": "ㄴ", "ㄶ": "ㄴ", "ㄻ": "ㅁ", "ㄼ": "ㄹ", "ㄽ": "ㄹ", "ㄾ": "ㄹ", "ㄿ": "ㅂ", "ㅀ": "ㄹ"}
TENSE = {"ㄱ": "ㄲ", "ㄷ": "ㄸ", "ㅂ": "ㅃ", "ㅅ": "ㅆ", "ㅈ": "ㅉ"}
CLUSTERS = {"ㄳ": ("ㄱ", "ㅅ"), "ㄵ": ("ㄴ", "ㅈ"), "ㄺ": ("ㄹ", "ㄱ"), "ㄻ": ("ㄹ", "ㅁ"), "ㄼ": ("ㄹ", "ㅂ"), "ㄽ": ("ㄹ", "ㅅ"), "ㄾ": ("ㄹ", "ㅌ"), "ㄿ": ("ㄹ", "ㅍ"), "ㅄ": ("ㅂ", "ㅅ")}


@dataclass(frozen=True)
class Phone:
    slot: str
    symbol: str
    syllable_index: int


class SimpleKoreanG2P:
    def to_phonemes(self, text: str) -> list[Phone]:
        syllables = []
        for char in text:
            code = ord(char) - 0xAC00
            if 0 <= code < 11172:
                syllables.append([INITIAL[code // 588], MEDIAL[(code % 588) // 28], FINAL[code % 28]])
        for i in range(len(syllables) - 1):
            current, following = syllables[i], syllables[i + 1]
            if current[2] and current[2] != "ㅇ" and following[0] == "ㅇ":
                if current[2] in CLUSTERS:
                    current[2], following[0] = CLUSTERS[current[2]]
                else:
                    following[0] = current[2] if current[2] != "ㅎ" else "ㅇ"
                    current[2] = ""
        for syllable in syllables:
            syllable[2] = NEUTRAL.get(syllable[2], syllable[2])
        for i in range(len(syllables) - 1):
            if syllables[i][2] in ("ㄱ", "ㄷ", "ㅂ"):
                syllables[i + 1][0] = TENSE.get(syllables[i + 1][0], syllables[i + 1][0])
        result = []
        for i, (initial, medial, final) in enumerate(syllables):
            result.extend([Phone("I", initial if initial != "ㅇ" else "ㅇ0", i), Phone("M", medial, i)])
            if final:
                result.append(Phone("F", final, i))
        return result

from enum import StrEnum


class TrainingLevel(StrEnum):
    phoneme = "phoneme"
    syllable = "syllable"
    word = "word"
    short_sentence = "short_sentence"
    sentence = "sentence"
    spontaneous = "spontaneous"


LEVEL_ORDER = list(TrainingLevel)

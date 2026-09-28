from enum import StrEnum


class TrainingLevel(StrEnum):
    phoneme = "phoneme"
    syllable = "syllable"
    word = "word"
    short_sentence = "short_sentence"
    sentence = "sentence"
    spontaneous = "spontaneous"


LEVEL_ORDER = list(TrainingLevel)


class GameType(StrEnum):
    monster_tower = "monster_tower"
    magic_beam = "magic_beam"


class SessionMode(StrEnum):
    real = "real"
    demo = "demo"

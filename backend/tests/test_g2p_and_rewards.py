from app.speech.g2p import SimpleKoreanG2P
from app.training.rewards import award


def test_ng_final_does_not_link():
    phones = SimpleKoreanG2P().to_phonemes("강아지")
    assert [(p.slot, p.symbol) for p in phones] == [("I", "ㄱ"), ("M", "ㅏ"), ("F", "ㅇ"), ("I", "ㅇ0"), ("M", "ㅏ"), ("I", "ㅈ"), ("M", "ㅣ")]


def test_cluster_final_splits_before_vowel():
    phones = SimpleKoreanG2P().to_phonemes("넋이")
    assert [(p.slot, p.symbol) for p in phones] == [("I", "ㄴ"), ("M", "ㅓ"), ("F", "ㄱ"), ("I", "ㅆ"), ("M", "ㅣ")]


def test_rewards_are_not_duplicated():
    first, badges, cards = award({}, {"monsterStagesCleared": 1, "beamSuccesses": 3, "retryThenSuccessCount": 5})
    assert set(badges) == {"첫 모험", "마법 빔 마스터", "끈기 용사"}
    assert len(cards) == 1
    second, badges, cards = award(first, {"monsterStagesCleared": 1, "beamSuccesses": 0, "retryThenSuccessCount": 0})
    assert not badges
    assert len(cards) == 1
    assert len(set(second["monsterCards"])) == 2

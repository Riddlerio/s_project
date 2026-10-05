from types import SimpleNamespace

from app.speech.pipeline import analyze


def goal():
    return SimpleNamespace(target_phoneme="ㅅ", word_position="initial", priority="accuracy", pass_threshold=None,
                           level="word", min_level="syllable", preferred_cue="visual_mouth", repetition_target=30,
                           session_duration_min=10)


ITEM = {"itemId": "beam-1", "game": "magic_beam", "displayText": "스", "level": "word", "beamTargetMs": 1500}


def acoustic(**changes):
    values = {"source": "microphone", "snrDb": 18, "noiseFloorDb": -60, "meanRmsDb": -42, "durationMs": 1700, "activeMs": 1600,
              "bestRunMs": 1400, "fricationMs": 1450, "clippingRatio": 0}
    values.update(changes)
    return values


def test_fricative_sustain_success():
    assert analyze(ITEM, None, acoustic(), goal()).result == "success"


def test_voiced_sound_is_not_fricative_success():
    result = analyze(ITEM, None, acoustic(bestRunMs=0, fricationMs=0), goal())
    assert result.result == "retry"
    assert "VOICED_NOT_FRICATIVE" in result.pattern_tags


def test_poor_audio_does_not_count_as_failure():
    result = analyze(ITEM, None, acoustic(snrDb=50, meanRmsDb=-56), goal())
    assert result.result == "uncertain"


def test_malformed_acoustic_number_is_not_accepted():
    result = analyze(ITEM, None, acoustic(snrDb="very loud", bestRunMs="long"), goal())
    assert result.result == "uncertain"

import json
from pathlib import Path

from app.pronunciation.audio_quality import assess_audio_quality
from app.training.retry_state import next_retry_state


CASES = json.loads((Path(__file__).resolve().parents[2] / "shared" / "audio_quality_cases.json").read_text(encoding="utf-8"))


def test_shared_audio_quality_boundaries():
    for case in CASES:
        result = assess_audio_quality(case["noiseFloorDb"], case["meanRmsDb"],
                                      case["durationMs"], case["clippingRatio"])
        assert result["level"] == case["level"], case


def test_retry_count_stays_with_item_until_advance():
    first = next_retry_state(None, "a", "uncertain", False)
    assert next_retry_state(first, "a", "retry", False)["listenAgainCount"] == 1
    assert next_retry_state(first, "a", "uncertain", False)["listenAgainCount"] == 2
    assert next_retry_state(first, "b", "uncertain", False)["listenAgainCount"] == 1
    assert next_retry_state(first, "a", "uncertain", True)["listenAgainCount"] == 0

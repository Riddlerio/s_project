import json
from pathlib import Path

from app.pronunciation.audio_quality import assess_audio_quality


CASES = json.loads((Path(__file__).resolve().parents[2] / "shared" / "audio_quality_cases.json").read_text(encoding="utf-8"))


def test_shared_audio_quality_boundaries():
    for case in CASES:
        result = assess_audio_quality(case["noiseFloorDb"], case["meanRmsDb"],
                                      case["durationMs"], case["clippingRatio"])
        assert result["level"] == case["level"], case

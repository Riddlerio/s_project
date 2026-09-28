from ..pronunciation.audio_quality import assess_audio_quality
from ..speech.pipeline import AnalysisResult, acoustic_number, analyze
from ..speech.g2p import SimpleKoreanG2P
from ..speech.normalization import normalize


def _result(result: str, tags=()) -> AnalysisResult:
    return AnalysisResult(0, result, "unknown" if result in {"uncertain", "no_speech", "target_observed", "not_target_attempt"} else "correct" if result == "success" else "omitted",
                          None, list(tags), [], [], [])


def evaluate_round(round_def, item: dict, transcript: str | None, acoustic: dict, goal, rules=()) -> AnalysisResult:
    if round_def.rule in {"TARGET_WORD", "CONVERSATION"} and (not transcript or not transcript.strip()):
        return _result("no_speech")
    if acoustic.get("source") == "microphone":
        if acoustic_number(acoustic, "activeMs", acoustic_number(acoustic, "voicedMs")) <= 0:
            return _result("no_speech", ["NO_SPEECH"])
        quality = assess_audio_quality(acoustic.get("noiseFloorDb"), acoustic.get("meanRmsDb"),
                                       acoustic.get("durationMs"), acoustic.get("clippingRatio"), acoustic.get("snrDb"))
        if quality["level"] in {"POOR", "UNKNOWN"}:
            return _result("uncertain", ["POOR_AUDIO" if quality["level"] == "POOR" else "NO_ACOUSTIC_EVIDENCE"])
    if round_def.rule == "TARGET_WORD":
        return analyze(item, transcript, acoustic, goal, rules)
    if round_def.rule == "CONVERSATION":
        if not any(phone.symbol == goal.target_phoneme for phone in SimpleKoreanG2P().to_phonemes(normalize(transcript))):
            return _result("not_target_attempt", ["TARGET_NOT_DETECTED"])
        return _result("target_observed", ["BASELINE_TARGET_DETECTED"])
    active = acoustic_number(acoustic, "activeMs", acoustic_number(acoustic, "voicedMs"))
    if active <= 0:
        return _result("no_speech", ["NO_SPEECH"])
    run = acoustic_number(acoustic, "bestRunMs")
    frication = acoustic_number(acoustic, "fricationMs")
    segments = acoustic.get("sustainSegmentsMs") or []
    target = round_def.target_ms
    rule = round_def.rule
    if rule in {"FRICATION", "CONTINUITY"}:
        passed = run >= 0.8 * target and frication >= 0.6 * active
        if rule == "CONTINUITY":
            passed = passed and acoustic_number(acoustic, "interruptionCount", 0) <= 1
    elif rule == "PULSES":
        passed = sum(segment >= target for segment in segments) >= 3
    elif rule == "TRANSITION":
        passed = acoustic_number(acoustic, "onsetFricationMs") >= target and acoustic_number(acoustic, "voicedAfterFricationMs") >= 200
    elif rule == "ENERGY_BAND":
        passed = 0.35 <= acoustic_number(acoustic, "energyMean01", -1) <= 0.75 and run >= target
    elif rule == "RE_ONSET":
        # "쉬었다가 다시": 목표 길이의 발성 구간 두 개 이상과 그 사이의 실제 쉼이 필요하다.
        passed = sum(segment >= target for segment in segments) >= 2 and 300 <= acoustic_number(acoustic, "pauseTotalMs") <= 4000
    else:
        passed = run >= 0.8 * target
    tags = []
    if not passed and rule in {"FRICATION", "CONTINUITY"} and active >= 0.8 * target and frication < 0.6 * active:
        tags.append("VOICED_NOT_FRICATIVE")
    if acoustic.get("source") == "keyboard":
        tags.append("DEMO_INPUT")
    return _result("success" if passed else "retry", tags)

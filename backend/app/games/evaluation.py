from ..pronunciation.audio_quality import assess_audio_quality
from .rounds import RE_ONSET_PAUSE_MS
from ..speech.pipeline import AnalysisResult, acoustic_number, analyze
from ..speech.g2p import SimpleKoreanG2P
from ..speech.normalization import normalize


# 대구대 건너기 음향 근사 기준(2026-10-05 성인 1명 PC 마이크 실측 2회, 정답 확인 포함).
# 근거: docs/handoff/MIC_MEASUREMENT_2026-10-05.md. 임상적으로 검증된 발음 정확도 기준이 아니다.
# - 바른 '사' 시작 마찰 79~99ms, '차·자' 39~59ms → 70ms(20ms 프레임 4개). 60ms는 둘이 겹친다.
# - 잡음보다 15dB 미만으로 작은 소리는 판단하지 않는다(틀림이 아니라 불확실). 화면 crossingFlow.ONSET_RULE과 같은 값.
ONSET_FRICATION_MS = 70
VOICED_AFTER_FRICATION_MS = 80
ONSET_MIN_SNR_DB = 15


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
    elif rule == "ONSET_FRICATION":
        # 필드가 누락된 입력은 실패로 세지 않는다. 0은 측정된 부재이므로 retry다.
        if acoustic.get("onsetFricationMs") is None or acoustic.get("voicedAfterFricationMs") is None:
            return _result("uncertain", ["NO_ACOUSTIC_EVIDENCE"])
        noise, level = acoustic.get("noiseFloorDb"), acoustic.get("meanRmsDb")
        if acoustic.get("source") == "microphone" and noise is not None and level is not None and level - noise < ONSET_MIN_SNR_DB:
            return _result("uncertain", ["POOR_AUDIO"])
        passed = (acoustic_number(acoustic, "onsetFricationMs") >= ONSET_FRICATION_MS
                  and acoustic_number(acoustic, "voicedAfterFricationMs") >= VOICED_AFTER_FRICATION_MS)
    elif rule == "ENERGY_BAND":
        passed = 0.35 <= acoustic_number(acoustic, "energyMean01", -1) <= 0.75 and run >= target
    elif rule == "RE_ONSET":
        # "쉬었다가 다시": 목표 길이의 발성 구간 두 개 이상과, 한 발화 안에서 인정되는 길이의 쉼이 필요하다.
        # 가장 긴 쉼 기준이며, 이전 클라이언트가 maxPauseMs를 보내지 않으면 전체 쉼 길이로 판단한다.
        low, high = RE_ONSET_PAUSE_MS
        pause = acoustic_number(acoustic, "maxPauseMs", acoustic_number(acoustic, "pauseTotalMs"))
        passed = sum(segment >= target for segment in segments) >= 2 and low <= pause <= high
    else:
        passed = run >= 0.8 * target
    tags = []
    if not passed and rule in {"FRICATION", "CONTINUITY"} and active >= 0.8 * target and frication < 0.6 * active:
        tags.append("VOICED_NOT_FRICATIVE")
    if acoustic.get("source") == "keyboard":
        tags.append("DEMO_INPUT")
    return _result("success" if passed else "retry", tags)

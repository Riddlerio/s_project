"""저장된 대구대 관찰을 설명한다. 자동 결과·치료사 결정·임상 통계는 바꾸지 않는다."""
from math import isfinite

from pydantic import ValidationError

from ..game_settings.schemas import DaeguCrossingRhythm
from ..games.evaluation import ONSET_FRICATION_MS, ONSET_MIN_SNR_DB, VOICED_AFTER_FRICATION_MS
from ..pronunciation.audio_quality import assess_audio_quality


def _number(acoustic, key):
    value = acoustic.get(key)
    return value if type(value) in (int, float) and isfinite(value) else None


def automatic_evidence(row, source):
    """판정 상수는 평가 모듈에서 가져오며 저장된 ai_result를 다시 판정하지 않는다."""
    stored = (row.evidence or {}).get("acoustic")
    acoustic = stored if isinstance(stored, dict) else {}
    messages = []
    if source != "REAL" or acoustic.get("source") == "keyboard":
        messages.append("DEMO·샘플 자료: 실제 임상 비교에 사용하지 않습니다.")
    if row.ai_result == "no_speech":
        return messages + ["말소리가 감지되지 않아 판단 보류(무발화는 실패가 아닙니다)."]

    onset = _number(acoustic, "onsetFricationMs")
    voiced = _number(acoustic, "voicedAfterFricationMs")
    if row.ai_result == "uncertain":
        reasons = []
        if acoustic.get("source") == "microphone":
            quality = assess_audio_quality(acoustic.get("noiseFloorDb"), acoustic.get("meanRmsDb"),
                                           acoustic.get("durationMs"), acoustic.get("clippingRatio"), acoustic.get("snrDb"))
            noise, level = _number(acoustic, "noiseFloorDb"), _number(acoustic, "meanRmsDb")
            if noise is not None and level is not None and level - noise < ONSET_MIN_SNR_DB:
                reasons.append(f"작게 말해 판단 보류(잡음보다 {level - noise:g}dB 큼, 현재 기준 {ONSET_MIN_SNR_DB:g}dB).")
            translations = {
                "INVALID_ACOUSTIC": "음향 측정값이 유효하지 않아 판단 보류.",
                "CLIPPING": "소리가 찌그러져 판단 보류.",
                "TOO_SHORT": "녹음 구간이 너무 짧아 판단 보류.",
                "TOO_LONG": "녹음 구간이 너무 길어 판단 보류.",
                "NO_NOISE_FLOOR": "주변 잡음 측정값이 없어 판단 보류.",
                "LOW_SNR": "잡음과 말소리를 구분하기 어려워 판단 보류.",
            }
            reasons.extend(translations[reason] for reason in quality["reasons"]
                           if reason in translations and not (reason == "LOW_SNR" and reasons))
        if onset is None or voiced is None:
            reasons.append("시작 바람 소리 또는 뒤 모음 측정값이 없어 판단 보류.")
        if not reasons:
            reasons.append("음질 또는 측정 근거가 충분하지 않아 판단 보류. 치료사의 확인이 필요합니다.")
        return messages + reasons + ["불확실은 실패가 아닙니다."]

    if onset is None or onset < 0:
        messages.append("시작 바람 소리 측정값이 없어 자동 추정 근거를 확인할 수 없습니다.")
    elif onset == 0:
        messages.append("시작 바람 소리 없음.")
    elif onset < ONSET_FRICATION_MS:
        messages.append(f"바람 소리 짧음({onset:g}ms, 현재 기준 {ONSET_FRICATION_MS:g}ms).")
    else:
        messages.append(f"시작 바람 소리 확인({onset:g}ms, 현재 기준 {ONSET_FRICATION_MS:g}ms).")
    if voiced is None or voiced < 0:
        messages.append("뒤 모음 측정값이 없어 자동 추정 근거를 확인할 수 없습니다.")
    elif voiced == 0:
        messages.append("끝까지 모음 없음.")
    elif voiced < VOICED_AFTER_FRICATION_MS:
        messages.append(f"뒤 모음 짧음({voiced:g}ms, 현재 기준 {VOICED_AFTER_FRICATION_MS:g}ms).")
    else:
        messages.append(f"뒤 모음 확인({voiced:g}ms, 현재 기준 {VOICED_AFTER_FRICATION_MS:g}ms).")
    return messages


def crossing_summary(rows, session):
    """검토 진행은 DEMO도 세되 임상 성공률과 섞지 않는다. 박자는 해당 회기 저장값만 읽는다."""
    observations = [row for row in rows if row["activity"] == "daegu_crossing"]
    stored = (session.runtime_state or {}).get("rhythm")
    try:
        rhythm = DaeguCrossingRhythm.model_validate(stored).model_dump()
    except ValidationError:
        rhythm = None
    return {
        "attemptN": len(observations),
        "autoSuccessN": sum(row["aiResult"] == "success" for row in observations),
        "deferredN": sum(row["aiResult"] in {"uncertain", "no_speech"} for row in observations),
        "confirmedN": sum(row["verification"] in {"CONFIRMED", "CORRECTED", "DEMO_CONFIRMED", "DEMO_CORRECTED"}
                          for row in observations),
        "reviewTotalN": len(observations),
        "rhythm": rhythm,
    }

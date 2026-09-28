from dataclasses import dataclass
from dataclasses import asdict

from .normalization import normalize
from .g2p import SimpleKoreanG2P
from .alignment import align


@dataclass
class AnalysisResult:
    score: int
    result: str
    target_status: str
    substitute_symbol: str | None
    pattern_tags: list[str]
    target_phones: list[dict]
    observed_phones: list[dict]
    alignment: list[dict]
    rule_applied_id: str | None = None


def analyze(item: dict, transcript: str | None, acoustic: dict, goal, rules=()) -> AnalysisResult:
    if item.get("game") == "magic_beam":
        voiced = acoustic.get("voicedMs", 0)
        target = item.get("beamTargetMs", 1500)
        passed = voiced >= 0.8 * target
        return AnalysisResult(min(100, round(voiced / target * 100)), "success" if passed else "retry", "correct" if passed else "omitted", None, [], [], [], [])
    observed = normalize(transcript)
    if not observed:
        return AnalysisResult(0, "no_speech", "omitted", None, [], [], [], [])
    g2p = SimpleKoreanG2P()
    target_phones = g2p.to_phonemes(normalize(item["displayText"]) or "")
    observed_phones = g2p.to_phonemes(observed)
    ops = align(target_phones, observed_phones)
    symbol = goal.target_phoneme
    eligible = [i for i, p in enumerate(target_phones) if p.symbol == symbol and p.slot == ("F" if goal.word_position == "final" else "I") and (goal.word_position != "initial" or p.syllable_index == 0) and (goal.word_position != "medial" or p.syllable_index > 0)]
    if not eligible:
        eligible = [i for i, p in enumerate(target_phones) if p.symbol == symbol]
    target_ops = [op for op in ops if op.target_index in eligible]
    target_status = "correct" if target_ops and all(op.kind == "match" for op in target_ops) else "omitted" if any(op.kind == "del" for op in target_ops) else "substituted"
    substitution = next((observed_phones[op.observed_index].symbol for op in target_ops if op.kind == "sub" and op.observed_index is not None), None)
    total = sum(3 if i in eligible else 1 for i in range(len(target_phones))) or 1
    loss = sum(op.cost * (3 if op.target_index in eligible else 1) for op in ops)
    score = max(0, round(100 * (1 - loss / total)))
    tags = []
    if target_status == "omitted":
        tags.append("OMISSION")
    elif substitution:
        if symbol in "ㅅㅆㅈ" and substitution in "ㄷㄸㅌ":
            tags.append("STOPPING")
        elif symbol in "ㅅㅆ" and substitution in "ㅈㅉㅊ":
            tags.append("AFFRICATION")
        elif (symbol, substitution) in [("ㅅ", "ㅆ"), ("ㅈ", "ㅉ")]:
            tags.append("TENSING")
        else:
            tags.append("OTHER_SUBSTITUTION")
    threshold = goal.pass_threshold or {"accuracy": 85, "balanced": 75, "speed": 70}[goal.priority]
    passed = target_status == "correct" and score >= threshold
    rule_id = None
    for rule in rules:
        params = rule.params
        if rule.rule_type == "ACCEPT_WORD_VARIANT" and params.get("item_text") == item["displayText"] and normalize(params.get("variant")) == observed:
            passed, rule_id = True, rule.id
        if rule.rule_type == "ACCEPT_SUBSTITUTION" and params.get("phoneme") == symbol and params.get("substitute") == substitution:
            passed, rule_id = True, rule.id
    return AnalysisResult(score, "success" if passed else "retry", target_status, substitution, tags, [asdict(p) for p in target_phones], [asdict(p) for p in observed_phones], [asdict(op) for op in ops], rule_id)

from dataclasses import dataclass, field

from .content import items, model_text
from ..enums import LEVEL_ORDER, TrainingLevel


@dataclass
class PolicyOutput:
    events: list[dict] = field(default_factory=list)
    decisions: list[dict] = field(default_factory=list)
    next_item: dict | None = None
    next_level: str = "word"
    queue: list[dict] = field(default_factory=list)
    resume_item: dict | None = None
    success_streak: int = 0
    target_retry_streak: int = 0
    session_complete: bool = False
    advanced: bool = False
    next_slot: int = 0
    beam_target_ms: int = 1500
    pending_big_attack: bool = False


def decide(goal, item: dict, analysis, state: dict, elapsed_sec: int, total_attempts: int, rules=(), previous_summary=None) -> PolicyOutput:
    level = state.get("currentLevel", goal.level)
    attempt = state.get("itemAttempt", 1)
    out = PolicyOutput(next_item=item, next_level=level, queue=list(state.get("queue", [])),
                       resume_item=state.get("resumeItem"), success_streak=state.get("successStreak", 0),
                       target_retry_streak=state.get("targetRetryStreak", 0), next_slot=state.get("nextSlot", 0),
                       beam_target_ms=state.get("beamTargetMs", 1500), pending_big_attack=state.get("pendingBigAttack", False))

    def event(kind, **payload):
        out.events.append({"type": kind, "payload": payload})

    def decision(kind, codes, to_level=None):
        out.decisions.append({"type": kind, "reasonCodes": codes, "fromLevel": level, "toLevel": to_level})

    def advance():
        out.next_item = out.queue.pop(0) if out.queue else None
        out.advanced = True
        if out.next_item and out.next_item.get("game") == "magic_beam":
            out.next_item = {**out.next_item, "beamTargetMs": out.beam_target_ms}

    if analysis.result == "no_speech":
        event("NO_SPEECH")
        return out

    if analysis.result == "uncertain":
        if state.get("listenAgainCount", 0) >= 2:
            event("ITEM_ADVANCE", reason="UNCERTAIN_SKIP")
            event("REWARD", xp=2, reason="ATTEMPT")
            decision("ITEM_ADVANCE", ["UNCERTAIN_SKIP"])
            advance()
        else:
            event("LISTEN_AGAIN")
            decision("LISTEN_AGAIN", ["LOW_CONFIDENCE"])
        return out

    if item.get("game") == "magic_beam":
        target = item.get("beamTargetMs", out.beam_target_ms)
        if analysis.result == "success":
            event("TARGET_SUCCESS", power=2)
            event("REWARD", xp=10)
            out.beam_target_ms = min(4000, target + 500)
            decision("BEAM_ADJUST", ["BEAM_SUCCESS_EXTEND"])
            advance()
        else:
            event("TARGET_RETRY", attempt=attempt, cue="none")
            if state.get("bestRunMs", 0) < target * 0.5:
                out.beam_target_ms = max(800, target - 300)
                out.next_item = {**item, "beamTargetMs": out.beam_target_ms}
                decision("BEAM_ADJUST", ["BEAM_SHORT_REDUCE"])
            if attempt >= 3:
                event("ITEM_SKIPPED")
                advance()
        return out

    cue_rule = next((r for r in rules if r.rule_type == "CUE_OVERRIDE" and r.active), None)
    cue = cue_rule.params.get("cue", goal.preferred_cue or "visual_mouth") if cue_rule else (goal.preferred_cue or "visual_mouth")
    cue_reason = ["THERAPIST_CUE_OVERRIDE"] if cue_rule else []

    if analysis.result == "success":
        out.success_streak += 1
        out.target_retry_streak = 0
        power = 3 if out.pending_big_attack else 2 if attempt == 1 else 1
        out.pending_big_attack = False
        event("TARGET_SUCCESS", power=power)
        event("REWARD", xp=10 + (5 if attempt == 1 else 0))
        if level != goal.level and out.success_streak >= (2 if goal.priority == "speed" else 3):
            out.next_level = goal.level
            out.next_item = out.resume_item or (out.queue.pop(0) if out.queue else None)
            out.resume_item = None
            out.success_streak = 0
            out.pending_big_attack = True
            out.advanced = out.next_item is not None
            event("LEVEL_UP", toLevel=goal.level)
            decision("LEVEL_UP", ["SUCCESS_STREAK_AT_REINFORCEMENT_LEVEL"], goal.level)
        else:
            advance()
    else:
        out.success_streak = 0
        out.target_retry_streak += analysis.target_status != "correct"
        event("TARGET_RETRY", attempt=attempt, cue=cue)
        event("REWARD", xp=2, effort=True)
        if out.target_retry_streak >= (4 if goal.priority == "speed" else 3) and LEVEL_ORDER.index(TrainingLevel(level)) > LEVEL_ORDER.index(TrainingLevel(goal.min_level)):
            out.next_level = LEVEL_ORDER[LEVEL_ORDER.index(TrainingLevel(level)) - 1].value
            out.resume_item = item
            inserted = items(goal.target_phoneme, out.next_level, goal.word_position)[:3]
            for candidate in inserted:
                candidate["itemId"] += f"#{out.next_slot}"
                out.next_slot += 1
            out.queue = inserted + out.queue
            advance()
            out.target_retry_streak = 0
            event("LEVEL_DOWN", toLevel=out.next_level)
            reasons = ["CONSECUTIVE_TARGET_RETRY", f"priority:{goal.priority}"]
            if previous_summary and previous_summary.get("levelDownCount", 0) >= 1:
                reasons.append("PREVIOUS_SESSION_SIMILAR_PATTERN")
            decision("LEVEL_DOWN", reasons + cue_reason, out.next_level)
        elif attempt >= (2 if goal.priority == "speed" else 3):
            advance()
            event("ITEM_SKIPPED")
            decision("ITEM_ADVANCE", ["MAX_ATTEMPTS_REACHED"] + cue_reason)
        elif attempt + 1 >= 3:
            event("HINT_REQUIRED", cue=cue, modelText=model_text(item["displayText"]))
            decision("HINT", ["THIRD_ATTEMPT"] + cue_reason)
        else:
            decision("CUE", ["SECOND_ATTEMPT"] + cue_reason)

    if total_attempts >= goal.repetition_target or (elapsed_sec >= goal.session_duration_min * 60 and out.advanced):
        out.session_complete = True
        event("SESSION_COMPLETE", totalXp=0, badges=[], monsterCards=[])
        decision("SESSION_END", ["REPETITION_TARGET_REACHED" if total_attempts >= goal.repetition_target else "DURATION_REACHED"])
    return out

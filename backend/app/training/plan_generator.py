from .content import items, beam_item


def generate_plan(goal, history=(), rules=()) -> dict:
    excluded = set(goal.excluded_words or []) | {r.params.get("item_text") for r in rules if r.rule_type == "EXCLUDE_ITEM"}
    candidates = [i for i in items(goal.target_phoneme, goal.level, goal.word_position) if i["displayText"] not in excluded]
    priorities = goal.priority_targets or []
    candidates.sort(key=lambda i: (i["displayText"] not in priorities, priorities.index(i["displayText"]) if i["displayText"] in priorities else 0))
    if not candidates:
        candidates = items(goal.target_phoneme, "syllable")
    warmup = bool(history and history[-1].get("levelDownCount", 0) >= 2)
    floor = ([*items(goal.target_phoneme, "syllable")[:3]] if warmup else []) + (candidates * 2)[:5]
    stages = [{"game": "monster_tower", "level": goal.level, "items": floor}]
    if "magic_beam" not in (goal.excluded_games or []):
        stages.append({"game": "magic_beam", "level": "phoneme", "items": [beam_item(goal.target_phoneme) for _ in range(3)]})
    if goal.session_duration_min > 5:
        stages.append({"game": "monster_tower", "level": goal.level, "items": (candidates * 2)[5:10] or candidates[:5]})
    slot = 0
    for stage in stages:
        unique_items = []
        for item in stage["items"]:
            unique_items.append({**item, "itemId": f'{item["itemId"]}#{slot}'})
            slot += 1
        stage["items"] = unique_items
    return {"stages": stages, "nextSlot": slot, "rationale": ["PREVIOUS_SESSION_LEVEL_DOWN"] if warmup else ["GOAL_BASED_PLAN"]}

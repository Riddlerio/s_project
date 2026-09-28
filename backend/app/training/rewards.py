MONSTER_CARDS = ["슬라임 사사", "바람 박쥐 소소", "구름 거북 수수", "번개 여우 시시", "별빛 고래 서서"]


def award(collection: dict, stats: dict) -> tuple[dict, list[str], list[str]]:
    result = dict(collection or {})
    badges = list(result.get("badges", []))
    cards = list(result.get("monsterCards", []))
    new_badges = []
    new_cards = []
    effort = result.get("effortCount", 0) + stats.get("retryThenSuccessCount", 0)
    result["effortCount"] = effort
    for name, earned in (("첫 모험", True), ("마법 빔 마스터", stats.get("beamSuccesses", 0) >= 3), ("끈기 용사", effort >= 5)):
        if earned and name not in badges:
            badges.append(name)
            new_badges.append(name)
    for _ in range(stats.get("monsterStagesCleared", 0)):
        next_card = next((card for card in MONSTER_CARDS if card not in cards), None)
        if next_card:
            cards.append(next_card)
            new_cards.append(next_card)
    result["badges"] = badges
    result["monsterCards"] = cards
    return result, new_badges, new_cards

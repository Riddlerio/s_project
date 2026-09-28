"""항목별 재청취 횟수를 보존한다."""


def next_retry_state(previous: dict | None, item_id: str, outcome: str, advanced: bool) -> dict:
    if advanced:
        return {"itemId": None, "listenAgainCount": 0}
    count = previous.get("listenAgainCount", 0) if previous and previous.get("itemId") == item_id else 0
    if outcome == "uncertain":
        count += 1
    return {"itemId": item_id, "listenAgainCount": count}

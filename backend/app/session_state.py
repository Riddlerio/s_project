"""기존 모험 세션과 V2 5라운드 세션을 구분하고 저장된 상태의 형식을 확인한다."""
from datetime import datetime

from fastapi import HTTPException

from .games.rounds import GAME_ROUNDS


LEGACY_INT_KEYS = ("itemAttempt", "stageIndex", "totalAttempts", "xp")
ACTIVITY_INT_KEYS = ("roundIndex", "roundAttempt", "roundAttemptsUsed", "roundSuccesses", "roundEvaluated",
                     "listenAgainCount", "difficulty", "difficultyIncreases", "lowStreak", "totalAttempts", "xp")


def is_activity(session) -> bool:
    return isinstance(session.runtime_state, dict) and "activityGame" in session.runtime_state


def _valid_item(item) -> bool:
    return isinstance(item, dict) and isinstance(item.get("itemId"), str) and isinstance(item.get("displayText"), str)


def _ints(state: dict, keys) -> bool:
    return all(type(state.get(key)) is int for key in keys)


def legacy_state(session) -> dict:
    """기존 모험 API가 쓸 수 있는 상태만 돌려준다. V2 세션이나 손상된 상태는 409다."""
    if is_activity(session):
        raise HTTPException(409, "5라운드 게임 세션은 이 경로에서 진행할 수 없습니다")
    state = session.runtime_state if isinstance(session.runtime_state, dict) else {}
    if not _valid_item(state.get("currentItem")) or not _ints(state, LEGACY_INT_KEYS):
        raise HTTPException(409, "세션 상태를 확인할 수 없습니다")
    return dict(state)


def activity_state(session) -> dict:
    """V2 5라운드 API가 쓸 수 있는 상태만 돌려준다. 기존 모험 세션이나 손상된 상태는 409다."""
    if not is_activity(session):
        raise HTTPException(409, "5라운드 게임 세션이 아닙니다")
    state = session.runtime_state
    if (state.get("activityGame") not in GAME_ROUNDS or not _ints(state, ACTIVITY_INT_KEYS)
            or not 1 <= state["roundIndex"] <= 5 or not _valid_item(state.get("currentItem"))
            or not isinstance(state.get("roundStartedAt"), str) or not isinstance(state.get("difficultyDecreased"), bool)):
        raise HTTPException(409, "세션 상태를 확인할 수 없습니다")
    try:
        datetime.fromisoformat(state["roundStartedAt"])
    except ValueError:
        raise HTTPException(409, "세션 상태를 확인할 수 없습니다") from None
    return dict(state)

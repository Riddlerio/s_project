"""기존 모험 세션과 V2 5라운드 세션을 구분하고 저장된 상태의 형식을 확인한다.

엔드포인트가 `state["key"]`로 직접 읽는 값은 모두 여기서 형식을 보장한다. 형식이 맞지 않으면 409다.
"""
import functools
import logging
from datetime import datetime
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictFloat, StrictInt, StrictStr, ValidationError, field_validator

from .games.rounds import GAME_ROUNDS


INVALID_STATE = "세션 상태를 확인할 수 없습니다"
Number = StrictInt | StrictFloat


class _State(BaseModel):
    # 알려지지 않은 키는 그대로 둔다. 쓰는 키의 형식만 강제한다.
    model_config = ConfigDict(extra="allow", strict=True)


class LegacyItem(_State):
    itemId: StrictStr
    displayText: StrictStr
    level: StrictStr
    game: StrictStr
    beamTargetMs: Number | None = None


class RetryState(_State):
    itemId: StrictStr | None = None
    listenAgainCount: StrictInt = Field(default=0, ge=0)


class LegacyState(_State):
    currentItem: LegacyItem
    itemAttempt: StrictInt = Field(ge=0)
    stageIndex: StrictInt = Field(ge=0)
    totalAttempts: StrictInt = Field(ge=0)
    xp: StrictInt = Field(ge=0)
    queue: list[LegacyItem] = []
    resumeItem: LegacyItem | None = None
    currentLevel: StrictStr | None = None
    successStreak: StrictInt = 0
    targetRetryStreak: StrictInt = 0
    nextSlot: StrictInt = 0
    beamTargetMs: Number = 1500
    pendingBigAttack: StrictBool = False
    listenAgainCount: StrictInt = 0
    retry: RetryState | None = None


class ActivityItem(LegacyItem):
    game: Literal["magic_beam", "sky_climb", "monster_adventure", "conversation_quest"]


class RoundSnapshot(_State):
    id: StrictStr | None = None
    generalizationLevel: StrictStr | None = None
    clinicalFocus: StrictStr | None = None
    elicitationType: StrictStr | None = None
    independence: StrictStr | None = None


class RoundRewardSnapshot(_State):
    index: StrictInt = Field(ge=1, le=5)
    stars: StrictInt = Field(ge=1, le=3)
    praise: StrictStr
    successRate: Number | None = Field(default=None, ge=0, le=1)


class ActivityState(_State):
    activityGame: Literal["magic_beam", "sky_climb", "monster_adventure", "conversation_quest"]
    roundIndex: StrictInt = Field(ge=1, le=5)
    stageIndex: StrictInt = Field(ge=0, le=4)
    roundAttempt: StrictInt = Field(ge=1)
    roundAttemptsUsed: StrictInt = Field(ge=0)
    roundSuccesses: StrictInt = Field(ge=0)
    roundEvaluated: StrictInt = Field(ge=0)
    listenAgainCount: StrictInt = Field(ge=0)
    difficulty: StrictInt = Field(ge=1, le=5)
    difficultyIncreases: StrictInt = Field(ge=0)
    lowStreak: StrictInt = Field(ge=0)
    difficultyDecreased: StrictBool
    totalAttempts: StrictInt = Field(ge=0)
    xp: StrictInt = Field(ge=0)
    roundStartedAt: StrictStr
    currentCue: StrictStr
    currentItem: ActivityItem
    roundDefinition: RoundSnapshot
    roundsComplete: StrictBool = False
    roundStars: list[RoundRewardSnapshot] = Field(default_factory=list)

    @field_validator("roundStartedAt")
    @classmethod
    def _iso(cls, value: str) -> str:
        datetime.fromisoformat(value)
        return value


class CompletionState(_State):
    """완료 처리에서 읽는 값. 기존 모험·5라운드 세션 모두 해당한다."""
    xp: StrictInt = Field(default=0, ge=0)
    stageIndex: StrictInt = Field(default=0, ge=0)
    activityGame: Literal["magic_beam", "sky_climb", "monster_adventure", "conversation_quest"] | None = None


class CompletedSummary(_State):
    totalXp: StrictInt
    heroLevel: StrictInt
    badges: list[StrictStr]
    monsterCards: list[StrictStr]


def is_activity(session) -> bool:
    return isinstance(session.runtime_state, dict) and "activityGame" in session.runtime_state


def _validated(model, value) -> None:
    if not isinstance(value, dict):
        raise HTTPException(409, INVALID_STATE)
    try:
        model.model_validate(value)
    except (ValidationError, ValueError, TypeError):
        raise HTTPException(409, INVALID_STATE) from None


def legacy_state(session) -> dict:
    """기존 모험 API가 쓸 수 있는 상태만 돌려준다. V2 세션이나 손상된 상태는 409다."""
    if is_activity(session):
        raise HTTPException(409, "5라운드 게임 세션은 이 경로에서 진행할 수 없습니다")
    _validated(LegacyState, session.runtime_state)
    return dict(session.runtime_state)


def activity_state(session) -> dict:
    """V2 5라운드 API가 쓸 수 있는 상태만 돌려준다. 기존 모험 세션이나 손상된 상태는 409다."""
    if not is_activity(session):
        raise HTTPException(409, "5라운드 게임 세션이 아닙니다")
    _validated(ActivityState, session.runtime_state)
    state = dict(session.runtime_state)
    if state["activityGame"] not in GAME_ROUNDS or state["currentItem"]["game"] != state["activityGame"]:
        raise HTTPException(409, INVALID_STATE)
    return state


def completion_state(session) -> dict:
    """완료 API가 쓸 수 있는 상태. 이미 완료된 세션은 저장된 요약의 형식도 확인한다."""
    if session.status == "completed":
        _validated(CompletedSummary, session.summary_json)
    _validated(CompletionState, session.runtime_state)
    return dict(session.runtime_state)


def state_guard(endpoint):
    """검증을 통과한 뒤에도 예상하지 못한 상태·계획 손상이 500이 되지 않게 409로 바꾼다."""
    @functools.wraps(endpoint)
    def wrapper(*args, **kwargs):
        try:
            return endpoint(*args, **kwargs)
        except HTTPException:
            raise
        except (KeyError, TypeError, IndexError, AttributeError, ValueError) as exc:
            db = kwargs.get("db")
            if db is not None:
                db.rollback()
            # 아동 발화가 섞일 수 있어 예외 메시지 대신 종류만 남긴다.
            logging.warning("손상된 세션 상태로 요청을 거부했습니다: %s in %s", type(exc).__name__, endpoint.__name__)
            raise HTTPException(409, INVALID_STATE) from None
    return wrapper

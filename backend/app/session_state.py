"""기존 모험 세션과 V2 5라운드 세션을 구분하고 저장된 상태의 형식을 확인한다.

엔드포인트가 `state["key"]`로 직접 읽는 값은 모두 여기서 형식을 보장한다. 형식이 맞지 않으면 409다.
"""
import functools
import logging
from datetime import datetime
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictFloat, StrictInt, StrictStr, ValidationError, field_validator, model_validator

from .games.rounds import GAME_ROUNDS
from .game_settings.schemas import DaeguCrossingRhythm


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


class ActivityItem(LegacyItem):
    game: Literal["magic_beam", "sky_climb", "monster_adventure", "conversation_quest", "daegu_crossing"]


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
    activityGame: Literal["magic_beam", "sky_climb", "monster_adventure", "conversation_quest", "daegu_crossing"]
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
    # 이번 라운드 동안 매직빔 승인 상태를 유지하는지. 비임상 게임 상태다.
    magicBeamRound: StrictBool = False
    roundStars: list[RoundRewardSnapshot] = Field(default_factory=list)

    @field_validator("roundStartedAt")
    @classmethod
    def _iso(cls, value: str) -> str:
        datetime.fromisoformat(value)
        return value


class CrossingState(ActivityState):
    # 이전 회기는 박자 기록이 없을 수 있다. 현재 아동 설정으로 과거 기록을 채우지 않는다.
    rhythm: DaeguCrossingRhythm | None = None
    itemIndexInRound: StrictInt = Field(ge=1, le=2)
    stripeIndex: StrictInt = Field(ge=1, le=10)
    itemAttemptsUsed: StrictInt = Field(ge=0, le=3)
    modelCue: StrictBool
    # 같은 회기에서 몇 번째 판인지(games/crossing.py MAX_LAPS). 판 기능 전의 회기는 값이 없어 1이다.
    lap: StrictInt = Field(default=1, ge=1, le=3)

    @model_validator(mode="after")
    def consistent_cursor(self):
        if self.stageIndex != self.roundIndex - 1:
            raise ValueError("라운드와 구간이 일치하지 않습니다")
        if self.stripeIndex != (self.roundIndex - 1) * 2 + self.itemIndexInRound:
            raise ValueError("줄 위치가 라운드와 일치하지 않습니다")
        if self.roundsComplete and (self.roundIndex != 5 or self.itemIndexInRound != 2):
            raise ValueError("완료 위치가 올바르지 않습니다")
        return self


class CrossingSummary(_State):
    totalAttempts: StrictInt = Field(ge=0)
    durationSec: StrictInt = Field(ge=0)
    sessionComplete: Literal[True]


class CompletionState(_State):
    """완료 처리에서 읽는 값. 기존 모험·5라운드 세션 모두 해당한다."""
    xp: StrictInt = Field(default=0, ge=0)
    stageIndex: StrictInt = Field(default=0, ge=0)
    activityGame: Literal["magic_beam", "sky_climb", "monster_adventure", "conversation_quest", "daegu_crossing"] | None = None


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


def activity_state(session) -> dict:
    """V2 5라운드 API가 쓸 수 있는 상태만 돌려준다. 기존 모험 세션이나 손상된 상태는 409다."""
    if not is_activity(session):
        raise HTTPException(409, "5라운드 게임 세션이 아닙니다")
    _validated(CrossingState if session.runtime_state.get("activityGame") == "daegu_crossing" else ActivityState, session.runtime_state)
    state = dict(session.runtime_state)
    if state["activityGame"] not in GAME_ROUNDS or state["currentItem"]["game"] != state["activityGame"]:
        raise HTTPException(409, INVALID_STATE)
    return state


def completion_state(session) -> dict:
    """완료 API가 쓸 수 있는 상태. 이미 완료된 세션은 저장된 요약의 형식도 확인한다."""
    if session.status == "completed":
        _validated(CrossingSummary if isinstance(session.runtime_state, dict) and session.runtime_state.get("activityGame") == "daegu_crossing" else CompletedSummary, session.summary_json)
    _validated(CompletionState, session.runtime_state)
    if session.runtime_state.get("activityGame") == "daegu_crossing":
        return activity_state(session)
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

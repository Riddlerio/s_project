from typing import Literal

from pydantic import ConfigDict, Field, field_validator, model_validator

from ..schemas_base import ApiModel

StartLevel = Literal["phoneme", "syllable", "word", "short_sentence"]
TargetLevel = Literal["syllable", "word", "short_sentence"]
GAME_ACTIVITIES = {"magic_beam", "sky_climb", "monster_adventure", "conversation_quest"}
STEP_ACTIVITIES = {"CONVERSATION": {"hoya_conversation"}, "GAME": GAME_ACTIVITIES, "PRACTICE": GAME_ACTIVITIES}
LEVELS = ("phoneme", "syllable", "word", "short_sentence")


class StrictModel(ApiModel):
    model_config = ConfigDict(alias_generator=ApiModel.model_config["alias_generator"], populate_by_name=True, extra="forbid")


class StepParameters(StrictModel):
    trials: int | None = Field(default=None, ge=1, le=60)
    duration_min: int | None = Field(default=None, ge=1, le=15)


class StepInput(StrictModel):
    step_type: Literal["CONVERSATION", "GAME", "PRACTICE"]
    activity: Literal["hoya_conversation", "magic_beam", "sky_climb", "monster_adventure", "conversation_quest"]
    target_level: StartLevel | None = None
    parameters: StepParameters = Field(default_factory=StepParameters)

    @model_validator(mode="after")
    def activity_matches_type(self):
        if self.activity not in STEP_ACTIVITIES[self.step_type]:
            raise ValueError("활동 유형과 활동이 맞지 않습니다")
        return self


def _clean_words(values: list[str]) -> list[str]:
    words = []
    for value in values:
        word = value.strip()
        if not word or len(word) > 20:
            raise ValueError("단어는 1–20자여야 합니다")
        if word not in words:
            words.append(word)
    return words


class SessionPlanInput(StrictModel):
    """치료사가 작성하는 구조화 form. 자유 입력은 therapist_note 하나뿐이다."""
    target_phoneme: Literal["ㅅ", "ㅈ", "ㄹ"]
    word_position: Literal["initial", "medial", "final"]
    start_level: StartLevel
    target_level: TargetLevel
    duration_min: Literal[5, 10, 15]
    repetition_target: int = Field(ge=10, le=60)
    preferred_cue: Literal["none", "visual_mouth", "auditory_model", "tactile_description"]
    priority_targets: list[str] = Field(default_factory=list, max_length=20)
    excluded_words: list[str] = Field(default_factory=list, max_length=20)
    conversation_theme: str = Field(default="", max_length=100)
    therapist_note: str = Field(default="", max_length=500)
    steps: list[StepInput] = Field(min_length=1, max_length=8)

    @field_validator("priority_targets", "excluded_words")
    @classmethod
    def clean_words(cls, values: list[str]) -> list[str]:
        return _clean_words(values)

    @model_validator(mode="after")
    def levels_in_order(self):
        if LEVELS.index(self.start_level) > LEVELS.index(self.target_level):
            raise ValueError("시작 단계가 목표 단계보다 높습니다")
        if set(self.priority_targets) & set(self.excluded_words):
            raise ValueError("우선 단어와 제외 단어가 겹칩니다")
        if any(step.target_level and LEVELS.index(step.target_level) > LEVELS.index(self.target_level) for step in self.steps):
            raise ValueError("활동 단계가 목표 단계보다 높습니다")
        return self


class SummaryOutput(ApiModel):
    """요약 AI의 structured output. 관찰 사실(evidencePoints)과 제안(nextSessionSuggestion)을 나눈다.

    길이·표현 제한은 제공자 schema 호환을 위해 여기 두지 않고 ValidateOutput 단계에서 검사한다.
    """
    observation_summary: str
    evidence_points: list[str]
    next_session_suggestion: str
    limitations: list[str]

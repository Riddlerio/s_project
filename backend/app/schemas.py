from typing import Literal

from pydantic import ConfigDict, Field, field_validator
from .schemas_base import ApiModel
from .pronunciation.acoustic import AcousticSummary


class LoginInput(ApiModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class DemoLoginInput(ApiModel):
    model_config = ConfigDict(alias_generator=ApiModel.model_config["alias_generator"], populate_by_name=True, extra="forbid")
    role: Literal["THERAPIST", "STUDENT"]


class GoalInput(ApiModel):
    target_phoneme: Literal["ㅅ", "ㅈ", "ㄹ"] = "ㅅ"
    target_sound: str = "사"
    word_position: Literal["initial", "medial", "final"] = "initial"
    level: Literal["syllable", "word", "short_sentence"] = "word"
    min_level: Literal["phoneme", "syllable", "word", "short_sentence"] = "syllable"
    session_duration_min: Literal[5, 10, 15] = 10
    repetition_target: int = Field(default=30, ge=10, le=60)
    priority: Literal["accuracy", "balanced", "speed"] = "accuracy"
    preferred_cue: Literal["none", "visual_mouth", "auditory_model", "tactile_description"] = "visual_mouth"
    excluded_words: list[str] = Field(default_factory=list)
    excluded_games: list[str] = Field(default_factory=list)
    priority_targets: list[str] = Field(default_factory=list)
    pass_threshold: int | None = None
    note: str = ""


class StartActivityInput(ApiModel):
    game: Literal["magic_beam", "sky_climb", "monster_adventure", "conversation_quest", "daegu_crossing"]
    mode: Literal["real", "demo"] = "demo"


class ChildInput(ApiModel):
    hero_name: str = Field(min_length=1, max_length=20)
    age_band: Literal["4-5", "6-7"] = "4-5"
    guardian_consent: bool = False


class UtteranceInput(ApiModel):
    model_config = ConfigDict(alias_generator=ApiModel.model_config["alias_generator"], populate_by_name=True, extra="forbid")
    item_id: str
    round_index: int | None = Field(default=None, ge=1, le=5)
    attempt_index: int = Field(default=1, ge=0, le=100)
    transcript: str | None = Field(default=None, max_length=50)
    alternatives: list[str] = Field(default_factory=list, max_length=5)
    recognizer: str = "demo_script"
    acoustic: AcousticSummary = Field(default_factory=AcousticSummary)
    elapsed_sec: int = Field(default=0, ge=0, le=600)
    attack: Literal["basic", "magic_beam"] = "basic"

    @field_validator("alternatives")
    @classmethod
    def limit_alternatives(cls, values: list[str]) -> list[str]:
        if any(len(value) > 50 for value in values):
            raise ValueError("대체 인식 결과는 50자 이하여야 합니다")
        return values


class CompleteInput(ApiModel):
    elapsed_sec: int = 0


class RecommendationDecisionInput(ApiModel):
    action: str
    modified_goal: dict | None = None
    note: str = ""


class FeedbackInput(ApiModel):
    action: str
    cue: str | None = None
    score: int | None = None
    note: str = ""
    create_rule: bool = False


class ObservationDecisionInput(ApiModel):
    model_config = ConfigDict(alias_generator=ApiModel.model_config["alias_generator"], populate_by_name=True, extra="forbid")
    action: Literal["confirm", "correct", "reject"]
    corrected_result: Literal["success", "retry", "uncertain", "no_speech"] | None = None
    note: str = Field(default="", max_length=500)


class ActivityRecommendationDecisionInput(ApiModel):
    model_config = ConfigDict(alias_generator=ApiModel.model_config["alias_generator"], populate_by_name=True, extra="forbid")
    action: Literal["accept", "modify", "reject"]
    modified_game: Literal["magic_beam", "sky_climb", "monster_adventure", "conversation_quest"] | None = None
    note: str = Field(default="", max_length=500)

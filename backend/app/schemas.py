from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class LoginInput(ApiModel):
    username: str
    password: str


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


class StartInput(ApiModel):
    play_code: str
    mode: str = "demo"


class ChildInput(ApiModel):
    hero_name: str = Field(min_length=1, max_length=20)
    age_band: Literal["4-5", "6-7"] = "4-5"
    guardian_consent: bool = False


class UtteranceInput(ApiModel):
    item_id: str
    attempt_index: int = 1
    transcript: str | None = None
    alternatives: list[str] = Field(default_factory=list)
    recognizer: str = "demo_script"
    acoustic: dict = Field(default_factory=dict)
    elapsed_sec: int = 0


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

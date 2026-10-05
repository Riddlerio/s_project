from typing import Literal

from pydantic import ConfigDict, Field

from ..schemas_base import ApiModel


class SkillDecisionInput(ApiModel):
    model_config = ConfigDict(alias_generator=ApiModel.model_config["alias_generator"], populate_by_name=True, extra="forbid")
    evidence_kind: Literal["APP_OBSERVATION", "DIRECT_OBSERVATION"]
    note: str = Field(default="", max_length=500)


class ClaimInput(ApiModel):
    model_config = ConfigDict(alias_generator=ApiModel.model_config["alias_generator"], populate_by_name=True, extra="forbid")
    takeover: bool = False


class CraftInput(ApiModel):
    model_config = ConfigDict(alias_generator=ApiModel.model_config["alias_generator"], populate_by_name=True, extra="forbid")
    request_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    recipe: Literal["tuna_sushi"]

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt

MIN_START_BPM = 76
MAX_START_BPM = 100
DEFAULT_START_BPM = 84
DEFAULT_ALLOW_FASTER = True


class DaeguCrossingRhythm(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    startBpm: StrictInt = Field(ge=MIN_START_BPM, le=MAX_START_BPM)
    allowFaster: StrictBool


class GameSettingsInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    daeguCrossing: DaeguCrossingRhythm

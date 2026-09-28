from typing import Literal

from pydantic import ConfigDict, Field, StrictFloat, StrictInt, model_validator

from ..schemas_base import ApiModel


Number = StrictInt | StrictFloat


class AcousticSummary(ApiModel):
    model_config = ConfigDict(alias_generator=ApiModel.model_config["alias_generator"], populate_by_name=True,
                              extra="forbid", allow_inf_nan=False)

    duration_ms: Number | None = Field(default=None, ge=0, le=60000)
    voiced_ms: Number | None = Field(default=None, ge=0, le=60000)
    active_ms: Number | None = Field(default=None, ge=0, le=60000)
    best_run_ms: Number | None = Field(default=None, ge=0, le=60000)
    frication_ms: Number | None = Field(default=None, ge=0, le=60000)
    onset_latency_ms: Number | None = Field(default=None, ge=0, le=60000)
    mean_rms_db: Number | None = Field(default=None, ge=-160, le=20)
    peak_rms_db: Number | None = Field(default=None, ge=-160, le=20)
    noise_floor_db: Number | None = Field(default=None, ge=-160, le=20)
    snr_db: Number | None = Field(default=None, ge=-100, le=180)
    mean_hf_ratio: Number | None = Field(default=None, ge=0, le=1)
    clipping_ratio: Number | None = Field(default=None, ge=0, le=1)
    mean_centroid_hz: Number | None = Field(default=None, ge=0, le=24000)
    sustain_segments_ms: list[Number] | None = Field(default=None, max_length=30)
    pause_count: StrictInt | None = Field(default=None, ge=0, le=100)
    pause_total_ms: Number | None = Field(default=None, ge=0, le=60000)
    interruption_count: StrictInt | None = Field(default=None, ge=0, le=100)
    energy_mean01: Number | None = Field(default=None, ge=0, le=1)
    energy_std01: Number | None = Field(default=None, ge=0, le=1)
    onset_frication_ms: Number | None = Field(default=None, ge=0, le=60000)
    voiced_after_frication_ms: Number | None = Field(default=None, ge=0, le=60000)
    source: Literal["keyboard", "microphone"] | None = None

    @model_validator(mode="after")
    def check_durations(self):
        if self.sustain_segments_ms is not None and any(value < 0 or value > 60000 for value in self.sustain_segments_ms):
            raise ValueError("sustainSegmentsMs 범위가 올바르지 않습니다")
        if self.best_run_ms is not None and self.duration_ms is not None and self.best_run_ms > self.duration_ms + 200:
            raise ValueError("bestRunMs가 durationMs보다 지나치게 큽니다")
        if self.frication_ms is not None and self.active_ms is not None and self.frication_ms > self.active_ms + 40:
            raise ValueError("fricationMs가 activeMs보다 지나치게 큽니다")
        return self

# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


class AdminStats(BaseModel):
    """
    Platform metrics. Totals include the anonymous counts kept when an account is deleted; no per-user data.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    users: int
    startups: int
    simulations: int
    turns_played: int = Field(..., alias='turnsPlayed')
    average_turn_duration_ms: float | None = Field(
        ...,
        alias='averageTurnDurationMs',
        description='Mean startedAt to completedAt of completed turn jobs.',
    )
    ai_requests: int = Field(
        ...,
        alias='aiRequests',
        description='LLM requests: llm-mode agent calls, per-turn AI CEO analyses that reached the LLM, and on-demand advisor questions.',
    )
    ml_predictions: int = Field(
        ...,
        alias='mlPredictions',
        description='Turns that carry an available ML forecast.',
    )
    failed_jobs: int = Field(..., alias='failedJobs')
    engine_version: str | None = Field(..., alias='engineVersion')
    model_version: str | None = Field(..., alias='modelVersion')
    generated_at: AwareDatetime = Field(..., alias='generatedAt')

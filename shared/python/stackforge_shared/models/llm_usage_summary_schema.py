# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


class LlmUsageSummary(BaseModel):
    """
    The user's LLM token use today (UTC) against the daily quota.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    used_today: int = Field(..., alias='usedToday', ge=0)
    daily_quota: int = Field(..., alias='dailyQuota', ge=0)
    remaining: int = Field(..., ge=0)
    exhausted: bool = Field(
        ...,
        description='Turns run in rules mode and the AI CEO is unavailable until the reset.',
    )
    resets_at: AwareDatetime = Field(..., alias='resetsAt')

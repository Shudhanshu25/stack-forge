# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class EngineInfoResponse(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    engine_version: str = Field(..., alias='engineVersion')
    model_version: str | None = Field(..., alias='modelVersion')
    training_dataset_version: str | None = Field(..., alias='trainingDatasetVersion')
    llm_configured: bool = Field(..., alias='llmConfigured')
    agent_model: str = Field(..., alias='agentModel')
    advisor_model: str = Field(..., alias='advisorModel')

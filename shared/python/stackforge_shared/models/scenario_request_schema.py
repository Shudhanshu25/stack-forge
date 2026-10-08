# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import scenario_branch_input_schema


class ScenarioRequest(BaseModel):
    """
    Compare two decision sets from the current state over 1-6 turns.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    horizon: int = Field(..., ge=1, le=6)
    baseline: scenario_branch_input_schema.ScenarioBranchInput
    alternative: scenario_branch_input_schema.ScenarioBranchInput

# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import decision_schema, enums_schema


class TurnSummary(BaseModel):
    """
    One past turn, condensed. Node sends the most recent few as the agents' bounded memory and the advisor's recent history.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    turn_number: int = Field(..., alias='turnNumber', ge=1)
    decisions: list[decision_schema.Decision] = Field(..., max_length=9)
    revenue: int
    profit: int
    cash: int
    customers: int = Field(..., ge=0)
    new_customers: int = Field(..., alias='newCustomers', ge=0)
    churned_customers: int = Field(..., alias='churnedCustomers', ge=0)
    customer_satisfaction: float = Field(
        ...,
        alias='customerSatisfaction',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    market_share: float = Field(
        ...,
        alias='marketShare',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    events: list[enums_schema.EventType] = Field(..., max_length=10)
    agent_summary: str | None = Field(
        None,
        alias='agentSummary',
        description="Reasoning summaries of the turn's agents, if any.",
        max_length=600,
    )

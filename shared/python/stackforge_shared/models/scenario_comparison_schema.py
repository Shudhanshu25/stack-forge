# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from . import decision_rejection_schema, decision_schema


class ScenarioTurn(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    turn: int
    revenue: int
    profit: int
    customers: int
    churn_rate: float = Field(..., alias='churnRate')
    cash: int


class ScenarioTotals(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    revenue: int
    profit: int
    end_cash: int = Field(..., alias='endCash')
    end_customers: int = Field(..., alias='endCustomers')
    average_churn_rate: float = Field(..., alias='averageChurnRate')


class Metric(StrEnum):
    revenue = 'revenue'
    profit = 'profit'
    end_cash = 'endCash'
    end_customers = 'endCustomers'
    average_churn_rate = 'averageChurnRate'


class ScenarioDifference(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    metric: Metric
    baseline: float
    alternative: float
    difference: float = Field(..., description='alternative minus baseline')


class ScenarioBranchResult(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    label: str
    decisions: list[decision_schema.Decision]
    rejections: list[decision_rejection_schema.DecisionRejection]
    bankrupt_at_turn: int | None = Field(..., alias='bankruptAtTurn')
    turns: list[ScenarioTurn]
    totals: ScenarioTotals | None


class ScenarioComparison(BaseModel):
    """
    Two branches run from the same state with the same seed and rules agents, so the decisions are the only difference. Never stored.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    start_turn: int = Field(..., alias='startTurn')
    horizon: int
    label: Literal['Simulation estimate']
    agent_mode: Literal['rules'] = Field(..., alias='agentMode')
    branches: list[ScenarioBranchResult] = Field(..., max_length=2, min_length=2)
    differences: list[ScenarioDifference] = Field(
        ...,
        description='Empty when either branch was rejected. Differences only; no recommendation.',
    )

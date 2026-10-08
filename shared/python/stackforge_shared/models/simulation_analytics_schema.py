# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from . import (
    decision_schema,
    enums_schema,
    estimated_effect_schema,
    location_profile_schema,
)


class Kpi(BaseModel):
    """
    A headline figure with its value one turn earlier (null at turn 0).
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    value: float
    previous: float | None
    change: float | None


class TurnMetrics(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    turn: int
    revenue: int
    expenses_total: int = Field(..., alias='expensesTotal')
    variable_costs: int = Field(..., alias='variableCosts')
    fixed_costs: int = Field(..., alias='fixedCosts')
    marketing_costs: int = Field(..., alias='marketingCosts')
    employee_costs: int = Field(..., alias='employeeCosts')
    product_costs: int = Field(..., alias='productCosts')
    profit: int
    cash: int
    customers: int
    new_customers: int = Field(..., alias='newCustomers')
    churned_customers: int = Field(..., alias='churnedCustomers')
    churn_rate: float = Field(..., alias='churnRate')
    market_share: float = Field(..., alias='marketShare')
    customer_satisfaction: float = Field(..., alias='customerSatisfaction')
    competitor_pressure: float = Field(..., alias='competitorPressure')
    brand_awareness: float = Field(..., alias='brandAwareness')
    product_quality: float = Field(..., alias='productQuality')
    price: int
    marketing_budget: int = Field(..., alias='marketingBudget')
    employees: int
    gross_margin: float | None = Field(
        ...,
        alias='grossMargin',
        description='(revenue - variable costs) / revenue; null without revenue.',
    )
    burn_rate: int = Field(
        ..., alias='burnRate', description='Paise lost this turn (0 when profitable).'
    )
    runway_months: float | None = Field(
        ...,
        alias='runwayMonths',
        description='cash / burnRate; null when not burning cash.',
    )
    cac: int | None = Field(
        ...,
        description='Marketing spend / new customers, paise; null without new customers.',
    )
    ltv: int | None = Field(
        ..., description='ARPU x gross margin / churn rate, paise; null when undefined.'
    )
    arpu: int | None = Field(
        ...,
        description='Revenue per customer this turn, paise; null without customers.',
    )
    demand_index: float = Field(
        ...,
        alias='demandIndex',
        description='Seasonality x active event demand effects during the turn (1 = normal).',
    )


class SegmentPoint(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    turn: int
    segment: enums_schema.CustomerSegmentType
    customers: int
    population: int
    churn_probability: float = Field(..., alias='churnProbability')
    conversion_rate: float = Field(..., alias='conversionRate')


class CompetitorPoint(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    turn: int
    id: str
    name: str
    archetype: enums_schema.CompetitorArchetype
    price: int
    market_share: float = Field(..., alias='marketShare')
    product_quality: float = Field(..., alias='productQuality')
    marketing_power: float = Field(..., alias='marketingPower')


class ForecastValues(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    revenue: int
    customers: int
    churn_rate: float = Field(..., alias='churnRate')


class ForecastPoint(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    target_turn: int = Field(..., alias='targetTurn')
    model_version: str | None = Field(..., alias='modelVersion')
    predicted: ForecastValues
    actual: ForecastValues | None = Field(
        ..., description='Null until the target turn is played.'
    )
    revenue_error_percent: float | None = Field(..., alias='revenueErrorPercent')
    customers_error_percent: float | None = Field(..., alias='customersErrorPercent')
    churn_rate_error: float | None = Field(..., alias='churnRateError')


class ForecastAccuracy(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    pairs: int
    revenue_mape: float | None = Field(..., alias='revenueMape')
    customers_mape: float | None = Field(..., alias='customersMape')
    churn_rate_mae: float | None = Field(..., alias='churnRateMae')


class ActiveEventSummary(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    type: enums_schema.EventType
    title: str
    polarity: enums_schema.EventPolarity
    turns_left: int = Field(..., alias='turnsLeft')


class MarketSnapshot(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    customer_sentiment: float = Field(..., alias='customerSentiment')
    sentiment_change: float | None = Field(..., alias='sentimentChange')
    competitor_pressure: float = Field(..., alias='competitorPressure')
    pressure_change: float | None = Field(..., alias='pressureChange')
    demand_index: float = Field(..., alias='demandIndex')
    demand_index_next: float = Field(
        ...,
        alias='demandIndexNext',
        description='Demand index the next turn starts with (seasonality and events still active).',
    )
    active_events: list[ActiveEventSummary] = Field(..., alias='activeEvents')


class Key(StrEnum):
    salaries = 'salaries'
    recruiting = 'recruiting'
    fixed = 'fixed'
    compliance = 'compliance'
    logistics = 'logistics'


class Cost(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    key: Key
    label: str
    factor: float = Field(
        ..., description='Multiplier the location applies to this line.'
    )
    actual: int
    baseline: int


class Key1(StrEnum):
    market_size = 'marketSize'
    price_elasticity = 'priceElasticity'
    competition = 'competition'
    max_hires = 'maxHires'


class DemandItem(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    key: Key1
    label: str
    factor: float = Field(
        ..., description='Multiplier after local demand weighting (1.0 = no effect).'
    )


class Kpis(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    cash: Kpi
    revenue: Kpi
    profit: Kpi
    customers: Kpi
    churn_rate: Kpi = Field(..., alias='churnRate')
    market_share: Kpi = Field(..., alias='marketShare')


class PreviewedDecision(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    decision: decision_schema.Decision
    previewed: list[estimated_effect_schema.EstimatedEffect]


class DecisionAnalysis(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    turn: int
    decisions: list[PreviewedDecision]
    combined_preview: list[estimated_effect_schema.EstimatedEffect] = Field(
        ...,
        alias='combinedPreview',
        description='All decisions together against changing nothing, as the preview estimated.',
    )
    actual: list[estimated_effect_schema.EstimatedEffect] = Field(
        ...,
        description='How each metric actually moved over the turn (stateBefore to stateAfter).',
    )
    direction_agreement: float | None = Field(
        ...,
        alias='directionAgreement',
        description='Share of metrics the preview expected to move whose actual movement went the same way.',
    )


class LocationImpact(BaseModel):
    """
    How much of the cost base and demand the location accounts for, against the neutral baseline (every index 1.0).
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    profile: location_profile_schema.LocationProfile
    local_demand_weight: float = Field(..., alias='localDemandWeight')
    costs: list[Cost] = Field(
        ...,
        description='Latest turn, per cost line: the amount and what it would be at the national baseline (paise).',
    )
    monthly_cost_base: int = Field(
        ...,
        alias='monthlyCostBase',
        description="Latest turn's total expenses (paise).",
    )
    monthly_location_cost: int = Field(
        ...,
        alias='monthlyLocationCost',
        description="Latest turn's expenses minus what they would be at the baseline (negative: the location saves money).",
    )
    demand: list[DemandItem]


class SimulationAnalytics(BaseModel):
    """
    Everything the dashboard and analytics views show, computed by the simulation service from stored turn records. Money in paise.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    current_turn: int = Field(..., alias='currentTurn')
    kpis: Kpis = Field(..., title='Kpis')
    market: MarketSnapshot
    series: list[TurnMetrics] = Field(
        ..., description='One entry per turn, starting at turn 0.'
    )
    segments: list[SegmentPoint]
    competitors: list[CompetitorPoint]
    forecasts: list[ForecastPoint]
    forecast_accuracy: ForecastAccuracy = Field(..., alias='forecastAccuracy')
    decisions: list[DecisionAnalysis]
    location: LocationImpact | None = None

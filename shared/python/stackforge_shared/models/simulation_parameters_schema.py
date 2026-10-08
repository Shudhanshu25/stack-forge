# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, RootModel


class SeasonalityItem(RootModel[float]):
    root: float = Field(..., ge=0.0, le=3.0)


class SegmentMix(BaseModel):
    """
    Share of the addressable market in each customer segment. Weights sum to 1.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    price_sensitive: float = Field(
        ...,
        alias='priceSensitive',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    premium: float = Field(
        ...,
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    loyal: float = Field(
        ...,
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    occasional: float = Field(
        ...,
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    enterprise: float = Field(
        ...,
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )


class SimulationParameters(BaseModel):
    """
    Default economic parameters of an industry, consumed by the simulation engine. Money in paise; rates in [0, 1] and monthly unless stated.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    unit_cost_rate: float = Field(
        ...,
        alias='unitCostRate',
        description='COGS as a share of revenue.',
        ge=0.0,
        le=1.0,
    )
    variable_cost_per_customer: int = Field(
        ...,
        alias='variableCostPerCustomer',
        description='Paise per active customer per month (hosting, support, servicing).',
        ge=0,
    )
    logistics_cost_per_order: int = Field(
        ...,
        alias='logisticsCostPerOrder',
        description='Paise per order for shipping and fulfilment.',
        ge=0,
    )
    return_rate: float = Field(
        ..., alias='returnRate', description='Share of orders refunded.', ge=0.0, le=1.0
    )
    inventory_holding_rate: float = Field(
        ...,
        alias='inventoryHoldingRate',
        description='Monthly inventory holding cost as a share of COGS.',
        ge=0.0,
        le=1.0,
    )
    purchases_per_customer_per_month: float = Field(
        ..., alias='purchasesPerCustomerPerMonth', ge=0.0, le=100.0
    )
    fixed_costs_monthly: int = Field(
        ...,
        alias='fixedCostsMonthly',
        description='Paise per month: rent, tools, overheads.',
        ge=0,
    )
    salary_per_employee_monthly: int = Field(
        ..., alias='salaryPerEmployeeMonthly', ge=0
    )
    initial_employees: int = Field(..., alias='initialEmployees', ge=0, le=10000)
    base_churn_rate: float = Field(
        ...,
        alias='baseChurnRate',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    base_cac: int = Field(
        ...,
        alias='baseCac',
        description='Paise of marketing spend per acquired customer at reference conditions.',
        ge=0,
    )
    base_conversion_rate: float = Field(
        ...,
        alias='baseConversionRate',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    price_elasticity: float = Field(
        ...,
        alias='priceElasticity',
        description='Magnitude of demand response to price relative to referencePrice.',
        ge=0.0,
        le=10.0,
    )
    reference_price: int = Field(
        ..., alias='referencePrice', description='Typical market price in paise.', ge=0
    )
    initial_product_quality: float = Field(
        ...,
        alias='initialProductQuality',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    initial_brand_awareness: float = Field(
        ...,
        alias='initialBrandAwareness',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    market_growth_rate_monthly: float = Field(
        ..., alias='marketGrowthRateMonthly', ge=-0.5, le=0.5
    )
    seasonality: list[SeasonalityItem] = Field(
        ...,
        description='Twelve monthly demand multipliers, January first.',
        max_length=12,
        min_length=12,
    )
    competitor_intensity: float = Field(
        ...,
        alias='competitorIntensity',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    event_probability_multiplier: float = Field(
        ..., alias='eventProbabilityMultiplier', ge=0.0, le=5.0
    )
    segment_mix: SegmentMix = Field(
        ...,
        alias='segmentMix',
        description='Share of the addressable market in each customer segment. Weights sum to 1.',
        title='SegmentMix',
    )
    customers_per_employee: int = Field(
        ...,
        alias='customersPerEmployee',
        description='Customers one employee can serve before service quality suffers.',
        ge=1,
    )
    local_demand_weight: float | None = Field(
        None,
        alias='localDemandWeight',
        description="How local the industry's customers are: scales the demand-side location effects (purchasing power, local market size, competition). 0 or absent: none.",
        ge=0.0,
        le=1.0,
    )
    recruiting_cost_salary_share: float | None = Field(
        None,
        alias='recruitingCostSalaryShare',
        description='Cost per hire as a share of a monthly salary. Absent: the engine default (0.25). Set by location (talent availability).',
        ge=0.0,
        le=2.0,
    )
    max_hires_per_turn: int | None = Field(
        None,
        alias='maxHiresPerTurn',
        description='Most hires allowed in one turn. Absent: no limit. Set by location when talent is scarce.',
        ge=1,
    )

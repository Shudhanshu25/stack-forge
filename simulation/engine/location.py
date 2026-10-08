"""Location: how a startup's city and state adjust its economics (docs/simulation.md#location).

A location profile holds indices relative to a national baseline of 1.0. `localize` turns a
configuration and its profile into the configuration the engine computes with:

- costs, always in full: salaries (salaryIndex), fixed costs (operatingCostIndex, plus a
  compliance surcharge or saving from regulatoryBurden), recruiting cost and a hiring cap
  (talentAvailability), and logistics cost per order (infrastructure; only industries that
  ship goods have one);
- demand, scaled by the industry's localDemandWeight w: market size (localMarketSize), price
  elasticity (purchasingPower) and competitor intensity (competitionDensity).

Every effect is a ratio to the baseline, so a profile of 1.0s (the neutral profile given to
startups created before locations existed, or no profile at all) changes nothing and the
results equal engine 1.0.0's exactly. `localize` is idempotent: the configuration it returns
keeps the profile's place (state, city, tier, for event conditions) with every index set to 1.0.
"""

import math
from dataclasses import dataclass

from . import profiles as pf
from .models import StartupConfiguration

INDEX_NAMES = (
    "salary_index",
    "operating_cost_index",
    "purchasing_power",
    "local_market_size",
    "talent_availability",
    "competition_density",
    "funding_access",
    "infrastructure",
    "regulatory_burden",
)


@dataclass(frozen=True)
class LocationFactors:
    """The multipliers a profile applies, after local demand weighting."""

    salary: float = 1.0
    fixed: float = 1.0  # operating cost and compliance together
    operating: float = 1.0
    compliance: float = 0.0  # compliance surcharge (+) or saving (-) as a share of fixed costs
    recruiting: float = 1.0
    max_hires: int | None = None
    logistics: float = 1.0
    market_size: float = 1.0
    elasticity: float = 1.0
    competition: float = 1.0
    local_demand_weight: float = 0.0

    @property
    def neutral(self) -> bool:
        return self == LocationFactors(local_demand_weight=self.local_demand_weight)


def _index(config: StartupConfiguration, name: str) -> float:
    profile = config.location_profile
    if profile is None:
        return 1.0
    value = getattr(profile.indices, name).value
    lo, hi = pf.LOCATION_INDEX_BOUNDS
    return min(hi, max(lo, float(value)))


def location_factors(config: StartupConfiguration) -> LocationFactors:
    """The multipliers this configuration's location applies (all 1.0 without a profile)."""
    w = float(config.parameters.local_demand_weight or 0.0)
    if config.location_profile is None:
        return LocationFactors(local_demand_weight=w)

    def weighted(name: str) -> float:
        return 1.0 + w * (_index(config, name) - 1.0)

    talent = _index(config, "talent_availability")
    operating = _index(config, "operating_cost_index")
    compliance = pf.COMPLIANCE_SHARE_OF_FIXED_COSTS * (_index(config, "regulatory_burden") - 1.0)
    max_hires = None
    if talent < 1.0:
        max_hires = max(1, math.floor(pf.HIRES_PER_TURN_AT_BASELINE * talent))
    return LocationFactors(
        salary=_index(config, "salary_index"),
        fixed=operating + compliance,
        operating=operating,
        compliance=compliance,
        recruiting=1.0 / talent,
        max_hires=max_hires,
        logistics=1.0 / _index(config, "infrastructure"),
        market_size=weighted("local_market_size"),
        elasticity=_index(config, "purchasing_power") ** (-pf.PURCHASING_POWER_EXPONENT * w),
        competition=weighted("competition_density"),
        local_demand_weight=w,
    )


def localize(config: StartupConfiguration) -> StartupConfiguration:
    """The configuration with its location applied (see the module docstring). Idempotent."""
    f = location_factors(config)
    if f.neutral:
        return config
    p = config.parameters
    share = (
        p.recruiting_cost_salary_share
        if p.recruiting_cost_salary_share is not None
        else pf.RECRUITING_COST_SALARY_SHARE
    )
    max_hires = p.max_hires_per_turn
    if f.max_hires is not None:
        max_hires = min(max_hires, f.max_hires) if max_hires is not None else f.max_hires
    parameters = p.model_copy(
        update={
            "salary_per_employee_monthly": round(p.salary_per_employee_monthly * f.salary),
            "fixed_costs_monthly": round(p.fixed_costs_monthly * max(0.0, f.fixed)),
            "recruiting_cost_salary_share": share * f.recruiting,
            "max_hires_per_turn": max_hires,
            "logistics_cost_per_order": round(p.logistics_cost_per_order * f.logistics),
            "price_elasticity": p.price_elasticity * f.elasticity,
            "competitor_intensity": min(1.0, max(0.0, p.competitor_intensity * f.competition)),
        }
    )
    profile = config.location_profile
    applied = profile.model_copy(
        update={
            "indices": profile.indices.model_copy(
                update={
                    name: getattr(profile.indices, name).model_copy(update={"value": 1.0})
                    for name in INDEX_NAMES
                }
            )
        }
    )
    return config.model_copy(
        update={
            "parameters": parameters,
            "market_size": max(1, round(config.market_size * f.market_size)),
            "location_profile": applied,
        }
    )


def recruiting_share(config: StartupConfiguration) -> float:
    """Cost per hire as a share of a monthly salary (engine default without a location)."""
    share = config.parameters.recruiting_cost_salary_share
    return pf.RECRUITING_COST_SALARY_SHARE if share is None else share


def _raw(value):
    """The plain value inside a generated wrapper (state and city codes are RootModels)."""
    return getattr(value, "root", value)


def matches(conditions, config: StartupConfiguration) -> bool:
    """Whether an event's location conditions hold for this startup. No conditions: always.
    A startup without a location (or with the neutral profile) only gets unconditional events."""
    if conditions is None:
        return True
    profile = config.location_profile
    state = _raw(profile.state) if profile is not None else None
    if state is None:
        return False
    if conditions.states and state not in {_raw(s) for s in conditions.states}:
        return False
    tier = _raw(profile.tier)
    if conditions.tiers and (tier is None or tier not in {_raw(t) for t in conditions.tiers}):
        return False
    city = _raw(profile.city_id)
    return not (conditions.cities and city not in {_raw(c) for c in conditions.cities})

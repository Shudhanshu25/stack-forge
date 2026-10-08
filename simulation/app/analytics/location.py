"""The analytics location panel: how much of the cost base and demand the location accounts for.

Each cost line of the latest turn is split from the recorded expenses with the location's
factors (the same ones the engine applied) and set against what it would be at the national
baseline (every index 1.0). Demand effects are reported as the multipliers the engine used.
"""

from types import ModuleType

from stackforge_shared.models.simulation_analytics_schema import (
    Cost,
    DemandItem,
    LocationImpact,
)

import locations
from engine.models import SimulationTurn, StartupConfiguration


def _factors(eng: ModuleType, config: StartupConfiguration):
    # Engines before 1.1.0 have no location: their factors are all 1.0.
    if not hasattr(eng, "location_factors"):
        return None
    return eng.location_factors(config)


def _orders(eng: ModuleType, config: StartupConfiguration, record: SimulationTurn) -> float:
    p = config.parameters
    seasonal = eng.profiles.BUSINESS_MODELS[config.business_model].seasonal_purchases
    month = (record.turn_number - 1) % 12
    multiplier = eng.seasonality(config, month) if seasonal else 1.0
    return record.state_after.customers * p.purchases_per_customer_per_month * multiplier


def location_impact(
    eng: ModuleType, config: StartupConfiguration, records: list[SimulationTurn]
) -> LocationImpact:
    profile = config.location_profile or locations.neutral_profile()
    f = _factors(eng, config)
    weight = float(config.parameters.local_demand_weight or 0.0)
    if f is None or f.neutral:
        salary = fixed_factor = operating = recruiting = logistics = 1.0
        compliance = 0.0
        demand = {"marketSize": 1.0, "priceElasticity": 1.0, "competition": 1.0}
    else:
        salary, fixed_factor, operating = f.salary, f.fixed, f.operating
        compliance, recruiting, logistics = f.compliance, f.recruiting, f.logistics
        demand = {
            "marketSize": f.market_size,
            "priceElasticity": f.elasticity,
            "competition": f.competition,
        }

    costs: list[Cost] = []
    base = 0
    if records:
        last = records[-1]
        e = last.state_after.expenses
        base = e.total
        n = last.state_after.employees
        hires = max(0, n - last.state_before.employees)
        share = config.parameters.recruiting_cost_salary_share
        share = eng.profiles.RECRUITING_COST_SALARY_SHARE if share is None else share
        share_local = share * recruiting
        # Salaries and recruiting share the employees line in proportion to their formula.
        weight_salaries = n / (n + hires * share_local) if n + hires * share_local else 1.0
        salaries = e.employees * weight_salaries
        recruit = e.employees - salaries
        fixed_baseline = e.fixed / fixed_factor if fixed_factor else e.fixed
        p_base = config.parameters
        orders = _orders(eng, config, last)
        logistics_actual = orders * round(p_base.logistics_cost_per_order * logistics)
        logistics_baseline = orders * p_base.logistics_cost_per_order
        lines = [
            ("salaries", "Salaries", salary, salaries, salaries / salary),
            (
                "recruiting",
                "Recruiting",
                salary * recruiting,
                recruit,
                recruit / (salary * recruiting),
            ),
            ("fixed", "Rent and overheads", operating, fixed_baseline * operating, fixed_baseline),
            ("compliance", "State compliance", 1.0 + compliance, fixed_baseline * compliance, 0.0),
            ("logistics", "Logistics", logistics, logistics_actual, logistics_baseline),
        ]
        costs = [
            Cost(key=k, label=label, factor=round(fac, 4), actual=round(a), baseline=round(b))
            for k, label, fac, a, b in lines
        ]
    location_cost = sum(c.actual - c.baseline for c in costs)
    return LocationImpact(
        profile=profile,
        local_demand_weight=weight,
        costs=costs,
        monthly_cost_base=base,
        monthly_location_cost=round(location_cost),
        demand=[
            DemandItem(
                key="marketSize", label="Local market size", factor=round(demand["marketSize"], 4)
            ),
            DemandItem(
                key="priceElasticity",
                label="Price sensitivity",
                factor=round(demand["priceElasticity"], 4),
            ),
            DemandItem(
                key="competition", label="Competition", factor=round(demand["competition"], 4)
            ),
        ],
    )

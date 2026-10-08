"""Features and targets shared by dataset generation, training and inference."""

from stackforge_shared.models.enums_schema import Industry

from engine.models import SimulationState

# The specification's features, named after the state fields they come from.
STATE_FEATURES = [
    "price",
    "marketingBudget",
    "employees",
    "customers",
    "churnRate",  # churned / customers at the start of the turn
    "competitorPressure",  # competition
    "customerSatisfaction",  # sentiment
    "productQuality",
    "revenue",
    "profit",
]
# Industries differ by orders of magnitude, so each gets an indicator column.
INDUSTRY_FEATURES = [f"industry_{i.value}" for i in Industry]
FEATURES = STATE_FEATURES + INDUSTRY_FEATURES

TARGETS = ["revenue", "customers", "churnRate"]  # all for the next turn


def churn_rate(state: SimulationState) -> float:
    start = state.customers - state.new_customers + state.churned_customers
    return state.churned_customers / start if start > 0 else 0.0


def feature_vector(state: SimulationState, industry: Industry) -> list[float]:
    values = {
        "price": state.price,
        "marketingBudget": state.marketing_budget,
        "employees": state.employees,
        "customers": state.customers,
        "churnRate": churn_rate(state),
        "competitorPressure": state.competitor_pressure,
        "customerSatisfaction": state.customer_satisfaction,
        "productQuality": state.product_quality,
        "revenue": state.revenue,
        "profit": state.profit,
    }
    industry_value = Industry(industry).value
    return [float(values[f]) for f in STATE_FEATURES] + [
        1.0 if f == f"industry_{industry_value}" else 0.0 for f in INDUSTRY_FEATURES
    ]


def target_vector(next_state: SimulationState) -> list[float]:
    return [float(next_state.revenue), float(next_state.customers), churn_rate(next_state)]

from engine.decisions import AppliedDecisions
from engine.events import EventEffects
from engine.finance import compute_financials


def test_revenue_costs_and_profit(config) -> None:
    params = config.parameters.model_copy(
        update={
            "purchases_per_customer_per_month": 2,
            "return_rate": 0.1,
            "unit_cost_rate": 0.2,
            "inventory_holding_rate": 0.1,
            "variable_cost_per_customer": 1_000,
            "logistics_cost_per_order": 500,
            "fixed_costs_monthly": 100_000,
            "salary_per_employee_monthly": 20_000,
        }
    )
    applied = AppliedDecisions(
        price=50_000, marketing_budget=30_000, employees=3, hires=1, product_investment=7_000
    )
    fin = compute_financials(100, applied, params, 1.0, EventEffects(fixed_costs=0.1))

    gross = 100 * 2 * 50_000  # 1,00,00,000
    assert fin.gross_revenue == gross
    assert fin.revenue == gross * 0.9
    cogs = gross * 0.2
    assert fin.expenses.variable == round(cogs * 1.1 + 100 * 1_000 + 200 * 500)
    assert fin.expenses.fixed == 110_000
    assert fin.expenses.marketing == 30_000
    assert fin.expenses.employees == 3 * 20_000 + 0.25 * 20_000
    assert fin.expenses.product == 7_000
    e = fin.expenses
    assert e.total == e.variable + e.fixed + e.marketing + e.employees + e.product
    assert fin.profit == fin.revenue - e.total


def test_unit_cost_event_raises_cogs(config) -> None:
    applied = AppliedDecisions(50_000, 0, 1, 0, 0)
    calm = compute_financials(100, applied, config.parameters, 1.0, EventEffects())
    disrupted = compute_financials(
        100, applied, config.parameters, 1.0, EventEffects(unit_cost=0.15)
    )
    assert disrupted.expenses.variable > calm.expenses.variable
    assert disrupted.revenue == calm.revenue


def test_no_customers_means_no_revenue(config) -> None:
    fin = compute_financials(
        0, AppliedDecisions(50_000, 0, 3, 0, 0), config.parameters, 1.0, EventEffects()
    )
    assert fin.revenue == 0
    assert fin.profit == -fin.expenses.total

"""Revenue, costs and profit. All money is integer paise."""

from dataclasses import dataclass

from . import profiles as pf
from .decisions import AppliedDecisions
from .events import EventEffects
from .models import Expenses, SimulationParameters


@dataclass(frozen=True)
class Financials:
    orders: float
    gross_revenue: int
    revenue: int  # net of refunds
    expenses: Expenses
    profit: int


def compute_financials(
    customers: int,
    applied: AppliedDecisions,
    params: SimulationParameters,
    purchase_multiplier: float,
    effects: EventEffects,
) -> Financials:
    """Revenue from end-of-month customers; costs split into variable, fixed, marketing,
    employees and product. Each component is rounded once, and total is their exact sum, so
    profit = revenue - total and the cash change equals profit."""
    orders = customers * params.purchases_per_customer_per_month * purchase_multiplier
    gross = orders * applied.price
    refunds = gross * params.return_rate
    revenue = round(gross - refunds)

    unit_cost_rate = min(1.0, max(0.0, params.unit_cost_rate * (1 + effects.unit_cost)))
    cogs = gross * unit_cost_rate
    variable = round(
        cogs
        + cogs * params.inventory_holding_rate
        + customers * params.variable_cost_per_customer
        + orders * params.logistics_cost_per_order
    )
    fixed = round(params.fixed_costs_monthly * max(0.0, 1 + effects.fixed_costs))
    marketing = applied.marketing_budget
    salary = params.salary_per_employee_monthly * max(0.0, 1 + effects.salaries)
    share = (
        pf.RECRUITING_COST_SALARY_SHARE
        if params.recruiting_cost_salary_share is None
        else params.recruiting_cost_salary_share
    )
    employees = round(applied.employees * salary + applied.hires * salary * share)
    product = applied.product_investment
    total = variable + fixed + marketing + employees + product
    return Financials(
        orders=orders,
        gross_revenue=round(gross),
        revenue=revenue,
        expenses=Expenses(
            total=total,
            variable=variable,
            fixed=fixed,
            marketing=marketing,
            employees=employees,
            product=product,
        ),
        profit=revenue - total,
    )

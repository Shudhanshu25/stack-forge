"""Decision validation and application."""

from dataclasses import dataclass

from . import profiles as pf
from .location import localize, recruiting_share
from .models import (
    Decision,
    DecisionRejection,
    DecisionResult,
    DecisionStatus,
    DecisionType,
    SimulationState,
    StartupConfiguration,
)

IMPLEMENTED = {
    DecisionType.pricing,
    DecisionType.marketing,
    DecisionType.hiring,
    DecisionType.product_quality,
}


class DecisionValidationError(ValueError):
    """Raised by run_turn when any decision is rejected. Carries every rejection."""

    def __init__(self, rejections: list[DecisionResult]) -> None:
        self.rejections = rejections
        reasons = "; ".join(f"{r.rejection.field}: {r.rejection.reason}" for r in rejections)
        super().__init__(f"Decisions rejected: {reasons}")


@dataclass(frozen=True)
class AppliedDecisions:
    price: int
    marketing_budget: int
    employees: int
    hires: int
    product_investment: int


def _rupees(paise: int) -> str:
    return f"₹{paise / 100:,.2f}".replace(".00", "")


def _check(decision: Decision, state: SimulationState, config: StartupConfiguration) -> str | None:
    """Returns why a single decision is invalid, or None."""
    value = decision.value
    params = config.parameters
    match decision.type:
        case DecisionType.pricing:
            if value < 0:
                return "price cannot be negative"
            if value < pf.MIN_PRICE:
                return "price must be at least ₹1"
            if value > pf.MAX_PRICE:
                return f"price cannot exceed {_rupees(pf.MAX_PRICE)}"
        case DecisionType.marketing:
            if value < 0:
                return "marketing budget cannot be negative"
            if value > state.cash:
                return (
                    f"marketing budget {_rupees(value)} exceeds available cash "
                    f"{_rupees(state.cash)}"
                )
        case DecisionType.hiring:
            if value < 0:
                return "employee count cannot be negative"
            if value < state.employees:
                return (
                    f"target headcount {value} is below the current {state.employees}; "
                    "reducing headcount needs FIRING, which is not yet supported"
                )
            if value > pf.MAX_EMPLOYEES:
                return f"employee count cannot exceed {pf.MAX_EMPLOYEES}"
            hires = value - state.employees
            cap = params.max_hires_per_turn
            if cap is not None and hires > cap:
                return (
                    f"at most {cap} hire{'s' if cap != 1 else ''} per turn here: talent is "
                    f"scarce in this location (asked for {hires})"
                )
            first_month = params.salary_per_employee_monthly * (
                value + hires * recruiting_share(config)
            )
            if hires > 0 and first_month > state.cash:
                return (
                    f"a month of salaries and recruiting for {value} employees "
                    f"({_rupees(round(first_month))}) exceeds available cash"
                )
        case DecisionType.product_quality:
            if value <= 0:
                return "product investment must be positive"
            if value > state.cash:
                return (
                    f"product investment {_rupees(value)} exceeds available cash "
                    f"{_rupees(state.cash)}"
                )
            if state.product_quality >= 0.99:
                return "product quality is already at its maximum"
    return None


def validate_decisions(
    state: SimulationState, decisions: list[Decision], config: StartupConfiguration
) -> list[DecisionResult]:
    """Validates each decision against the current state. Rejections name the field and reason.

    A decision that keeps a value unchanged (for example the current price) is accepted as a
    no-op. Reducing headcount through HIRING is rejected because FIRING is reserved.
    """
    config = localize(config)
    results: list[DecisionResult] = []
    seen: set[DecisionType] = set()
    for i, decision in enumerate(decisions):
        field = f"decisions[{i}].value"
        reason: str | None
        if state.cash < 0:
            field, reason = "cash", "the startup is bankrupt; no further decisions are possible"
        elif decision.type not in IMPLEMENTED:
            field, reason = f"decisions[{i}].type", f"{decision.type.value} is not yet supported"
        elif decision.type in seen:
            field = f"decisions[{i}].type"
            reason = f"{decision.type.value} appears more than once"
        else:
            reason = _check(decision, state, config)
        seen.add(decision.type)
        results.append(_result(decision, field, reason))

    # Marketing budget and product investment are both paid this turn; together they must fit.
    accepted = {
        r.decision.type: (i, r)
        for i, r in enumerate(results)
        if r.status == DecisionStatus.accepted
    }
    if DecisionType.product_quality in accepted:
        i, product = accepted[DecisionType.product_quality]
        marketing = (
            accepted[DecisionType.marketing][1].decision.value
            if DecisionType.marketing in accepted
            else state.marketing_budget
        )
        if marketing + product.decision.value > state.cash:
            results[i] = _result(
                product.decision,
                f"decisions[{i}].value",
                "marketing budget plus product investment exceeds available cash "
                f"{_rupees(state.cash)}",
            )
    return results


def _result(decision: Decision, field: str, reason: str | None) -> DecisionResult:
    if reason is None:
        return DecisionResult(decision=decision, status=DecisionStatus.accepted, effects=[])
    return DecisionResult(
        decision=decision,
        status=DecisionStatus.rejected,
        rejection=DecisionRejection(field=field, reason=reason),
        effects=[],
    )


def apply_decisions(state: SimulationState, decisions: list[Decision]) -> AppliedDecisions:
    """Applies already-validated decisions. Unmentioned levers keep their current values."""
    by_type = {d.type: d.value for d in decisions}
    employees = by_type.get(DecisionType.hiring, state.employees)
    return AppliedDecisions(
        price=by_type.get(DecisionType.pricing, state.price),
        marketing_budget=by_type.get(DecisionType.marketing, state.marketing_budget),
        employees=employees,
        hires=max(0, employees - state.employees),
        product_investment=by_type.get(DecisionType.product_quality, 0),
    )

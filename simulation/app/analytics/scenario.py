"""Scenario comparison: two decision sets from the same state, same seed, rules agents.

Because every random draw comes from (seed, turn, stream) and the number of draws never
depends on decisions, both branches see the same events and noise; the decisions are the
only difference. Decisions apply in the first turn; levers persist afterwards. Nothing is
recorded.
"""

from stackforge_shared.models.engine_scenario_request_schema import EngineScenarioRequest
from stackforge_shared.models.scenario_branch_input_schema import ScenarioBranchInput
from stackforge_shared.models.scenario_comparison_schema import (
    ScenarioBranchResult,
    ScenarioComparison,
    ScenarioDifference,
    ScenarioTotals,
    ScenarioTurn,
)

from app.services.engine_service import engine_for
from engine.models import DecisionStatus
from ml.features import churn_rate

METRICS = ["revenue", "profit", "endCash", "endCustomers", "averageChurnRate"]


def _branch(request: EngineScenarioRequest, branch: ScenarioBranchInput, index: int):
    label = branch.label or ("Baseline" if index == 0 else "Alternative")
    eng = engine_for(request.engine_version)
    results = eng.validate_decisions(request.state, branch.decisions, request.configuration)
    rejections = [r.rejection for r in results if r.status == DecisionStatus.rejected]
    if rejections or request.state.cash < 0:
        return ScenarioBranchResult(
            label=label,
            decisions=branch.decisions,
            rejections=rejections,
            bankrupt_at_turn=None,
            turns=[],
            totals=None,
        )
    state, turns, bankrupt = request.state, [], None
    for step in range(request.horizon):
        turn_number = request.state.turn + 1 + step
        decisions = branch.decisions if step == 0 else []
        state = eng.run_turn(
            state, decisions, request.configuration, request.seed, turn_number
        ).state_after
        turns.append(
            ScenarioTurn(
                turn=turn_number,
                revenue=state.revenue,
                profit=state.profit,
                customers=state.customers,
                churn_rate=round(churn_rate(state), 6),
                cash=state.cash,
            )
        )
        if state.cash < 0:
            bankrupt = turn_number
            break
    totals = ScenarioTotals(
        revenue=sum(t.revenue for t in turns),
        profit=sum(t.profit for t in turns),
        end_cash=turns[-1].cash,
        end_customers=turns[-1].customers,
        average_churn_rate=round(sum(t.churn_rate for t in turns) / len(turns), 6),
    )
    return ScenarioBranchResult(
        label=label,
        decisions=branch.decisions,
        rejections=[],
        bankrupt_at_turn=bankrupt,
        turns=turns,
        totals=totals,
    )


def compare_scenarios(request: EngineScenarioRequest) -> ScenarioComparison:
    branches = [_branch(request, b, i) for i, b in enumerate(request.branches)]
    differences = []
    if all(b.totals for b in branches):
        a = branches[0].totals.model_dump(by_alias=True)
        b = branches[1].totals.model_dump(by_alias=True)
        differences = [
            ScenarioDifference(
                metric=k, baseline=a[k], alternative=b[k], difference=round(b[k] - a[k], 6)
            )
            for k in METRICS
        ]
    return ScenarioComparison(
        start_turn=request.state.turn + 1,
        horizon=request.horizon,
        label="Simulation estimate",
        agent_mode="rules",
        branches=branches,
        differences=differences,
    )

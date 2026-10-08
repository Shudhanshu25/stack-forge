"""AI CEO advisor. Explains computed results; never changes them.

Failures (no LLM, timeout, invalid output, invented figures) produce advice marked
unavailable; they never fail a turn.
"""

import time

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from stackforge_shared.models.ai_advice_schema import AIAdvice
from stackforge_shared.models.enums_schema import AdviceMode, BusinessModel, Industry
from stackforge_shared.models.simulation_turn_schema import SimulationTurn
from stackforge_shared.models.startup_profile_schema import StartupProfile
from stackforge_shared.models.turn_summary_schema import TurnSummary

from app import prompts
from app.advisor.faithfulness import check
from app.agents.context import (
    competitors_view,
    decision_view,
    memory_view,
    percent,
    profile_view,
    rupees,
    state_view,
)
from app.config import Settings
from app.llm.budget import TokenMeter
from app.llm.client import LLMClient, LLMError


class AdvisorResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    summary: str
    positive_factors: list[str] = Field(alias="positiveFactors")
    negative_factors: list[str] = Field(alias="negativeFactors")
    key_risk: str = Field(alias="keyRisk")
    key_opportunity: str = Field(alias="keyOpportunity")
    recommendation: str
    reasoning: str
    confidence: float


DEFAULT_QUESTIONS = {
    AdviceMode.explain: "Why did my results change this month?",
    AdviceMode.analyze: "What caused this month's performance?",
    AdviceMode.scenario: "What should I consider before my next decisions?",
}

TASKS = {
    AdviceMode.explain: "EXPLAIN: answer the founder's why-question about this month, tracing "
    "the answer to specific decisions, events, competitor moves and customer reactions.",
    AdviceMode.analyze: "ANALYZE: review this month's performance and identify what drove it.",
    AdviceMode.scenario: "SCENARIO: the founder is weighing a possible decision. Lay out what "
    "to consider and the likely direction of effects, using the current data. Do not "
    "estimate new figures.",
}

MAX_QUESTION = 500  # the API schema's limit; enforced again here

MAX_ITEMS = 4
MAX_TEXT = 1200


def advisor_context(
    turn: SimulationTurn,
    history: list[TurnSummary],
    industry: Industry,
    business_model: BusinessModel,
) -> dict:
    """Everything the advisor may cite: previous and new state, decisions, events, forecast,
    competitor moves, agent reasoning and recent history, with the main changes precomputed
    (so the advisor never needs to calculate)."""
    before, after = turn.state_before, turn.state_after
    view = {"industry": industry.value, "businessModel": business_model.value}
    forecast = turn.forecast
    names = {c.id: c.name for c in after.competitors}
    return {
        "turn": turn.turn_number,
        "previousState": {**view, **state_view(before)},
        "newState": {**view, **state_view(after)},
        "changes": {
            "revenueRupees": rupees(after.revenue - before.revenue),
            "profitRupees": rupees(after.profit - before.profit),
            "cashRupees": rupees(after.cash - before.cash),
            "customers": after.customers - before.customers,
            "customerSatisfactionPoints": round(
                percent(after.customer_satisfaction) - percent(before.customer_satisfaction), 2
            ),
            "brandAwarenessPoints": round(
                percent(after.brand_awareness) - percent(before.brand_awareness), 2
            ),
        },
        "decisions": decision_view(turn.decisions, before),
        "eventsStarted": [
            {"type": e.type.value, "title": e.title, "description": e.description}
            for e in turn.events
        ],
        "activeEvents": [
            {"title": a.event.title, "turnsLeft": a.remaining_turns} for a in after.active_events
        ],
        "competitors": competitors_view(after),
        "competitorActions": [
            {
                "competitor": names.get(a.competitor_id, a.competitor_id),
                "action": a.action.value,
                "reason": a.reason,
            }
            for a in turn.competitor_actions
            if a.action.value != "NONE"
        ],
        "customerReaction": turn.agent_effects.customer.reasoning_summary,
        "competitorView": turn.agent_effects.competitor.reasoning_summary,
        "forecastNextTurn": (
            {
                "turn": forecast.target_turn,
                "revenueRupees": rupees(forecast.revenue or 0),
                "customers": forecast.customers,
                "monthlyChurnPercent": percent(forecast.churn_rate or 0),
                "note": "ML estimate assuming decisions stay the same",
            }
            if forecast and forecast.available
            else {"available": False}
        ),
        "recentTurns": memory_view(history),
    }


def unavailable(mode: AdviceMode, question: str | None, reason: str) -> AIAdvice:
    return AIAdvice(
        available=False,
        mode=mode,
        question=question,
        summary="",
        positive_factors=[],
        negative_factors=[],
        key_risk="",
        key_opportunity="",
        recommendation="",
        reasoning="",
        confidence=0.0,
        unavailable_reason=reason[:300],
    )


def _texts(advice: AdvisorResponse) -> list[str]:
    return [
        advice.summary,
        *advice.positive_factors,
        *advice.negative_factors,
        advice.key_risk,
        advice.key_opportunity,
        advice.recommendation,
        advice.reasoning,
    ]


def advisor_prompt(
    mode: AdviceMode, question: str | None, profile: StartupProfile | None, context: dict
) -> str:
    """The user message for the advisor: the task, then the question, the founder's profile
    and the computed data as one <data> block."""
    data = {
        "founderQuestion": (question or DEFAULT_QUESTIONS[mode])[:MAX_QUESTION],
        "startup": profile_view(profile),
        "simulation": context,
    }
    return f"Task: {TASKS[mode]}\n\n" + prompts.data_block(data)


def advise(
    llm: LLMClient | None,
    settings: Settings,
    *,
    mode: AdviceMode,
    question: str | None,
    turn: SimulationTurn,
    history: list[TurnSummary],
    industry: Industry,
    business_model: BusinessModel,
    profile: StartupProfile | None = None,
    meter: TokenMeter | None = None,
) -> AIAdvice:
    """The AI CEO's reading of a turn, or advice marked unavailable with the reason.

    The founder's question and startup profile reach the model only inside the <data> block.
    Figures in the answer are checked against the computed data alone, never against founder
    text, so a question cannot smuggle in a figure for the advisor to repeat.
    """
    meter = meter or TokenMeter(budget=None)
    prompt_spec = prompts.load("advisor")
    first_call = len(meter.calls)

    def finish(advice: AIAdvice) -> AIAdvice:
        return advice.model_copy(
            update={
                "prompt_version": prompt_spec.version,
                "llm_calls": meter.calls[first_call:],
            }
        )

    if llm is None:
        return finish(unavailable(mode, question, "LLM not configured"))
    if meter.daily_quota_exhausted:
        return finish(
            unavailable(mode, question, "Daily AI quota reached; it resets at midnight UTC")
        )
    context = advisor_context(turn, history, industry, business_model)
    prompt = advisor_prompt(mode, question, profile, context)
    feedback = ""
    cited = ""
    for _ in range(2):  # one retry if the advice cites figures not in the data
        if not meter.allows_call():
            return finish(unavailable(mode, question, "Token budget for this turn is spent"))
        usage: dict[str, int] = {}
        started = time.perf_counter()

        def record(outcome: str, usage=usage, started=started) -> None:
            meter.record(
                purpose="advisor",
                model=settings.llm_advisor_model,
                prompt_version=prompt_spec.version,
                usage=usage,
                outcome=outcome,
                latency_ms=(time.perf_counter() - started) * 1000,
            )

        try:
            raw = llm.generate_json(
                purpose="advisor",
                model=settings.llm_advisor_model,
                system=prompt_spec.system,
                prompt=prompt + feedback,
                response_schema=AdvisorResponse,
                timeout_s=settings.llm_timeout_s,
                temperature=0.3,
                on_usage=usage.update,
            )
            advice = AdvisorResponse.model_validate(raw)
        except LLMError as exc:
            record(exc.kind)
            return finish(unavailable(mode, question, f"{exc.kind}: {exc}"))
        except ValidationError as exc:
            record("invalid_output")
            return finish(unavailable(mode, question, f"invalid_output: {exc.errors()[0]['msg']}"))
        if not 0 <= advice.confidence <= 1:
            record("invalid_output")
            return finish(unavailable(mode, question, "invalid_output: confidence outside [0, 1]"))

        report = check(_texts(advice), context)
        if not report.unsupported:
            record("ok")
            return finish(
                AIAdvice(
                    available=True,
                    mode=mode,
                    question=question,
                    summary=advice.summary[:MAX_TEXT],
                    positive_factors=[f[:300] for f in advice.positive_factors[:MAX_ITEMS]],
                    negative_factors=[f[:300] for f in advice.negative_factors[:MAX_ITEMS]],
                    key_risk=advice.key_risk[:MAX_TEXT],
                    key_opportunity=advice.key_opportunity[:MAX_TEXT],
                    recommendation=advice.recommendation[:MAX_TEXT],
                    reasoning=advice.reasoning[:MAX_TEXT],
                    confidence=round(advice.confidence, 3),
                    model_version=settings.llm_advisor_model,
                )
            )
        record("unsupported_figures")
        cited = ", ".join(c.text for c in report.unsupported[:10])
        feedback = (
            f"\n\nYour previous answer cited figures that are not in the data: {cited}. "
            "Rewrite it using only figures that appear in the data."
        )
    return finish(unavailable(mode, question, f"unsupported_figures: {cited}"))

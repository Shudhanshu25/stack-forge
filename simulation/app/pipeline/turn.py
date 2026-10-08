"""The turn pipeline, built with LangGraph.

    state validator -> customer agent -> competitor agent -> event generator
    -> simulation core -> forecast engine -> AI CEO

Each node is reported as a stage the moment it finishes. Python calculates, LLMs interpret:
the agents only produce bounded, validated modifiers (falling back to rules on any failure);
the engine computes every number; the forecast and the advice are attached to the record but
never feed back into state. The caller (the Node worker) reports COMPLETE once the record is
stored.
"""

import logging
import time
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from itertools import pairwise
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from opentelemetry import context as otel_context
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
from stackforge_shared.models.ai_advice_schema import AIAdvice
from stackforge_shared.models.enums_schema import AdviceMode, AgentMode, PipelineStage
from stackforge_shared.models.forecast_schema import Forecast
from stackforge_shared.models.pipeline_event_schema import PipelineError, PipelineEvent, Type
from stackforge_shared.models.pipeline_turn_request_schema import PipelineTurnRequest
from stackforge_shared.models.simulation_turn_schema import (
    PromptVersions,
    SimulationTurn,
    TurnLlmUsage,
)

import engines
from app.advisor.advisor import advise, unavailable
from app.agents.agents import COMPETITOR, CUSTOMER, run_agent
from app.agents.context import agent_context
from app.config import Settings
from app.llm.budget import TokenMeter
from app.llm.cache import AgentCache
from app.llm.client import LLMClient
from app.observability import FORECAST_DURATION, timed_stage, tracer
from engine.models import AgentEffects, AgentOutput, DecisionStatus, MarketEvent
from ml.forecast import forecast

logger = logging.getLogger("app.pipeline")


class StageError(Exception):
    def __init__(self, code: str, message: str, details: object = None) -> None:
        super().__init__(message)
        self.code, self.message, self.details = code, message, details


@dataclass(frozen=True)
class PipelineDeps:
    settings: Settings
    llm: LLMClient | None
    cache: AgentCache | None = None


class TurnState(TypedDict, total=False):
    request: PipelineTurnRequest
    rules: AgentEffects
    customer: AgentOutput
    competitor: AgentOutput
    events: list[MarketEvent]
    record: SimulationTurn
    forecast: Forecast
    advice: AIAdvice


NODE_STAGES = {
    "state_validator": PipelineStage.processing_decision,
    "customer_agent": PipelineStage.analyzing_customers,
    "competitor_agent": PipelineStage.analyzing_competitors,
    "event_generator": PipelineStage.applying_market_event,
    "simulation_core": PipelineStage.updating_financial_model,
    "forecast_engine": PipelineStage.generating_forecast,
    "ai_ceo": PipelineStage.ai_ceo_analysis,
}


def build_graph(
    deps: PipelineDeps,
    parent: Callable[[], otel_context.Context | None] = lambda: None,
    meter: TokenMeter | None = None,
):
    """The seven-stage graph. Each node runs in a span under `parent()` and is timed."""
    settings, llm = deps.settings, deps.llm
    meter = meter or TokenMeter(budget=None)

    def state_validator(state: TurnState) -> TurnState:
        req = state["request"]
        try:
            eng = engines.get_engine(req.engine_version)
        except engines.UnsupportedEngineVersionError as exc:
            raise StageError(
                "ENGINE_VERSION_UNSUPPORTED", str(exc), {"version": exc.version}
            ) from exc
        if req.state.cash < 0:
            raise StageError("SIMULATION_BANKRUPT", "The startup is bankrupt")
        if req.turn_number != req.state.turn + 1:
            raise StageError(
                "TURN_OUT_OF_ORDER", f"Expected turn {req.state.turn + 1}, got {req.turn_number}"
            )
        results = eng.validate_decisions(req.state, req.decisions, req.configuration)
        rejected = [r for r in results if r.status == DecisionStatus.rejected]
        if rejected:
            raise StageError(
                "DECISIONS_REJECTED",
                "One or more decisions were rejected",
                [r.rejection.model_dump() for r in rejected],
            )
        rules = eng.rule_based_agent_effects(req.state, req.decisions, req.configuration)
        return {"rules": rules}

    def _agent(state: TurnState, spec, rules: AgentOutput) -> AgentOutput:
        # Rules mode, or the user's daily token quota is used up (the turn then runs in rules
        # mode and its llmUsage says why).
        if state["request"].agent_mode == AgentMode.rules or meter.daily_quota_exhausted:
            return rules
        context = agent_context(state["request"])
        return run_agent(spec, llm, settings, context, rules, meter, deps.cache)

    def customer_agent(state: TurnState) -> TurnState:
        return {"customer": _agent(state, CUSTOMER, state["rules"].customer)}

    def competitor_agent(state: TurnState) -> TurnState:
        return {"competitor": _agent(state, COMPETITOR, state["rules"].competitor)}

    def event_generator(state: TurnState) -> TurnState:
        req = state["request"]
        return {
            "events": engines.get_engine(req.engine_version).turn_events(
                req.state, req.configuration, req.seed, req.turn_number
            )
        }

    def simulation_core(state: TurnState) -> TurnState:
        req = state["request"]
        mode = AgentMode.rules if meter.daily_quota_exhausted else req.agent_mode
        effects = AgentEffects(
            mode=mode, customer=state["customer"], competitor=state["competitor"]
        )
        record = engines.get_engine(req.engine_version).run_turn(
            req.state, req.decisions, req.configuration, req.seed, req.turn_number, effects
        )
        if [e.type for e in record.events] != [e.type for e in state["events"]]:
            raise StageError("INTERNAL_ERROR", "Event generator and simulation core disagree")
        return {"record": record}

    def forecast_engine(state: TurnState) -> TurnState:
        req = state["request"]
        started = time.perf_counter()
        result = forecast(
            state["record"].state_after, req.configuration.industry, settings.forecast_model_dir
        )
        FORECAST_DURATION.labels(str(result.available).lower()).observe(
            time.perf_counter() - started
        )
        return {"forecast": result}

    def ai_ceo(state: TurnState) -> TurnState:
        req = state["request"]
        record = state["record"].model_copy(update={"forecast": state["forecast"]})
        if not settings.advisor_on_turn:
            return {"advice": unavailable(AdviceMode.analyze, None, "Advisor disabled")}
        return {
            "advice": advise(
                llm,
                settings,
                mode=AdviceMode.analyze,
                question=None,
                turn=record,
                history=req.memory or [],
                industry=req.configuration.industry,
                business_model=req.configuration.business_model,
                profile=req.startup_profile,
                meter=meter,
            )
        }

    graph = StateGraph(TurnState)
    nodes = [state_validator, customer_agent, competitor_agent, event_generator,
             simulation_core, forecast_engine, ai_ceo]  # fmt: skip
    for node in nodes:
        graph.add_node(node.__name__, timed_stage(node.__name__, node, parent))
    graph.add_edge(START, nodes[0].__name__)
    for a, b in pairwise(nodes):
        graph.add_edge(a.__name__, b.__name__)
    graph.add_edge(nodes[-1].__name__, END)
    return graph.compile()


def run_pipeline(
    request: PipelineTurnRequest,
    deps: PipelineDeps,
    parent: otel_context.Context | None = None,
) -> Iterator[PipelineEvent]:
    """Yields a stage event as each node finishes, then one result or error event.

    `parent` is the caller's trace context: the generator is consumed on other threads, so the
    pipeline span and its stage spans are parented explicitly rather than through "current".
    """
    span = tracer.start_span(
        "pipeline.turn",
        context=parent,
        attributes={
            "stackforge.turn": request.turn_number,
            "stackforge.agent_mode": request.agent_mode.value,
            "stackforge.engine_version": request.engine_version or engines.CURRENT,
        },
    )
    pipeline_context = trace.set_span_in_context(span, parent)
    meter = TokenMeter.for_request(deps.settings.llm_turn_token_budget, request.token_allowance)
    graph = build_graph(deps, lambda: pipeline_context, meter)
    state: TurnState = {"request": request}
    try:
        for index, update in enumerate(graph.stream(state, stream_mode="updates"), start=1):
            for node, changes in update.items():
                state.update(changes or {})
                # The final share of progress belongs to the caller storing the record.
                progress = round(95 * index / len(NODE_STAGES), 1)
                yield PipelineEvent(type=Type.stage, stage=NODE_STAGES[node], progress=progress)
        record = state["record"].model_copy(
            update={
                "forecast": state["forecast"],
                "advice": state["advice"],
                "llm_usage": usage_of(meter),
            }
        )
        yield PipelineEvent(type=Type.result, record=record)
    except StageError as exc:
        span.set_attribute("stackforge.error_code", exc.code)
        yield _error(exc.code, exc.message, exc.details)
    except Exception as exc:
        if type(exc).__name__ == "EngineInputError":  # any retained engine version
            span.set_attribute("stackforge.error_code", "ENGINE_INPUT_ERROR")
            yield _error("ENGINE_INPUT_ERROR", str(exc))
            return
        logger.exception("pipeline failed")
        span.record_exception(exc)
        span.set_status(Status(StatusCode.ERROR))
        yield _error("INTERNAL_ERROR", "The turn pipeline failed")
    finally:
        span.end()


def usage_of(meter: TokenMeter) -> TurnLlmUsage:
    """What the turn's LLM calls cost and which prompt versions produced them."""
    versions = {c.purpose: c.prompt_version for c in meter.calls}
    return TurnLlmUsage(
        prompt_versions=PromptVersions(
            customer_agent=versions.get("customer_agent"),
            competitor_agent=versions.get("competitor_agent"),
            advisor=versions.get("advisor"),
        ),
        calls=meter.calls,
        daily_quota_exhausted=meter.daily_quota_exhausted,
        turn_budget_exhausted=meter.budget_exhausted,
    )


def _error(code: str, message: str, details: object = None) -> PipelineEvent:
    return PipelineEvent(
        type=Type.error, error=PipelineError(code=code, message=message, details=details)
    )

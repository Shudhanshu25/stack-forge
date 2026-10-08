"""LLM customer and competitor agents.

LLM output is untrusted: it is parsed against a schema, range-checked, clamped to the
configured per-turn caps, and replaced by the rule-based output (marked rules_fallback, with
the reason) on any failure. The engine applies its own last-resort caps as well.
"""

import time
from dataclasses import dataclass

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app import prompts
from app.config import Settings
from app.llm.budget import TokenMeter
from app.llm.cache import AgentCache, cache_key
from app.llm.client import LLMClient, LLMError
from app.prompts import Prompt
from engine.models import AgentOutput, AgentSource

MAX_REASONING = 600


class _Camel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class CustomerAgentResponse(_Camel):
    sentiment_change: float = Field(alias="sentimentChange")
    demand_modifier: float = Field(alias="demandModifier")
    reasoning_summary: str = Field(alias="reasoningSummary")


class CompetitorAgentResponse(_Camel):
    competitor_threat: float = Field(alias="competitorThreat")
    demand_modifier: float = Field(alias="demandModifier")
    reasoning_summary: str = Field(alias="reasoningSummary")


@dataclass(frozen=True)
class AgentSpec:
    purpose: str  # also the prompt name: app/prompts/<purpose>/v<N>.md
    response: type[_Camel]

    @property
    def prompt(self) -> Prompt:
        return prompts.load(self.purpose)


CUSTOMER = AgentSpec("customer_agent", CustomerAgentResponse)
COMPETITOR = AgentSpec("competitor_agent", CompetitorAgentResponse)


class InvalidAgentOutputError(ValueError):
    pass


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def validate_output(spec: AgentSpec, raw: dict, settings: Settings) -> AgentOutput:
    """Schema validation, then range validation, then the configured per-turn caps."""
    try:
        parsed = spec.response.model_validate(raw)
    except ValidationError as exc:
        raise InvalidAgentOutputError(f"schema: {exc.errors()[0]['msg']}") from exc

    sentiment = getattr(parsed, "sentiment_change", 0.0)
    threat = getattr(parsed, "competitor_threat", 0.0)
    demand = parsed.demand_modifier
    for name, value, lo, hi in (
        ("sentimentChange", sentiment, -1.0, 1.0),
        ("demandModifier", demand, -1.0, 1.0),
        ("competitorThreat", threat, 0.0, 1.0),
    ):
        if value != value or not lo <= value <= hi:  # NaN or out of range
            raise InvalidAgentOutputError(f"{name} {value} outside [{lo}, {hi}]")
    reasoning = parsed.reasoning_summary.strip()
    if not reasoning:
        raise InvalidAgentOutputError("empty reasoningSummary")

    return AgentOutput(
        source=AgentSource.llm,
        sentiment_change=round(
            _clamp(sentiment, -settings.agent_sentiment_cap, settings.agent_sentiment_cap), 6
        ),
        demand_modifier=round(
            _clamp(demand, -settings.agent_demand_cap, settings.agent_demand_cap), 6
        ),
        competitor_threat=round(threat, 6),
        reasoning_summary=reasoning[:MAX_REASONING],
    )


def fallback(rules: AgentOutput, reason: str) -> AgentOutput:
    return rules.model_copy(
        update={"source": AgentSource.rules_fallback, "fallback_reason": reason[:300]}
    )


def agent_prompt(context: dict) -> str:
    """The user message for an agent: all input as one <data> block."""
    return "Simulation data for this month:\n" + prompts.data_block(context)


def run_agent(
    spec: AgentSpec,
    llm: LLMClient | None,
    settings: Settings,
    context: dict,
    rules: AgentOutput,
    meter: TokenMeter | None = None,
    cache: AgentCache | None = None,
) -> AgentOutput:
    """The LLM agent's validated output, or the rule-based output marked as a fallback.

    The context (including any founder-written text) goes into the prompt only as a <data>
    block; the instructions come from the versioned prompt file. A cached output for the same
    prompt version and input is reused without calling the provider.
    """
    meter = meter or TokenMeter(budget=None)
    if llm is None:
        return fallback(rules, "LLM not configured")
    if meter.daily_quota_exhausted:
        return fallback(rules, "daily_quota_exhausted: the daily AI token quota is used up")
    prompt_spec = spec.prompt
    model = settings.llm_agent_model
    prompt = agent_prompt(context)
    key = cache_key(prompt_spec.version, model, prompt_spec.system, prompt)

    if cache is not None and (hit := cache.get(key)) is not None:
        try:
            output = validate_output(spec, hit, settings)
        except InvalidAgentOutputError:
            output = None  # stale or corrupt entry: ask the model instead
        if output is not None:
            meter.record(
                purpose=spec.purpose,
                model=model,
                prompt_version=prompt_spec.version,
                usage=None,
                outcome="ok",
                cached=True,
            )
            return output.model_copy(update={"cached": True})

    if not meter.allows_call():
        return fallback(rules, "token_budget_exhausted: the turn's token budget is spent")

    usage: dict[str, int] = {}
    started = time.perf_counter()

    def record(outcome: str) -> None:
        meter.record(
            purpose=spec.purpose,
            model=model,
            prompt_version=prompt_spec.version,
            usage=usage,
            outcome=outcome,
            latency_ms=(time.perf_counter() - started) * 1000,
        )

    try:
        raw = llm.generate_json(
            purpose=spec.purpose,
            model=model,
            system=prompt_spec.system,
            prompt=prompt,
            response_schema=spec.response,
            timeout_s=settings.llm_timeout_s,
            on_usage=usage.update,
        )
        output = validate_output(spec, raw, settings)
    except LLMError as exc:
        record(exc.kind)
        return fallback(rules, f"{exc.kind}: {exc}")
    except InvalidAgentOutputError as exc:
        record("invalid_output")
        return fallback(rules, f"invalid_output: {exc}")
    record("ok")
    if cache is not None:
        cache.set(key, raw)
    return output

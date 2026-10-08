"""The LangGraph pipeline with agents, forecast and advisor, using a fake LLM client."""

import json
from pathlib import Path

import pytest
from stackforge_shared.models.pipeline_turn_request_schema import PipelineTurnRequest
from stackforge_shared.models.turn_summary_schema import TurnSummary
from stackforge_shared.templates import build_configuration

import engine
from app.config import Settings
from app.llm.client import FakeLLMClient, LLMError
from app.pipeline.turn import PipelineDeps, run_pipeline
from engine.models import AgentSource

SEED = 77
GOOD_ADVICE = {
    "summary": "Revenue rose as customers grew.",
    "positiveFactors": ["More customers"],
    "negativeFactors": ["Still loss-making"],
    "keyRisk": "Cash runway",
    "keyOpportunity": "Word of mouth",
    "recommendation": "Keep marketing steady",
    "reasoning": "Marketing brought new customers while costs stayed flat.",
    "confidence": 0.7,
}


@pytest.fixture
def config():
    return build_configuration("SAAS")


def settings(tmp_path: Path, **overrides) -> Settings:
    return Settings(app_env="test", forecast_model_dir=tmp_path / "none", **overrides)


def fake(customer=None, competitor=None, advice=None) -> FakeLLMClient:
    return FakeLLMClient(
        responses={
            "customer_agent": [
                customer
                or {
                    "sentimentChange": 0.04,
                    "demandModifier": 0.03,
                    "reasoningSummary": "Customers like the steady price.",
                }
            ],
            "competitor_agent": [
                competitor
                or {
                    "competitorThreat": 0.6,
                    "demandModifier": -0.02,
                    "reasoningSummary": "Rivals notice the marketing push.",
                }
            ],
            "advisor": [advice or GOOD_ADVICE],
        }
    )


def request(config, state, turn=1, mode="llm", decisions=None, memory=None):
    return PipelineTurnRequest(
        state=state,
        decisions=decisions if decisions is not None else [],
        configuration=config,
        seed=SEED,
        turn_number=turn,
        agent_mode=mode,
        memory=memory or [],
    )


def run(req, deps):
    events = list(run_pipeline(req, deps))
    assert events[-1].type.value in ("result", "error")
    return events, events[-1]


def advice_that_cites(text: str) -> dict:
    return {**GOOD_ADVICE, "summary": text}


def test_llm_mode_uses_validated_agent_effects(config, tmp_path) -> None:
    state = engine.create_initial_state(config, SEED)
    events, result = run(request(config, state), PipelineDeps(settings(tmp_path), fake()))
    assert len(events) == 8
    effects = result.record.agent_effects
    assert effects.mode.value == "llm"
    assert effects.customer.source == AgentSource.llm
    assert effects.customer.sentiment_change == 0.04
    assert effects.competitor.competitor_threat == 0.6
    assert effects.competitor.reasoning_summary == "Rivals notice the marketing push."


def test_agent_values_are_clamped_to_the_configured_caps(config, tmp_path) -> None:
    state = engine.create_initial_state(config, SEED)
    llm = fake(customer={"sentimentChange": -0.9, "demandModifier": 0.8, "reasoningSummary": "x"})
    _, result = run(request(config, state), PipelineDeps(settings(tmp_path), llm))
    customer = result.record.agent_effects.customer
    assert customer.source == AgentSource.llm
    assert customer.sentiment_change == -0.1
    assert customer.demand_modifier == 0.15


@pytest.mark.parametrize(
    ("customer", "reason"),
    [
        ({"sentimentChange": 0.1, "demandModifier": 1.7, "reasoningSummary": "x"}, "outside"),
        ({"sentimentChange": 0.1, "reasoningSummary": "x"}, "schema"),
        ({"sentimentChange": 0.1, "demandModifier": 0.1, "reasoningSummary": " "}, "empty"),
        (LLMError("timeout", "deadline exceeded"), "timeout"),
        (LLMError("provider_error", "503"), "provider_error"),
    ],
)
def test_bad_agent_output_falls_back_to_rules_and_says_why(config, tmp_path, customer, reason):
    state = engine.create_initial_state(config, SEED)
    llm = fake(customer=customer)
    _, result = run(request(config, state), PipelineDeps(settings(tmp_path), llm))
    customer_out = result.record.agent_effects.customer
    rules = engine.rule_based_agent_effects(state, [], config).customer
    assert customer_out.source == AgentSource.rules_fallback
    assert reason in customer_out.fallback_reason
    assert customer_out.sentiment_change == rules.sentiment_change
    assert result.record.agent_effects.competitor.source == AgentSource.llm


def test_unreachable_llm_still_completes_the_turn_on_rules(config, tmp_path) -> None:
    state = engine.create_initial_state(config, SEED)
    down = FakeLLMClient(
        responses={
            p: [LLMError("timeout", "no answer")]
            for p in ("customer_agent", "competitor_agent", "advisor")
        }
    )
    events, result = run(request(config, state), PipelineDeps(settings(tmp_path), down))
    assert result.type.value == "result"
    assert [e.stage.value for e in events[:-1]][-1] == "AI_CEO_ANALYSIS"
    record = result.record
    assert record.agent_effects.customer.source == AgentSource.rules_fallback
    assert record.agent_effects.competitor.source == AgentSource.rules_fallback
    assert record.advice.available is False
    assert "timeout" in record.advice.unavailable_reason
    # The state is exactly what rules mode produces.
    rules = engine.run_turn(state, [], config, SEED, 1)
    assert record.state_after == rules.state_after


def test_without_an_llm_rules_mode_runs_every_stage(config, tmp_path) -> None:
    state = engine.create_initial_state(config, SEED)
    events, result = run(
        request(config, state, mode="rules"), PipelineDeps(settings(tmp_path), None)
    )
    assert len(events) == 8
    assert result.record.agent_effects.customer.source == AgentSource.rules
    assert result.record.advice.unavailable_reason == "LLM not configured"
    assert result.record.forecast.available is False


def test_llm_simulation_replays_exactly_from_stored_effects(config, tmp_path) -> None:
    llm = FakeLLMClient(
        responses={
            "customer_agent": [
                {
                    "sentimentChange": round(0.01 * i, 2),
                    "demandModifier": round(0.02 - 0.01 * i, 2),
                    "reasoningSummary": f"turn {i}",
                }
                for i in range(1, 7)
            ],
            "competitor_agent": [
                {
                    "competitorThreat": round(0.1 * i, 2),
                    "demandModifier": -0.01,
                    "reasoningSummary": f"threat {i}",
                }
                for i in range(1, 7)
            ],
            "advisor": [GOOD_ADVICE],
        }
    )
    deps = PipelineDeps(settings(tmp_path), llm)
    initial = engine.create_initial_state(config, SEED)
    state, records = initial, []
    for turn in range(1, 7):
        decisions = [engine.models.Decision(type="MARKETING", value=5_000_000)] if turn == 1 else []
        _, result = run(request(config, state, turn, decisions=decisions), deps)
        records.append(result.record)
        state = result.record.state_after
    assert {r.agent_effects.customer.source for r in records} == {AgentSource.llm}
    # Rules-mode play with the same seed diverges, so the LLM effects mattered...
    rules_state = initial
    for r in records:
        rules_state = engine.run_turn(
            rules_state, r.decisions, config, SEED, r.turn_number
        ).state_after
    assert rules_state != records[-1].state_after
    # ...and replay with the stored effects (no LLM) reproduces every state, also through JSON.
    stored = [json.loads(r.model_dump_json(by_alias=True, exclude_none=True)) for r in records]
    from stackforge_shared.models.simulation_turn_schema import SimulationTurn

    restored = [SimulationTurn.model_validate(r) for r in stored]
    assert engine.replay_mismatches(initial, restored, SEED, config) == []
    calls_before = len(llm.calls)
    engine.replay(initial, restored, SEED, config)
    assert len(llm.calls) == calls_before


def test_agents_receive_structured_state_and_memory(config, tmp_path) -> None:
    state = engine.create_initial_state(config, SEED)
    memory = [
        TurnSummary(
            turn_number=1,
            decisions=[],
            revenue=100,
            profit=-5,
            cash=900,
            customers=3,
            new_customers=3,
            churned_customers=0,
            customer_satisfaction=0.6,
            market_share=0.0,
            events=["bad_review"],
        )
    ]
    state = state.model_copy(update={"turn": 1})
    llm = fake()
    run(request(config, state, turn=2, memory=memory), PipelineDeps(settings(tmp_path), llm))
    prompt = next(c for c in llm.calls if c["purpose"] == "customer_agent")["prompt"]
    data = json.loads(prompt.split("<data>\n", 1)[1].split("\n</data>", 1)[0])
    assert set(data) == {"startup", "market", "competitors", "decision", "recentTurns"}
    assert data["recentTurns"][0]["events"] == ["bad_review"]
    assert data["startup"]["cashRupees"] == state.cash // 100


def test_advice_with_invented_figures_is_retried_then_withheld(config, tmp_path) -> None:
    state = engine.create_initial_state(config, SEED)
    invented = advice_that_cites("Revenue will reach ₹9,87,654 next month.")
    llm = fake(advice=invented)
    _, result = run(request(config, state), PipelineDeps(settings(tmp_path), llm))
    advice = result.record.advice
    assert advice.available is False
    assert advice.unavailable_reason.startswith("unsupported_figures")
    assert len([c for c in llm.calls if c["purpose"] == "advisor"]) == 2
    assert "not in the data" in llm.calls[-1]["prompt"]


def test_advice_is_kept_when_the_retry_cites_only_input_figures(config, tmp_path) -> None:
    state = engine.create_initial_state(config, SEED)
    llm = FakeLLMClient(
        responses={
            **fake().responses,
            "advisor": [
                advice_that_cites("Profit was ₹4,32,10,987."),
                advice_that_cites("Cash is healthy."),
            ],
        }
    )
    _, result = run(request(config, state), PipelineDeps(settings(tmp_path), llm))
    assert result.record.advice.available is True
    assert result.record.advice.summary == "Cash is healthy."


class _Response:
    text = '{"reasoningSummary": "ok"}'


def _gemini_with(monkeypatch, outcomes):
    """A GeminiClient whose SDK call returns or raises each outcome in turn (no network)."""
    from app.llm import client as client_module

    monkeypatch.setattr(client_module, "SERVER_ERROR_BACKOFF_S", 0)
    gemini = client_module.GeminiClient("test-key")
    calls = []

    def generate_content(**_):
        calls.append(1)
        outcome = outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    monkeypatch.setattr(gemini._client.models, "generate_content", generate_content)
    return gemini, calls


def _ask(gemini):
    from pydantic import BaseModel

    class Out(BaseModel):
        reasoningSummary: str  # noqa: N815

    return gemini.generate_json(
        purpose="customer_agent",
        model="m",
        system="s",
        prompt="p",
        response_schema=Out,
        timeout_s=5,
    )


def test_gemini_retries_a_transient_server_error_once(monkeypatch) -> None:
    from google.genai import errors

    gemini, calls = _gemini_with(monkeypatch, [errors.ServerError(503, {}), _Response()])
    assert _ask(gemini) == {"reasoningSummary": "ok"}
    assert len(calls) == 2


def test_gemini_gives_up_after_one_retry_and_does_not_retry_client_errors(monkeypatch) -> None:
    from google.genai import errors

    gemini, calls = _gemini_with(
        monkeypatch, [errors.ServerError(503, {}), errors.ServerError(503, {})]
    )
    with pytest.raises(LLMError) as failed:
        _ask(gemini)
    assert failed.value.kind == "provider_error" and len(calls) == 2

    gemini, calls = _gemini_with(monkeypatch, [errors.ClientError(400, {})])
    with pytest.raises(LLMError):
        _ask(gemini)
    assert len(calls) == 1

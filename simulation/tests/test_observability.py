"""Metrics and tracing: route-template metrics, one trace per turn across the pipeline, LLM
call and token counters."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from prometheus_client import REGISTRY
from stackforge_shared.templates import build_configuration

import engine
from app.config import Settings
from app.main import create_app
from app.pipeline.turn import NODE_STAGES

EXPORTER = InMemorySpanExporter()


@pytest.fixture(scope="module", autouse=True)
def tracing():
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(EXPORTER))
    trace.set_tracer_provider(provider)
    yield
    provider.shutdown()


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    app = create_app(
        Settings(app_env="test", llm_provider="none", forecast_model_dir=tmp_path / "none"),
        llm=None,
    )
    return TestClient(app)


def turn_body() -> dict:
    config = build_configuration("SAAS")
    state = engine.create_initial_state(config, 5)
    return {
        "state": state.model_dump(mode="json", by_alias=True, exclude_none=True),
        "decisions": [{"type": "MARKETING", "value": 5_000_000}],
        "configuration": config.model_dump(mode="json", by_alias=True, exclude_none=True),
        "seed": 5,
        "turnNumber": 1,
        "agentMode": "rules",
        "memory": [],
    }


def test_metrics_use_route_templates(client: TestClient) -> None:
    client.post("/pipeline/turn", json=turn_body())
    text = client.get("/metrics").text
    assert 'http_requests_total{method="POST",route="/pipeline/turn",status="200"}' in text
    assert 'pipeline_stage_duration_seconds_count{stage="simulation_core"}' in text
    assert 'forecast_duration_seconds_count{available="false"}' in text


def test_a_turn_is_one_trace_continuing_the_callers_context(client: TestClient) -> None:
    EXPORTER.clear()
    trace_id = "4bf92f3577b34da6a3ce929d0e0e4736"
    events = client.post(
        "/pipeline/turn",
        json=turn_body(),
        headers={"traceparent": f"00-{trace_id}-00f067aa0ba902b7-01"},
    ).text.splitlines()
    assert json.loads(events[-1])["type"] == "result"

    spans = EXPORTER.get_finished_spans()
    names = {s.name for s in spans}
    stage_spans = {f"pipeline.{node}" for node in NODE_STAGES}
    assert stage_spans <= names and "pipeline.turn" in names
    # Every span (server, pipeline, stages) belongs to the caller's trace.
    assert {format(s.context.trace_id, "032x") for s in spans} == {trace_id}
    pipeline = next(s for s in spans if s.name == "pipeline.turn")
    for s in spans:
        if s.name in stage_spans:
            assert s.parent.span_id == pipeline.context.span_id


def test_llm_calls_and_tokens_are_counted(monkeypatch) -> None:
    from app.llm import client as client_module

    class Usage:
        prompt_token_count = 120
        candidates_token_count = 30

    class Response:
        text = '{"reasoningSummary": "ok"}'
        usage_metadata = Usage()

    gemini = client_module.GeminiClient("test-key")
    monkeypatch.setattr(gemini._client.models, "generate_content", lambda **_: Response())

    def sample(name: str, **labels) -> float:
        return REGISTRY.get_sample_value(name, labels) or 0.0

    before = sample("llm_tokens_total", purpose="customer_agent", model="m", kind="prompt")
    from pydantic import BaseModel

    class Out(BaseModel):
        reasoningSummary: str  # noqa: N815

    EXPORTER.clear()
    gemini.generate_json(
        purpose="customer_agent", model="m", system="s", prompt="p",
        response_schema=Out, timeout_s=5,
    )  # fmt: skip
    assert sample("llm_tokens_total", purpose="customer_agent", model="m", kind="prompt") == (
        before + 120
    )
    assert sample("llm_calls_total", purpose="customer_agent", model="m", outcome="ok") >= 1
    span = next(s for s in EXPORTER.get_finished_spans() if s.name == "llm.generate")
    assert span.attributes["gen_ai.usage.output_tokens"] == 30

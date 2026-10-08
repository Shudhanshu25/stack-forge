"""Metrics (Prometheus), tracing (OpenTelemetry) and error tracking (Sentry) for the service.

Tracing and Sentry are off unless configured (OTEL_EXPORTER_OTLP_ENDPOINT, SENTRY_DSN), so tests
and local runs need nothing. Nothing here is imported by the pure engine.
"""

import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager

from fastapi import Response
from opentelemetry import context as otel_context
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from starlette.requests import Request

SECONDS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30)

HTTP_REQUESTS = Counter(
    "http_requests_total",
    "HTTP requests by route template and status",
    ["method", "route", "status"],
)
HTTP_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency by route template",
    ["method", "route", "status"],
    buckets=SECONDS,
)
STAGE_DURATION = Histogram(
    "pipeline_stage_duration_seconds",
    "Turn pipeline stage duration",
    ["stage"],
    buckets=SECONDS,
)
LLM_CALLS = Counter(
    "llm_calls_total", "LLM calls by purpose, model and outcome", ["purpose", "model", "outcome"]
)
LLM_TOKENS = Counter(
    "llm_tokens_total", "LLM tokens by purpose, model and kind", ["purpose", "model", "kind"]
)
LLM_DURATION = Histogram(
    "llm_request_duration_seconds",
    "LLM call latency",
    ["purpose", "model"],
    buckets=(0.1, 0.25, 0.5, 1, 2, 4, 8, 15, 30, 60),
)
FORECAST_DURATION = Histogram(
    "forecast_duration_seconds",
    "Forecast latency, by whether a forecast was available",
    ["available"],
    buckets=SECONDS,
)

tracer = trace.get_tracer("stackforge.simulation")


def route_of(request: Request) -> str:
    route = request.scope.get("route")
    return getattr(route, "path", None) or "unmatched"


def observe_request(request: Request, status: int, seconds: float) -> None:
    labels = {"method": request.method, "route": route_of(request), "status": str(status)}
    HTTP_REQUESTS.labels(**labels).inc()
    HTTP_DURATION.labels(**labels).observe(seconds)


def metrics_endpoint() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


def record_llm_call(
    purpose: str, model: str, outcome: str, seconds: float, usage: dict[str, int] | None
) -> None:
    LLM_CALLS.labels(purpose, model, outcome).inc()
    LLM_DURATION.labels(purpose, model).observe(seconds)
    for kind, count in (usage or {}).items():
        if count:
            LLM_TOKENS.labels(purpose, model, kind).inc(count)


@contextmanager
def stage(name: str, parent: otel_context.Context | None) -> Iterator[trace.Span]:
    """A pipeline stage: a child span of the pipeline span and a duration observation."""
    started = time.perf_counter()
    with tracer.start_as_current_span(f"pipeline.{name}", context=parent) as span:
        try:
            yield span
        except Exception as exc:
            span.record_exception(exc)
            span.set_status(Status(StatusCode.ERROR))
            raise
        finally:
            STAGE_DURATION.labels(name).observe(time.perf_counter() - started)


def timed_stage(name: str, fn: Callable, parent: Callable[[], otel_context.Context | None]):
    """Wraps a LangGraph node so it runs inside `stage`."""

    def node(state):
        with stage(name, parent()):
            return fn(state)

    node.__name__ = name
    return node


# FastAPI creates the server spans itself (native telemetry), continuing an incoming
# traceparent. We own the exporter, so FastAPI's own environment export stays off (otherwise
# every span would be exported twice), and Prometheus covers metrics.
FASTAPI_TELEMETRY = {
    "auto_configure": False,
    "metrics": False,
    "logs": False,
    "operation_spans": False,
    "exclude": lambda scope: scope.get("path") in ("/health", "/metrics"),
}

_tracing_provider = None


def init_tracing(endpoint: str, service_name: str = "stackforge-simulation") -> bool:
    """Exports spans over OTLP/HTTP. The provider is process-wide and set up once."""
    global _tracing_provider
    if not endpoint:
        return False
    if _tracing_provider is None:
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        _tracing_provider = TracerProvider(resource=Resource.create({"service.name": service_name}))
        _tracing_provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{endpoint.rstrip('/')}/v1/traces"))
        )
        trace.set_tracer_provider(_tracing_provider)
    return True


def init_sentry(dsn: str, environment: str, release: str | None) -> bool:
    if not dsn:
        return False
    import sentry_sdk

    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        release=release,
        traces_sample_rate=0,  # errors only; tracing is OpenTelemetry's job
        send_default_pii=False,
    )
    sentry_sdk.set_tag("service", "simulation")
    return True


def tag_request(request_id: str) -> None:
    """Attaches the request id to any error Sentry reports for this request."""
    try:
        import sentry_sdk

        sentry_sdk.get_isolation_scope().set_tag("requestId", request_id)
    except ImportError:  # pragma: no cover - sentry-sdk is a dependency
        pass

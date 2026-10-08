from fastapi import FastAPI

from app.config import Settings, get_settings
from app.errors import register_error_handlers
from app.llm.cache import create_agent_cache
from app.llm.client import LLMClient, create_llm_client
from app.logging import configure_logging
from app.middleware import RequestContextMiddleware
from app.observability import FASTAPI_TELEMETRY, init_sentry, init_tracing, metrics_endpoint
from app.pipeline.turn import PipelineDeps
from app.routes import advisor as advisor_routes
from app.routes import analytics as analytics_routes
from app.routes import engine as engine_routes
from app.routes import health
from app.routes import locations as location_routes
from engine import ENGINE_VERSION

_UNSET = object()


def create_app(
    settings: Settings | None = None, llm: LLMClient | object | None = _UNSET
) -> FastAPI:
    """Builds the app. Tests pass `llm` (a fake client, or None for no LLM)."""
    settings = settings or get_settings()
    if settings.app_env == "production" and settings.llm_provider == "stub":
        raise RuntimeError("LLM_PROVIDER=stub is for tests and cannot run in production")
    if llm is _UNSET:
        llm = create_llm_client(settings.llm_provider, settings.llm_api_key)
    configure_logging(settings.log_level)
    init_sentry(settings.sentry_dsn, settings.app_env, settings.release_sha)
    init_tracing(settings.otel_exporter_otlp_endpoint)
    app = FastAPI(
        title="Stack Forge simulation service",
        version=ENGINE_VERSION,
        docs_url=None if settings.app_env == "production" else "/docs",
        redoc_url=None,
        telemetry=FASTAPI_TELEMETRY,
    )
    app.add_middleware(RequestContextMiddleware, max_request_bytes=settings.max_request_bytes)
    register_error_handlers(app)
    app.include_router(health.router)
    app.include_router(engine_routes.router)
    app.include_router(advisor_routes.router)
    app.include_router(analytics_routes.router)
    app.include_router(location_routes.router)
    app.state.pipeline_deps = PipelineDeps(
        settings=settings,
        llm=llm,  # type: ignore[arg-type]
        cache=create_agent_cache(settings.redis_url, settings.agent_cache_ttl_s),
    )
    # Prometheus scrape endpoint (internal network only).
    app.add_api_route("/metrics", metrics_endpoint, include_in_schema=False)
    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    s = get_settings()
    # Serve the app built above; passing "app.main:app" would import (and build) it again.
    uvicorn.run(app, host=s.host, port=s.port, log_config=None)

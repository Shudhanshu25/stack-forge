from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from ml.forecast import DEFAULT_ARTIFACTS


class Settings(BaseSettings):
    """Configuration from environment variables (and simulation/.env in development)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    host: str = "127.0.0.1"
    port: int = 8000
    log_level: str = "INFO"
    max_request_bytes: int = 10_000_000  # replay requests carry every turn record

    # LLM (Google Gemini). Without a key, agents fall back to rules and advice is unavailable.
    llm_provider: Literal["gemini", "stub", "none"] = "gemini"  # stub: tests only
    llm_api_key: str = Field(default="", repr=False)
    llm_agent_model: str = "gemini-3.5-flash-lite"
    llm_advisor_model: str = "gemini-3.8-flash"
    llm_timeout_s: float = 10.0

    # Per-turn caps on agent effects. Values outside the schema range ([-1, 1], threat
    # [0, 1]) are rejected; values inside it are clamped to these caps.
    agent_demand_cap: float = 0.15
    agent_sentiment_cap: float = 0.1

    advisor_on_turn: bool = True  # run the AI CEO in every turn's pipeline

    # Cost controls: tokens one turn may spend across agents and the AI CEO (0 = no limit), and
    # the agent cache (Redis; off when empty) and how long entries live.
    llm_turn_token_budget: int = 12_000
    redis_url: str = ""
    agent_cache_ttl_s: int = 7 * 24 * 3600

    # Observability (off when empty)
    otel_exporter_otlp_endpoint: str = ""  # e.g. http://tempo:4318
    sentry_dsn: str = Field(default="", repr=False)
    release_sha: str | None = None
    forecast_model_dir: Path = DEFAULT_ARTIFACTS


@lru_cache
def get_settings() -> Settings:
    return Settings()

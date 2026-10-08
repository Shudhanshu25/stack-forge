"""Cache of validated agent outputs, keyed by a hash of the prompt version, model and input.

The same prompt version given the same input (state, decisions, memory, profile) returns the
cached output instead of calling the provider again. Hits are recorded in the turn like any
other agent effect (with `cached: true`, no tokens). The cache fails open: if Redis is down,
the agent simply calls the LLM.
"""

import hashlib
import json
import logging
from typing import Protocol

logger = logging.getLogger("app.llm.cache")


def cache_key(prompt_version: str, model: str, system: str, prompt: str) -> str:
    digest = hashlib.sha256(
        "\n\x00".join((prompt_version, model, system, prompt)).encode("utf-8")
    ).hexdigest()
    return f"stackforge:agent:{digest}"


class AgentCache(Protocol):
    def get(self, key: str) -> dict | None: ...

    def set(self, key: str, value: dict) -> None: ...


class MemoryAgentCache:
    """In-process cache for tests and single-process runs."""

    def __init__(self) -> None:
        self.data: dict[str, str] = {}

    def get(self, key: str) -> dict | None:
        raw = self.data.get(key)
        return json.loads(raw) if raw else None

    def set(self, key: str, value: dict) -> None:
        self.data[key] = json.dumps(value)


class RedisAgentCache:
    def __init__(self, url: str, ttl_s: int) -> None:
        import redis  # only needed when a cache is configured

        self._redis = redis.Redis.from_url(url, socket_timeout=0.5, socket_connect_timeout=0.5)
        self._ttl_s = ttl_s

    def get(self, key: str) -> dict | None:
        try:
            raw = self._redis.get(key)
        except Exception as exc:  # fail open
            logger.warning("agent cache read failed", extra={"fields": {"error": str(exc)}})
            return None
        return json.loads(raw) if raw else None

    def set(self, key: str, value: dict) -> None:
        try:
            self._redis.set(key, json.dumps(value), ex=self._ttl_s)
        except Exception as exc:
            logger.warning("agent cache write failed", extra={"fields": {"error": str(exc)}})


def create_agent_cache(url: str, ttl_s: int) -> AgentCache | None:
    return RedisAgentCache(url, ttl_s) if url else None

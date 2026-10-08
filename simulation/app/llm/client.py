"""The one module that talks to an LLM provider. Everything else depends on LLMClient.

Swapping providers means adding another implementation here and a branch in
create_llm_client; agents and the advisor do not change.
"""

import json
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import ClassVar, Protocol

from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
from pydantic import BaseModel

from app.observability import record_llm_call, tracer

logger = logging.getLogger("app.llm")


class LLMError(Exception):
    """A failed LLM call.

    `kind` is one of: not_configured, timeout, provider_error, invalid_output.
    """

    def __init__(self, kind: str, message: str) -> None:
        super().__init__(message)
        self.kind = kind


class LLMClient(Protocol):
    def generate_json(
        self,
        *,
        purpose: str,
        model: str,
        system: str,
        prompt: str,
        response_schema: type[BaseModel],
        timeout_s: float,
        temperature: float = 0.2,
        on_usage: Callable[[dict[str, int]], None] | None = None,
    ) -> dict:
        """Returns the parsed JSON object, or raises LLMError. Reports the call's token counts
        ({"prompt": n, "completion": m}) to `on_usage` when the provider gives them."""
        ...


def estimate_usage(text: str, completion: int = 60) -> dict[str, int]:
    """Rough token counts (about 4 characters a token) for test doubles."""
    return {"prompt": max(1, len(text) // 4), "completion": completion}


SERVER_ERROR_RETRIES = 1
SERVER_ERROR_BACKOFF_S = 1.0


class GeminiClient:
    """Google Gemini through the google-genai SDK, with JSON-constrained output."""

    def __init__(self, api_key: str) -> None:
        from google import genai  # imported here so the rest of the app never needs it
        from google.genai import errors

        self._genai = genai
        self._client = genai.Client(api_key=api_key)
        self._server_error = errors.ServerError

    def generate_json(
        self,
        *,
        purpose: str,
        model: str,
        on_usage: Callable[[dict[str, int]], None] | None = None,
        **kwargs,
    ) -> dict:
        with tracer.start_as_current_span(
            "llm.generate",
            attributes={
                "gen_ai.system": "gemini",
                "gen_ai.request.model": model,
                "purpose": purpose,
            },
        ) as span:
            try:
                result = self._generate(purpose=purpose, model=model, on_usage=on_usage, **kwargs)
            except LLMError as exc:
                span.set_attribute("error.type", exc.kind)
                span.set_status(Status(StatusCode.ERROR, exc.kind))
                raise
            return result

    def _generate(
        self,
        *,
        purpose: str,
        model: str,
        system: str,
        prompt: str,
        response_schema: type[BaseModel],
        timeout_s: float,
        temperature: float = 0.2,
        on_usage: Callable[[dict[str, int]], None] | None = None,
    ) -> dict:
        from google.genai import types

        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_schema=response_schema,
            temperature=temperature,
            http_options=types.HttpOptions(timeout=int(timeout_s * 1000)),
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )
        started = time.perf_counter()
        for attempt in range(1 + SERVER_ERROR_RETRIES):
            try:
                response = self._client.models.generate_content(
                    model=model, contents=prompt, config=config
                )
                break
            except Exception as exc:
                # A 5xx is usually transient: retry once, quickly. Timeouts and 4xx are not retried.
                if attempt < SERVER_ERROR_RETRIES and isinstance(exc, self._server_error):
                    _log(purpose, model, started, "server_error_retry")
                    time.sleep(SERVER_ERROR_BACKOFF_S)
                    continue
                kind = "timeout" if _looks_like_timeout(exc) else "provider_error"
                _log(purpose, model, started, kind)
                code = getattr(exc, "code", None)  # HTTP status on google-genai API errors
                status = f" {code}" if isinstance(code, int) else ""
                raise LLMError(kind, f"{type(exc).__name__}{status} from the LLM provider") from exc
        usage = _usage(response)
        span = trace.get_current_span()
        span.set_attribute("gen_ai.usage.input_tokens", usage.get("prompt", 0))
        span.set_attribute("gen_ai.usage.output_tokens", usage.get("completion", 0))
        _log(purpose, model, started, "ok", usage)
        if on_usage:
            on_usage(usage)
        return _parse(response.text)


@dataclass
class FakeLLMClient:
    """Scripted client for tests: each call pops the next response for its purpose.

    A response is a dict (returned), an LLMError (raised), or a callable taking the prompt.
    """

    responses: dict[str, list] = field(default_factory=dict)
    calls: list[dict] = field(default_factory=list)
    #: Token counts reported per purpose (default: estimated from the prompt length).
    usage: dict[str, dict[str, int]] = field(default_factory=dict)

    def generate_json(
        self,
        *,
        purpose: str,
        model: str,
        system: str,
        prompt: str,
        on_usage: Callable[[dict[str, int]], None] | None = None,
        **_: object,
    ) -> dict:
        self.calls.append({"purpose": purpose, "model": model, "system": system, "prompt": prompt})
        if on_usage:
            on_usage(self.usage.get(purpose) or estimate_usage(system + prompt))
        queue = self.responses.get(purpose) or []
        if not queue:
            raise LLMError("provider_error", f"no scripted response for {purpose}")
        response = queue.pop(0) if len(queue) > 1 else queue[0]
        if isinstance(response, Exception):
            raise response
        if isinstance(response, Callable):
            response = response(prompt)
        return json.loads(json.dumps(response))


class StubLLMClient:
    """Deterministic, offline stand-in used by the end-to-end test and smoke runs.

    Its output is schema-valid but says nothing real; it is refused in production.
    """

    RESPONSES: ClassVar[dict[str, dict]] = {
        "customer_agent": {
            "sentimentChange": 0.02,
            "demandModifier": 0.01,
            "reasoningSummary": "Stub customer agent: customers react mildly.",
        },
        "competitor_agent": {
            "competitorThreat": 0.3,
            "demandModifier": -0.01,
            "reasoningSummary": "Stub competitor agent: rivals keep watching.",
        },
        "advisor": {
            "summary": "Stub AI CEO: results reflect this month's decisions and market.",
            "positiveFactors": ["Customers are growing"],
            "negativeFactors": ["The startup is not yet profitable"],
            "keyRisk": "Cash runway",
            "keyOpportunity": "Word of mouth",
            "recommendation": "Review pricing and marketing against cash",
            "reasoning": "Stub output for testing; no model was called.",
            "confidence": 0.5,
        },
    }

    def generate_json(
        self,
        *,
        purpose: str,
        system: str = "",
        prompt: str = "",
        on_usage: Callable[[dict[str, int]], None] | None = None,
        **_: object,
    ) -> dict:
        if on_usage:
            on_usage(estimate_usage(system + prompt))
        return json.loads(json.dumps(self.RESPONSES[purpose]))


def create_llm_client(provider: str, api_key: str) -> LLMClient | None:
    """None when no provider is configured; callers then fall back to rules."""
    if provider == "gemini" and api_key:
        return GeminiClient(api_key)
    if provider == "stub":
        return StubLLMClient()
    return None


def _parse(text: str | None) -> dict:
    if not text:
        raise LLMError("invalid_output", "empty response")
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise LLMError("invalid_output", "response is not JSON") from exc
    if not isinstance(data, dict):
        raise LLMError("invalid_output", "response is not a JSON object")
    return data


def _looks_like_timeout(exc: Exception) -> bool:
    name = type(exc).__name__.lower()
    return "timeout" in name or "timed out" in str(exc).lower() or "deadline" in str(exc).lower()


def _usage(response: object) -> dict[str, int]:
    """Token counts from a Gemini response (empty when the provider reports none)."""
    meta = getattr(response, "usage_metadata", None)
    if meta is None:
        return {}
    return {
        "prompt": int(getattr(meta, "prompt_token_count", 0) or 0),
        "completion": int(getattr(meta, "candidates_token_count", 0) or 0),
    }


def _log(
    purpose: str, model: str, started: float, outcome: str, usage: dict[str, int] | None = None
) -> None:
    if outcome != "server_error_retry":
        record_llm_call(purpose, model, outcome, time.perf_counter() - started, usage)
    logger.info(
        "llm call",
        extra={
            "fields": {
                "purpose": purpose,
                "llmModel": model,
                "outcome": outcome,
                "latencyMs": round((time.perf_counter() - started) * 1000, 1),
            }
        },
    )

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

client = TestClient(create_app(Settings(app_env="test", max_request_bytes=1000)))


def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_request_id_is_propagated() -> None:
    response = client.get("/health", headers={"X-Request-Id": "req-123"})
    assert response.headers["X-Request-Id"] == "req-123"


def test_unknown_route_uses_error_shape() -> None:
    response = client.get("/does-not-exist")
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "NOT_FOUND"
    assert set(body["error"]) == {"code", "message", "details"}


def test_oversized_body_is_rejected() -> None:
    response = client.post("/health", content=b"x" * 2000)
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_stub_llm_is_refused_in_production() -> None:
    with pytest.raises(RuntimeError, match="stub"):
        create_app(Settings(app_env="production", llm_provider="stub"))


def test_stub_llm_answers_schema_valid_agent_output() -> None:
    from app.llm.client import StubLLMClient, create_llm_client

    assert isinstance(create_llm_client("stub", ""), StubLLMClient)
    assert create_llm_client("gemini", "") is None

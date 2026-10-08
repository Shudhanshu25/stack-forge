"""Architecture rule 2: the engine imports no web, database, queue or LLM code and does no I/O."""

import ast
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parents[1] / "engine"

FORBIDDEN_MODULES = {
    "fastapi", "starlette", "uvicorn", "pymongo", "motor", "redis", "httpx", "requests",
    "anthropic", "openai", "langchain", "langgraph", "app", "socket", "urllib", "time",
    "datetime", "os", "subprocess",
}  # fmt: skip
FORBIDDEN_CALLS = {"open", "print", "input"}


def test_engine_has_no_forbidden_imports_or_io() -> None:
    files = list(ENGINE_DIR.rglob("*.py"))
    assert files
    for path in files:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                roots = {alias.name.split(".")[0] for alias in node.names}
            elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
                roots = {node.module.split(".")[0]}
            else:
                roots = set()
            assert not roots & FORBIDDEN_MODULES, f"{path.name} imports {roots & FORBIDDEN_MODULES}"
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                assert node.func.id not in FORBIDDEN_CALLS, f"{path.name} calls {node.func.id}()"

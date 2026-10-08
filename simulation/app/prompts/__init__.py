"""Versioned prompts. Each prompt lives in app/prompts/<name>/v<N>.md (the system prompt).

The highest version is used unless pinned with an environment variable such as
PROMPT_VERSION_CUSTOMER_AGENT=1. A changed prompt is a new file, never an edit to an existing
one, so every turn and advice record's `promptVersion` (e.g. "customer_agent@v1") always
identifies the exact text that produced it.

User-supplied text is never part of a prompt file: callers wrap it with `data_block`.
"""

import json
import os
import re
from dataclasses import dataclass
from functools import cache
from pathlib import Path

PROMPTS_DIR = Path(__file__).resolve().parent
NAMES = ("customer_agent", "competitor_agent", "advisor")


@dataclass(frozen=True)
class Prompt:
    name: str
    number: int
    system: str

    @property
    def version(self) -> str:
        return f"{self.name}@v{self.number}"


def versions(name: str) -> list[int]:
    found = [
        int(m.group(1))
        for f in (PROMPTS_DIR / name).glob("v*.md")
        if (m := re.fullmatch(r"v(\d+)\.md", f.name))
    ]
    return sorted(found)


@cache
def load(name: str, number: int | None = None) -> Prompt:
    """The prompt `name` at `number`, the pinned version, or the latest."""
    if number is None:
        pinned = os.environ.get(f"PROMPT_VERSION_{name.upper()}")
        number = int(pinned) if pinned else versions(name)[-1]
    path = PROMPTS_DIR / name / f"v{number}.md"
    return Prompt(name, number, path.read_text(encoding="utf-8").strip())


def data_block(data: object) -> str:
    """Untrusted data for a prompt: JSON between <data> tags. "<" is escaped inside the JSON
    strings, so no value can close the block early or open a tag of its own."""
    encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    return f"<data>\n{encoded}\n</data>"

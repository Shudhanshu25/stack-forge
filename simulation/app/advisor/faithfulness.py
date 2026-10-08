"""Checks that every figure in advice text appears in the data the advisor was given.

A claim is supported when it matches some input number (compared by magnitude) within 1% or
0.5 absolute, after converting lakh/crore/thousand units. Whole numbers 0-12 are allowed as
ordinary counts ("three risks", "turn 2"). Also used by the evaluation scripts.
"""

import re
from dataclasses import dataclass, field

_NUMBER = re.compile(
    r"(?<![\w.])\s?(?:₹|rs\.?\s?|inr\s?)?\s?"
    r"(?P<num>\d{1,3}(?:,\d{2,3})+|\d+)(?P<frac>\.\d+)?"
    r"\s?(?P<unit>%|percent\b|lakhs?\b|lacs?\b|l\b|crores?\b|cr\b|k\b|thousand\b)?",
    re.IGNORECASE,
)
_MULTIPLIERS = {"lakh": 1e5, "lakhs": 1e5, "lac": 1e5, "lacs": 1e5, "l": 1e5,
                "crore": 1e7, "crores": 1e7, "cr": 1e7, "k": 1e3, "thousand": 1e3}  # fmt: skip
FREE_INTEGERS = range(13)


@dataclass(frozen=True)
class Claim:
    text: str
    value: float


@dataclass
class FaithfulnessReport:
    claims: list[Claim] = field(default_factory=list)
    unsupported: list[Claim] = field(default_factory=list)

    @property
    def supported_share(self) -> float:
        return 1.0 if not self.claims else 1 - len(self.unsupported) / len(self.claims)


def extract_claims(text: str) -> list[Claim]:
    claims = []
    for m in _NUMBER.finditer(text):
        value = float(m.group("num").replace(",", "") + (m.group("frac") or ""))
        unit = (m.group("unit") or "").lower()
        value *= _MULTIPLIERS.get(unit, 1)
        claims.append(Claim(m.group(0).strip(), value))
    return claims


def collect_numbers(data: object) -> list[float]:
    """Every number in a JSON-like structure, as magnitudes."""
    out: list[float] = []
    if isinstance(data, bool):
        return out
    if isinstance(data, int | float):
        out.append(abs(float(data)))
    elif isinstance(data, dict):
        for v in data.values():
            out.extend(collect_numbers(v))
    elif isinstance(data, list):
        for v in data:
            out.extend(collect_numbers(v))
    elif isinstance(data, str):
        out.extend(c.value for c in extract_claims(data))
    return out


def is_supported(value: float, allowed: list[float]) -> bool:
    if value.is_integer() and int(value) in FREE_INTEGERS:
        return True
    return any(abs(value - v) <= max(0.01 * v, 0.5) for v in allowed)


def check(texts: list[str], context: object) -> FaithfulnessReport:
    allowed = collect_numbers(context)
    report = FaithfulnessReport()
    for text in texts:
        for claim in extract_claims(text):
            report.claims.append(claim)
            if not is_supported(claim.value, allowed):
                report.unsupported.append(claim)
    return report

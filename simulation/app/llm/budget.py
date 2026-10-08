"""Token accounting for one turn (or one advice request).

The meter records every LLM call with its prompt version and tokens, and refuses further calls
once the turn's budget is spent. The budget is the smaller of the configured per-turn budget
and what the user may still spend today (Node passes that as `tokenAllowance`).
"""

from dataclasses import dataclass, field

from stackforge_shared.models.llm_call_schema import LlmCall


@dataclass
class TokenMeter:
    budget: int | None  # None: unlimited
    daily_quota_exhausted: bool = False
    calls: list[LlmCall] = field(default_factory=list)
    budget_exhausted: bool = False

    @classmethod
    def for_request(cls, turn_budget: int, allowance: int | None) -> "TokenMeter":
        if allowance is not None and allowance <= 0:
            return cls(budget=0, daily_quota_exhausted=True)
        limits = [b for b in (turn_budget or None, allowance) if b is not None]
        return cls(budget=min(limits) if limits else None)

    @property
    def spent(self) -> int:
        return sum(c.prompt_tokens + c.completion_tokens for c in self.calls)

    def allows_call(self) -> bool:
        """Whether another call may be made. Records when the budget stops one."""
        if self.daily_quota_exhausted:
            return False
        if self.budget is not None and self.spent >= self.budget:
            self.budget_exhausted = True
            return False
        return True

    def record(
        self,
        *,
        purpose: str,
        model: str,
        prompt_version: str,
        usage: dict[str, int] | None,
        outcome: str,
        cached: bool = False,
        latency_ms: float | None = None,
    ) -> None:
        usage = usage or {}
        self.calls.append(
            LlmCall(
                purpose=purpose,
                model=model,
                prompt_version=prompt_version,
                prompt_tokens=int(usage.get("prompt", 0)),
                completion_tokens=int(usage.get("completion", 0)),
                cached=cached,
                outcome=outcome,
                latency_ms=round(latency_ms, 1) if latency_ms is not None else None,
            )
        )

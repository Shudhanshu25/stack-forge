# Stack Forge: prompts for Claude Code

Setup: put `CLAUDE.md` at the repository root and `SPEC.md` at `docs/SPEC.md`. Fill in the two placeholders at the top of the spec. Then run one prompt per session, in order.

## Milestone 1

```text
Implement Milestone 1 (Foundation) from docs/SPEC.md: repository setup, shared contracts, authentication, and startup management.

The repository currently contains only CLAUDE.md and docs/SPEC.md. Work through the whole milestone in one go. When you finish, tell me what is built, the exact commands to run it, and anything in the spec you found ambiguous or deviated from. Fill in the Commands section of CLAUDE.md.
```

## Milestone 2

```text
Implement Milestone 2 (Simulation engine) from docs/SPEC.md.

Everything later depends on this engine being pure and reproducible, so the determinism and replay requirements matter more than the realism of any single formula. Choose sensible economic formulas yourself and document them in docs/simulation.md. When you finish, show me the output of a ten-turn SaaS run and list the formulas you are least confident in.
```

## Milestone 3

```text
Implement Milestone 3 (Integration and live play) from docs/SPEC.md.

When you finish, tell me how to start everything and play a turn in the browser, and note any contract changes you made in /shared.
```

## Milestone 4

```text
Implement Milestone 4 (Forecasting, agents and advisor) from docs/SPEC.md.

The LLM provider and orchestration framework are named at the top of the spec. Keep LLM calls behind one client module, and make the test suite runnable without an API key by faking that client. When you finish, show me the model comparison table and one full turn record from an llm-mode turn.
```

## Milestone 5

```text
Implement Milestone 5 (Product) from docs/SPEC.md: dashboard, scenario comparison, analytics and reports, onboarding, and admin.

Replace the minimal play screen with the dashboard. The visual direction is a dark, data-dense founder dashboard; pick one type scale and one accent color and apply them consistently. When you finish, list each view and the route it lives at.
```

## Milestone 6

```text
Implement Milestone 6 (Hardening, deployment and evaluation) from docs/SPEC.md.

When you finish, give me the commands to bring up the production stack, run the evaluation scripts, and run the demo, and list any failure case from the Reliability section that does not yet behave as specified.
```

## Between milestones

Play with what was built before starting the next one. If something is wrong, describe the behavior you saw and the behavior you wanted in a new session; the spec stays the reference.

## Effort

Start at the default effort. The engine and the agent pipeline (Milestones 2 and 4) are the ones worth trying at a higher setting if results disappoint; the others are likely fine lower. This is something to test on your own runs, not a fixed rule.

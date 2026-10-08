# Stack Forge: prompts for Milestones 7 and 8

Setup: append `SPEC_MILESTONES_7_8.md` to `docs/SPEC.md` and fill in its placeholders. Run one prompt per session.

## Milestone 7

```text
Implement Milestone 7 (Production operations) from docs/SPEC.md.

Milestones 1 to 6 are complete, so this is a change to a working system: moving routes under /api/v1 and adding engine versioning must leave existing simulations playable and replayable. I will add repository secrets and server access myself; list exactly which secrets and one-time server steps the workflows need. When you finish, tell me what is automated, what I still have to do by hand, and any existing behavior you changed.
```

## Milestone 8

```text
Implement Milestone 8 (LLM safeguards and account basics) from docs/SPEC.md.

Existing users have no verification status; migrate them as verified. Keep the test suite runnable without email, Google or LLM credentials by faking those clients. When you finish, list the environment variables and third-party console setup I need (email domain, Google OAuth client), and show me the prompt eval results.
```

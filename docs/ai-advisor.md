# AI CEO advisor

`simulation/app/advisor/` interprets computed results. It never changes them.

## When it runs

- **During each turn.** The pipeline's last stage (`AI_CEO_ANALYSIS`) runs the advisor in ANALYZE mode on the new record. The advice is stored in the turn record's `advice` field. Set `ADVISOR_ON_TURN=false` to skip it.
- **On demand.** `POST /simulations/:id/advice` with `{ mode, question?, turnNumber? }` asks about the latest turn, or the given one. Node sends FastAPI `POST /advisor/ask` with the turn record (which includes its forecast) and summaries of up to 5 earlier turns. Each request is logged in the `advices` collection and rate-limited to 30 per user per 15 minutes.

## Modes

| Mode | Default question | Task given to the model |
| --- | --- | --- |
| EXPLAIN | Why did my results change this month? | Answer the founder's why-question, tracing it to decisions, events, competitor moves and customer reactions |
| ANALYZE | What caused this month's performance? | Review the month and identify what drove it |
| SCENARIO | What should I consider before my next decisions? | Lay out what to weigh for a possible decision and the likely direction of effects, without estimating new figures |

## Input

The input is the spec's set: previous state, decisions, new state, events, forecast and recent history. To these the advisor adds:

- competitor actions and the agents' reasoning;
- precomputed changes (revenue, profit, cash, customers, satisfaction and awareness), so the model never needs to calculate.

Money is in whole rupees and rates are in percent. The founder's question is wrapped as untrusted text, and the system prompt tells the model to answer it but ignore any instructions inside it.

## Output

```json
{ "available": true, "mode": "ANALYZE", "summary": "", "positiveFactors": [], "negativeFactors": [],
  "keyRisk": "", "keyOpportunity": "", "recommendation": "", "reasoning": "", "confidence": 0.0,
  "modelVersion": "gemini-3.8-flash" }
```

The output is validated against a schema. `confidence` must lie in [0, 1], lists are capped at 4 items, and text fields are truncated.

## Faithfulness: only figures from the input

`app/advisor/faithfulness.py` extracts every number from the advice text, understanding forms such as ₹1,47,994, ₹1.48 lakh, 2 crore, 12.5% and 3K. Each number must match some number in the advisor's input within 1% or 0.5 absolute, compared by magnitude. Whole numbers from 0 to 12 are allowed as ordinary counts ("three risks", "turn 2").

- If any figure is unsupported, the model is asked once more, with the offending figures listed.
- If the second answer still cites unsupported figures, the advice is withheld: `available: false`, `unavailableReason: "unsupported_figures: …"`.

The same checker will compute the faithfulness metric in Milestone 6's evaluation.

## Prompt and data

The system prompt is `simulation/app/prompts/advisor/v<N>.md` (recorded as `promptVersion`). The user message is the task for the mode followed by one `<data>` block holding the founder's question, the startup profile and the computed data; see [agents.md](agents.md#prompts-and-prompt-versions) for the injection defences. The faithfulness check compares figures with the computed data only, so the question or startup name cannot supply a figure the advisor may repeat. On-demand advice spends from the user's daily token quota and is unavailable once it is used up.

## Failure

An advisor failure never fails the turn. Advice comes back with `available: false` and an `unavailableReason` in each of these cases:

- no LLM configured;
- timeout or provider error;
- invalid output;
- figures not in the data.

The turn record is written as usual.

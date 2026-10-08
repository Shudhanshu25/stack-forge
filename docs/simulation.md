# Simulation engine

The engine lives in `simulation/engine`. It is pure Python: no web framework, database, queue or LLM imports, no file or network I/O, no clock and no unseeded randomness (`tests/test_engine_purity.py` enforces the imports). One turn is one month. Money is integer paise; rates and scores are floats in [0, 1] unless stated.

Engine version: `1.0.0` (`engine/version.py`). Replay is guaranteed only within one engine version; bump it whenever a change alters results.

## Public API

```python
create_initial_state(config, seed) -> SimulationState            # turn 0
run_turn(state, decisions, config, seed, turn_number, agent_effects=None) -> SimulationTurn
preview(state, decisions, config, seed, turn_number) -> DecisionPreview
replay(initial_state, records, seed, config) -> list[SimulationTurn]
replay_mismatches(initial_state, records, seed, config) -> list[int]
validate_decisions(state, decisions, config) -> list[DecisionResult]
```

All types are the pydantic models generated from `shared/schemas`. `run_turn` raises `DecisionValidationError` (carrying every rejection) if any decision is invalid, and `EngineInputError` if the turn number is not `state.turn + 1`, the seed is outside 0..2^53−1, or the startup is bankrupt.

The specification writes `replay(initial_state, records, seed)`. The configuration is also required, because the startup's economics live there, so it is the fourth argument.

## Determinism

- **Seeded streams.** Every random draw comes from `random.Random(int)` seeded with the first 8 bytes of `sha256("stackforge|seed|turn|stream")`. The streams are `competitors` (turn 0 creation and each turn's reactions), `events` and `demand`. Any turn can therefore be replayed on its own from its `stateBefore`, and adding draws to one stream never shifts another.
- **Uniform draws only.** Only `Random.random()` is used, because CPython guarantees its sequence. Normal and lognormal draws are built on it with Box–Muller.
- **Fixed draw counts.** The number of draws per turn never depends on decisions: one per catalog event, two per competitor, and four per segment. A baseline and a variant run with the same seed therefore share events and noise, so differences between them come from the decisions. Preview and the Milestone 5 scenario comparison depend on this.
- **Agent effects.** These are stored in the turn record. Replay passes them back in, so llm-mode runs replay without calling an LLM.
- **Floats.** Floats in the state are rounded to 6 decimals, and money is rounded once per cost component. JSON round-trips preserve every value exactly; a test stores records as JSON, reloads them and replays them.

## Engine versions

Every simulation records the `engineVersion` it was created with (`engine/version.py`, currently `1.1.0`; `1.0.0` is retained as `engine_v1_0_0/`) and is computed by that version for its whole life: turns, previews, scenarios, analytics and replay all send it to the simulation service, which picks the matching engine from `simulation/engines.py`. A formula change therefore never alters an existing simulation or breaks its replay.

The current version is the `engine/` package. Older versions are frozen, self-contained copies beside it (`engine_v1_0_0/` and so on, discovered automatically); the engine uses only relative imports so a copy needs no edits. Releasing a formula change:

```bash
cd simulation
.venv/Scripts/python -m engine_freeze            # copy engine/ to engine_v<x>_<y>_<z>/, write its replay fixture
# edit engine/ and bump ENGINE_VERSION in engine/version.py
.venv/Scripts/python -m engine_freeze --fixture  # replay fixture for the new version
.venv/Scripts/python -m pytest                   # replays every retained version's fixture
```

`tests/engine_fixtures/<version>.json` holds recorded runs per version (three industries, ten turns, one with LLM-style stored agent effects); `tests/test_engine_versions.py` replays each retained version's fixture with that version and requires zero mismatches, and checks that a frozen copy imports nothing from `engine/` and computes the same results. A request for a version the service no longer has is refused with 409 `ENGINE_VERSION_UNSUPPORTED`. A frozen engine still uses the shared Pydantic models, so a breaking schema change needs a new frozen copy or a compatible model.

## Configuration

`StartupConfiguration` is snapshotted when a startup is created (by Node, or by `stackforge_shared.templates.build_configuration` in scripts). It contains:

- the industry's `SimulationParameters`, from `shared/templates/industries/*.json`;
- the difficulty's `DifficultyModifiers`, from `shared/templates/difficulty.json`;
- the event catalog, from `shared/templates/events.json`.

Because everything is snapshotted, editing the data files never changes an existing simulation.

Effective values used below:

| Symbol | Value |
| --- | --- |
| CAC | `baseCac × cacMultiplier × (1 + event cac) × (1 + event marketingCost)` |
| conv | `baseConversionRate × conversionMultiplier` |
| churn₀ | `baseChurnRate × churnMultiplier` |
| ε | `priceElasticity × business-model elasticity multiplier` |
| CI | `min(1, competitorIntensity × competitorIntensityMultiplier)` |
| ref | `referencePrice` |
| M | `marketSize` from the configuration (fixed; used for scales) |

## Location

Engine 1.1.0 (Milestone 10). A startup's `configuration.locationProfile` holds nine indices, each relative to a national baseline of 1.0 ([locations.md](locations.md) gives every value and its source). At every engine entry point `localize(config)` (`engine/location.py`) applies the profile to the configuration the engine computes with:

| Effect | Formula | Scaled by w |
| --- | --- | --- |
| Salaries | `salaryPerEmployeeMonthly × salaryIndex` | no |
| Overheads and compliance | `fixedCostsMonthly × (operatingCostIndex + 0.1 × (regulatoryBurden − 1))` | no |
| Recruiting | cost per hire `0.25 × salary ÷ talentAvailability`; below 1.0, at most `⌊8 × talentAvailability⌋` hires per turn (more is rejected) | no |
| Logistics | `logisticsCostPerOrder ÷ infrastructure` (zero for industries that ship no goods) | no |
| Price sensitivity | `priceElasticity × purchasingPower^(−0.5 × w)` | yes |
| Market size | `marketSize × (1 + w × (localMarketSize − 1))`, so segment populations scale | yes |
| Competition | `competitorIntensity × (1 + w × (competitionDensity − 1))`, raising initial competitor share and pressure | yes |

`w` is the industry template's `localDemandWeight` (0 to 1): demand-side effects are scaled by it, cost-side effects always apply in full. `fundingAccess` is stored but unused until a funding decision exists. The constants 0.1, 8 and 0.5 are `COMPLIANCE_SHARE_OF_FIXED_COSTS`, `HIRES_PER_TURN_AT_BASELINE` and `PURCHASING_POWER_EXPONENT` in `engine/profiles.py`; indices are clamped to 0.3–2.5.

Every effect is a ratio to the baseline, so a profile of 1.0s changes nothing: a configuration without a profile, or with the neutral profile given to startups created before locations existed (migration 005), computes exactly as engine 1.0.0 did. `tests/test_location.py` replays every 1.0.0 fixture run on engine 1.1.0 and requires identical results. `localize` is idempotent: the configuration it returns keeps the profile's place (for event conditions) with every index set to 1.0.

**Events with conditions.** An event may carry `conditions` on `states`, `tiers` and `cities`; every list given must contain the startup's value. Events without conditions behave as before; a startup without a location only gets those. The draw sequence is unchanged (one draw per catalog entry, matched or not). Catalog 1.1.0 adds six: state startup incentive (states rated Best or Top Performer in the States' Startup Ranking 5.0), state regulatory change, local festival demand, monsoon flooding (flood-prone states), local talent war (the six largest startup hubs; raises salaries through the new `salaries` event effect) and infrastructure outage (tier-2 and tier-3 cities).

**Profiles are resolved outside the engine** by `simulation/locations` from `simulation/data/locations/india.json`: a listed city uses its own values; any other city uses its state's purchasing power and regulation with its tier's defaults. The simulation service exposes `GET /locations` and `POST /locations/profile`, and the API snapshots the resolved profile into the startup's configuration when it is created.

## Order of operations

1. **Validate decisions** (see below). Any rejection aborts the turn.
2. **Apply decisions.** Set the new price, the marketing budget (it persists until changed) and the headcount. Product investment raises quality immediately: `q' = q + (1 − q)(1 − e^(−I / (20 × salary)))`.
3. **Agent effects.** If none were supplied, compute the rule-based ones. Clamp the total demand modifier to ±0.3 and the total sentiment change to ±0.2, whatever their source.
4. **Resolve events.** Sample new events, then sum the effects of every active event.
5. **Competitor reactions.**
6. **Demand per segment**, then **acquisition and churn**.
7. **Revenue**, then **variable, fixed, marketing, employee and product costs**, then **profit**, then **cash**.
8. **Update market state:** population growth, market shares, awareness, satisfaction and quality drift.
9. **Build the immutable turn record.**

## Decisions

Each decision's `value` means:

| Type | `value` |
| --- | --- |
| `PRICING` | new price in paise |
| `MARKETING` | monthly marketing budget in paise; it persists until changed |
| `HIRING` | target headcount |
| `PRODUCT_QUALITY` | one-off investment in paise |

`FIRING`, `R_AND_D`, `EXPANSION`, `COST_CUTTING` and `FUNDING` are rejected as not yet supported.

Rejections name the field (`decisions[i].value`, `decisions[i].type` or `cash`) and the reason:

- **Any decision:**
  - the startup is bankrupt (cash < 0);
  - the decision type appears twice in one turn.
- **Pricing:** the price is negative, below ₹1, or above ₹1 crore.
- **Marketing:** the budget is negative or exceeds available cash.
- **Hiring:**
  - the target headcount is negative or above 10,000;
  - it is below the current headcount (which needs FIRING);
  - a month of salaries plus recruiting for the new headcount exceeds cash.
- **Product quality:**
  - the investment is not positive or exceeds cash;
  - quality is already ≥ 0.99;
  - marketing budget plus investment exceeds cash.

A decision that keeps a value unchanged (for example the current price) is accepted as a no-op rather than rejected. That lets a play screen submit all four decisions every turn.

## Customer market

The market is modelled as five customer segments (cohorts), not individual agents. A segment's population is `M × segmentMix`, and it grows by `marketGrowthRateMonthly` each turn.

| Segment | price sens. | quality sens. | loyalty | conv × | churn × | willingness to pay (× ref) |
| --- | --- | --- | --- | --- | --- | --- |
| PRICE_SENSITIVE | 0.9 | 0.3 | 0.2 | 1.2 | 1.4 | 0.8 |
| PREMIUM | 0.2 | 0.9 | 0.5 | 0.7 | 0.7 | 1.6 |
| LOYAL | 0.4 | 0.5 | 0.9 | 0.8 | 0.4 | 1.1 |
| OCCASIONAL | 0.6 | 0.4 | 0.2 | 0.6 | 1.6 | 0.9 |
| ENTERPRISE | 0.3 | 0.8 | 0.7 | 0.3 | 0.5 | 2.0 |

**Choice share.** This is a multinomial logit over the founder's offer and the four competitors' offers, computed per segment. Each offer `i` has utility:

```
Uᵢ = −ε(0.5 + priceSens) · ln(priceᵢ / (ref × WTP))  +  4 · qualitySens · (qualityᵢ − 0.5)  +  0.4 · ln(0.05 + visibilityᵢ)
```

The founder's visibility is brand awareness; a competitor's is `0.3 + 0.7 × marketingPower`. The founder's share `s` is `e^U_founder / Σ e^U`. Attractiveness is `a = 5s`, which equals 1 at parity with all four competitors. This single share carries price, quality, awareness and competition into demand.

**Acquisition.** For a segment with population `N` and current customers `C`, potential = `N − C` and reach = `potential / N`.

- **Paid:** `spendₑ × w / CAC × a × reach`, where:
  - `spendₑ = B / (1 + B / (baseCac × M × 0.01))` gives diminishing returns on very large budgets;
  - `w` is the segment's share of `population × conversion multiplier`.

  At parity, paid acquisition equals budget ÷ CAC.
- **Organic:** `potential × conv × segment conv × awareness × s × model organic × 0.2`. The 0.2 is the share of aware prospects actively evaluating in a month.
- **Referrals:** `C × 0.03 × max(0, satisfaction − 0.5) × 2`.
- **Demand multiplier:** `seasonality[month] × (1 + event demand) × (1 + agent demand)`, clamped to [0.1, 5].

Expected new customers = (paid + organic + referrals) × demand multiplier, capped at 30% of potential. The result is multiplied by a mean-one lognormal noise factor (σ = 0.12) and rounded.

**Churn.** Each segment's rate is the product of:

- `churn₀ × segment churn × model churn`;
- price pressure `clamp((price / (ref × WTP))^(0.8 × priceSens), 0.5, 3)`;
- quality pressure `clamp(1 + 2 × qualitySens × (avg competitor quality − quality), 0.5, 2)`;
- satisfaction factor `(1.5 − satisfaction)`;
- loyalty factor `(1 + (1 − loyalty) × competitor pressure × 0.5)`;
- service factor `(1 + 0.5 × min(1, max(0, load − 1)))`, where load = customers ÷ (employees × customersPerEmployee);
- `(1 + event churn)`.

The rate is capped at 0.9. Churned customers = round(C × rate × lognormal noise, σ = 0.10), never more than C.

Customers are counted at month end: C − churned + new.

## Revenue and costs

```
orders    = customers × purchasesPerCustomerPerMonth × (seasonality[month] if the model has seasonal purchases)
gross     = orders × price
revenue   = round(gross × (1 − returnRate))
COGS      = gross × clamp(unitCostRate × (1 + event unitCost), 0, 1)
variable  = round(COGS × (1 + inventoryHoldingRate) + customers × variableCostPerCustomer + orders × logisticsCostPerOrder)
fixed     = round(fixedCostsMonthly × max(0, 1 + event fixedCosts))
marketing = marketing budget
employees = round(employees × salary + hires × salary × 0.25)      # 25% of a month's salary to recruit
product   = this turn's product investment
total     = variable + fixed + marketing + employees + product
profit    = revenue − total
cash      = cash + profit
```

Each component is rounded once and `total` is their exact integer sum, so `cash change = profit` holds by construction. A property test checks it.

Business-model modifiers:

| Model | organic × | churn × | seasonal purchases | elasticity × |
| --- | --- | --- | --- | --- |
| SUBSCRIPTION | 1.0 | 1.0 | no | 1.0 |
| TRANSACTIONAL | 1.0 | 1.0 | yes | 1.0 |
| FREEMIUM | 1.5 | 1.1 | no | 1.0 |
| MARKETPLACE | 1.2 | 1.0 | yes | 1.0 |
| ADVERTISING | 1.5 | 1.0 | yes | 0.5 |

For freemium, `customers` are paying users. For advertising, price is revenue per user. For a marketplace, price is the take per order.

The startup is **bankrupt** when cash is negative after a turn; no further turns or decisions are accepted. Turn 1 is January.

## Market state updates

- **Founder market share** = customers ÷ total population (the share of the addressable market).
- **Competitor shares.** Each competitor's target is its population-weighted logit share × `(0.15 + 0.35 × CI)`. Its share moves 10% of the way to the target each turn. If competitors plus the founder would exceed 1, the competitor shares are scaled down: the founder's growth comes out of competitors. Shares therefore always sum to at most 1.
- **Competitor pressure** = `CI × (1 − population-weighted founder choice share)`.
- **Brand awareness** = `A(1 − 0.03) + (1 − A)(1 − e^(−B / (baseCac × M × 0.02))) + (1 − A) × 0.5 × market share`. The first term decays by 3% a month; the second is marketing-driven gain; the third is word of mouth. Event awareness effects are added while active.
- **Customer satisfaction** moves 35% of the way toward its target each turn: `0.2 + 0.6 × quality + 0.2 × value − service penalty`, where value = `clamp(1.5 − price/ref, 0, 1)` and service penalty = `min(0.3, 0.3 × max(0, load − 1))`. Agent sentiment and event effects are added before the update.
- **Product quality** loses 0.003 a month, gains `0.005 × (min(employees / initialEmployees, 2) − 1)` from the team, and has a floor of 0.05.

## Competitors

There are four archetypes, one competitor each. Their attributes are jittered by up to ±10% from the turn-0 `competitors` stream.

| Archetype | price × ref | quality | marketing | reaction | cash | strategy | share weight |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BUDGET | 0.75 | 0.45 | 0.40 | 0.6 | 0.50 | UNDERCUT | 0.30 |
| PREMIUM | 1.40 | 0.80 | 0.50 | 0.3 | 0.70 | PREMIUM | 0.25 |
| AGGRESSIVE | 0.95 | 0.55 | 0.85 | 0.9 | 0.60 | PENETRATION | 0.25 |
| INNOVATIVE | 1.10 | 0.75 | 0.60 | 0.5 | 0.55 | MATCH | 0.20 |

**Threat.** The competitor agent's `competitorThreat` measures how threatened competitors feel. Its rule-based value is the sum of four signals, clamped to [0, 1]:

- `0.35 × min(1, founder share / largest competitor share)`;
- `0.6 × clamp((avg competitor price − price) / avg competitor price, 0, 0.5)`;
- `clamp(quality − avg competitor quality, 0, 0.3)`;
- 0.15 if the marketing budget rose by more than 20%.

**Reaction.** Each competitor reacts with probability `reactionTendency × threat` if its cash strength is at least 0.1.

| Archetype | Response |
| --- | --- |
| BUDGET | cuts price 4–10% (floor: 60% of its anchor price) |
| AGGRESSIVE | cuts price if the founder cut price or undercuts it by 10%; otherwise raises marketing power by 0.04–0.10 |
| PREMIUM | invests in product (+0.02–0.05 quality); raises marketing instead if the founder raised marketing without improving quality |
| INNOVATIVE | invests in product |

Acting costs 0.05 cash strength, and cash strength recovers 0.01 a turn. A competitor that does not act drifts 10% back toward its archetype's price and marketing power, and 5% back toward its archetype's quality. Every competitor's action, including `NONE`, is recorded in `competitorActions`.

## Customer agent (rule-based)

- `sentimentChange = clamp(−0.25 × relative price change + 0.8 × quality change, −0.2, 0.2)`.
- `demandModifier = 0.5 × sentimentChange`.

The rule-based competitor agent sets only `competitorThreat`; its demand and sentiment modifiers are 0. In llm mode (Milestone 4), both agents return all three values, and the engine treats them the same way.

## Events

The catalog is `shared/templates/events.json`, which holds 15 events snapshotted into the configuration. Each event has a type, a polarity, a base monthly probability, a duration and effects:

- **Multipliers:** `demand`, `marketingCost`, `cac`, `churn`, `unitCost`, `fixedCosts`.
- **Additive per active turn:** `brandAwareness`, `customerSatisfaction`, `productQuality`.

Each turn, every catalog entry draws one uniform number. An event starts if it is not already active, fewer than 2 events have started this turn, and the draw is below:

```
p = probability × eventProbabilityMultiplier(industry) × eventProbabilityMultiplier(difficulty) × polarity weight
```

The polarity weight is `negativeEventWeight` for negative events and `1 / negativeEventWeight` for positive ones. An event is active for `duration` turns, including the one it starts in. Effects of all active events add up. `events` in the turn record lists the events that started that turn; `stateAfter.activeEvents` lists those still running.

## Preview

`preview` validates the decisions without raising. It then runs, with the same seed:

- the turn with no decisions (the baseline);
- the turn with each accepted decision alone;
- the turn with all accepted decisions together.

It compares each run against the baseline for revenue, profit, cash, customers, new customers, churned customers, market share, satisfaction, awareness and quality. For each metric it reports a direction and a magnitude bin, never a number:

- relative change < 0.5%: FLAT / NONE;
- < 5%: SMALL;
- < 15%: MEDIUM;
- otherwise: LARGE.

The denominator has a floor (₹1,000 for money, 10 for counts, 0.05 for scores) so changes near zero don't look huge. The result is labelled "Simulation estimate" and nothing is recorded.

## Industry templates and calibration

The templates are data files. For Milestone 2 they were revised to two stated targets: about 10–12 months of base runway at zero revenue, and a lifetime value of roughly 3–6 times CAC at parity. LTV here is the monthly contribution after COGS, refunds and servicing, divided by churn. The Milestone 1 values gave SaaS under two months of runway.

`python -m runner.viability` checks the result. For each industry it tries fixed marketing budgets of 0–15% of capital, hiring whenever support capacity is 90% used, over 10 seeds and 24 turns. A test requires the best budget to survive on at least 60% of seeds on NORMAL.

At engine 1.0.0, survival with the best budget is:

| Difficulty | Industries at 100% | Others |
| --- | --- | --- |
| NORMAL | most industries | FinTech 80%, Consumer App 60% |
| HARD | none | 20–50% |

Doing nothing (no marketing) usually fails.

## Running it

```bash
cd simulation
.venv/Scripts/python -m runner --industry SAAS --turns 10 --seed 42          # one industry
.venv/Scripts/python -m runner --industry all --turns 12 --policy growth     # every template
.venv/Scripts/python -m runner --industry ECOMMERCE --json records.json      # dump turn records
.venv/Scripts/python -m runner.viability --turns 24 --seeds 10               # calibration check
```

Policies: `steady` (5% of initial capital on marketing each month), `growth` (marketing at 8% of cash, hiring when support is stretched, product investment every other month) and `random` (seeded random valid decisions, for training data). Policies live outside the engine and only play decisions the engine accepts.

## Tests

`simulation/tests/engine`:

- **Unit tests:** RNG, decisions, choice shares, acquisition, churn, finance, events, competitors and agents.
- **Turn-level behaviour tests:** marketing raises acquisition, a lower price wins customers, hiring cost, quality investment, supplied agent effects, event persistence and expiry.
- **Hypothesis property tests** over random industries, difficulties, seeds and decision sequences. They check that:
  - customer counts are never negative, stay within population and add up;
  - the cash change equals profit, and profit equals revenue minus total costs;
  - market shares sum to at most 1;
  - every score stays in [0, 1].
- **Determinism tests:** identical records from identical inputs.
- **Replay tests:**
  - every industry rebuilds a 20-turn random-policy run from its records;
  - a JSON round trip replays exactly;
  - single turns replay on their own;
  - tampering is detected;
  - gaps are rejected.
- **Preview tests.**
- **CLI and calibration tests.**

## Least certain formulas

1. **Awareness and organic growth.** The awareness scale (`baseCac × M × 0.02`) and the 0.2 organic evaluation rate set how much of growth is organic versus paid. They were chosen so that ₹50K a month in a 2-lakh SaaS market buys roughly 10–15% awareness, which is plausible but not grounded in data. Small changes here move every industry's trajectory.
2. **Market share against the whole addressable population.** Founder share is customers ÷ population, while competitor shares come from a separate target `0.15 + 0.35 × CI`. These are two different definitions of "share" glued together by normalisation. They respect the "sum ≤ 1" invariant but aren't a coherent served-market model.
3. **Multiplicative churn.** Seven multiplicative factors can compound, so the 0.9 cap occasionally binds in extreme states. Each factor is reasonable alone; their product is not calibrated.
4. **Satisfaction target.** The weights `0.2 + 0.6 × quality + 0.2 × value` are a judgement call.
5. **Rule-based competitor threat.** The weights are hand-set, and threat stays low until the founder has meaningful share, so competitors rarely react early.
6. **Service capacity.** Each employee supports `customersPerEmployee` customers. This makes headcount a real cost driver (decisive for HealthTech), but it ignores roles: every employee is support.

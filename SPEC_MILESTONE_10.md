# Stack Forge Specification: Milestone 10

Append this to `docs/SPEC.md`. Rules and conventions in `CLAUDE.md` still apply.

## Milestone 10: Startup location

A startup has a location, and the location changes its economics. Coverage is India. Location effects come from a curated data file; no LLM is involved.

### Data model

`Startup` gains a `location` object: `country` (fixed to `IN` for now; the field exists so other countries can be added later), `state`, `city`, and `tier` (`METRO`, `TIER_2`, `TIER_3`). `StartupConfiguration` gains the resolved `locationProfile` that the engine uses. Both are added to the shared schemas first.

Location is set at creation and cannot change once a simulation has started.

### Location data

A data file under `/simulation/data/locations`, treated like the industry templates: data, not code branches.

**Listed cities (20):** Bengaluru, Mumbai, Delhi NCR, Hyderabad, Pune, Chennai, Kolkata, Ahmedabad, Jaipur, Kochi, Indore, Chandigarh, Coimbatore, Lucknow, Bhubaneswar, Nagpur, Surat, Visakhapatnam, Thiruvananthapuram, Guwahati.

**Fallback:** for any other city the user picks a state and a tier, and the profile is built from that state's values combined with tier defaults.

Each profile holds indices relative to a national baseline of 1.0:

- `salaryIndex`: cost per employee
- `operatingCostIndex`: rent and fixed overheads
- `purchasingPower`: how price sensitive local customers are
- `localMarketSize`: addressable customers nearby
- `talentAvailability`: how easily and quickly hires are made
- `competitionDensity`: strength and number of local competitors
- `fundingAccess`: reserved for the funding decision; stored now, unused until that decision exists
- `infrastructure`: logistics and connectivity quality
- `regulatoryBurden`: state-level compliance cost

Every value carries a `source` note and an `isEstimate` flag. Where a published figure exists (salary surveys, state GDP per capita, commercial rent reports, startup ecosystem rankings), derive the index from it and cite it. Where none exists, set a reasoned estimate and mark it. Do not present estimates as measured data. `docs/locations.md` lists every value with its source.

### Engine effects

The location profile adjusts the industry template when the initial state is built, and the engine reads the adjusted configuration from then on.

- **Costs:** employee cost scales with `salaryIndex`; fixed costs with `operatingCostIndex`; a recurring compliance cost with `regulatoryBurden`.
- **Hiring:** low `talentAvailability` caps hires per turn and raises cost per hire.
- **Demand:** `purchasingPower` shifts segment price sensitivity; `localMarketSize` scales segment populations.
- **Competition:** `competitionDensity` scales initial competitor strength and market share.
- **Logistics:** `infrastructure` affects variable costs for industries that ship physical goods.

How much location matters depends on the industry. Each industry template gains a `localDemandWeight` from 0 to 1: Food & Beverage is near 1 because its customers are local, SaaS is near 0 because its customers are national while its costs remain local. Demand-side effects are scaled by this weight; cost-side effects always apply in full.

### Location-specific events

Event definitions gain optional conditions on state, tier or city. Add: state startup-policy incentive, state regulatory change, local festival demand surge, monsoon or flood disruption, local talent war in startup hubs, infrastructure outage. Events without conditions behave as before.

### Compatibility

This changes engine formulas, so it is a new `engineVersion`. Existing startups are migrated to a neutral location profile with every index at 1.0 and `localDemandWeight` effects disabled, and their simulations continue and replay on their original engine version with identical results. A test asserts this against a stored fixture.

### Interface

- A location step in the creation wizard: state, then city filtered by state, with an "other city" option that asks for the tier.
- Before confirming, a location profile card shows each index as higher, lower or near the national baseline, in plain language ("Salaries: high", "Talent: easy to hire"), with estimates labelled.
- The dashboard header shows city and state. Analytics gains a location panel showing how much of the cost base and demand the location accounts for compared with the neutral baseline.
- A tooltip in onboarding explains why location matters.

### Evaluation

A script in `/evaluation` runs the same industry, seed and decision policy across all 20 cities and writes a comparison table of cash, profit and customers after twelve turns. This is the evidence for the report that location has a measurable, explainable effect.

### Tests

Unit tests for profile resolution (listed city, fallback, neutral), each engine effect in isolation, `localDemandWeight` scaling, and event conditions. A determinism test covers a located startup. The compatibility fixture test above.

**Done when:** a new startup can be created in any listed city or by fallback, two otherwise identical startups in different cities produce different and explainable results on the same seed, simulations created before this milestone replay unchanged, every location value has a source or an estimate flag in `docs/locations.md`, and the city comparison table is generated by one command.

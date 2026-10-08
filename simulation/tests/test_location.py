"""Milestone 10: location profiles, each engine effect in isolation, local demand weighting,
event conditions, determinism, and compatibility with engine 1.0.0."""

import json
from pathlib import Path

import pytest
from stackforge_shared.models.startup_configuration_schema import StartupConfiguration
from stackforge_shared.templates import build_configuration

import engine
import engines
import locations
from engine import profiles as pf
from engine.events import resolve_events
from engine.location import localize, location_factors, matches
from engine.models import Decision, DecisionStatus, DecisionType, SimulationTurn
from engine.rng import rng_for
from runner.policies import POLICIES, accepted_only

FIXTURES = Path(__file__).parent / "engine_fixtures"
INDEX_NAMES = [
    "salary_index",
    "operating_cost_index",
    "purchasing_power",
    "local_market_size",
    "talent_availability",
    "competition_density",
    "funding_access",
    "infrastructure",
    "regulatory_burden",
]


def with_index(profile, **values):
    """A neutral profile (but located in Karnataka, Bengaluru) with only the given indices set."""
    neutral = locations.neutral_profile().indices
    indices = neutral.model_copy(
        update={
            name: getattr(neutral, name).model_copy(update={"value": v})
            for name, v in values.items()
        }
    )
    base = profile or locations.city_profile("bengaluru")
    return base.model_copy(update={"indices": indices})


def config_with(industry="FOOD_AND_BEVERAGE", weight=None, **values) -> StartupConfiguration:
    cfg = build_configuration(industry, location_profile=with_index(None, **values))
    if weight is not None:
        cfg = cfg.model_copy(
            update={"parameters": cfg.parameters.model_copy(update={"local_demand_weight": weight})}
        )
    return cfg


def play(cfg: StartupConfiguration, turns=6, seed=11, policy="steady"):
    state = engine.create_initial_state(cfg, seed)
    records = []
    for t in range(1, turns + 1):
        if state.cash < 0:
            break
        decisions = accepted_only(state, cfg, POLICIES[policy](state, cfg, t, seed))
        record = engine.run_turn(state, decisions, cfg, seed, t)
        records.append(record)
        state = record.state_after
    return state, records


# ---- Profile resolution ----------------------------------------------------------------------


def test_a_listed_city_uses_its_own_values():
    p = locations.resolve("KA", city_id="bengaluru")
    assert (p.basis.value, p.city, p.tier.value, p.state.root) == (
        "LISTED_CITY",
        "Bengaluru",
        "METRO",
        "KA",
    )
    data = locations.data()
    city = next(c for c in data["cities"] if c["id"] == "bengaluru")
    assert p.indices.salary_index.value == city["indices"]["salaryIndex"]["value"]


def test_another_city_combines_its_state_with_tier_defaults():
    p = locations.resolve("MH", city="Nashik", tier="TIER_2")
    data = locations.data()
    state = next(s for s in data["states"] if s["code"] == "MH")
    tier = data["tiers"]["TIER_2"]["defaults"]
    assert p.basis.value == "STATE_AND_TIER" and p.city == "Nashik" and p.city_id is None
    assert p.indices.purchasing_power.value == state["indices"]["purchasingPower"]["value"]
    assert p.indices.regulatory_burden.value == state["indices"]["regulatoryBurden"]["value"]
    assert p.indices.salary_index.value == tier["salaryIndex"]["value"]
    assert p.indices.local_market_size.value == tier["localMarketSize"]["value"]


def test_the_neutral_profile_is_the_baseline():
    p = locations.neutral_profile()
    assert p.basis.value == "NEUTRAL" and p.state is None
    assert all(getattr(p.indices, n).value == 1.0 for n in INDEX_NAMES)


@pytest.mark.parametrize(
    ("args", "message"),
    [
        ({"state": "ZZ", "tier": "TIER_2"}, "unknown state"),
        ({"state": "KA", "city_id": "nowhere"}, "unknown city"),
        ({"state": "MH", "city_id": "bengaluru"}, "not in"),
        ({"state": "MH", "city": "Nashik"}, "needs a tier"),
    ],
)
def test_unknown_or_incomplete_places_are_refused(args, message):
    with pytest.raises(locations.LocationError, match=message):
        locations.resolve(**args)


def test_every_value_has_a_source_and_an_estimate_flag():
    data = locations.data()
    assert len(data["cities"]) == 20 and len(data["states"]) == 36
    rows = [c["indices"] for c in data["cities"]]
    rows += [s["indices"] for s in data["states"]]
    rows += [t["defaults"] for t in data["tiers"].values()]
    for indices in rows:
        for entry in indices.values():
            assert entry["source"].strip()
            assert isinstance(entry["isEstimate"], bool)
            assert pf.LOCATION_INDEX_BOUNDS[0] <= entry["value"] <= pf.LOCATION_INDEX_BOUNDS[1]
    # The catalog lists every listed city under its state.
    listed = {getattr(c.id, "root", c.id) for s in locations.catalog().states for c in s.cities}
    assert listed == set(locations.listed_city_ids())


# ---- Engine effects in isolation -------------------------------------------------------------


def test_no_profile_and_the_neutral_profile_change_nothing():
    base = build_configuration("FOOD_AND_BEVERAGE")
    neutral = build_configuration("FOOD_AND_BEVERAGE", location_profile=locations.neutral_profile())
    assert localize(base) is base
    assert localize(neutral) is neutral
    assert location_factors(neutral).neutral


def test_salaries_scale_with_the_salary_index():
    base = build_configuration("SAAS")
    cfg = localize(config_with("SAAS", salary_index=1.3))
    assert cfg.parameters.salary_per_employee_monthly == round(
        base.parameters.salary_per_employee_monthly * 1.3
    )


def test_fixed_costs_scale_with_operating_cost_and_compliance():
    base = build_configuration("SAAS").parameters.fixed_costs_monthly
    assert localize(
        config_with("SAAS", operating_cost_index=1.5)
    ).parameters.fixed_costs_monthly == round(base * 1.5)
    heavier = localize(config_with("SAAS", regulatory_burden=1.2)).parameters.fixed_costs_monthly
    assert heavier == round(base * (1 + pf.COMPLIANCE_SHARE_OF_FIXED_COSTS * 0.2))
    lighter = localize(config_with("SAAS", regulatory_burden=0.8)).parameters.fixed_costs_monthly
    assert lighter < base


def test_scarce_talent_caps_hires_and_raises_their_cost():
    cfg = config_with("SAAS", talent_availability=0.5)
    local = localize(cfg)
    assert local.parameters.max_hires_per_turn == int(pf.HIRES_PER_TURN_AT_BASELINE * 0.5)
    assert local.parameters.recruiting_cost_salary_share == pytest.approx(
        pf.RECRUITING_COST_SALARY_SHARE / 0.5
    )
    state = engine.create_initial_state(cfg, 3)
    too_many = Decision(type=DecisionType.hiring, value=state.employees + 5)
    result = engine.validate_decisions(state, [too_many], cfg)[0]
    assert result.status == DecisionStatus.rejected
    assert "talent is scarce" in result.rejection.reason
    # Plentiful talent: no cap, cheaper recruiting.
    rich = localize(config_with("SAAS", talent_availability=1.4))
    assert rich.parameters.max_hires_per_turn is None
    assert rich.parameters.recruiting_cost_salary_share < pf.RECRUITING_COST_SALARY_SHARE


def test_infrastructure_changes_logistics_only_for_industries_that_ship_goods():
    goods = localize(config_with("ECOMMERCE", infrastructure=0.8))
    base = build_configuration("ECOMMERCE").parameters.logistics_cost_per_order
    assert goods.parameters.logistics_cost_per_order == round(base / 0.8)
    saas = localize(config_with("SAAS", infrastructure=0.8))
    assert saas.parameters.logistics_cost_per_order == 0


def test_purchasing_power_lowers_price_sensitivity_by_local_weight():
    base = build_configuration("FOOD_AND_BEVERAGE").parameters
    cfg = localize(config_with(purchasing_power=1.6))
    w = base.local_demand_weight
    assert cfg.parameters.price_elasticity == pytest.approx(
        base.price_elasticity * 1.6 ** (-pf.PURCHASING_POWER_EXPONENT * w)
    )
    assert cfg.parameters.price_elasticity < base.price_elasticity


def test_local_market_size_scales_segment_populations():
    base = build_configuration("FOOD_AND_BEVERAGE")
    cfg = config_with(local_market_size=1.5)
    w = base.parameters.local_demand_weight
    assert localize(cfg).market_size == round(base.market_size * (1 + w * 0.5))
    pop = lambda c: sum(s.population for s in engine.create_initial_state(c, 5).customer_segments)  # noqa: E731
    assert pop(cfg) > pop(base)


def test_competition_density_strengthens_initial_competitors():
    base = build_configuration("FOOD_AND_BEVERAGE")
    cfg = config_with(competition_density=1.4)
    share = lambda c: sum(x.market_share for x in engine.create_initial_state(c, 5).competitors)  # noqa: E731
    assert share(cfg) > share(base)
    assert engine.create_initial_state(cfg, 5).competitor_pressure > (
        engine.create_initial_state(base, 5).competitor_pressure
    )


def test_local_demand_weight_scales_demand_but_never_costs():
    national = localize(
        config_with(
            "SAAS",
            weight=0.0,
            local_market_size=2.0,
            purchasing_power=2.0,
            competition_density=2.0,
            salary_index=1.3,
        )
    )
    base = build_configuration("SAAS")
    assert national.market_size == base.market_size
    assert national.parameters.price_elasticity == base.parameters.price_elasticity
    assert national.parameters.competitor_intensity == base.parameters.competitor_intensity
    assert national.parameters.salary_per_employee_monthly == round(
        base.parameters.salary_per_employee_monthly * 1.3
    )
    local = localize(config_with("SAAS", weight=1.0, local_market_size=2.0))
    assert local.market_size == base.market_size * 2


def test_localize_is_idempotent():
    cfg = build_configuration("ECOMMERCE", location_profile=locations.city_profile("mumbai"))
    once = localize(cfg)
    assert localize(once) == once
    assert once.location_profile.city_id.root == "mumbai"  # place kept for event conditions


def test_a_talent_war_event_raises_salaries():
    from engine.decisions import AppliedDecisions
    from engine.events import EventEffects
    from engine.finance import compute_financials

    p = build_configuration("SAAS").parameters
    applied = AppliedDecisions(
        price=50_000, marketing_budget=0, employees=4, hires=0, product_investment=0
    )
    calm = compute_financials(10, applied, p, 1.0, EventEffects())
    war = compute_financials(10, applied, p, 1.0, EventEffects(salaries=0.12))
    assert war.expenses.employees == round(calm.expenses.employees * 1.12)


# ---- Event conditions ------------------------------------------------------------------------


def test_event_conditions_match_state_tier_and_city():
    events = {e.type.value: e for e in build_configuration("SAAS").events}
    bengaluru = build_configuration("SAAS", location_profile=locations.city_profile("bengaluru"))
    lucknow = build_configuration("SAAS", location_profile=locations.city_profile("lucknow"))
    unlocated = build_configuration("SAAS")
    assert matches(events["local_talent_war"].conditions, bengaluru)
    assert not matches(events["local_talent_war"].conditions, lucknow)
    assert matches(events["infrastructure_outage"].conditions, lucknow)  # TIER_2
    assert not matches(events["infrastructure_outage"].conditions, bengaluru)  # METRO
    assert matches(events["state_startup_incentive"].conditions, bengaluru)  # Karnataka
    assert not matches(events["monsoon_disruption"].conditions, bengaluru)
    # Without a location only unconditional events can happen.
    assert not matches(events["local_festival_demand"].conditions, unlocated)
    assert matches(events["viral_exposure"].conditions, unlocated)


def test_an_unmatched_event_never_starts_and_the_draws_stay_aligned():
    cfg = build_configuration("SAAS", location_profile=locations.city_profile("bengaluru"))
    always = [e.model_copy(update={"probability": 1.0}) for e in cfg.events]
    cfg = cfg.model_copy(update={"events": always})
    _, started = resolve_events([], cfg, 1, rng_for(1, 1, "events"))
    for e in started:
        assert matches(e.conditions, cfg)
    rng = rng_for(1, 1, "events")
    resolve_events([], cfg, 1, rng)
    assert rng.random() == pytest.approx(
        _draw_after(len(cfg.events))
    )  # one draw per catalog entry, matched or not


def _draw_after(n: int) -> float:
    rng = rng_for(1, 1, "events")
    for _ in range(n):
        rng.random()
    return rng.random()


# ---- Determinism, measurable effect, compatibility ---------------------------------------------


def test_a_located_startup_is_deterministic_and_replays():
    cfg = build_configuration("ECOMMERCE", location_profile=locations.city_profile("pune"))
    _first_state, first = play(cfg)
    _second_state, second = play(cfg)
    assert [r.model_dump(mode="json") for r in first] == [r.model_dump(mode="json") for r in second]
    initial = engine.create_initial_state(cfg, 11)
    assert engine.replay_mismatches(initial, first, 11, cfg) == []


def test_two_cities_with_the_same_seed_and_decisions_differ():
    mumbai, _ = play(
        build_configuration("FOOD_AND_BEVERAGE", location_profile=locations.city_profile("mumbai"))
    )
    lucknow, _ = play(
        build_configuration("FOOD_AND_BEVERAGE", location_profile=locations.city_profile("lucknow"))
    )
    assert mumbai.cash != lucknow.cash
    # Mumbai's salaries and rents are higher, so its costs are higher every turn.
    assert mumbai.expenses.fixed > lucknow.expenses.fixed


def test_engine_1_1_replays_engine_1_0_runs_unchanged():
    """Startups from before locations: no profile, or the neutral profile, compute exactly as
    engine 1.0.0 did (same configuration, decisions and stored agent effects)."""
    fixture = json.loads((FIXTURES / "1.0.0.json").read_text(encoding="utf-8"))
    for run in fixture["runs"]:
        for profile in (None, locations.neutral_profile()):
            cfg = StartupConfiguration.model_validate(run["configuration"])
            cfg = cfg.model_copy(update={"location_profile": profile})
            initial = engine.create_initial_state(cfg, run["seed"])
            assert (
                initial.model_dump(mode="json", by_alias=True, exclude_none=True)
                == run["initialState"]
            )
            records = [SimulationTurn.model_validate(r) for r in run["records"]]
            assert engine.replay_mismatches(initial, records, run["seed"], cfg) == []


def test_old_simulations_still_run_on_their_own_engine():
    assert engines.get_engine("1.0.0").ENGINE_VERSION == "1.0.0"
    assert engines.get_engine().ENGINE_VERSION == "1.1.0"


# ---- Service: endpoints and the analytics location panel --------------------------------------


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    from fastapi.testclient import TestClient

    from app.config import Settings
    from app.main import create_app

    settings = Settings(app_env="test", forecast_model_dir=tmp_path_factory.mktemp("none"))
    return TestClient(create_app(settings, llm=None))


def _dump(model) -> dict:
    return model.model_dump(mode="json", by_alias=True, exclude_none=True)


def test_location_endpoints(client):
    catalog = client.get("/locations").json()
    karnataka = next(s for s in catalog["states"] if s["code"] == "KA")
    assert {"id": "bengaluru", "name": "Bengaluru", "tier": "METRO"} in karnataka["cities"]
    assert [t["tier"] for t in catalog["tiers"]] == ["METRO", "TIER_2", "TIER_3"]
    listed = client.post("/locations/profile", json={"state": "KA", "cityId": "bengaluru"})
    assert listed.status_code == 200 and listed.json()["basis"] == "LISTED_CITY"
    other = client.post(
        "/locations/profile", json={"state": "MH", "city": "Nashik", "tier": "TIER_2"}
    )
    assert other.json()["basis"] == "STATE_AND_TIER"
    bad = client.post("/locations/profile", json={"state": "MH", "cityId": "bengaluru"})
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "UNKNOWN_LOCATION"


def test_analytics_show_what_the_location_costs(client):
    cfg = build_configuration("ECOMMERCE", location_profile=locations.city_profile("mumbai"))
    _, records = play(cfg, turns=3, seed=21, policy="growth")
    body = {
        "initialState": _dump(engine.create_initial_state(cfg, 21)),
        "records": [_dump(r) for r in records],
        "seed": 21,
        "configuration": _dump(cfg),
    }
    location = client.post("/analytics/simulation", json=body).json()["location"]
    costs = {c["key"]: c for c in location["costs"]}
    assert costs["salaries"]["actual"] > costs["salaries"]["baseline"]  # Mumbai pays more
    assert costs["fixed"]["actual"] > costs["fixed"]["baseline"]  # and rents more
    assert location["monthlyCostBase"] == records[-1].state_after.expenses.total
    assert location["monthlyLocationCost"] == sum(
        c["actual"] - c["baseline"] for c in location["costs"]
    )
    assert {d["key"] for d in location["demand"]} == {
        "marketSize",
        "priceElasticity",
        "competition",
    }

    # A startup without a location: the neutral profile, and no difference anywhere.
    plain = build_configuration("ECOMMERCE")
    _, records = play(plain, turns=2, seed=21, policy="growth")
    body = {
        "initialState": _dump(engine.create_initial_state(plain, 21)),
        "records": [_dump(r) for r in records],
        "seed": 21,
        "configuration": _dump(plain),
    }
    neutral = client.post("/analytics/simulation", json=body).json()["location"]
    assert neutral["profile"]["basis"] == "NEUTRAL"
    assert neutral["monthlyLocationCost"] == 0

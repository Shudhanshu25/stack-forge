"""Location profiles: resolve a startup's place to the indices the engine uses.

The values live in data/locations/india.json (data, not code, like the industry templates;
every value carries its source and whether it is an estimate; docs/locations.md lists them).

- A listed city uses its own values.
- Any other city is built from its state's values for the state-level indices (purchasing
  power, regulatory burden) and the tier's defaults for the city-level ones.
- The neutral profile (every index 1.0) is what startups created before locations existed use;
  the engine treats it, like no profile at all, as no location effect.

Resolution reads a data file, so it lives here rather than in the pure engine; the engine only
receives the resolved profile inside the configuration.
"""

import json
from functools import cache
from pathlib import Path

from stackforge_shared.models.location_catalog_schema import LocationCatalog
from stackforge_shared.models.location_profile_schema import LocationProfile

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "locations" / "india.json"

INDICES = (
    "salaryIndex",
    "operatingCostIndex",
    "purchasingPower",
    "localMarketSize",
    "talentAvailability",
    "competitionDensity",
    "fundingAccess",
    "infrastructure",
    "regulatoryBurden",
)
# Indices that come from the state for a city that is not listed; the rest come from the tier.
STATE_LEVEL = ("purchasingPower", "regulatoryBurden")
TIERS = ("METRO", "TIER_2", "TIER_3")


class LocationError(ValueError):
    """The requested place is not known, or the request is incomplete."""


@cache
def data() -> dict:
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def _states() -> dict[str, dict]:
    return {s["code"]: s for s in data()["states"]}


def _cities() -> dict[str, dict]:
    return {c["id"]: c for c in data()["cities"]}


def catalog() -> LocationCatalog:
    """States (alphabetical) with their listed cities, and the tiers, for the creation wizard."""
    cities = sorted(data()["cities"], key=lambda c: c["name"])
    return LocationCatalog.model_validate(
        {
            "dataVersion": data()["dataVersion"],
            "country": "IN",
            "tiers": [
                {
                    "tier": t,
                    "label": data()["tiers"][t]["label"],
                    "description": data()["tiers"][t]["description"],
                }
                for t in TIERS
            ],
            "states": [
                {
                    "code": s["code"],
                    "name": s["name"],
                    "cities": [
                        {"id": c["id"], "name": c["name"], "tier": c["tier"]}
                        for c in cities
                        if c["state"] == s["code"]
                    ],
                }
                for s in sorted(data()["states"], key=lambda s: s["name"])
            ],
        }
    )


def _profile(
    basis: str,
    state: dict | None,
    city: str | None,
    city_id: str | None,
    tier: str | None,
    indices: dict,
) -> LocationProfile:
    return LocationProfile.model_validate(
        {
            "dataVersion": data()["dataVersion"],
            "basis": basis,
            "country": "IN",
            "state": state["code"] if state else None,
            "stateName": state["name"] if state else None,
            "city": city,
            "cityId": city_id,
            "tier": tier,
            "indices": {name: dict(indices[name]) for name in INDICES},
        }
    )


def resolve(
    state: str,
    city_id: str | None = None,
    city: str | None = None,
    tier: str | None = None,
) -> LocationProfile:
    """The profile for a listed city (by id) or for any other city (by state and tier)."""
    states = _states()
    if state not in states:
        raise LocationError(f"unknown state or union territory: {state}")
    st = states[state]
    if city_id:
        listed = _cities().get(city_id)
        if listed is None:
            raise LocationError(f"unknown city: {city_id}")
        if listed["state"] != state:
            raise LocationError(f"{listed['name']} is not in {st['name']}")
        return _profile(
            "LISTED_CITY", st, listed["name"], listed["id"], listed["tier"], listed["indices"]
        )
    if tier not in TIERS:
        raise LocationError("a city that is not listed needs a tier (METRO, TIER_2 or TIER_3)")
    defaults = data()["tiers"][tier]["defaults"]
    indices = {
        name: (st["indices"][name] if name in STATE_LEVEL else defaults[name]) for name in INDICES
    }
    return _profile("STATE_AND_TIER", st, (city or "").strip() or None, None, tier, indices)


def city_profile(city_id: str) -> LocationProfile:
    """Shortcut for a listed city (scripts and evaluation)."""
    listed = _cities().get(city_id)
    if listed is None:
        raise LocationError(f"unknown city: {city_id}")
    return resolve(listed["state"], city_id=city_id)


def neutral_profile() -> LocationProfile:
    """Every index at the national baseline: no location effect."""
    baseline = {
        name: {
            "value": 1.0,
            "isEstimate": False,
            "source": "National baseline (startup created before locations existed).",
        }
        for name in INDICES
    }
    return _profile("NEUTRAL", None, None, None, None, baseline)


def listed_city_ids() -> list[str]:
    """The listed cities in the order of the data file."""
    return [c["id"] for c in data()["cities"]]

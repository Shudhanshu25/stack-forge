"""Loads the shared data files and builds a StartupConfiguration from them.

This mirrors how the Node API snapshots a configuration when a startup is created
(backend/src/modules/startups/startup.service.ts). Scripts and evaluation use it to build
configurations without going through the API. The engine itself never reads files.
"""

import json
from functools import cache
from pathlib import Path

from stackforge_shared import TEMPLATES_DIR
from stackforge_shared.models.difficulty_presets_schema import DifficultyPresets
from stackforge_shared.models.enums_schema import BusinessModel, Difficulty, Industry
from stackforge_shared.models.event_catalog_schema import EventCatalog
from stackforge_shared.models.industry_template_schema import IndustryTemplate
from stackforge_shared.models.location_profile_schema import LocationProfile
from stackforge_shared.models.startup_configuration_schema import StartupConfiguration


def _read(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


@cache
def industry_templates() -> dict[Industry, IndustryTemplate]:
    templates = (
        IndustryTemplate.model_validate(_read(p))
        for p in sorted((TEMPLATES_DIR / "industries").glob("*.json"))
    )
    return {t.industry: t for t in templates}


@cache
def difficulty_presets() -> DifficultyPresets:
    return DifficultyPresets.model_validate(_read(TEMPLATES_DIR / "difficulty.json"))


@cache
def event_catalog() -> EventCatalog:
    return EventCatalog.model_validate(_read(TEMPLATES_DIR / "events.json"))


def build_configuration(
    industry: Industry | str,
    difficulty: Difficulty | str = Difficulty.normal,
    *,
    business_model: BusinessModel | str | None = None,
    initial_capital: int | None = None,
    initial_price: int | None = None,
    market_size: int | None = None,
    location_profile: LocationProfile | None = None,
) -> StartupConfiguration:
    """A configuration for an industry, using the template defaults for anything not given.

    `location_profile` comes from the simulation service's resolver (simulation/locations); without
    one the configuration has no location, which the engine treats as the neutral baseline.
    """
    template = industry_templates()[Industry(industry)]
    defaults = template.defaults
    catalog = event_catalog()
    return StartupConfiguration(
        industry=template.industry,
        business_model=BusinessModel(business_model or defaults.business_model),
        difficulty=Difficulty(difficulty),
        initial_capital=initial_capital if initial_capital is not None else defaults.initial_capital,
        initial_price=initial_price if initial_price is not None else defaults.initial_price,
        market_size=market_size if market_size is not None else defaults.market_size,
        template_version=template.template_version,
        parameters=template.parameters.model_copy(deep=True),
        difficulty_modifiers=getattr(difficulty_presets(), Difficulty(difficulty).value.lower()),
        events_version=catalog.events_version,
        events=[e.model_copy(deep=True) for e in catalog.events],
        location_profile=location_profile.model_copy(deep=True) if location_profile else None,
    )

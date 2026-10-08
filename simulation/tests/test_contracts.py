import json

import pytest
from stackforge_shared import TEMPLATES_DIR
from stackforge_shared.models.enums_schema import Industry
from stackforge_shared.models.industry_template_schema import IndustryTemplate
from stackforge_shared.models.startup_configuration_schema import StartupConfiguration
from stackforge_shared.templates import build_configuration

TEMPLATE_FILES = sorted((TEMPLATES_DIR / "industries").glob("*.json"))


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.mark.parametrize("path", TEMPLATE_FILES, ids=lambda p: p.stem)
def test_templates_validate_against_generated_models(path) -> None:
    template = IndustryTemplate.model_validate(load(path))
    mix = template.parameters.segment_mix
    total = mix.price_sensitive + mix.premium + mix.loyal + mix.occasional + mix.enterprise
    assert total == pytest.approx(1.0)


def test_every_industry_has_a_template() -> None:
    industries = {IndustryTemplate.model_validate(load(p)).industry for p in TEMPLATE_FILES}
    assert industries == set(Industry)


def test_configuration_round_trips_as_camel_case() -> None:
    config = build_configuration("SAAS", "NORMAL")
    wire = config.model_dump(by_alias=True, mode="json")
    assert wire["initialCapital"] == 100_000_000
    assert wire["parameters"]["baseChurnRate"] == 0.05
    assert wire["eventsVersion"] == load(TEMPLATES_DIR / "events.json")["eventsVersion"]
    assert StartupConfiguration.model_validate(wire) == config


def test_out_of_range_rate_is_rejected() -> None:
    template = load(TEMPLATES_DIR / "industries" / "saas.json")
    template["parameters"]["baseChurnRate"] = 1.5
    with pytest.raises(ValueError):
        IndustryTemplate.model_validate(template)

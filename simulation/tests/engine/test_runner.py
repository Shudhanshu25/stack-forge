import json

import pytest
from stackforge_shared.models.enums_schema import Industry
from stackforge_shared.templates import build_configuration

from runner.__main__ import main
from runner.viability import BUDGET_SHARES, survives


def test_cli_runs_every_industry(capsys, tmp_path) -> None:
    out = tmp_path / "records.json"
    assert main(["--industry", "all", "--turns", "4", "--json", str(out)]) == 0
    printed = capsys.readouterr().out
    for industry in Industry:
        assert industry.value in printed
    records = json.loads(out.read_text(encoding="utf-8"))
    assert set(records) == {i.value for i in Industry}
    assert all(len(r) == 4 for r in records.values())


@pytest.mark.parametrize("industry", list(Industry))
def test_templates_are_viable_on_normal(industry) -> None:
    """Calibration guard: some disciplined budget survives 24 turns on most seeds."""
    config = build_configuration(industry, "NORMAL")
    best = 0.0
    for share in BUDGET_SHARES:
        budget = round(config.initial_capital * share / 100_000) * 100_000
        alive = sum(survives(config, budget, seed, 24)[0] for seed in range(10))
        best = max(best, alive / 10)
    assert best >= 0.6, f"{industry.value}: best survival {best:.0%}"

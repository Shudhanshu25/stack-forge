import json

import pytest
from stackforge_shared.models.enums_schema import Industry
from stackforge_shared.templates import build_configuration

from engine import ReplayError, create_initial_state, replay, replay_mismatches, run_turn
from engine.models import SimulationTurn
from tests.engine.helpers import SEED, dump, play


def test_same_inputs_give_identical_records(config) -> None:
    first = [dump(r) for r in play(config, 12)]
    second = [dump(r) for r in play(config, 12)]
    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)


def test_initial_state_depends_only_on_config_and_seed(config) -> None:
    assert dump(create_initial_state(config, 5)) == dump(create_initial_state(config, 5))
    assert dump(create_initial_state(config, 5)) != dump(create_initial_state(config, 6))


def test_different_seeds_give_different_runs(config) -> None:
    a = [r.state_after.customers for r in play(config, 10, 1)]
    b = [r.state_after.customers for r in play(config, 10, 2)]
    assert a != b


@pytest.mark.parametrize("industry", list(Industry))
def test_replay_rebuilds_a_twenty_turn_run(industry) -> None:
    config = build_configuration(industry)
    records = play(config, 20, policy="random")
    initial = create_initial_state(config, SEED)
    replayed = replay(initial, records, SEED, config)
    assert [dump(r.state_after) for r in replayed] == [dump(r.state_after) for r in records]
    assert replay_mismatches(initial, records, SEED, config) == []


def test_replay_survives_a_json_round_trip(config) -> None:
    """Records stored as JSON (as MongoDB will hold them) replay exactly."""
    records = play(config, 20, policy="random")
    stored = json.loads(json.dumps([dump(r) for r in records]))
    restored = [SimulationTurn.model_validate(r) for r in stored]
    initial = create_initial_state(config, SEED)
    assert replay_mismatches(initial, restored, SEED, config) == []


def test_any_single_turn_replays_on_its_own(config) -> None:
    records = play(config, 15, policy="random")
    for record in (records[0], records[7], records[-1]):
        again = run_turn(
            record.state_before,
            record.decisions,
            config,
            SEED,
            record.turn_number,
            record.agent_effects,
        )
        assert dump(again) == dump(record)


def test_replay_detects_a_tampered_record(config) -> None:
    records = play(config, 10)
    target = records[4]
    assert target.decisions, "growth policy decides every turn"
    tampered_decision = target.decisions[0].model_copy(
        update={"value": target.decisions[0].value + 100_000}
    )
    records[4] = target.model_copy(update={"decisions": [tampered_decision, *target.decisions[1:]]})
    initial = create_initial_state(config, SEED)
    assert 5 in replay_mismatches(initial, records, SEED, config)


def test_replay_rejects_a_gap_in_turns(config) -> None:
    records = play(config, 5)
    with pytest.raises(ReplayError):
        replay(create_initial_state(config, SEED), [records[0], records[2]], SEED, config)

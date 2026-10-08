from engine import create_initial_state, run_turn
from engine.models import Decision, DecisionType, SimulationTurn, StartupConfiguration
from runner.policies import POLICIES, accepted_only

SEED = 1234


def decision(kind: str, value: int) -> Decision:
    return Decision(type=DecisionType(kind), value=value)


def play(
    config: StartupConfiguration, turns: int, seed: int = SEED, policy: str = "growth"
) -> list[SimulationTurn]:
    """Plays a run with a scripted policy, stopping at bankruptcy."""
    state = create_initial_state(config, seed)
    records = []
    for turn in range(1, turns + 1):
        if state.cash < 0:
            break
        decisions = accepted_only(state, config, POLICIES[policy](state, config, turn, seed))
        record = run_turn(state, decisions, config, seed, turn)
        records.append(record)
        state = record.state_after
    return records


def dump(model) -> dict:
    return model.model_dump(mode="json", by_alias=True)

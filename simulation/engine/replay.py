"""replay: rebuild a run from its stored turn records."""

from .models import SimulationState, SimulationTurn, StartupConfiguration
from .turn import run_turn


class ReplayError(ValueError):
    """The records do not form a contiguous sequence of turns."""


def replay(
    initial_state: SimulationState,
    records: list[SimulationTurn],
    seed: int,
    config: StartupConfiguration,
) -> list[SimulationTurn]:
    """Recomputes every turn from the initial state, the stored decisions and the stored agent
    effects. LLMs are never called: stored effects are used as they are.

    The specification lists replay(initial_state, records, seed); the configuration is also
    required because the engine reads the startup's economics from it.
    """
    state = initial_state
    replayed: list[SimulationTurn] = []
    for record in records:
        if record.turn_number != state.turn + 1:
            raise ReplayError(f"expected turn {state.turn + 1}, found {record.turn_number}")
        turn = run_turn(
            state, record.decisions, config, seed, record.turn_number, record.agent_effects
        )
        replayed.append(turn)
        state = turn.state_after
    return replayed


def replay_mismatches(
    initial_state: SimulationState,
    records: list[SimulationTurn],
    seed: int,
    config: StartupConfiguration,
) -> list[int]:
    """Turn numbers whose recomputed stateAfter differs from the stored one (empty if none)."""
    replayed = replay(initial_state, records, seed, config)
    return [
        stored.turn_number
        for stored, again in zip(records, replayed, strict=True)
        if stored.state_after.model_dump(mode="json") != again.state_after.model_dump(mode="json")
    ]

import pytest
from stackforge_shared.templates import build_configuration

from engine import create_initial_state
from engine.models import SimulationState, StartupConfiguration
from tests.engine.helpers import SEED


@pytest.fixture
def config() -> StartupConfiguration:
    return build_configuration("SAAS", "NORMAL")


@pytest.fixture
def state(config: StartupConfiguration) -> SimulationState:
    return create_initial_state(config, SEED)

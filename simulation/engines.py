"""The engine versions this service can run.

Every simulation records the engineVersion it was created with and is computed by that version
for its whole life, so formula changes never alter an existing simulation or its replay.

The current version is the `engine` package. Before changing formulas, freeze it with
`python -m engine_freeze`: that copies it to `engine_v<major>_<minor>_<patch>` (discovered
here automatically) and writes its replay fixture. Then edit `engine/` and bump ENGINE_VERSION.
"""

import importlib
import pkgutil
import re
from functools import cache
from pathlib import Path
from types import ModuleType

import engine

CURRENT = engine.ENGINE_VERSION
FROZEN_PACKAGE = re.compile(r"^engine_v(\d+)_(\d+)_(\d+)$")


class UnsupportedEngineVersionError(LookupError):
    def __init__(self, version: str) -> None:
        self.version = version
        super().__init__(
            f"engine version {version} is not available (retained: {', '.join(retained())})"
        )


@cache
def _packages() -> dict[str, str]:
    """Version -> package name: the current engine plus every frozen copy beside it."""
    found = {CURRENT: "engine"}
    root = Path(__file__).resolve().parent
    for module in pkgutil.iter_modules([str(root)]):
        match = FROZEN_PACKAGE.match(module.name)
        if module.ispkg and match:
            found[".".join(match.groups())] = module.name
    return found


def retained() -> list[str]:
    """Every version this service can run, oldest first."""
    return sorted(_packages(), key=lambda v: tuple(int(p) for p in v.split(".")))


def get_engine(version: str | None = None) -> ModuleType:
    """The engine module for a simulation's recorded version (the current one if None)."""
    wanted = version or CURRENT
    package = _packages().get(wanted)
    if package is None:
        raise UnsupportedEngineVersionError(wanted)
    module = importlib.import_module(package)
    if wanted != module.ENGINE_VERSION:
        found = module.ENGINE_VERSION
        raise RuntimeError(f"{package} reports version {found}, expected {wanted}")
    return module

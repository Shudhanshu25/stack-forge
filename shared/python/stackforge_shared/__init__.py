"""Shared contracts for the Python services.

Models in ``stackforge_shared.models`` are generated from ``shared/schemas``; regenerate with
``npm run generate`` from the repository root.
"""

from pathlib import Path

SHARED_DIR = Path(__file__).resolve().parents[2]
SCHEMAS_DIR = SHARED_DIR / "schemas"
TEMPLATES_DIR = SHARED_DIR / "templates"

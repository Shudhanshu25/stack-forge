# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from . import session_schema


class SessionListResponse(BaseModel):
    """
    Active sessions, most recently used first.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    sessions: list[session_schema.Session]

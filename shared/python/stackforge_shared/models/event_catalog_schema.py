# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import market_event_schema


class EventCatalog(BaseModel):
    """
    Shape of shared/templates/events.json.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    events_version: str = Field(
        ..., alias='eventsVersion', pattern='^[0-9]+\\.[0-9]+\\.[0-9]+$'
    )
    events: list[market_event_schema.MarketEvent] = Field(..., min_length=1)

# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from . import enums_schema


class Decision(BaseModel):
    """
    One founder decision for a turn. The meaning of value depends on type: PRICING = price in paise; MARKETING = monthly marketing budget in paise; HIRING = target employee headcount; PRODUCT_QUALITY = product investment in paise. Reserved types are rejected by the engine.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    type: enums_schema.DecisionType
    value: int

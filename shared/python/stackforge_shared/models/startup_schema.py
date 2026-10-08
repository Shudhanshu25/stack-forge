# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from . import location_schema, product_schema, startup_configuration_schema


class Startup(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    id: str
    owner_id: str = Field(..., alias='ownerId')
    name: str = Field(..., max_length=80, min_length=1)
    product: product_schema.Product
    configuration: startup_configuration_schema.StartupConfiguration
    created_at: AwareDatetime = Field(..., alias='createdAt')
    updated_at: AwareDatetime = Field(..., alias='updatedAt')
    location: location_schema.Location | None = Field(
        ...,
        description='Null for startups created before locations existed (they use the neutral profile).',
    )

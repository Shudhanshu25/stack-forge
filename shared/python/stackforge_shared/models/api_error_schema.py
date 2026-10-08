# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ApiErrorBody(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    code: str = Field(
        ...,
        description='Stable machine-readable code, e.g. VALIDATION_ERROR, UNAUTHORIZED, TOKEN_EXPIRED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED, PAYLOAD_TOO_LARGE, INTERNAL_ERROR.',
    )
    message: str
    details: Any


class ApiError(BaseModel):
    """
    The single error shape returned by every API.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    error: ApiErrorBody = Field(..., title='ApiErrorBody')

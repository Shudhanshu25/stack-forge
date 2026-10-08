# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field

from . import enums_schema


class User(BaseModel):
    """
    Public view of a user. The password hash never leaves the backend.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    id: str
    email: EmailStr
    name: str = Field(..., max_length=100, min_length=1)
    role: enums_schema.UserRole
    created_at: AwareDatetime = Field(..., alias='createdAt')
    onboarding_completed: bool = Field(
        ...,
        alias='onboardingCompleted',
        description='Whether the first-launch walkthrough was finished or dismissed.',
    )
    email_verified: bool = Field(
        ...,
        alias='emailVerified',
        description='Whether the email address was confirmed (verification link, password reset or Google). Unverified accounts cannot start simulations.',
    )
    has_password: bool = Field(
        ...,
        alias='hasPassword',
        description='False for accounts created with Google sign-in until a password is set through a reset.',
    )
    google_linked: bool = Field(
        ...,
        alias='googleLinked',
        description='Whether Google sign-in is linked to the account.',
    )

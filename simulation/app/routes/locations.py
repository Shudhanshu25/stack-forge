from fastapi import APIRouter
from stackforge_shared.models.location_catalog_schema import LocationCatalog
from stackforge_shared.models.location_profile_request_schema import LocationProfileRequest
from stackforge_shared.models.location_profile_schema import LocationProfile

import locations
from app.errors import AppError

router = APIRouter()


@router.get("/locations", response_model=LocationCatalog)
def catalog() -> LocationCatalog:
    """States, listed cities and tiers for the location step of the creation wizard."""
    return locations.catalog()


@router.post("/locations/profile", response_model=LocationProfile)
def profile(body: LocationProfileRequest) -> LocationProfile:
    """A listed city's profile, or any other city's from its state and tier. 400 if unknown."""
    try:
        return locations.resolve(
            body.state.root if hasattr(body.state, "root") else body.state,
            city_id=getattr(body.city_id, "root", body.city_id),
            city=body.city,
            tier=body.tier.value if body.tier is not None else None,
        )
    except locations.LocationError as exc:
        raise AppError(400, "UNKNOWN_LOCATION", str(exc)) from exc

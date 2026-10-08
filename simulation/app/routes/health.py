from fastapi import APIRouter
from stackforge_shared.models.health_response_schema import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, response_model_by_alias=True)
def health() -> HealthResponse:
    return HealthResponse(status="ok")

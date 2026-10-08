from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from opentelemetry import context as otel_context
from stackforge_shared.models.decision_preview_schema import DecisionPreview
from stackforge_shared.models.engine_preview_request_schema import EnginePreviewRequest
from stackforge_shared.models.engine_replay_request_schema import EngineReplayRequest
from stackforge_shared.models.engine_replay_response_schema import EngineReplayResponse
from stackforge_shared.models.engine_start_request_schema import EngineStartRequest
from stackforge_shared.models.engine_start_response_schema import EngineStartResponse
from stackforge_shared.models.pipeline_turn_request_schema import PipelineTurnRequest

from app.pipeline.turn import PipelineDeps, run_pipeline
from app.services import engine_service

router = APIRouter()


@router.post("/engine/start", response_model=EngineStartResponse, response_model_exclude_none=True)
def start(body: EngineStartRequest) -> EngineStartResponse:
    return engine_service.start(body)


@router.post("/engine/preview", response_model=DecisionPreview, response_model_exclude_none=True)
def preview(body: EnginePreviewRequest) -> DecisionPreview:
    return engine_service.preview(body)


@router.post(
    "/engine/replay", response_model=EngineReplayResponse, response_model_exclude_none=True
)
def replay(body: EngineReplayRequest) -> EngineReplayResponse:
    return engine_service.replay(body)


@router.post("/pipeline/turn")
def pipeline_turn(body: PipelineTurnRequest, request: Request) -> StreamingResponse:
    """Streams NDJSON PipelineEvents: stage events as stages finish, then a result or error."""
    deps: PipelineDeps = request.app.state.pipeline_deps
    lines = (
        event.model_dump_json(by_alias=True, exclude_none=True) + "\n"
        for event in run_pipeline(body, deps, otel_context.get_current())
    )
    return StreamingResponse(lines, media_type="application/x-ndjson")

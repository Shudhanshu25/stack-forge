"""Engine operations behind the /engine routes. Maps engine exceptions to API errors."""

from stackforge_shared.models.decision_preview_schema import DecisionPreview
from stackforge_shared.models.engine_preview_request_schema import EnginePreviewRequest
from stackforge_shared.models.engine_replay_request_schema import EngineReplayRequest
from stackforge_shared.models.engine_replay_response_schema import EngineReplayResponse
from stackforge_shared.models.engine_start_request_schema import EngineStartRequest
from stackforge_shared.models.engine_start_response_schema import EngineStartResponse

import engine
import engines
from app.errors import AppError


def start(request: EngineStartRequest) -> EngineStartResponse:
    state = call_engine(engine.create_initial_state, request.configuration, request.seed)
    return EngineStartResponse(state=state, engine_version=engine.ENGINE_VERSION)


def engine_for(version: str | None):
    """The engine a simulation was created with; 409 if this service no longer has it."""
    try:
        return engines.get_engine(version)
    except engines.UnsupportedEngineVersionError as exc:
        raise AppError(
            409, "ENGINE_VERSION_UNSUPPORTED", str(exc), {"version": exc.version}
        ) from exc


def preview(request: EnginePreviewRequest) -> DecisionPreview:
    eng = engine_for(request.engine_version)
    return call_engine(
        eng.preview,
        request.state,
        request.decisions,
        request.configuration,
        request.seed,
        request.turn_number,
    )


def replay(request: EngineReplayRequest) -> EngineReplayResponse:
    eng = engine_for(request.engine_version)
    records = call_engine(
        eng.replay, request.initial_state, request.records, request.seed, request.configuration
    )
    mismatches = [
        stored.turn_number
        for stored, again in zip(request.records, records, strict=True)
        if stored.state_after.model_dump(mode="json") != again.state_after.model_dump(mode="json")
    ]
    return EngineReplayResponse(records=records, mismatches=mismatches)


def call_engine(fn, *args):
    try:
        return fn(*args)
    except Exception as exc:
        # Matched by name: each retained engine version defines its own exception classes.
        kind = type(exc).__name__
        if kind == "EngineInputError":
            raise AppError(400, "ENGINE_INPUT_ERROR", str(exc)) from exc
        if kind == "ReplayError":
            raise AppError(400, "REPLAY_ERROR", str(exc)) from exc
        raise

import json

from fastapi import APIRouter, Request
from stackforge_shared.models.engine_analytics_request_schema import EngineAnalyticsRequest
from stackforge_shared.models.engine_info_response_schema import EngineInfoResponse
from stackforge_shared.models.engine_scenario_request_schema import EngineScenarioRequest
from stackforge_shared.models.scenario_comparison_schema import ScenarioComparison
from stackforge_shared.models.simulation_analytics_schema import SimulationAnalytics

from app.analytics.analytics import build_analytics
from app.analytics.scenario import compare_scenarios
from app.pipeline.turn import PipelineDeps
from app.services.engine_service import call_engine
from engine import ENGINE_VERSION

router = APIRouter()


@router.post(
    "/analytics/simulation", response_model=SimulationAnalytics, response_model_exclude_none=False
)
def analytics(body: EngineAnalyticsRequest) -> SimulationAnalytics:
    return call_engine(build_analytics, body)


@router.post(
    "/engine/scenario", response_model=ScenarioComparison, response_model_exclude_none=False
)
def scenario(body: EngineScenarioRequest) -> ScenarioComparison:
    return call_engine(compare_scenarios, body)


@router.get("/engine/info", response_model=EngineInfoResponse)
def info(request: Request) -> EngineInfoResponse:
    deps: PipelineDeps = request.app.state.pipeline_deps
    model_version = dataset_version = None
    try:
        artifacts = deps.settings.forecast_model_dir
        current = (artifacts / "CURRENT").read_text().strip()
        meta = json.loads((artifacts / current / "revenue.json").read_text())
        model_version, dataset_version = meta["modelVersion"], meta["trainingDatasetVersion"]
    except (OSError, KeyError, ValueError):
        pass
    return EngineInfoResponse(
        engine_version=ENGINE_VERSION,
        model_version=model_version,
        training_dataset_version=dataset_version,
        llm_configured=deps.llm is not None,
        agent_model=deps.settings.llm_agent_model,
        advisor_model=deps.settings.llm_advisor_model,
    )

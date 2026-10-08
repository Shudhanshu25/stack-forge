from fastapi import APIRouter, Request
from stackforge_shared.models.advisor_request_schema import AdvisorRequest
from stackforge_shared.models.ai_advice_schema import AIAdvice

from app.advisor.advisor import advise
from app.llm.budget import TokenMeter
from app.pipeline.turn import PipelineDeps

router = APIRouter()


@router.post("/advisor/ask", response_model=AIAdvice, response_model_exclude_none=True)
def ask(body: AdvisorRequest, request: Request) -> AIAdvice:
    """On-demand AI CEO advice about one turn. Failures return advice marked unavailable."""
    deps: PipelineDeps = request.app.state.pipeline_deps
    return advise(
        deps.llm,
        deps.settings,
        mode=body.mode,
        question=body.question,
        turn=body.turn,
        history=body.history,
        industry=body.industry,
        business_model=body.business_model,
        profile=body.startup_profile,
        meter=TokenMeter.for_request(deps.settings.llm_turn_token_budget, body.token_allowance),
    )

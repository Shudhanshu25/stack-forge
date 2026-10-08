import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.errors import error_body
from app.logging import log_context
from app.observability import observe_request, tag_request

logger = logging.getLogger("app.request")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Propagates X-Request-Id (set by Node) into logs and rejects oversized bodies."""

    def __init__(self, app, max_request_bytes: int) -> None:
        super().__init__(app)
        self.max_request_bytes = max_request_bytes

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        token = log_context.set({"requestId": request_id})
        tag_request(request_id)
        started = time.perf_counter()
        try:
            length = request.headers.get("content-length")
            if length is not None and length.isdigit() and int(length) > self.max_request_bytes:
                response: Response = JSONResponse(
                    status_code=413,
                    content=error_body("PAYLOAD_TOO_LARGE", "Request body too large"),
                )
            else:
                response = await call_next(request)
            response.headers["X-Request-Id"] = request_id
            observe_request(request, response.status_code, time.perf_counter() - started)
            logger.info(
                "request completed",
                extra={
                    "fields": {
                        "method": request.method,
                        "path": request.url.path,
                        "status": response.status_code,
                        "durationMs": round((time.perf_counter() - started) * 1000, 1),
                    }
                },
            )
            return response
        finally:
            log_context.reset(token)

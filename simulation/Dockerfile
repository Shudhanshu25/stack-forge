# Simulation service: engine, forecasting, agents and the AI CEO behind FastAPI.
# Build context is the repository root: docker build -f simulation/Dockerfile .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app
# libgomp: OpenMP runtime used by XGBoost.
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# The shared package resolves schemas and templates relative to its own location, so it is
# installed in place (editable) at /app/shared/python.
COPY shared/schemas shared/schemas
COPY shared/templates shared/templates
COPY shared/python shared/python
COPY simulation/requirements.txt simulation/requirements.txt
RUN cd simulation && pip install -r requirements.txt

COPY simulation simulation

# Train the forecasting model at build time. Seeded, so every build gets the same dataset and
# the same comparison; the image never starts without a model.
ARG TRAIN_ARGS=""
RUN cd simulation && python -m ml.train ${TRAIN_ARGS}

RUN useradd --system --uid 10001 app && chown -R app /app/simulation/ml
USER app
WORKDIR /app/simulation

ENV APP_ENV=production HOST=0.0.0.0 PORT=8000
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"
CMD ["python", "-m", "app.main"]

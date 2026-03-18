# syntax=docker/dockerfile:1.7

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
  && rm -rf /var/lib/apt/lists/*

ENV HF_HOME=/root/.cache/huggingface
ENV TRANSFORMERS_CACHE=/root/.cache/huggingface
ENV STANZA_RESOURCES_DIR=/root/stanza_resources
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

RUN mkdir -p /root/.cache/huggingface /root/stanza_resources

COPY requirements.txt .

# Keep installs cacheable and force CPU torch wheels for predictable image size.
# Torch 2.6 defaults break Stanza model loading (weights_only=True), so pin 2.5.1.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install --index-url https://download.pytorch.org/whl/cpu torch==2.5.1 && \
    pip install -r requirements.txt

COPY app/ ./app/

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

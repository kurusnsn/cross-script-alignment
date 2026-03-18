# syntax=docker/dockerfile:1.7

FROM python:3.11-slim

# System deps (espeak for phonemizer, build tools for wheels, ICU for pyicu)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    libicu-dev \
    pkg-config \
    espeak-ng \
    espeak-ng-data \
    git \
  && rm -rf /var/lib/apt/lists/*

ENV HF_HOME=/root/.cache/huggingface
ENV TRANSFORMERS_CACHE=/root/.cache/huggingface
ENV HF_DATASETS_CACHE=/root/.cache/huggingface
ENV CLTS_PATH=/opt/clts
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN mkdir -p /root/.cache/huggingface /opt/clts

COPY requirements.txt .

# Install deps with cached pip directory and CPU-only torch to avoid giant CUDA wheels.
# Torch 2.6 defaults break Stanza model loading (weights_only=True), so pin 2.5.1.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip wheel setuptools==80.9.0 && \
    pip install --index-url https://download.pytorch.org/whl/cpu torch==2.5.1 && \
    pip install -r requirements.txt

# CLTS dataset is small and stable; keep it in image for epitran.
RUN git clone --depth 1 https://github.com/cldf-clts/clts.git /opt/clts || true

# Copy app source code last so code changes do not invalidate dependency layers.
COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

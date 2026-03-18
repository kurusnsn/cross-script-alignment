# syntax=docker/dockerfile:1.7

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

ENV HF_HOME=/root/.cache/huggingface
ENV TRANSFORMERS_CACHE=/root/.cache/huggingface
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

COPY requirements.txt .

# Install CPU torch first so requirements (torch>=2.0.0) does not pull CUDA wheels.
# Pin 2.5.1 to stay compatible with shared runtime expectations.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install --index-url https://download.pytorch.org/whl/cpu torch==2.5.1 && \
    pip install -r requirements.txt

COPY . .

RUN mkdir -p /root/.cache/huggingface

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]

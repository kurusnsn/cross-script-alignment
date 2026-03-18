import json
import time
import asyncio
import httpx
import numpy as np
import os
import sys

# Configuration
BASE_URL = os.getenv("PERF_TARGET_URL", "http://localhost:8000")
CONCURRENCY = 5
REQUESTS_PER_ENDPOINT = 50
OUTPUT_FILE = "perf/baseline.json"

CRITICAL_ENDPOINTS = [
    {
        "name": "health_check",
        "method": "GET",
        "path": "/healthz",
        "payload": None
    },
    {
        "name": "alignerate_basic",
        "method": "POST",
        "path": "/align",
        "payload": {"text": "Hello world", "source_lang": "en", "target_lang": "fa"}
    },
    {
        "name": "phrase_align",
        "method": "POST",
        "path": "/align/phrase-align",
        "payload": {
            "source_text": "How are you?",
            "target_text": "چطوری؟"
        }
    },
    {
        "name": "auth_login_fail", # We check performance even for failures
        "method": "POST",
        "path": "/auth/login",
        "payload": {"username": "perf_test@example.com", "password": "WrongPassword123!"}
    }
]

async def benchmark_endpoint(client, endpoint):
    latencies = []
    errors = 0
    
    print(f"Benchmarking {endpoint['name']}...")
    
    async def make_request():
        nonlocal errors
        start = time.perf_counter()
        try:
            if endpoint["method"] == "GET":
                resp = await client.get(endpoint["path"])
            else:
                resp = await client.post(endpoint["path"], json=endpoint["payload"])
            
            duration = time.perf_counter() - start
            if resp.status_code >= 500:
                errors += 1
            return duration
        except Exception:
            errors += 1
            return None

    # Warm up
    await make_request()
    
    # Run benchmark with light concurrency
    for i in range(0, REQUESTS_PER_ENDPOINT, CONCURRENCY):
        tasks = [make_request() for _ in range(CONCURRENCY)]
        batch_results = await asyncio.gather(*tasks)
        latencies.extend([r for r in batch_results if r is not None])

    if not latencies:
        return None

    p50 = np.percentile(latencies, 50) * 1000
    p95 = np.percentile(latencies, 95) * 1000
    p99 = np.percentile(latencies, 99) * 1000
    
    return {
        "p50_ms": round(p50, 2),
        "p95_ms": round(p95, 2),
        "p99_ms": round(p99, 2),
        "error_rate": round(errors / REQUESTS_PER_ENDPOINT, 4),
        "sample_count": len(latencies)
    }

async def main():
    if not os.path.exists("perf"):
        os.makedirs("perf")

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        baseline = {
            "metadata": {
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "target_url": BASE_URL,
                "concurrency": CONCURRENCY,
                "requests_per_endpoint": REQUESTS_PER_ENDPOINT
            },
            "endpoints": {}
        }
        
        for ep in CRITICAL_ENDPOINTS:
            result = await benchmark_endpoint(client, ep)
            if result:
                baseline["endpoints"][ep["name"]] = result
            else:
                print(f"Failed to benchmark {ep['name']}")
        
        with open(OUTPUT_FILE, "w") as f:
            json.dump(baseline, f, indent=2)
            
        print(f"\nBaseline generated and saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    asyncio.run(main())

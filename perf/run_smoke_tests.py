import json
import time
import asyncio
import httpx
import numpy as np
import os
import sys

# Configuration
BASE_URL = os.getenv("PERF_TARGET_URL", "http://localhost:8000")
BASELINE_FILE = "perf/baseline.json"
LATENCY_THRESHOLD_RATIO = 1.1 # 10% tolerance
CONCURRENCY = 5
REQUESTS_PER_ENDPOINT = 20 # Faster for smoke tests

async def benchmark_endpoint(client, name, method, path, payload):
    latencies = []
    errors = 0
    
    async def make_request():
        nonlocal errors
        start = time.perf_counter()
        try:
            if method == "GET":
                resp = await client.get(path)
            else:
                resp = await client.post(path, json=payload)
            
            duration = time.perf_counter() - start
            if resp.status_code >= 500:
                errors += 1
            return duration
        except Exception:
            errors += 1
            return None

    # Warm up
    await make_request()
    
    for i in range(0, REQUESTS_PER_ENDPOINT, CONCURRENCY):
        tasks = [make_request() for _ in range(CONCURRENCY)]
        batch_results = await asyncio.gather(*tasks)
        latencies.extend([r for r in batch_results if r is not None])

    if not latencies:
        return None

    return {
        "p95_ms": round(np.percentile(latencies, 95) * 1000, 2),
        "error_rate": round(errors / REQUESTS_PER_ENDPOINT, 4)
    }

async def main():
    if not os.path.exists(BASELINE_FILE):
        print(f"Error: Baseline file {BASELINE_FILE} not found.")
        sys.exit(1)

    with open(BASELINE_FILE, "r") as f:
        baseline = json.load(f)

    print(f"--- Performance Smoke Test ---")
    print(f"Target: {BASE_URL}")
    print(f"Baseline generated at: {baseline['metadata']['generated_at']}")
    print("-" * 30)

    regressions = []
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # We only test endpoints that have a baseline
        for name, base_metrics in baseline["endpoints"].items():
            # Find the configuration for this endpoint name
            # For this MVP, we re-use the mapping or assume we know it.
            # In a real system, we'd store the config in baseline.json too.
            config_map = {
                "health_check": ("GET", "/healthz", None),
                "alignerate_basic": ("POST", "/align", {"text": "Hello world", "source_lang": "en", "target_lang": "fa"}),
                "phrase_align": ("POST", "/align/phrase-align", {"source_text": "How are you?", "target_text": "چطوری؟"}),
                "auth_login_fail": ("POST", "/auth/login", {"username": "perf_test@example.com", "password": "WrongPassword123!"})
            }
            
            if name not in config_map:
                continue
                
            method, path, payload = config_map[name]
            current = await benchmark_endpoint(client, name, method, path, payload)
            
            if not current:
                print(f"FAILED to benchmark {name}")
                regressions.append(f"{name}: Failed to collect data")
                continue

            base_p95 = base_metrics["p95_ms"]
            curr_p95 = current["p95_ms"]
            
            threshold = base_p95 * LATENCY_THRESHOLD_RATIO
            status = "PASS"
            msg = ""

            if curr_p95 > threshold:
                status = "FAIL"
                msg = f" (Regression: {curr_p95}ms > {threshold}ms)"
                regressions.append(f"{name}: p95 latency regression ({curr_p95}ms vs baseline {base_p95}ms)")
            
            if current["error_rate"] > base_metrics["error_rate"]:
                status = "FAIL"
                msg += f" (Error rate increase: {current['error_rate']} > {base_metrics['error_rate']})"
                regressions.append(f"{name}: Error rate regression")

            print(f"[{status}] {name}: p95={curr_p95}ms, error_rate={current['error_rate']}{msg}")

    print("-" * 30)
    if regressions:
        print(f"RESULT: FAILED ({len(regressions)} regressions detected)")
        for r in regressions:
            print(f"  - {r}")
        sys.exit(1)
    else:
        print("RESULT: PASSED (All metrics within baseline + 10%)")
        sys.exit(0)

if __name__ == "__main__":
    asyncio.run(main())

"""Sample FastAPI Application (User Management & Shopping Service).

Monitored by the AI-Powered DevOps Monitoring System.
Tech Stack: FastAPI, Python, PostgreSQL.
Outputs structured logs to application.log for error detection and AI triage.
"""

import os
import sys
import logging
import math
import threading
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from application.database import get_db_connection, get_application_data, probe_database

# Ensure logs directory exists
LOG_DIR = os.getenv("LOG_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs"))
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.getenv("LOG_FILE_PATH", os.path.join(LOG_DIR, "application.log"))

# Configure Application Logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("application")

app = FastAPI(
    title="User Management Service",
    description="FastAPI microservice monitored by AI DevOps system",
    version="1.0.0"
)

REQUEST_METRICS_WINDOW_SECONDS = 60
REQUEST_METRICS_EXCLUDED_PATHS = {"/health", "/health/dependencies", "/metrics"}
_request_metrics_lock = threading.Lock()
_request_samples = deque()
_requests_total = 0
_errors_total = 0
_service_started_at = time.monotonic()


@app.middleware("http")
async def collect_request_metrics(request, call_next):
    global _requests_total, _errors_total
    started_at = time.monotonic()
    request_id = request.headers.get("x-request-id")
    if not request_id or len(request_id) > 128 or any(
        not (character.isascii() and (character.isalnum() or character in "-_."))
        for character in request_id
    ):
        request_id = uuid.uuid4().hex
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        response.headers["X-Request-ID"] = request_id
        return response
    except Exception:
        logger.exception(
            "[application] request_id=%s method=%s path=%s unhandled_exception",
            request_id,
            request.method,
            request.url.path,
        )
        raise
    finally:
        duration_ms = (time.monotonic() - started_at) * 1000
        log_message = (
            "[application] request_id=%s method=%s path=%s status=%s duration_ms=%.1f"
        )
        if request.url.path not in REQUEST_METRICS_EXCLUDED_PATHS or status_code >= 400:
            if status_code >= 500:
                logger.error(log_message, request_id, request.method, request.url.path, status_code, duration_ms)
            elif status_code >= 400:
                logger.warning(log_message, request_id, request.method, request.url.path, status_code, duration_ms)
            else:
                logger.info(log_message, request_id, request.method, request.url.path, status_code, duration_ms)

        if request.url.path not in REQUEST_METRICS_EXCLUDED_PATHS:
            completed_at = time.monotonic()
            duration_seconds = completed_at - started_at
            with _request_metrics_lock:
                _requests_total += 1
                if status_code >= 500:
                    _errors_total += 1
                _request_samples.append((completed_at, status_code, duration_seconds))


# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def index():
    """Application root endpoint."""
    return {
        "status": "online",
        "service": "User Management & Shopping API",
        "framework": "FastAPI",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0"
    }


@app.get("/health")
def health():
    """Health check endpoint used by Jenkins CI/CD stage 7 and monitoring dashboard."""
    return {
        "status": "healthy",
        "service": "User Management Service",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": "active",
        "database": "postgresql"
    }


@app.get("/health/dependencies")
def dependency_health():
    """Report a direct database probe separately from application process health."""
    database = probe_database()
    status = "healthy" if database["status"] == "UP" else (
        "degraded" if database["status"] == "DOWN" else "unknown"
    )
    return {"status": status, "checks": {"postgresql": database}}


@app.get("/metrics")
def request_metrics():
    """Expose measured request volume, errors, and latency for this application process."""
    now = time.monotonic()
    cutoff = now - REQUEST_METRICS_WINDOW_SECONDS
    with _request_metrics_lock:
        while _request_samples and _request_samples[0][0] < cutoff:
            _request_samples.popleft()
        samples = list(_request_samples)
        requests_total = _requests_total
        errors_total = _errors_total

    window_seconds = min(REQUEST_METRICS_WINDOW_SECONDS, max(1.0, now - _service_started_at))
    recent_errors = sum(1 for _, status_code, _ in samples if status_code >= 500)
    durations = sorted(duration for _, _, duration in samples)
    p95_index = max(0, math.ceil(len(durations) * 0.95) - 1)
    return {
        "status": "UP",
        "sampled_at": datetime.now(timezone.utc).isoformat(),
        "window_seconds": round(window_seconds, 1),
        "requests_total": requests_total,
        "errors_total": errors_total,
        "requests_per_second": round(len(samples) / window_seconds, 3),
        "error_rate_percent": round(
            (recent_errors / len(samples) * 100) if samples else 0.0, 2
        ),
        "latency_ms_avg": round(
            (sum(durations) / len(durations) * 1000) if durations else 0.0, 1
        ),
        "latency_ms_p95": round(durations[p95_index] * 1000, 1) if durations else 0.0,
    }


@app.get("/api/items")
def get_items():
    """Retrieve shopping items from PostgreSQL database."""
    try:
        items = get_application_data()
        return {"items": items, "count": len(items)}
    except Exception as exc:
        logger.error(
            "Database connection failed\n"
            "File \"database.py\", line 25\n"
            "ConnectionError: Database unavailable"
        )
        raise HTTPException(
            status_code=500,
            detail={"error": "Internal Server Error", "message": "PostgreSQL database unavailable."}
        ) from exc


@app.get("/api/simulate-db-error")
@app.post("/api/simulate-db-error")
def simulate_db_error():
    """Simulation route: Generates a PostgreSQL connection failure log for pipeline testing."""
    logger.error(
        "Database connection failed\n"
        "File \"database.py\", line 25\n"
        "ConnectionError: Database unavailable"
    )
    raise HTTPException(
        status_code=500,
        detail={
            "status": "error_simulated",
            "error_type": "ConnectionError",
            "message": "Simulated PostgreSQL connection failure logged to application.log."
        }
    )


@app.get("/api/simulate-crash")
@app.post("/api/simulate-crash")
def simulate_crash():
    """Simulation route: Triggers a CRITICAL unhandled error."""
    logger.critical(
        "CRITICAL System failure in user-service: OutOfMemory / NullPointer in payment pipeline.\n"
        "File \"application/app.py\", line 85, in process_transaction\n"
        "RuntimeError: Fatal service disruption encountered."
    )
    raise HTTPException(
        status_code=500,
        detail={
            "status": "critical_simulated",
            "error_type": "RuntimeError",
            "message": "Simulated critical failure logged to application.log."
        }
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("APP_PORT", 5000))
    host = os.getenv("APP_HOST", "0.0.0.0")
    logger.info("Starting FastAPI sample application on %s:%d", host, port)
    uvicorn.run("application.app:app", host=host, port=port, reload=False)

"""Monitoring Dashboard FastAPI Web Service.

Module 9 & 10 in the DevOps Monitoring pipeline.
Tech Stack: FastAPI, React, Python.
Provides REST API endpoints and serves the centralized React monitoring dashboard.
"""

import os
import sys
import json
import queue
import re
import requests
import threading
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# Add workspace root to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from monitoring.metrics_collector import MetricsCollector
from monitoring.log_collector import LogCollector
from monitoring.main import load_incidents, update_incident
from monitoring.error_intelligence import build_error_intelligence
from monitoring.remediation import (
    ALLOWED_RUNBOOKS,
    RemediationError,
    dispatch_remediation,
    remediation_status,
)

app = FastAPI(
    title="DevOps Central Monitoring Dashboard API",
    description="FastAPI backend serving real-time metrics and incident data to the React dashboard",
    version="1.0.0"
)

# Enable CORS for React frontend (Vite dev server on port 5173 / localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

metrics_collector = MetricsCollector()
log_collector = LogCollector()

APP_HEALTH_URL = os.getenv("APP_HEALTH_URL", "http://localhost:5000/health")
APP_SERVICE_BASE_URL = APP_HEALTH_URL.rsplit("/", 1)[0]
APP_DEPENDENCY_HEALTH_URL = os.getenv(
    "APP_DEPENDENCY_HEALTH_URL",
    f"{APP_SERVICE_BASE_URL}/health/dependencies",
)
APP_METRICS_URL = os.getenv("APP_METRICS_URL", f"{APP_SERVICE_BASE_URL}/metrics")


@app.get("/api/system-status")
def system_status():
    """Panel 1: FastAPI Application status and health check."""
    started_at = datetime.now(timezone.utc)
    status_data = {
        "status": "DOWN",
        "service": "User Management Service (FastAPI)",
        "http_code": 0,
        "details": {},
        "sampled_at": started_at.isoformat(),
        "latency_ms": None,
        "dependencies": {
            "postgresql": {"status": "UNKNOWN", "reason": "application unavailable"}
        },
    }
    try:
        res = requests.get(APP_HEALTH_URL, timeout=0.5)
        status_data["http_code"] = res.status_code
        if res.status_code == 200:
            status_data["status"] = "UP"
            status_data["details"] = res.json()
            status_data["latency_ms"] = round(
                (datetime.now(timezone.utc) - started_at).total_seconds() * 1000, 1
            )
    except requests.RequestException as exc:
        status_data["details"] = {"error": type(exc).__name__}

    if status_data["status"] == "UP":
        try:
            dependency_response = requests.get(APP_DEPENDENCY_HEALTH_URL, timeout=1.5)
            if dependency_response.ok:
                status_data["dependencies"] = dependency_response.json().get(
                    "checks", status_data["dependencies"]
                )
            else:
                status_data["dependencies"] = {
                    "postgresql": {
                        "status": "UNKNOWN",
                        "reason": f"dependency probe returned HTTP {dependency_response.status_code}",
                    }
                }
        except requests.RequestException as exc:
            status_data["dependencies"] = {
                "postgresql": {
                    "status": "UNKNOWN",
                    "reason": f"dependency probe failed: {type(exc).__name__}",
                }
            }

    return status_data


@app.get("/api/metrics")
def get_metrics():
    """Return host telemetry plus measured application request and latency metrics."""
    metrics = metrics_collector.get_system_metrics()
    try:
        service_response = requests.get(APP_METRICS_URL, timeout=1.0)
        if service_response.ok:
            metrics["service"] = service_response.json()
        else:
            metrics["service"] = {
                "status": "UNAVAILABLE",
                "http_code": service_response.status_code,
            }
    except requests.RequestException as exc:
        metrics["service"] = {
            "status": "UNAVAILABLE",
            "error_type": type(exc).__name__,
        }
    metrics_collector.record_sample(metrics)
    return metrics


@app.get("/api/metrics/history")
def get_metrics_history(
    limit: int = Query(default=10_080, ge=1, le=10_080),
    window_seconds: int = Query(default=604_800, ge=60, le=604_800),
):
    """Return persisted resource samples for the requested time window."""
    cutoff = datetime.now(timezone.utc).timestamp() - window_seconds
    history = [
        sample
        for sample in metrics_collector.get_history(limit)
        if datetime.fromisoformat(sample["sampled_at"]).timestamp() >= cutoff
    ]
    return {
        "samples": history,
        "count": len(history),
        "retention_seconds": metrics_collector.HISTORY_RETENTION_SECONDS,
        "sample_interval_seconds": metrics_collector.sample_interval_seconds,
    }


@app.get("/api/logs")
def get_logs(max_lines: int = 150, source: str = "all"):
    """Return a bounded window of application, Docker, or combined log records."""
    if not 1 <= max_lines <= 1000:
        raise HTTPException(status_code=422, detail="max_lines must be between 1 and 1000")

    source_name = source.lower().strip()
    if source_name not in {"all", "application", "docker"}:
        raise HTTPException(status_code=422, detail="source must be all, application, or docker")

    logs = []
    source_errors = {}
    requested_sources = ["application", "docker"] if source_name == "all" else [source_name]
    for log_source in requested_sources:
        try:
            source_logs = (
                log_collector.read_all_logs(max_lines=max_lines)
                if log_source == "application"
                else log_collector.fetch_docker_logs(tail=max_lines)
            )
            logs.extend(f"[{log_source}] {line}" for line in source_logs)
        except RuntimeError as exc:
            source_errors[log_source] = str(exc)
        except OSError as exc:
            source_errors[log_source] = f"Unable to read {log_source} logs: {exc}"

    if source_name == "all":
        def timestamp_key(line):
            candidate = line.split("] ", 1)[-1]
            match = re.match(r"(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)", candidate)
            if not match:
                return float("inf")
            try:
                parsed = datetime.fromisoformat(match.group(1).replace("Z", "+00:00"))
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                return parsed.timestamp()
            except ValueError:
                return float("inf")

        logs.sort(key=timestamp_key)
    logs = logs[-max_lines:]

    summary = {
        "total": len(logs),
        "info": sum(1 for line in logs if "INFO" in line.upper()),
        "warning": sum(1 for line in logs if "WARN" in line.upper()),
        "error": sum(1 for line in logs if "ERROR" in line.upper() or "CRITICAL" in line.upper()),
    }

    if source_name != "all" and source_errors:
        raise HTTPException(status_code=503, detail=source_errors[source_name])

    return {
        "lines": logs,
        "count": len(logs),
        "source": source_name,
        "container_name": log_collector.container_name,
        "summary": summary,
        "source_errors": source_errors,
    }


@app.get("/api/logs/stream")
def stream_logs(source: str = "all"):
    """Stream newly appended application and/or Docker log lines as server-sent events."""
    source_name = source.lower().strip()
    if source_name not in {"all", "application", "docker"}:
        raise HTTPException(status_code=422, detail="source must be all, application, or docker")

    def event_stream():
        event_queue = queue.Queue(maxsize=1000)
        stop_event = threading.Event()
        requested_sources = ["application", "docker"] if source_name == "all" else [source_name]

        def enqueue(payload):
            while not stop_event.is_set():
                try:
                    event_queue.put(payload, timeout=0.25)
                    return
                except queue.Full:
                    continue

        def publish_lines(log_source):
            try:
                stream = (
                    log_collector.tail_log_stream(stop_event=stop_event)
                    if log_source == "application"
                    else log_collector.tail_docker_logs(stop_event=stop_event)
                )
                for line in stream:
                    if stop_event.is_set():
                        break
                    enqueue({"source": log_source, "line": line})
            except RuntimeError as exc:
                enqueue({"source": log_source, "error": str(exc)})
            except OSError as exc:
                enqueue({"source": log_source, "error": f"Unable to stream {log_source} logs: {exc}"})

        workers = [
            threading.Thread(target=publish_lines, args=(log_source,), daemon=True)
            for log_source in requested_sources
        ]
        for worker in workers:
            worker.start()

        try:
            yield "retry: 3000\n\n"
            while True:
                try:
                    payload = event_queue.get(timeout=15)
                    yield f"data: {json.dumps(payload)}\n\n"
                except queue.Empty:
                    yield ": keep-alive\n\n"
        finally:
            stop_event.set()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/incidents")
def get_incidents():
    """Panels 5, 6, 7 & 8: Errors, Groq AI Analysis, Code Path, and Slack notifications."""
    incidents = load_incidents()
    return {"incidents": incidents, "count": len(incidents)}


@app.get("/api/error-intelligence")
def get_error_intelligence():
    """Return recurring patterns, cross-service correlations, and measured anomalies."""
    data = build_error_intelligence(
        incidents=load_incidents(),
        metric_samples=metrics_collector.get_history(),
        metric_thresholds=MetricsCollector._get_thresholds(),
    )
    data["remediation"] = remediation_status()
    return data


class RemediationRequest(BaseModel):
    runbook: str
    approved: bool = False


@app.post("/api/incidents/{incident_id}/remediate")
def remediate_incident(incident_id: str, request: RemediationRequest):
    """Dispatch an operator-approved, allow-listed runbook to the configured runner."""
    if not request.approved:
        raise HTTPException(status_code=400, detail="Explicit remediation approval is required.")
    if request.runbook not in ALLOWED_RUNBOOKS:
        raise HTTPException(status_code=422, detail="Unsupported remediation runbook.")
    incident = next(
        (item for item in load_incidents() if item.get("id") == incident_id),
        None,
    )
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found.")
    try:
        result = dispatch_remediation(incident, request.runbook)
    except RemediationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    audit = list(incident.get("remediation_history") or [])
    audit.append(result)
    updated = update_incident(
        incident_id,
        {"remediation_history": audit, "remediation_status": result["status"]},
    )
    if updated is None:
        raise HTTPException(status_code=500, detail="Incident disappeared during remediation update.")
    return {"incident_id": incident_id, "remediation": result}


@app.get("/api/deployments")
def get_deployments():
    """Panel 9: Jenkins build and deployment status (7-Stage Pipeline)."""
    deployments = [
        {
            "build_number": 43,
            "branch": "main",
            "commit": "fix(db): update PostgreSQL connection string and retry handling",
            "status": "SUCCESS",
            "timestamp": "2026-10-31 11:15:00",
            "duration": "1m 32s",
            "stages": [
                {"name": "Source Code", "status": "SUCCESS"},
                {"name": "Build", "status": "SUCCESS"},
                {"name": "Test", "status": "SUCCESS"},
                {"name": "Docker Build", "status": "SUCCESS"},
                {"name": "Push Image", "status": "SUCCESS"},
                {"name": "Deploy", "status": "SUCCESS"},
                {"name": "Health Check", "status": "SUCCESS"}
            ]
        },
        {
            "build_number": 42,
            "branch": "main",
            "commit": "feat(user): migrate from MongoDB to PostgreSQL schema",
            "status": "FAILED",
            "timestamp": "2026-10-31 10:30:00",
            "duration": "2m 05s",
            "stages": [
                {"name": "Source Code", "status": "SUCCESS"},
                {"name": "Build", "status": "SUCCESS"},
                {"name": "Test", "status": "SUCCESS"},
                {"name": "Docker Build", "status": "SUCCESS"},
                {"name": "Push Image", "status": "SUCCESS"},
                {"name": "Deploy", "status": "SUCCESS"},
                {"name": "Health Check", "status": "FAILED"}
            ]
        }
    ]
    return {"deployments": deployments}


@app.post("/api/simulate-error")
@app.get("/api/simulate-error")
def simulate_error(error_type: str = "db"):
    """Trigger or proxy an error simulation to test monitoring, Groq AI triage, and Slack."""
    target_url = "http://localhost:5000/api/simulate-db-error" if error_type == "db" else "http://localhost:5000/api/simulate-crash"
    try:
        res = requests.post(target_url, timeout=0.5)
        return {"status": "forwarded", "code": res.status_code, "target": target_url}
    except Exception as exc:
        return {"status": "app_unreachable_mock_logged", "error": str(exc), "target": target_url}


# Mount and serve the React Single-Page Application (SPA)
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "dist")
STATIC_INDEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates", "index.html")

if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/", response_class=FileResponse)
    def serve_root():
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

    @app.get("/{full_path:path}", response_class=FileResponse)
    def serve_react_app(full_path: str):
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
else:
    @app.get("/", response_class=HTMLResponse)
    def index():
        if os.path.exists(STATIC_INDEX):
            with open(STATIC_INDEX, "r", encoding="utf-8") as f:
                return f.read()
        return "<h1>AI-Powered DevOps Monitoring React Dashboard API</h1>"


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("DASHBOARD_PORT", 5050))
    host = os.getenv("DASHBOARD_HOST", "0.0.0.0")
    print(f"Starting DevOps FastAPI Dashboard Server on http://{host}:{port}")
    uvicorn.run("dashboard.app:app", host=host, port=port, reload=False)

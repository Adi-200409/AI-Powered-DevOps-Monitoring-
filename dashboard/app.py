"""Monitoring Dashboard FastAPI Web Service.

Module 9 & 10 in the DevOps Monitoring pipeline.
Tech Stack: FastAPI, React, Python.
Provides REST API endpoints and serves the centralized React monitoring dashboard.
"""

import os
import sys
import requests
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# Add workspace root to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from monitoring.metrics_collector import MetricsCollector
from monitoring.log_collector import LogCollector
from monitoring.main import load_incidents

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


@app.get("/api/system-status")
def system_status():
    """Panel 1: FastAPI Application status and health check."""
    status_data = {
        "status": "DOWN",
        "service": "User Management Service (FastAPI)",
        "http_code": 0,
        "details": {}
    }
    try:
        res = requests.get(APP_HEALTH_URL, timeout=2)
        status_data["http_code"] = res.status_code
        if res.status_code == 200:
            status_data["status"] = "UP"
            status_data["details"] = res.json()
    except Exception as exc:
        status_data["details"] = {"error": str(exc)}

    return status_data


@app.get("/api/metrics")
def get_metrics():
    """Panels 2 & 3: CPU and Memory statistics from metrics_collector.py."""
    return metrics_collector.get_system_metrics()


@app.get("/api/logs")
def get_logs(max_lines: int = 150):
    """Panel 4: Application log records from application.log."""
    logs = log_collector.read_all_logs(max_lines=max_lines)
    return {"lines": logs, "count": len(logs)}


@app.get("/api/incidents")
def get_incidents():
    """Panels 5, 6, 7 & 8: Errors, Groq AI Analysis, Code Path, and Slack notifications."""
    incidents = load_incidents()
    return {"incidents": incidents, "count": len(incidents)}


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


# Mount and serve the React Single-Page Application (SPA)
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "dist")
STATIC_INDEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates", "index.html")

if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}", response_class=FileResponse)
    def serve_react_app(full_path: str):
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

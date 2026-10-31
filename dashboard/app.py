"""Monitoring Dashboard Web Service.

Module 9 & 10 in the DevOps Monitoring pipeline.
A Flask web application that serves a centralized dashboard visualizing:
- System Overview & Live Health Check
- CPU & Memory Metrics
- Application Logs Viewer
- Real-time Error Detection & Alerts
- AI Root Cause Analysis & Remediations (Groq)
- Code Path Context (File & Function)
- Slack Alert Delivery Status
- Jenkins CI/CD Deployment History
"""

import os
import sys
import json
import requests
from flask import Flask, render_template, jsonify

# Add parent directory to path so monitoring modules can be imported
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from monitoring.metrics_collector import MetricsCollector
from monitoring.log_collector import LogCollector
from monitoring.main import load_incidents

app = Flask(__name__)
metrics_collector = MetricsCollector()
log_collector = LogCollector()

APP_HEALTH_URL = os.getenv("APP_HEALTH_URL", "http://localhost:5000/health")


@app.route("/")
def index():
    """Renders the main unified dashboard."""
    return render_template("index.html")


@app.route("/api/system-status")
def system_status():
    """Panel 1: Application status and uptime health check."""
    status_data = {
        "status": "DOWN",
        "service": "User Management Service",
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

    return jsonify(status_data)


@app.route("/api/metrics")
def get_metrics():
    """Panels 2 & 3: CPU and Memory statistics."""
    return jsonify(metrics_collector.get_system_metrics())


@app.route("/api/logs")
def get_logs():
    """Panel 4: Application log records."""
    logs = log_collector.read_all_logs(max_lines=150)
    return jsonify({"lines": logs, "count": len(logs)})


@app.route("/api/incidents")
def get_incidents():
    """Panels 5, 6, 7 & 8: Errors, AI Analysis, Code Path, and Slack notifications."""
    incidents = load_incidents()
    return jsonify({"incidents": incidents, "count": len(incidents)})


@app.route("/api/deployments")
def get_deployments():
    """Panel 9: Jenkins build and deployment status."""
    # Starter deployment records matching the Jenkins 7-stage CI/CD pipeline
    deployments = [
        {
            "build_number": 42,
            "branch": "main",
            "commit": "fix(db): correct MongoDB connection string",
            "status": "SUCCESS",
            "timestamp": "2026-10-31 11:15:00",
            "duration": "1m 45s",
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
            "build_number": 41,
            "branch": "main",
            "commit": "feat(user): update database configuration",
            "status": "FAILED",
            "timestamp": "2026-10-31 10:30:00",
            "duration": "2m 10s",
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
    return jsonify({"deployments": deployments})


if __name__ == "__main__":
    port = int(os.getenv("DASHBOARD_PORT", 5050))
    host = os.getenv("DASHBOARD_HOST", "0.0.0.0")
    print(f"Starting DevOps Central Monitoring Dashboard on http://{host}:{port}")
    app.run(host=host, port=port, debug=False)

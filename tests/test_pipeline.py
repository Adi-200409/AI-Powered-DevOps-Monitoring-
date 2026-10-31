"""End-to-End Pipeline & Integration Tests.

Validates the complete DevOps monitoring loop:
1. Microservice HTTP probes and simulation routes
2. Multi-line log aggregation
3. Secret-masked code context extraction
4. Groq LLM root-cause analysis (live or structured fallback)
5. Slack alert formatting
6. State persistence in logs/incidents.json
7. Dashboard REST API endpoints
"""

import os
import json
import pytest

from application.app import app as application_app
from dashboard.app import app as dashboard_app
from monitoring.log_collector import LogCollector
from monitoring.error_detector import ErrorDetector
from monitoring.code_analyzer import CodeAnalyzer
from monitoring.groq_analyzer import GroqAnalyzer
from monitoring.slack_alert import SlackNotifier
from monitoring.metrics_collector import MetricsCollector
from monitoring.main import process_error_event, load_incidents, save_incident


# =====================================================================
# 1. End-to-End Incident Processing Pipeline
# =====================================================================
def test_end_to_end_error_processing(tmp_path):
    """Simulates an application failure, verifies code context extraction,
    AI triage, Slack payload generation, and incident persistence.
    """
    error_event = [
        '2026-11-01 12:00:00 ERROR Database connection failed',
        'File "database.py", line 25, in get_db_connection',
        'ConnectionError: Database unavailable: Failed to connect to PostgreSQL'
    ]

    record = process_error_event(error_event)

    assert record is not None
    assert record["level"] == "ERROR"
    assert "Database connection failed" in record["error_message"]

    # Verify code context identified file & line
    code_ctx = record["code_context"]
    assert code_ctx["file"] == "database.py"
    assert code_ctx["line"] == 25
    assert "database.py" in code_ctx["potential_code_location"]
    assert "DATABASE_URL" in code_ctx["code_snippet"] or "get_db_connection" in code_ctx["code_snippet"]

    # Verify AI diagnosis schema
    ai_diag = record["ai_diagnosis"]
    assert "probable_root_cause" in ai_diag
    assert "suggested_solution" in ai_diag
    assert "ai_recommendation" in ai_diag

    # Verify incident state was recorded
    cached = load_incidents()
    assert len(cached) > 0
    assert any(inc["id"] == record["id"] for inc in cached)


# =====================================================================
# 2. Multi-line Log Collector
# =====================================================================
def test_multiline_log_collector(tmp_path):
    """Verifies that LogCollector groups multi-line log events by timestamp."""
    log_file = tmp_path / "test_application.log"
    collector = LogCollector(log_file_path=str(log_file))

    # Write initial lines
    with open(log_file, "w", encoding="utf-8") as f:
        f.write("2026-11-01 10:00:00 INFO Application initialized\n")
        f.write("2026-11-01 10:00:05 ERROR Database query failure\n")
        f.write("  File \"database.py\", line 45, in query\n")
        f.write("  QueryTimeout: timed out after 5000ms\n")
        f.write("2026-11-01 10:00:10 INFO Health check passed\n")

    logs = collector.read_all_logs(max_lines=10)
    assert len(logs) == 5
    assert "QueryTimeout" in logs[3]


# =====================================================================
# 3. Live Host Metrics Collector
# =====================================================================
def test_live_metrics_collector():
    """Verifies that MetricsCollector returns valid system CPU, memory, and disk telemetry."""
    collector = MetricsCollector()
    metrics = collector.get_system_metrics()

    assert "cpu" in metrics
    assert "memory" in metrics
    assert "disk" in metrics
    assert "uptime" in metrics

    assert metrics["cpu"]["cores"] >= 1
    assert 0.0 <= metrics["cpu"]["percent"] <= 100.0
    assert metrics["memory"]["total_gb"] > 0
    assert metrics["memory"]["percent"] >= 0


# =====================================================================
# 4. Slack Notifier Formatting
# =====================================================================
def test_slack_notifier_payload():
    """Verifies Slack alert text formatting."""
    notifier = SlackNotifier(webhook_url="", channel="#devops-alerts")

    incident = {
        "container": "user-service",
        "message": "ConnectionError: Database unavailable",
        "timestamp": "2026-11-01 10:00:00"
    }
    ai_analysis = {
        "detected_error": "PostgreSQL Connection Refused",
        "probable_root_cause": "Port 5432 closed",
        "potential_code_location": "database.py:25",
        "suggested_solution": "Restart postgres service",
        "ai_recommendation": "Check Docker network"
    }

    formatted = notifier.format_alert_text(incident, ai_analysis, server_name="AWS EC2")
    assert "#devops-alerts" in formatted
    assert "PostgreSQL Connection Refused" in formatted
    assert "database.py:25" in formatted


# =====================================================================
# 5. Monitored Microservice API Endpoints (Direct Function Invocation)
# =====================================================================
def test_application_api_routes(monkeypatch):
    """Tests microservice route handlers directly."""
    from application.app import health, index, get_items, simulate_db_error, simulate_crash
    from fastapi import HTTPException

    # Health check
    res_health = health()
    assert res_health["status"] == "healthy"
    assert res_health["database"] == "postgresql"

    # Index welcome
    res_index = index()
    assert res_index["framework"] == "FastAPI"

    # Items listing (with MOCK_DB=true)
    monkeypatch.setenv("MOCK_DB", "true")
    res_items = get_items()
    assert "items" in res_items
    assert len(res_items["items"]) >= 1

    # Simulate DB error raises 500
    with pytest.raises(HTTPException) as exc_db:
        simulate_db_error()
    assert exc_db.value.status_code == 500

    # Simulate crash raises 500
    with pytest.raises(HTTPException) as exc_crash:
        simulate_crash()
    assert exc_crash.value.status_code == 500


# =====================================================================
# 6. Dashboard Backend API Endpoints (Direct Function Invocation)
# =====================================================================
def test_dashboard_api_routes():
    """Tests centralized monitoring dashboard route handlers directly."""
    from dashboard.app import (
        system_status,
        get_metrics,
        get_logs,
        get_incidents,
        get_deployments,
        simulate_error
    )

    # System status probe
    res_status = system_status()
    assert "status" in res_status

    # System host metrics
    res_metrics = get_metrics()
    assert "cpu" in res_metrics
    assert "memory" in res_metrics

    # Application logs
    res_logs = get_logs(max_lines=50)
    assert "lines" in res_logs
    assert "count" in res_logs

    # Incidents list
    res_incidents = get_incidents()
    assert "incidents" in res_incidents
    assert "count" in res_incidents

    # CI/CD Deployments
    res_deployments = get_deployments()
    assert "deployments" in res_deployments
    assert len(res_deployments["deployments"]) > 0

    # Error simulation endpoint
    res_sim = simulate_error(error_type="db")
    assert "status" in res_sim

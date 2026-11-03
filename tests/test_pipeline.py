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
from monitoring.error_intelligence import (
    analyze_metric_trends,
    build_error_intelligence,
    error_fingerprint,
)
from monitoring.remediation import RemediationError, dispatch_remediation


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


def test_error_intelligence_groups_patterns_and_correlates_services():
    incidents = [
        {
            "id": "one",
            "timestamp": "2026-11-03T12:00:00+00:00",
            "container": "orders",
            "error_message": "PostgreSQL connection failed request 1234",
        },
        {
            "id": "two",
            "timestamp": "2026-11-03T12:05:00+00:00",
            "container": "billing",
            "error_message": "PostgreSQL connection failed request 9876",
        },
    ]
    now = __import__("datetime").datetime.fromisoformat("2026-11-03T12:10:00+00:00")
    report = build_error_intelligence(incidents, [], now=now)

    assert error_fingerprint("Timeout request 1234") == error_fingerprint("Timeout request 9876")
    assert report["summary"]["incidents_analyzed"] == 2
    assert report["summary"]["recurring_patterns"] == 1
    assert report["correlations"][0]["services"] == ["billing", "orders"]


def test_metric_anomaly_trend_reports_measured_spike():
    samples = [
        {"sampled_at": f"2026-11-03T12:{minute:02d}:00+00:00", "cpu_percent": value}
        for minute, value in enumerate([20, 21, 20, 22, 65])
    ]

    anomalies = analyze_metric_trends(samples)

    assert len(anomalies) == 1
    assert anomalies[0]["metric"] == "cpu"
    assert anomalies[0]["evidence"] == "measured history deviation"


def test_save_incident_adds_recurrence_metadata(tmp_path, monkeypatch):
    import monitoring.main as monitoring_module

    monkeypatch.setattr(monitoring_module, "STATE_FILE", str(tmp_path / "incidents.json"))
    first = {"id": "first", "timestamp": "2026-11-03T12:00:00+00:00", "detected_at": "2026-11-03T12:00:00+00:00", "error_message": "timeout request 1234", "slack_delivered": True}
    second = {"id": "second", "timestamp": "2026-11-03T12:01:00+00:00", "detected_at": "2026-11-03T12:01:00+00:00", "error_message": "timeout request 9876"}

    save_incident(first)
    save_incident(second)
    records = load_incidents()

    assert records[0]["occurrence_count"] == 2
    assert records[0]["duplicate_of"] == "first"


def test_remediation_requires_enablement_and_dispatches_allowlisted_runbook(monkeypatch):
    class SuccessfulResponse:
        ok = True
        status_code = 200

    import monitoring.remediation as remediation_module
    dispatched = {}

    monkeypatch.delenv("REMEDIATION_ENABLED", raising=False)
    monkeypatch.delenv("REMEDIATION_WEBHOOK_URL", raising=False)
    with pytest.raises(RemediationError):
        dispatch_remediation({"id": "inc-1"}, "restart_service")

    monkeypatch.setenv("REMEDIATION_ENABLED", "true")
    monkeypatch.setenv("REMEDIATION_WEBHOOK_URL", "https://runbooks.example.test/dispatch")
    def fake_post(url, json, timeout):
        dispatched.update({"url": url, "payload": json, "timeout": timeout})
        return SuccessfulResponse()

    monkeypatch.setattr(remediation_module.requests, "post", fake_post)
    result = dispatch_remediation(
        {"id": "inc-1", "error_message": "password=topsecret"}, "restart_service"
    )

    assert result["status"] == "dispatched"
    assert result["runbook"] == "restart_service"
    assert "topsecret" not in dispatched["payload"]["incident"]["error_message"]
    with pytest.raises(RemediationError):
        dispatch_remediation({"id": "inc-1"}, "arbitrary_shell_command")


def test_error_intelligence_api_exposes_remediation_state(monkeypatch):
    import dashboard.app as dashboard_module

    monkeypatch.setattr(dashboard_module, "load_incidents", lambda: [])
    monkeypatch.setattr(dashboard_module.metrics_collector, "get_history", lambda: [])
    monkeypatch.delenv("REMEDIATION_ENABLED", raising=False)

    response = dashboard_module.get_error_intelligence()

    assert response["summary"]["incidents_analyzed"] == 0
    assert response["remediation"]["enabled"] is False
    assert response["remediation"]["approval_required"] is True


def test_remediation_api_rejects_unapproved_request():
    import dashboard.app as dashboard_module
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        dashboard_module.remediate_incident(
            "inc-1", dashboard_module.RemediationRequest(runbook="restart_service")
        )

    assert exc_info.value.status_code == 400


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


def test_docker_log_events_keep_container_service_and_group_traceback(monkeypatch):
    import threading

    collector = LogCollector(container_name="billing-service")
    docker_lines = [
        "2026-11-03T12:00:00.000000000Z 2026-11-03 12:00:00 ERROR PostgreSQL connection failed",
        "2026-11-03T12:00:00.100000000Z   File \"billing.py\", line 18, in charge",
        "2026-11-03T12:00:01.000000000Z 2026-11-03 12:00:01 INFO retrying",
    ]
    monkeypatch.setattr(
        collector,
        "tail_docker_logs",
        lambda *_args, **_kwargs: iter(docker_lines),
    )

    events = list(collector.tail_docker_log_events(threading.Event()))

    assert len(events) == 2
    assert events[0][0].startswith("2026-11-03 12:00:00 ERROR")
    assert "billing.py" in events[0][1]
    incident = ErrorDetector(target_container="billing-service").extract_incident(events[0])
    assert incident["container"] == "billing-service"


def test_log_collector_tails_lines_appended_after_subscribe(tmp_path):
    """A live file tail should emit lines appended after the stream opens."""
    import threading
    import time

    log_file = tmp_path / "live_application.log"
    log_file.write_text("existing line\n", encoding="utf-8")
    collector = LogCollector(log_file_path=str(log_file))
    stop_event = threading.Event()
    stream = collector.tail_log_stream(interval_seconds=0.01, stop_event=stop_event)

    def append_line():
        time.sleep(0.03)
        with open(log_file, "a", encoding="utf-8") as file:
            file.write("2026-11-03 12:00:00 ERROR live failure\n")

    writer = threading.Thread(target=append_line)
    writer.start()
    try:
        assert next(stream) == "2026-11-03 12:00:00 ERROR live failure"
    finally:
        stop_event.set()
        stream.close()
        writer.join(timeout=1)


def test_dashboard_log_sources_and_docker_failure_are_explicit(monkeypatch):
    """The log API combines sources and reports Docker availability failures."""
    import dashboard.app as dashboard_module
    from fastapi import HTTPException

    class FakeLogCollector:
        container_name = "test-service"

        @staticmethod
        def read_all_logs(max_lines):
            return ["2026-11-03 12:00:00 INFO application ready"]

        @staticmethod
        def fetch_docker_logs(tail):
            raise RuntimeError("Docker CLI is not installed")

    monkeypatch.setattr(dashboard_module, "log_collector", FakeLogCollector())

    combined = dashboard_module.get_logs(max_lines=10, source="all")
    assert combined["count"] == 1
    assert combined["lines"][0].startswith("[application]")
    assert combined["container_name"] == "test-service"
    assert combined["source_errors"]["docker"] == "Docker CLI is not installed"

    with pytest.raises(HTTPException) as exc_info:
        dashboard_module.get_logs(max_lines=10, source="docker")
    assert exc_info.value.status_code == 503

    stream_response = dashboard_module.stream_logs(source="application")
    assert stream_response.media_type == "text/event-stream"
    with pytest.raises(HTTPException) as invalid_source:
        dashboard_module.stream_logs(source="database")
    assert invalid_source.value.status_code == 422


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


def test_dashboard_metrics_and_history_include_real_samples(tmp_path, monkeypatch):
    """Verify dashboard telemetry responses expose process/network data and stored samples."""
    import dashboard.app as dashboard_module

    class ApplicationMetricsResponse:
        ok = True

        @staticmethod
        def json():
            return {
                "status": "UP",
                "requests_total": 3,
                "errors_total": 1,
                "requests_per_second": 0.1,
                "error_rate_percent": 33.3,
                "latency_ms_avg": 12.0,
                "latency_ms_p95": 20.0,
            }

    monkeypatch.setattr(
        dashboard_module,
        "metrics_collector",
        MetricsCollector(history_path=str(tmp_path / "dashboard-metrics.json"), sample_interval_seconds=60),
    )
    monkeypatch.setattr(
        dashboard_module.requests,
        "get",
        lambda *_args, **_kwargs: ApplicationMetricsResponse(),
    )

    current = dashboard_module.get_metrics()
    history = dashboard_module.get_metrics_history(limit=10, window_seconds=3600)

    assert current["service"]["requests_total"] == 3
    assert current["network"]["total_bytes_received"] is not None
    assert "top_processes" in current
    assert history["count"] >= 1
    assert history["samples"][-1]["sampled_at"] <= current["sampled_at"]


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

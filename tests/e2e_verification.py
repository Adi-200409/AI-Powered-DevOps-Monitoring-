"""Comprehensive End-to-End System Verification Script.

Executes all 9 stages of the AI-Powered DevOps Monitoring System:
1. Microservice Endpoints & Request Telemetry
2. Host Metrics Collection & Time-Series History
3. Simulated Error Generation & Logging
4. Multi-Line Log Aggregation & Extraction
5. Error Detection & Filtering
6. Code Context Analysis & Credential Sanitization
7. AI Root-Cause Diagnostic Analysis
8. Slack Alert Notification Payload Formatting
9. Incident Persistence & Dashboard REST API Verification
10. React Production Distribution Delivery
"""

import os
import sys
import json
import time
from datetime import datetime, timezone

# Ensure project root is on sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from application.app import health, index, request_metrics, get_items, simulate_db_error, simulate_crash
from application.database import probe_database
from monitoring.metrics_collector import MetricsCollector
from monitoring.log_collector import LogCollector
from monitoring.error_detector import ErrorDetector
from monitoring.code_analyzer import CodeAnalyzer
from monitoring.groq_analyzer import GroqAnalyzer
from monitoring.slack_alert import SlackNotifier
from monitoring.main import process_error_event, load_incidents, save_incident
from monitoring.error_intelligence import build_error_intelligence, error_fingerprint
from dashboard.app import (
    system_status,
    get_metrics,
    get_metrics_history,
    get_logs,
    get_incidents,
    get_deployments,
    get_error_intelligence,
    simulate_error,
    FRONTEND_DIST,
)


def run_e2e_verification():
    passed = 0
    total = 0

    def check(name, condition, details=""):
        nonlocal passed, total
        total += 1
        status = "PASSED" if condition else "FAILED"
        if condition:
            passed += 1
            print(f"  [+] {name}: {status}")
            if details:
                print(f"      {details}")
        else:
            print(f"  [-] {name}: {status}")
            if details:
                print(f"      ERROR: {details}")

    print("\n" + "=" * 70)
    print("  AI-POWERED DEVOPS MONITORING - END-TO-END SYSTEM TEST")
    print("=" * 70 + "\n")

    # -------------------------------------------------------------
    # Stage 1: Monitored Application Microservice Endpoints
    # -------------------------------------------------------------
    print("[Stage 1] Monitored FastAPI Microservice Endpoints")
    h = health()
    check("GET /health", h.get("status") == "healthy" and h.get("database") == "postgresql",
          f"Status: {h.get('status')}, DB: {h.get('database')}")

    idx = index()
    check("GET / (Root Welcome)", idx.get("status") == "online" and idx.get("framework") == "FastAPI",
          f"Framework: {idx.get('framework')}, Version: {idx.get('version')}")

    req_m = request_metrics()
    check("GET /metrics", "requests_total" in req_m and "latency_ms_avg" in req_m,
          f"Requests: {req_m.get('requests_total')}, Window: {req_m.get('window_seconds')}s")

    db_probe = probe_database()
    check("Database Probe", "status" in db_probe,
          f"Status: {db_probe.get('status')}, Reason/Latency: {db_probe.get('reason', db_probe.get('latency_ms'))}")

    # -------------------------------------------------------------
    # Stage 2: Host Metrics Collector & History Time-Series
    # -------------------------------------------------------------
    print("\n[Stage 2] Host & Resource Telemetry Collection")
    collector = MetricsCollector()
    sys_metrics = collector.get_system_metrics()
    check("Host Telemetry Acquisition",
          "cpu" in sys_metrics and "memory" in sys_metrics and "disk" in sys_metrics,
          f"CPU: {sys_metrics.get('cpu', {}).get('percent')}%, "
          f"RAM: {sys_metrics.get('memory', {}).get('percent')}%, "
          f"Disk: {sys_metrics.get('disk', {}).get('percent')}%, "
          f"Cores: {sys_metrics.get('cpu', {}).get('cores')}")

    collector.record_sample(sys_metrics)
    history = collector.get_history()
    check("Metrics History Persistence",
          len(history) >= 1 and "cpu_percent" in history[-1],
          f"History entries: {len(history)}, Latest sample: {history[-1].get('sampled_at')}")

    # -------------------------------------------------------------
    # Stage 3: Error Simulation & File Logging
    # -------------------------------------------------------------
    print("\n[Stage 3] Automated Error Simulation & File Logging")
    db_error_caught = False
    try:
        simulate_db_error()
    except Exception as exc:
        db_error_caught = True
        err_detail = getattr(exc, "detail", str(exc))
    check("Simulate DB Failure Route", db_error_caught, f"Response: {err_detail}")

    crash_caught = False
    try:
        simulate_crash()
    except Exception as exc:
        crash_caught = True
        crash_detail = getattr(exc, "detail", str(exc))
    check("Simulate Crash Route", crash_caught, f"Response: {crash_detail}")

    log_path = os.path.join(BASE_DIR, "logs", "application.log")
    log_exists = os.path.exists(log_path) and os.path.getsize(log_path) > 0
    check("Log Emission to application.log", log_exists, f"File size: {os.path.getsize(log_path) if log_exists else 0} bytes")

    # -------------------------------------------------------------
    # Stage 4: Multi-Line Log Aggregation & Log Collector
    # -------------------------------------------------------------
    print("\n[Stage 4] Multi-Line Log Aggregation & LogCollector")
    log_collector = LogCollector()
    raw_logs = log_collector.read_all_logs(max_lines=50)
    check("Log Reading from application.log", len(raw_logs) > 0, f"Read {len(raw_logs)} lines from log stream")

    # Verify error lines and continuation lines are present
    has_error_header = any("ERROR" in line or "CRITICAL" in line for line in raw_logs)
    has_continuation = any('File "' in line or "ConnectionError" in line for line in raw_logs)
    check("Captured Error Header & Traceback Lines", has_error_header and has_continuation,
          f"Found error markers in {len(raw_logs)} logged lines")

    # -------------------------------------------------------------
    # Stage 5: Error Detection & Filtering
    # -------------------------------------------------------------
    print("\n[Stage 5] Error Detection & Severity Filtering")
    detector = ErrorDetector()
    sample_error = [
        "2026-11-09 10:00:00 ERROR Database connection failed",
        'File "database.py", line 25, in get_db_connection',
        "ConnectionError: Database unavailable"
    ]
    is_actionable = detector.is_actionable_error(sample_error[0])
    check("Actionable Error Filter (ERROR)", is_actionable, "Correctly flagged ERROR level")

    info_ignored = not detector.is_actionable_error("2026-11-09 10:00:00 INFO Health check passed")
    check("Non-actionable Filter (INFO)", info_ignored, "Correctly suppressed INFO line")

    extracted = detector.extract_incident(sample_error)
    check("Incident Extraction",
          extracted.get("level") == "ERROR" and "Database connection failed" in extracted.get("message", ""),
          f"Level: {extracted.get('level')}, Message: {extracted.get('message')}")

    # -------------------------------------------------------------
    # Stage 6: Code Context Analysis & Credential Sanitization
    # -------------------------------------------------------------
    print("\n[Stage 6] Code Context Retrieval & Secret Masking")
    analyzer = CodeAnalyzer()
    parsed_loc = analyzer.parse_traceback_location(sample_error[1])
    check("Traceback Location Parser",
          parsed_loc is not None and parsed_loc[0] == "database.py" and parsed_loc[1] == 25,
          f"Parsed: File='{parsed_loc[0]}', Line={parsed_loc[1]}, Func='{parsed_loc[2]}'")

    code_analysis = analyzer.analyze(
        error_message="Database connection failed",
        stack_trace='File "database.py", line 25, in get_db_connection\nconn = psycopg2.connect("postgresql://admin:SecretPass123@localhost:5432/db")'
    )
    secrets_masked = "SecretPass123" not in code_analysis.get("sanitized_trace", "")
    check("Credential & Token Masking", secrets_masked, "Password successfully redacted in trace")
    check("Source Code Snippet Extraction",
          "def get_db_connection" in code_analysis.get("code_snippet", ""),
          f"Extracted snippet around line 25 in {code_analysis.get('file')}")

    # -------------------------------------------------------------
    # Stage 7: AI Incident Diagnosis (Groq / Structured Fallback)
    # -------------------------------------------------------------
    print("\n[Stage 7] AI Root-Cause Diagnostic Analysis")
    groq = GroqAnalyzer()
    diagnosis = groq.analyze_incident(
        error_message=code_analysis.get("file", "Database connection failed"),
        sanitized_trace=code_analysis.get("sanitized_trace", ""),
        code_snippet=code_analysis.get("code_snippet", ""),
        potential_location=code_analysis.get("potential_code_location", "")
    )
    has_schema = all(k in diagnosis for k in ["detected_error", "probable_root_cause", "suggested_solution", "ai_recommendation"])
    check("AI Diagnostic Schema Compliance", has_schema,
          f"Root cause: {diagnosis.get('probable_root_cause')[:60]}...")

    # -------------------------------------------------------------
    # Stage 8: Slack Notification Payload Generation
    # -------------------------------------------------------------
    print("\n[Stage 8] Slack Webhook Alert Dispatcher")
    notifier = SlackNotifier()
    alert_text = notifier.format_alert_text(extracted, diagnosis)
    has_text_fields = "Application Failure Detected!" in alert_text and "AI Analysis:" in alert_text
    check("Slack Alert Text Formatting", has_text_fields,
          f"Channel: {notifier.channel}, Length: {len(alert_text)} chars")

    # -------------------------------------------------------------
    # Stage 9: Incident Processing & Dashboard REST APIs
    # -------------------------------------------------------------
    print("\n[Stage 9] Incident Persistence & Centralized Dashboard REST APIs")
    # Execute full process_error_event
    processed_incident = process_error_event(sample_error)
    check("End-to-End process_error_event",
          processed_incident is not None and "id" in processed_incident,
          f"Created incident ID: {processed_incident.get('id')}")

    # Dashboard APIs
    d_status = system_status()
    check("Dashboard: GET /api/system-status",
          "status" in d_status and "service" in d_status,
          f"App Status: {d_status.get('status')}, Service: {d_status.get('service')}")

    d_metrics = get_metrics()
    check("Dashboard: GET /api/metrics",
          "cpu" in d_metrics and "memory" in d_metrics,
          f"CPU: {d_metrics.get('cpu', {}).get('percent')}%, Memory: {d_metrics.get('memory', {}).get('percent')}%")

    d_history = get_metrics_history()
    check("Dashboard: GET /api/metrics/history",
          "samples" in d_history and isinstance(d_history["samples"], list),
          f"Samples count: {d_history.get('count')}")

    d_logs = get_logs(max_lines=50)
    check("Dashboard: GET /api/logs",
          "lines" in d_logs and "summary" in d_logs,
          f"Returned {d_logs.get('count')} lines (Errors: {d_logs.get('summary', {}).get('error')})")

    d_incidents = get_incidents()
    check("Dashboard: GET /api/incidents",
          "incidents" in d_incidents and len(d_incidents["incidents"]) >= 1,
          f"Incidents in store: {d_incidents.get('count')}")

    d_intel = get_error_intelligence()
    check("Dashboard: GET /api/error-intelligence",
          "summary" in d_intel and "patterns" in d_intel and "remediation" in d_intel,
          f"Analyzed: {d_intel.get('summary', {}).get('incidents_analyzed')}, "
          f"Patterns: {d_intel.get('summary', {}).get('recurring_patterns')}")

    d_deployments = get_deployments()
    check("Dashboard: GET /api/deployments",
          "deployments" in d_deployments and isinstance(d_deployments["deployments"], list),
          f"Deployment records: {len(d_deployments.get('deployments', []))}")

    d_sim = simulate_error(error_type="db")
    check("Dashboard: POST /api/simulate-error",
          "status" in d_sim,
          f"Simulation response: {d_sim.get('status')}")

    # -------------------------------------------------------------
    # Stage 10: React SPA Production Distribution Delivery
    # -------------------------------------------------------------
    print("\n[Stage 10] React SPA Single-Page Application Distribution")
    dist_index = os.path.join(FRONTEND_DIST, "index.html")
    dist_exists = os.path.exists(dist_index)
    check("Frontend Dist index.html", dist_exists, f"Path: {dist_index}")

    if dist_exists:
        with open(dist_index, "r", encoding="utf-8") as f:
            content = f.read()
        has_root = '<div id="root">' in content
        has_bundle = "/assets/index-" in content
        check("React SPA Mount Root & Bundle Links", has_root and has_bundle, "Mount point <div id='root'> and bundled JS/CSS found")

    # -------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------
    print("\n" + "=" * 70)
    print(f"  END-TO-END VERIFICATION RESULT: {passed}/{total} CHECKS PASSED")
    print("=" * 70 + "\n")

    return passed == total


if __name__ == "__main__":
    success = run_e2e_verification()
    sys.exit(0 if success else 1)

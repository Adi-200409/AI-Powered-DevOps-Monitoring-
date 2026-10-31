"""Unit and Integration Tests for AI-Powered DevOps Monitoring System.

Tech Stack: FastAPI, Python, PostgreSQL, React.
Executed during Jenkins CI/CD Stage 3: 'Test' (pytest tests/ -v).
"""

import pytest
from fastapi import HTTPException
from application.app import health, index, simulate_db_error, simulate_crash
from monitoring.error_detector import ErrorDetector
from monitoring.code_analyzer import CodeAnalyzer
from monitoring.groq_analyzer import GroqAnalyzer
from monitoring.metrics_collector import MetricsCollector


# =====================================================================
# 1. FastAPI Application Endpoint Tests
# =====================================================================
def test_health_endpoint():
    """Verify that Jenkins CI/CD stage 7 health check endpoint returns 200 with healthy state."""
    data = health()
    assert data["status"] == "healthy"
    assert data["database"] == "postgresql"
    assert data["service"] == "User Management Service"
    assert "uptime" in data


def test_index_endpoint():
    """Verify FastAPI welcome root endpoint responds successfully with FastAPI framework info."""
    data = index()
    assert data["status"] == "online"
    assert data["framework"] == "FastAPI"
    assert data["version"] == "1.0.0"


def test_simulate_db_error_endpoint():
    """Verify simulated DB error logs to application.log and raises HTTPException 500."""
    with pytest.raises(HTTPException) as exc_info:
        simulate_db_error()
    assert exc_info.value.status_code == 500
    detail = exc_info.value.detail
    assert detail.get("status") == "error_simulated"
    assert detail.get("error_type") == "ConnectionError"


def test_simulate_crash_endpoint():
    """Verify simulated crash raises HTTPException 500 with critical error payload."""
    with pytest.raises(HTTPException) as exc_info:
        simulate_crash()
    assert exc_info.value.status_code == 500
    detail = exc_info.value.detail
    assert detail.get("status") == "critical_simulated"


# =====================================================================
# 2. Monitoring Module Tests
# =====================================================================
def test_error_detector_filtering():
    """Verify error detector captures ERROR/CRITICAL and ignores INFO."""
    detector = ErrorDetector()
    
    assert detector.is_actionable_error("2026-10-31 10:32:10 ERROR Database connection failed") is True
    assert detector.is_actionable_error("2026-10-31 10:32:10 CRITICAL Service Crash") is True
    assert detector.is_actionable_error("2026-10-31 10:32:10 INFO Service healthy") is False
    assert detector.is_actionable_error("2026-10-31 10:32:10 WARNING Slow response") is False


def test_code_analyzer_secret_masking():
    """Verify sensitive tokens and PostgreSQL credentials are automatically masked before LLM call."""
    analyzer = CodeAnalyzer()
    
    raw_text = 'Database error: postgresql://admin:SecretPass123@localhost:5432/devops_db, Groq Key: gsk_1234567890123456789012345'
    masked = analyzer.mask_secrets(raw_text)
    
    assert "SecretPass123" not in masked
    assert "gsk_1234567890123456789012345" not in masked
    assert "***PASS***" in masked or "***MASKED" in masked


def test_code_analyzer_trace_parsing():
    """Verify stack trace parser extracts file and line numbers."""
    analyzer = CodeAnalyzer()
    trace = 'File "database.py", line 25\nConnectionError: Database unavailable'
    parsed = analyzer.parse_traceback_location(trace)
    
    assert parsed is not None
    filename, line, func = parsed
    assert filename == "database.py"
    assert line == 25


def test_groq_analyzer_fallback():
    """Verify Groq analyzer generates a valid diagnosis structure for PostgreSQL."""
    analyzer = GroqAnalyzer(api_key="")
    diagnosis = analyzer.analyze_incident(
        error_message="ConnectionError: Database unavailable",
        sanitized_trace="database.py:25",
        code_snippet="conn = psycopg2.connect(DATABASE_URL)",
        potential_location="database.py:25"
    )
    
    assert "severity" in diagnosis
    assert "detected_error" in diagnosis
    assert "probable_root_cause" in diagnosis
    assert "potential_code_location" in diagnosis
    assert "suggested_solution" in diagnosis
    assert "ai_recommendation" in diagnosis
    assert "PostgreSQL" in diagnosis["probable_root_cause"] or "PostgreSQL" in diagnosis["detected_error"]


def test_metrics_collector():
    """Verify metrics collector gathers system metrics dictionary."""
    collector = MetricsCollector()
    metrics = collector.get_system_metrics()
    
    assert "cpu" in metrics
    assert "memory" in metrics
    assert "uptime" in metrics
    assert metrics["cpu"]["cores"] > 0

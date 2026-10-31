"""Unit and Integration Tests for AI-Powered DevOps Monitoring System.

Executed during Jenkins CI/CD Stage 3: 'Test' (pytest tests/).
"""

import os
import pytest
from application.app import app
from monitoring.error_detector import ErrorDetector
from monitoring.code_analyzer import CodeAnalyzer
from monitoring.groq_analyzer import GroqAnalyzer
from monitoring.metrics_collector import MetricsCollector


@pytest.fixture
def client():
    """Flask test client fixture."""
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client


# =====================================================================
# 1. Application Endpoint Tests
# =====================================================================
def test_health_endpoint(client):
    """Verify that Jenkins CI/CD stage 7 health check endpoint returns 200."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "healthy"
    assert "uptime" in data


def test_index_endpoint(client):
    """Verify welcome root endpoint responds successfully."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "online"


def test_simulate_db_error_endpoint(client):
    """Verify simulated DB error generates HTTP 500 and structured error response."""
    response = client.get("/api/simulate-db-error")
    assert response.status_code == 500
    data = response.get_json()
    assert data["status"] == "error_simulated"
    assert data["error_type"] == "ConnectionError"


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
    """Verify sensitive tokens and credentials are automatically masked before LLM call."""
    analyzer = CodeAnalyzer()
    
    raw_text = 'Database error: mongodb://admin:SecretPass123@localhost:27017, Groq Key: gsk_1234567890123456789012345'
    masked = analyzer.mask_secrets(raw_text)
    
    assert "SecretPass123" not in masked
    assert "gsk_1234567890123456789012345" not in masked
    assert "***MASKED" in masked or "***PASS***" in masked


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
    """Verify Groq analyzer generates a valid diagnosis structure even when offline."""
    analyzer = GroqAnalyzer(api_key="")
    diagnosis = analyzer.analyze_incident(
        error_message="ConnectionError: Database unavailable",
        sanitized_trace="database.py:25",
        code_snippet="client = MongoClient(uri)",
        potential_location="database.py:25"
    )
    
    assert "severity" in diagnosis
    assert "detected_error" in diagnosis
    assert "probable_root_cause" in diagnosis
    assert "potential_code_location" in diagnosis
    assert "suggested_solution" in diagnosis
    assert "ai_recommendation" in diagnosis


def test_metrics_collector():
    """Verify metrics collector gathers system metrics dictionary."""
    collector = MetricsCollector()
    metrics = collector.get_system_metrics()
    
    assert "cpu" in metrics
    assert "memory" in metrics
    assert "uptime" in metrics
    assert metrics["cpu"]["cores"] > 0


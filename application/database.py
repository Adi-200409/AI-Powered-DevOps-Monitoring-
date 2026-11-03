"""PostgreSQL Database Connector Module for FastAPI Application.

Handles PostgreSQL connection pooling and health verification.
Provides simulated failure hooks for DevOps automated error detection.
"""

import os
import logging
import time

try:
    import psycopg2
    from psycopg2 import OperationalError
except ImportError:
    psycopg2 = None
    class OperationalError(Exception):
        pass

logger = logging.getLogger("application")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/devops_db")
SIMULATE_DB_ERROR = os.getenv("SIMULATE_DB_ERROR", "false").lower() == "true"


def get_db_connection(database_url: str = None):
    """Establish connection to PostgreSQL database instance.

    Raises:
        ConnectionError: When PostgreSQL connection fails or is intentionally simulated.
    """
    target_url = database_url or DATABASE_URL

    # Line 25 context matching project failure scenario
    if SIMULATE_DB_ERROR or "invalid_host" in target_url:
        logger.error("Database connection failed\nFile \"database.py\", line 25\nConnectionError: Database unavailable")
        raise ConnectionError("Database unavailable: Failed to connect to PostgreSQL cluster at target URI.")

    if os.getenv("MOCK_DB", "false").lower() == "true" or target_url == "mock":
        return None

    if psycopg2 is None:
        logger.warning("psycopg2 is not installed. Running in mock PostgreSQL database mode.")
        return None

    try:
        conn = psycopg2.connect(target_url, connect_timeout=1)
        logger.info("Successfully connected to PostgreSQL database.")
        return conn
    except (OperationalError, Exception) as exc:
        logger.error(
            "Database connection failed - %s: %s\nFile \"database.py\", line 25\nConnectionError: Database unavailable",
            exc.__class__.__name__,
            str(exc),
            exc_info=True
        )
        raise ConnectionError(f"Database unavailable: {str(exc)}") from exc


def probe_database():
    """Check PostgreSQL connectivity without returning connection details or logging failures."""
    database_url = os.getenv("DATABASE_URL", DATABASE_URL)
    if os.getenv("MOCK_DB", "false").lower() == "true" or database_url == "mock":
        return {"status": "UNKNOWN", "reason": "mock database mode"}
    if os.getenv("SIMULATE_DB_ERROR", "false").lower() == "true":
        return {"status": "DOWN", "reason": "database failure simulation is enabled"}
    if psycopg2 is None:
        return {"status": "UNKNOWN", "reason": "PostgreSQL driver is unavailable"}

    started_at = time.perf_counter()
    try:
        connection = psycopg2.connect(database_url, connect_timeout=1)
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        finally:
            connection.close()
    except psycopg2.Error as exc:
        return {"status": "DOWN", "error_type": type(exc).__name__}

    return {
        "status": "UP",
        "latency_ms": round((time.perf_counter() - started_at) * 1000, 1),
    }


def get_application_data():
    """Retrieve sample application items from PostgreSQL database."""
    try:
        conn = get_db_connection()
        if conn is None:
            # Mock data when PostgreSQL is not connected yet
            return [
                {"id": 1, "name": "DevOps Microservice", "status": "active", "price": 49.99},
                {"id": 2, "name": "AI Triage Engine", "status": "active", "price": 99.00}
            ]

        with conn.cursor() as cursor:
            cursor.execute("SELECT id, name, status, price FROM items LIMIT 10;")
            columns = [desc[0] for desc in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
            return results
    except Exception as exc:
        logger.error("Failed to query PostgreSQL items: %s", str(exc), exc_info=True)
        raise

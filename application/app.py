"""Sample Flask Application (Online Shopping / User Management Service).

Monitored by the AI-Powered DevOps Monitoring System.
Outputs logs to application.log for error detection and AI triage.
"""

import os
import sys
import logging
from datetime import datetime, timezone
from flask import Flask, jsonify, request
from application.database import get_db_client, get_application_data

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

app = Flask(__name__)


@app.route("/", methods=["GET"])
def index():
    """Application root endpoint."""
    return jsonify({
        "status": "online",
        "service": "User Management & Shopping API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0"
    }), 200


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint used by Jenkins CI/CD stage 7 and monitoring dashboard."""
    # Simple liveness check
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": "active"
    }), 200


@app.route("/api/items", methods=["GET"])
def get_items():
    """Retrieve shopping items from MongoDB."""
    try:
        items = get_application_data()
        return jsonify({"items": items, "count": len(items)}), 200
    except Exception as exc:
        logger.error("Database connection failed\nFile \"database.py\", line 25\nConnectionError: Database unavailable")
        return jsonify({
            "error": "Internal Server Error",
            "message": "Database unavailable. Could not fetch items."
        }), 500


@app.route("/api/simulate-db-error", methods=["GET", "POST"])
def simulate_db_error():
    """Simulation route: Generates a database connection failure log for pipeline testing."""
    logger.error(
        "Database connection failed\n"
        "File \"database.py\", line 25\n"
        "ConnectionError: Database unavailable"
    )
    return jsonify({
        "status": "error_simulated",
        "error_type": "ConnectionError",
        "message": "Simulated database connection failure logged to application.log."
    }), 500


@app.route("/api/simulate-crash", methods=["GET", "POST"])
def simulate_crash():
    """Simulation route: Triggers a CRITICAL unhandled error."""
    logger.critical(
        "CRITICAL System failure in user-service: OutOfMemory / NullPointer in payment pipeline.\n"
        "File \"application/app.py\", line 85, in process_transaction\n"
        "RuntimeError: Fatal service disruption encountered."
    )
    return jsonify({
        "status": "critical_simulated",
        "error_type": "RuntimeError",
        "message": "Simulated critical failure logged to application.log."
    }), 500


if __name__ == "__main__":
    port = int(os.getenv("APP_PORT", 5000))
    host = os.getenv("APP_HOST", "0.0.0.0")
    logger.info("Starting sample application on %s:%d", host, port)
    app.run(host=host, port=port, debug=False)

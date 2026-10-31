"""Sample FastAPI Application (User Management & Shopping Service).

Monitored by the AI-Powered DevOps Monitoring System.
Tech Stack: FastAPI, Python, PostgreSQL.
Outputs structured logs to application.log for error detection and AI triage.
"""

import os
import sys
import logging
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from application.database import get_db_connection, get_application_data

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

app = FastAPI(
    title="User Management Service",
    description="FastAPI microservice monitored by AI DevOps system",
    version="1.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def index():
    """Application root endpoint."""
    return {
        "status": "online",
        "service": "User Management & Shopping API",
        "framework": "FastAPI",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0"
    }


@app.get("/health")
def health():
    """Health check endpoint used by Jenkins CI/CD stage 7 and monitoring dashboard."""
    return {
        "status": "healthy",
        "service": "User Management Service",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": "active",
        "database": "postgresql"
    }


@app.get("/api/items")
def get_items():
    """Retrieve shopping items from PostgreSQL database."""
    try:
        items = get_application_data()
        return {"items": items, "count": len(items)}
    except Exception as exc:
        logger.error(
            "Database connection failed\n"
            "File \"database.py\", line 25\n"
            "ConnectionError: Database unavailable"
        )
        raise HTTPException(
            status_code=500,
            detail={"error": "Internal Server Error", "message": "PostgreSQL database unavailable."}
        ) from exc


@app.get("/api/simulate-db-error")
@app.post("/api/simulate-db-error")
def simulate_db_error():
    """Simulation route: Generates a PostgreSQL connection failure log for pipeline testing."""
    logger.error(
        "Database connection failed\n"
        "File \"database.py\", line 25\n"
        "ConnectionError: Database unavailable"
    )
    raise HTTPException(
        status_code=500,
        detail={
            "status": "error_simulated",
            "error_type": "ConnectionError",
            "message": "Simulated PostgreSQL connection failure logged to application.log."
        }
    )


@app.get("/api/simulate-crash")
@app.post("/api/simulate-crash")
def simulate_crash():
    """Simulation route: Triggers a CRITICAL unhandled error."""
    logger.critical(
        "CRITICAL System failure in user-service: OutOfMemory / NullPointer in payment pipeline.\n"
        "File \"application/app.py\", line 85, in process_transaction\n"
        "RuntimeError: Fatal service disruption encountered."
    )
    raise HTTPException(
        status_code=500,
        detail={
            "status": "critical_simulated",
            "error_type": "RuntimeError",
            "message": "Simulated critical failure logged to application.log."
        }
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("APP_PORT", 5000))
    host = os.getenv("APP_HOST", "0.0.0.0")
    logger.info("Starting FastAPI sample application on %s:%d", host, port)
    uvicorn.run("application.app:app", host=host, port=port, reload=False)

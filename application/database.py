"""Database connector and management module for the sample application.

Handles MongoDB connections with health verification and simulated failure triggers
for testing DevOps automated error detection.
"""

import os
import logging

try:
    from pymongo import MongoClient
    from pymongo.errors import ServerSelectionTimeoutError, ConnectionFailure
except ImportError:
    MongoClient = None
    class ServerSelectionTimeoutError(Exception): pass
    class ConnectionFailure(Exception): pass

logger = logging.getLogger("application")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/devops_db")
SIMULATE_DB_ERROR = os.getenv("SIMULATE_DB_ERROR", "false").lower() == "true"


def get_db_client(uri: str = None):
    """Establish connection to MongoDB instance.
    
    Raises:
        ConnectionError: When MongoDB connection fails or is intentionally simulated.
    """
    target_uri = uri or MONGO_URI

    # Simulation check for live testing scenarios
    if SIMULATE_DB_ERROR or "invalid_host" in target_uri:
        # Line 25 context matching project reference in documentation
        logger.error("Database connection failed\nFile \"database.py\", line 25\nConnectionError: Database unavailable")
        raise ConnectionError("Database unavailable: Failed to connect to MongoDB cluster at target URI.")

    if MongoClient is None:
        logger.warning("pymongo is not installed. Running in mock database mode.")
        return None

    try:
        client = MongoClient(target_uri, serverSelectionTimeoutMS=2000)
        # Verify server state
        client.admin.command("ping")
        logger.info("Successfully connected to database.")
        return client
    except (ServerSelectionTimeoutError, ConnectionFailure) as exc:
        logger.error(
            "Database connection failed - %s: %s",
            exc.__class__.__name__,
            str(exc),
            exc_info=True
        )
        raise ConnectionError(f"Database unavailable: {str(exc)}") from exc


def get_application_data():
    """Retrieve sample application items from database."""
    try:
        client = get_db_client()
        if client is None:
            return [{"id": 1, "name": "Mock Item", "price": 29.99}]
        db = client.get_default_database()
        collection = db["items"]
        return list(collection.find({}, {"_id": 0}).limit(10))
    except Exception as exc:
        logger.error("Failed to query application items: %s", str(exc), exc_info=True)
        raise

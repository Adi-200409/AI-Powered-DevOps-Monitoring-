"""Error Detector Module.

Scans incoming log events for ERROR and CRITICAL severity levels.
Filters out INFO and WARNING (ignored in version 1).
Extracts timestamp, error message, stack trace snippets, and container details.
"""

import re
from datetime import datetime, timezone
from typing import Dict, List, Optional


class ErrorDetector:
    """Parses and detects error conditions in application logs."""

    # Matches lines like: 2026-10-31 10:32:10 ERROR Database connection failed
    LOG_PATTERN = re.compile(
        r"^(?P<timestamp>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(?P<level>INFO|WARNING|ERROR|CRITICAL)\s+(?P<message>.*)$"
    )

    def __init__(self, target_container: str = "user-service"):
        self.target_container = target_container

    def is_actionable_error(self, line: str) -> bool:
        """Determines if a log line represents an actionable failure (ERROR or CRITICAL)."""
        match = self.LOG_PATTERN.match(line.strip())
        if match:
            level = match.group("level")
            return level in ("ERROR", "CRITICAL")
        # Also catch raw error keywords if unformatted
        upper = line.upper()
        return "ERROR:" in upper or "CRITICAL:" in upper or "EXCEPTION" in upper or "TRACEBACK" in upper

    def parse_log_line(self, line: str) -> Optional[Dict[str, str]]:
        """Parses a structured log line into a dictionary."""
        match = self.LOG_PATTERN.match(line.strip())
        if match:
            return {
                "timestamp": match.group("timestamp"),
                "level": match.group("level"),
                "message": match.group("message"),
                "container": self.target_container,
                "raw": line.strip()
            }
        return None

    def extract_incident(self, error_lines: List[str]) -> Dict[str, str]:
        """Consolidates consecutive error lines/tracebacks into a single incident structure."""
        if not error_lines:
            return {}

        primary_line = error_lines[0]
        parsed = self.parse_log_line(primary_line)

        timestamp = parsed["timestamp"] if parsed else datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        level = parsed["level"] if parsed else "ERROR"
        message = parsed["message"] if parsed else primary_line

        full_trace = "\n".join(error_lines)

        return {
            "timestamp": timestamp,
            "level": level,
            "message": message,
            "stack_trace": full_trace,
            "container": self.target_container,
            "detected_at": datetime.now(timezone.utc).isoformat()
        }


if __name__ == "__main__":
    detector = ErrorDetector()
    test_log = "2026-10-31 10:32:10 ERROR Database connection failed"
    print(f"Log: '{test_log}' -> Actionable: {detector.is_actionable_error(test_log)}")
    print(f"Parsed: {detector.parse_log_line(test_log)}")

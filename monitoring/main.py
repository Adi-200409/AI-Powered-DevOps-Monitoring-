"""Monitoring Service Orchestrator.

Ties together log collection, error detection, code context retrieval,
Groq LLM analysis, Slack alerting, and state storage for the dashboard.
"""

import os
import sys
import time
import json
import tempfile
from datetime import datetime
from typing import List, Dict, Any, Optional

from monitoring.log_collector import LogCollector
from monitoring.error_detector import ErrorDetector
from monitoring.code_analyzer import CodeAnalyzer
from monitoring.groq_analyzer import GroqAnalyzer
from monitoring.slack_alert import SlackNotifier

STATE_FILE = os.getenv("INCIDENTS_STATE_FILE", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs", "incidents.json"))


def load_incidents() -> List[Dict[str, Any]]:
    """Loads recorded incidents from local JSON cache."""
    if not os.path.exists(STATE_FILE):
        return []

    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            incidents = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Unable to load incident state from {STATE_FILE!r}") from exc

    if not isinstance(incidents, list) or any(not isinstance(item, dict) for item in incidents):
        raise ValueError(f"Incident state in {STATE_FILE!r} must be a JSON array of objects")

    return incidents


def save_incident(incident_data: Dict[str, Any]) -> None:
    """Appends incident to local state cache for the dashboard."""
    incidents = load_incidents()
    incidents.insert(0, incident_data)
    # Retain the 50 most recent incidents
    incidents = incidents[:50]

    state_path = os.path.abspath(STATE_FILE)
    state_directory = os.path.dirname(state_path)
    temporary_path = None
    try:
        os.makedirs(state_directory, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=state_directory,
            prefix=f".{os.path.basename(state_path)}.",
            suffix=".tmp",
            delete=False
        ) as f:
            temporary_path = f.name
            json.dump(incidents, f, indent=2)
        os.replace(temporary_path, state_path)
    except OSError as exc:
        raise RuntimeError(f"Unable to save incident state to {state_path!r}") from exc
    finally:
        if temporary_path and os.path.exists(temporary_path):
            os.remove(temporary_path)


def process_error_event(
    error_lines: List[str],
    detector: Optional[ErrorDetector] = None,
    analyzer: Optional[CodeAnalyzer] = None,
    groq: Optional[GroqAnalyzer] = None,
    slack: Optional[SlackNotifier] = None
) -> Dict[str, Any]:
    """Processes a detected multi-line error event end-to-end.
    
    Extracts incident, analyzes code context, queries Groq LLM, alerts Slack,
    and records to incidents.json for the dashboard.
    """
    detector = detector or ErrorDetector()
    analyzer = analyzer or CodeAnalyzer()
    groq = groq or GroqAnalyzer()
    slack = slack or SlackNotifier()

    incident = detector.extract_incident(error_lines)
    code_ctx = analyzer.analyze(
        error_message=incident.get("message", ""),
        stack_trace=incident.get("stack_trace", "")
    )

    print(f"[AI Analysis] Submitting to Groq LLM (Code location: {code_ctx['potential_code_location']})...")
    ai_diagnosis = groq.analyze_incident(
        error_message=incident.get("message", ""),
        sanitized_trace=code_ctx.get("sanitized_trace", ""),
        code_snippet=code_ctx.get("code_snippet", ""),
        potential_location=code_ctx.get("potential_code_location", ""),
        container_name=incident.get("container", "user-service")
    )

    print("[Notification] Sending alert to Slack...")
    delivered = slack.send_alert(incident=incident, ai_analysis=ai_diagnosis)

    # Record incident state for dashboard
    record = {
        "id": f"inc-{int(time.time() * 1000)}",
        "timestamp": incident.get("timestamp"),
        "level": incident.get("level"),
        "container": incident.get("container"),
        "error_message": incident.get("message"),
        "code_context": code_ctx,
        "ai_diagnosis": ai_diagnosis,
        "slack_delivered": delivered
    }
    save_incident(record)
    print("[Complete] Incident recorded and queued in dashboard.")
    return record


def run_pipeline():
    """Main loop: listens for log events and executes AI triage and Slack alerts."""
    print("=================================================================")
    print("  AI-Powered DevOps Monitoring Service Started")
    print("  Listening for ERROR and CRITICAL events in application.log...")
    print("=================================================================")

    collector = LogCollector()
    detector = ErrorDetector()
    analyzer = CodeAnalyzer()
    groq = GroqAnalyzer()
    slack = SlackNotifier()

    # Process live log stream with multi-line event grouping
    for log_event in collector.tail_log_events(interval_seconds=1.0):
        if not log_event:
            continue
        # Check if primary or continuation line contains actionable error
        if any(detector.is_actionable_error(line) for line in log_event):
            print(f"\n[ALERT] Actionable error detected ({len(log_event)} lines):\n  {log_event[0]}")
            process_error_event(
                error_lines=log_event,
                detector=detector,
                analyzer=analyzer,
                groq=groq,
                slack=slack
            )


if __name__ == "__main__":
    try:
        run_pipeline()
    except KeyboardInterrupt:
        print("\nMonitoring service stopped by user.")
        sys.exit(0)

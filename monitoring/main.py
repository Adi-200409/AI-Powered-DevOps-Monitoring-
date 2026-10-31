"""Monitoring Service Orchestrator.

Ties together log collection, error detection, code context retrieval,
Groq LLM analysis, Slack alerting, and state storage for the dashboard.
"""

import os
import sys
import time
import json
from datetime import datetime
from typing import List, Dict, Any

from monitoring.log_collector import LogCollector
from monitoring.error_detector import ErrorDetector
from monitoring.code_analyzer import CodeAnalyzer
from monitoring.groq_analyzer import GroqAnalyzer
from monitoring.slack_alert import SlackNotifier

STATE_FILE = os.getenv("INCIDENTS_STATE_FILE", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs", "incidents.json"))


def load_incidents() -> List[Dict[str, Any]]:
    """Loads recorded incidents from local JSON cache."""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def save_incident(incident_data: Dict[str, Any]):
    """Appends incident to local state cache for the dashboard."""
    incidents = load_incidents()
    incidents.insert(0, incident_data)
    # Retain the 50 most recent incidents
    incidents = incidents[:50]
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(incidents, f, indent=2)
    except Exception as exc:
        print(f"[MonitoringOrchestrator] Error saving incident state: {exc}")


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

    # Process live log stream
    for log_line in collector.tail_log_stream(interval_seconds=1.5):
        if detector.is_actionable_error(log_line):
            print(f"\n[ALERT] Actionable error detected:\n  {log_line}")

            incident = detector.extract_incident([log_line])
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
                "id": f"inc-{int(time.time())}",
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


if __name__ == "__main__":
    try:
        run_pipeline()
    except KeyboardInterrupt:
        print("\nMonitoring service stopped by user.")
        sys.exit(0)


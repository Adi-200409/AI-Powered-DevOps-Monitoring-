"""Monitoring Service Orchestrator.

Ties together log collection, error detection, code context retrieval,
Groq LLM analysis, Slack alerting, and state storage for the dashboard.
"""

import os
import sys
import time
import json
import threading
import tempfile
from datetime import datetime
from typing import List, Dict, Any, Optional

from monitoring.log_collector import LogCollector
from monitoring.error_detector import ErrorDetector
from monitoring.code_analyzer import CodeAnalyzer
from monitoring.groq_analyzer import GroqAnalyzer
from monitoring.slack_alert import SlackNotifier
from monitoring.error_intelligence import enrich_incident

STATE_FILE = os.getenv("INCIDENTS_STATE_FILE", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs", "incidents.json"))
_INCIDENTS_LOCK = threading.Lock()


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
    """Append a deduplicated incident record and persist it for the dashboard."""
    with _INCIDENTS_LOCK:
        incidents = load_incidents()
        record = enrich_incident(incident_data, incidents)
        incidents.insert(0, record)
        incidents = incidents[:50]
        directory = os.path.dirname(os.path.abspath(STATE_FILE))
        temp_path = None
        try:
            os.makedirs(directory, exist_ok=True)
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=directory,
                prefix=".incidents-",
                suffix=".tmp",
                delete=False,
            ) as state_file:
                temp_path = state_file.name
                json.dump(incidents, state_file, indent=2)
            os.replace(temp_path, STATE_FILE)
        except OSError as exc:
            print(f"[MonitoringOrchestrator] Error saving incident state: {exc}")
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except OSError as cleanup_error:
                    print(f"[MonitoringOrchestrator] Error cleaning temporary state: {cleanup_error}")


def update_incident(incident_id: str, changes: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Update an existing incident without replacing unrelated incident history."""
    with _INCIDENTS_LOCK:
        incidents = load_incidents()
        for incident in incidents:
            if incident.get("id") != incident_id:
                continue
            incident.update(changes)
            directory = os.path.dirname(os.path.abspath(STATE_FILE))
            temp_path = None
            try:
                os.makedirs(directory, exist_ok=True)
                with tempfile.NamedTemporaryFile(
                    mode="w",
                    encoding="utf-8",
                    dir=directory,
                    prefix=".incidents-",
                    suffix=".tmp",
                    delete=False,
                ) as state_file:
                    temp_path = state_file.name
                    json.dump(incidents[:50], state_file, indent=2)
                os.replace(temp_path, STATE_FILE)
            except OSError as exc:
                print(f"[MonitoringOrchestrator] Error updating incident state: {exc}")
                if temp_path and os.path.exists(temp_path):
                    try:
                        os.unlink(temp_path)
                    except OSError as cleanup_error:
                        print(f"[MonitoringOrchestrator] Error cleaning temporary state: {cleanup_error}")
                raise
            return dict(incident)
    return None


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

    record = {
        "id": f"inc-{int(time.time() * 1000)}",
        "timestamp": incident.get("timestamp"),
        "detected_at": incident.get("detected_at"),
        "level": incident.get("level"),
        "container": incident.get("container"),
        "error_message": incident.get("message"),
        "code_context": code_ctx,
        "ai_diagnosis": ai_diagnosis,
    }
    record = enrich_incident(record, load_incidents())
    if record.get("duplicate_of"):
        delivered = False
        record["notification_suppressed"] = True
        print(f"[Notification] Suppressing duplicate alert for {record['duplicate_of']}.")
    else:
        print("[Notification] Sending alert to Slack...")
        delivered = slack.send_alert(incident=incident, ai_analysis=ai_diagnosis)
        record["notification_suppressed"] = False
    record["slack_delivered"] = delivered

    # Record incident state for dashboard
    save_incident(record)
    record = next(
        (item for item in load_incidents() if item.get("id") == record["id"]),
        record,
    )
    print("[Complete] Incident recorded and queued in dashboard.")
    return record


def _watch_docker_container(container_name: str, stop_event: threading.Event) -> None:
    """Run an independent error-processing loop for one configured Docker service."""
    collector = LogCollector(container_name=container_name)
    detector = ErrorDetector(target_container=container_name)
    analyzer = CodeAnalyzer()
    groq = GroqAnalyzer()
    slack = SlackNotifier()
    while not stop_event.is_set():
        try:
            for log_event in collector.tail_docker_log_events(stop_event=stop_event):
                if stop_event.is_set():
                    break
                if any(detector.is_actionable_error(line) for line in log_event):
                    print(
                        f"\n[ALERT] Actionable error detected in {container_name} "
                        f"({len(log_event)} lines):\n  {log_event[0]}"
                    )
                    process_error_event(
                        error_lines=log_event,
                        detector=detector,
                        analyzer=analyzer,
                        groq=groq,
                        slack=slack,
                    )
        except RuntimeError as exc:
            print(f"[Docker watcher:{container_name}] {exc}")
        if not stop_event.is_set():
            stop_event.wait(5)


def run_pipeline():
    """Listen to application and configured Docker logs for error events."""
    print("=================================================================")
    print("  AI-Powered DevOps Monitoring Service Started")
    print("  Listening for ERROR and CRITICAL events in application.log...")
    print("=================================================================")

    collector = LogCollector()
    detector = ErrorDetector()
    analyzer = CodeAnalyzer()
    groq = GroqAnalyzer()
    slack = SlackNotifier()
    stop_event = threading.Event()
    monitored_containers = sorted(
        {
            name.strip()
            for name in os.getenv("MONITORED_CONTAINERS", "").split(",")
            if name.strip()
        }
    )
    for container_name in monitored_containers:
        threading.Thread(
            target=_watch_docker_container,
            args=(container_name, stop_event),
            name=f"docker-log-watcher-{container_name}",
            daemon=True,
        ).start()
        print(f"  Watching Docker service: {container_name}")

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

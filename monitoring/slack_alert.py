"""Slack Alert Integration Module.

Module 6 in the DevOps Monitoring pipeline.
Dispatches real-time critical failure notifications and AI-generated root-cause reports
to the #devops-alerts channel via Slack Incoming Webhook.
"""

import os
import json
from typing import Dict, Any, Optional
import requests


class SlackNotifier:
    """Sends incident reports and AI triage summaries to Slack."""

    def __init__(self, webhook_url: Optional[str] = None, channel: Optional[str] = None):
        self.webhook_url = webhook_url or os.getenv("SLACK_WEBHOOK_URL", "")
        self.channel = channel or os.getenv("SLACK_CHANNEL", "#devops-alerts")

    def format_alert_text(
        self,
        incident: Dict[str, Any],
        ai_analysis: Dict[str, Any],
        server_name: str = "AWS EC2"
    ) -> str:
        """Formats alert plain text matching project documentation specification."""
        error_title = ai_analysis.get("detected_error", incident.get("message", "Application error"))
        root_cause = ai_analysis.get("probable_root_cause", "Under investigation")
        code_path = ai_analysis.get("potential_code_location", "Unknown location")
        recommendation = ai_analysis.get("ai_recommendation") or ai_analysis.get("suggested_solution", "Verify application logs")

        text = (
            f"*{self.channel} | Critical alert*\n"
            f"*Application Failure Detected!*\n"
            f"• *Application:* User Management System\n"
            f"• *Server:* {server_name}\n"
            f"• *Container:* {incident.get('container', 'user-service')}\n"
            f"• *Error:* {error_title}\n"
            f"• *AI Analysis:* {root_cause}\n"
            f"• *Suggested Code Path:* `{code_path}`\n"
            f"• *Recommended Action:* {recommendation}\n"
        )
        return text

    def send_alert(
        self,
        incident: Dict[str, Any],
        ai_analysis: Dict[str, Any],
        server_name: str = "AWS EC2"
    ) -> bool:
        """Posts incident and AI analysis payload to Slack Incoming Webhook."""
        message_text = self.format_alert_text(incident, ai_analysis, server_name)

        if not self.webhook_url or "YOUR/WEBHOOK/URL" in self.webhook_url:
            print(f"[SlackNotifier - DRY RUN]: No valid webhook configured.\n{message_text}")
            return False

        payload = {
            "text": message_text,
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": "🚨 Critical Application Failure Detected",
                        "emoji": True
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Application:*\nUser Management System"},
                        {"type": "mrkdwn", "text": f"*Environment:*\n{server_name}"},
                        {"type": "mrkdwn", "text": f"*Container:*\n`{incident.get('container', 'user-service')}`"},
                        {"type": "mrkdwn", "text": f"*Severity:*\n`{ai_analysis.get('severity', 'High')}`"}
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Error:* {ai_analysis.get('detected_error', incident.get('message', 'Error'))}"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*AI Root Cause Analysis:*\n{ai_analysis.get('probable_root_cause', 'N/A')}"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Potential Code Location:*\n`{ai_analysis.get('potential_code_location', 'N/A')}`"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Recommended Action:*\n{ai_analysis.get('ai_recommendation', 'Inspect container logs')}"
                    }
                }
            ]
        }

        try:
            response = requests.post(
                self.webhook_url,
                data=json.dumps(payload),
                headers={"Content-Type": "application/json"},
                timeout=5
            )
            if response.status_code == 200:
                print("[SlackNotifier] Alert successfully delivered to Slack.")
                return True
            else:
                print(f"[SlackNotifier] Slack API returned HTTP {response.status_code}: {response.text}")
                return False
        except Exception as exc:
            print(f"[SlackNotifier] Failed to send alert: {exc}")
            return False


if __name__ == "__main__":
    notifier = SlackNotifier()
    dummy_incident = {"container": "user-service", "message": "Database connection failed."}
    dummy_ai = {
        "detected_error": "Database connection failed.",
        "probable_root_cause": "Possible MongoDB connection configuration issue.",
        "potential_code_location": "database.py",
        "ai_recommendation": "Verify the database URI and Docker network."
    }
    notifier.send_alert(dummy_incident, dummy_ai)


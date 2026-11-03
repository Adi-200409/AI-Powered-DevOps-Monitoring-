"""Approval-gated dispatch to an operator-configured remediation runner."""

import os
from datetime import datetime, timezone
from typing import Any, Dict

import requests

from monitoring.code_analyzer import CodeAnalyzer

ALLOWED_RUNBOOKS = {
    "restart_service": "Restart the affected service",
    "rollback_deployment": "Roll back the most recent deployment",
    "scale_service": "Scale the affected service",
}


class RemediationError(RuntimeError):
    """Raised when an approved remediation cannot be safely dispatched."""


def remediation_status() -> Dict[str, Any]:
    """Report whether a trusted runbook receiver has been configured."""
    enabled = os.getenv("REMEDIATION_ENABLED", "false").strip().lower() == "true"
    configured = bool(os.getenv("REMEDIATION_WEBHOOK_URL", "").strip())
    return {
        "enabled": enabled and configured,
        "approval_required": True,
        "available_runbooks": [
            {"id": key, "label": label} for key, label in ALLOWED_RUNBOOKS.items()
        ],
        "reason": None
        if enabled and configured
        else "Set REMEDIATION_ENABLED=true and configure REMEDIATION_WEBHOOK_URL to enable dispatch.",
    }


def dispatch_remediation(
    incident: Dict[str, Any], runbook: str
) -> Dict[str, Any]:
    """Send an approved, allow-listed runbook request to the configured receiver."""
    status = remediation_status()
    if not status["enabled"]:
        raise RemediationError(status["reason"])
    if runbook not in ALLOWED_RUNBOOKS:
        raise RemediationError("Unsupported remediation runbook.")

    target_url = os.getenv("REMEDIATION_WEBHOOK_URL", "").strip()
    try:
        response = requests.post(
            target_url,
            json={
                "runbook": runbook,
                "incident": {
                    "id": incident.get("id"),
                    "fingerprint": incident.get("fingerprint"),
                    "service": incident.get("container"),
                    "severity": incident.get("level"),
                    "error_message": CodeAnalyzer().mask_secrets(
                        str(incident.get("error_message") or "")
                    ),
                },
            },
            timeout=5,
        )
    except requests.RequestException as exc:
        raise RemediationError(f"Remediation runner request failed: {type(exc).__name__}") from exc
    if not response.ok:
        raise RemediationError(
            f"Remediation runner returned HTTP {response.status_code}."
        )
    return {
        "runbook": runbook,
        "label": ALLOWED_RUNBOOKS[runbook],
        "status": "dispatched",
        "requested_at": datetime.now(timezone.utc).isoformat(),
    }

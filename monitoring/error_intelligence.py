"""Correlation, recurrence, and trend analysis for recorded incidents."""

import re
import statistics
import hashlib
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional


_VOLATILE_VALUE = re.compile(
    r"\b(?:[0-9a-f]{8}-[0-9a-f-]{27,}|0x[0-9a-f]+|\d{2,})\b", re.IGNORECASE
)
_NON_WORD = re.compile(r"[^a-z0-9]+")
_DEPENDENCY_PATTERNS = (
    ("postgresql", re.compile(r"\b(?:postgres(?:ql)?|psycopg2|database|sqlalchemy)\b", re.I)),
    ("redis", re.compile(r"\bredis\b", re.I)),
    ("network", re.compile(r"\b(?:connection|timeout|http|socket|network)\b", re.I)),
)


def error_fingerprint(message: str) -> str:
    """Create a stable key that ignores common request IDs and numeric values."""
    normalized = _VOLATILE_VALUE.sub("<value>", (message or "").lower())
    normalized = _NON_WORD.sub(" ", normalized)
    digest = hashlib.sha256(normalized.strip().encode("utf-8")).hexdigest()[:16]
    return f"err-{digest}"


def _parse_timestamp(value: Any) -> Optional[datetime]:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        for pattern in ("%Y-%m-%d %H:%M:%S",):
            try:
                parsed = datetime.strptime(value, pattern)
            except ValueError:
                continue
            parsed = parsed.replace(tzinfo=timezone.utc)
            break
        else:
            return None
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def enrich_incident(
    incident: Dict[str, Any], history: Iterable[Dict[str, Any]]
) -> Dict[str, Any]:
    """Attach a recurrence key and occurrence metadata to a new incident."""
    record = dict(incident)
    message = record.get("error_message", "")
    fingerprint = error_fingerprint(message)
    matches = [
        item
        for item in history
        if item.get("fingerprint") == fingerprint
        or (
            not item.get("fingerprint")
            and error_fingerprint(item.get("error_message", "")) == fingerprint
        )
    ]
    prior_times = [
        _parse_timestamp(item.get("detected_at") or item.get("timestamp") or item.get("last_seen"))
        for item in matches
    ]
    prior_times = [item for item in prior_times if item is not None]
    current_time = _parse_timestamp(record.get("timestamp")) or datetime.now(timezone.utc)
    detected_time = _parse_timestamp(record.get("detected_at")) or datetime.now(timezone.utc)
    recent_duplicate = next(
        (
            item
            for item in matches
            if item.get("slack_delivered") is True
            if (
                previous_time := _parse_timestamp(
                    item.get("detected_at") or item.get("timestamp") or item.get("last_seen")
                )
            )
            and timedelta(0) <= detected_time - previous_time <= timedelta(minutes=10)
        ),
        None,
    )
    record.update(
        {
            "fingerprint": fingerprint,
            "occurrence_count": len(matches) + 1,
            "first_seen": min(prior_times + [current_time]).isoformat(),
            "last_seen": current_time.isoformat(),
            "status": record.get("status", "open"),
            "duplicate_of": recent_duplicate.get("id") if recent_duplicate else None,
        }
    )
    return record


def _dependency_for(message: str) -> Optional[str]:
    for dependency, pattern in _DEPENDENCY_PATTERNS:
        if pattern.search(message or ""):
            return dependency
    return None


def build_error_intelligence(
    incidents: List[Dict[str, Any]],
    metric_samples: List[Dict[str, Any]],
    now: Optional[datetime] = None,
    metric_thresholds: Optional[Dict[str, Dict[str, float]]] = None,
) -> Dict[str, Any]:
    """Summarize recurrence, cross-service events, and measured resource trends."""
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=7)
    recent = []
    for incident in incidents:
        timestamp = _parse_timestamp(incident.get("timestamp") or incident.get("last_seen"))
        if timestamp and timestamp >= cutoff:
            recent.append(incident)

    pattern_map: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for incident in recent:
        fingerprint = incident.get("fingerprint") or error_fingerprint(
            incident.get("error_message", "")
        )
        pattern_map[fingerprint].append(incident)
    patterns = []
    for fingerprint, occurrences in pattern_map.items():
        occurrences.sort(
            key=lambda item: _parse_timestamp(item.get("timestamp")) or datetime.min.replace(tzinfo=timezone.utc)
        )
        patterns.append(
            {
                "fingerprint": fingerprint,
                "message": occurrences[-1].get("error_message", "Unknown error"),
                "occurrences": len(occurrences),
                "services": sorted({item.get("container") or "unknown" for item in occurrences}),
                "first_seen": occurrences[0].get("timestamp"),
                "last_seen": occurrences[-1].get("timestamp"),
                "incident_ids": [item.get("id") for item in occurrences if item.get("id")],
            }
        )
    patterns.sort(key=lambda item: (item["occurrences"], item["last_seen"] or ""), reverse=True)

    by_dependency: Dict[str, List[Any]] = defaultdict(list)
    for incident in recent:
        dependency = _dependency_for(incident.get("error_message", ""))
        timestamp = _parse_timestamp(incident.get("timestamp"))
        if dependency and timestamp:
            by_dependency[dependency].append((timestamp, incident))

    correlations = []
    for dependency, events in by_dependency.items():
        events.sort(key=lambda item: item[0])
        for index, (start, _) in enumerate(events):
            cluster = [
                incident
                for timestamp, incident in events[index:]
                if timestamp - start <= timedelta(minutes=15)
            ]
            services = sorted({item.get("container") or "unknown" for item in cluster})
            if len(cluster) > 1 and len(services) > 1:
                correlations.append(
                    {
                        "dependency": dependency,
                        "window_start": start.isoformat(),
                        "services": services,
                        "occurrences": len(cluster),
                        "incident_ids": [item.get("id") for item in cluster if item.get("id")],
                    }
                )
                break

    anomalies = analyze_metric_trends(metric_samples, metric_thresholds)
    return {
        "generated_at": now.isoformat(),
        "history_window_days": 7,
        "patterns": patterns,
        "correlations": correlations,
        "anomalies": anomalies,
        "summary": {
            "incidents_analyzed": len(recent),
            "recurring_patterns": sum(1 for item in patterns if item["occurrences"] > 1),
            "correlated_service_events": len(correlations),
            "anomaly_signals": len(anomalies),
        },
    }


def analyze_metric_trends(
    samples: List[Dict[str, Any]],
    thresholds: Optional[Dict[str, Dict[str, float]]] = None,
) -> List[Dict[str, Any]]:
    """Flag measured resource deviations and estimate time to warning threshold."""
    metrics = {
        "cpu": ("cpu_percent", 70.0),
        "memory": ("memory_percent", 80.0),
        "disk": ("disk_percent", 80.0),
    }
    anomalies = []
    for metric, (field, default_warning) in metrics.items():
        metric_limits = (thresholds or {}).get(metric, {})
        warning_threshold = metric_limits.get("warning", default_warning)
        critical_threshold = metric_limits.get("critical", 90.0)
        values = [
            (sample.get(field), _parse_timestamp(sample.get("sampled_at")))
            for sample in samples
        ]
        values = [(float(value), timestamp) for value, timestamp in values if value is not None and timestamp]
        if not values:
            continue
        current, current_time = values[-1]
        baseline_values = [value for value, _ in values[-21:-1]]
        baseline = statistics.median(baseline_values) if baseline_values else current
        deviations = [abs(value - baseline) for value in baseline_values]
        median_deviation = statistics.median(deviations) if deviations else 0.0
        threshold = max(15.0, median_deviation * 3.0)
        recent_values = values[-5:]
        rate_per_minute = 0.0
        if len(recent_values) >= 2:
            elapsed = (recent_values[-1][1] - recent_values[0][1]).total_seconds() / 60
            if elapsed > 0:
                rate_per_minute = (recent_values[-1][0] - recent_values[0][0]) / elapsed
        if current >= warning_threshold or current - baseline >= threshold:
            time_to_threshold = None
            if rate_per_minute > 0 and current < warning_threshold:
                time_to_threshold = round((warning_threshold - current) / rate_per_minute, 1)
            anomalies.append(
                {
                    "metric": metric,
                    "current": round(current, 1),
                    "baseline": round(baseline, 1),
                    "warning_threshold": warning_threshold,
                    "state": "warning" if current < critical_threshold else "critical",
                    "trend_per_minute": round(rate_per_minute, 2),
                    "estimated_minutes_to_warning": time_to_threshold,
                    "sampled_at": current_time.isoformat(),
                    "evidence": "measured history deviation" if current - baseline >= threshold else "configured threshold crossed",
                }
            )
    return anomalies

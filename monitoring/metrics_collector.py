"""Collect and retain host resource telemetry for the monitoring dashboard."""

import json
import logging
import os
import platform
import tempfile
import threading
import time
import subprocess
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

try:
    import psutil
except ImportError:
    psutil = None

logger = logging.getLogger(__name__)
START_TIME = time.time()
DEFAULT_HISTORY_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "logs",
    "metrics_history.json",
)


class MetricsCollector:
    """Collect host/process/network readings and retain a bounded sample history."""

    HISTORY_RETENTION_SECONDS = 7 * 24 * 60 * 60
    HISTORY_MAX_SAMPLES = 10_080
    HISTORY_SAMPLE_INTERVAL_SECONDS = 60
    DEFAULT_THRESHOLDS = {
        "cpu": {"warning": 70.0, "critical": 90.0},
        "memory": {"warning": 80.0, "critical": 90.0},
        "disk": {"warning": 80.0, "critical": 90.0},
    }

    def __init__(
        self,
        history_path: Optional[str] = None,
        sample_interval_seconds: int = HISTORY_SAMPLE_INTERVAL_SECONDS,
    ):
        self.start_time = START_TIME
        self.history_path = history_path or os.getenv(
            "METRICS_HISTORY_FILE", DEFAULT_HISTORY_PATH
        )
        self.sample_interval_seconds = max(1, sample_interval_seconds)
        self._lock = threading.Lock()
        self._container_lock = threading.Lock()
        self._history = self._load_history()
        self._previous_network: Optional[Dict[str, int]] = None
        self._previous_network_time: Optional[float] = None
        self._container_cache: Optional[Dict[str, Any]] = None
        self._container_cache_time = 0.0

    def get_system_metrics(self) -> Dict[str, Any]:
        """Gather a current host, network, and monitoring-process snapshot."""
        now = time.time()
        timestamp = datetime.now(timezone.utc).isoformat()
        uptime_seconds = max(0, int(now - self.start_time))
        hours, remainder = divmod(uptime_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        uptime_formatted = f"{hours}h {minutes}m {seconds}s"

        snapshot: Dict[str, Any] = {
            "sampled_at": timestamp,
            "host": {
                "name": platform.node() or "unknown",
                "platform": platform.platform(),
                "process_id": os.getpid(),
                "process_name": "monitoring-dashboard",
                "uptime_seconds": uptime_seconds,
                "uptime_formatted": uptime_formatted,
            },
            "uptime": {"seconds": uptime_seconds, "formatted": uptime_formatted},
            "cpu": {"percent": None, "cores": None},
            "memory": {
                "total_gb": None,
                "used_gb": None,
                "percent": None,
                "available_gb": None,
            },
            "disk": {
                "total_gb": None,
                "used_gb": None,
                "percent": None,
                "free_gb": None,
            },
            "network": {
                "bytes_sent_per_second": None,
                "bytes_received_per_second": None,
                "total_bytes_sent": None,
                "total_bytes_received": None,
            },
            "process": {"cpu_percent": None, "memory_mb": None},
            "top_processes": [],
            "containers": {"status": "UNAVAILABLE", "items": [], "reason": "Not sampled"},
            "thresholds": self._get_thresholds(),
        }

        if psutil is not None:
            snapshot["cpu"] = {
                "percent": round(psutil.cpu_percent(interval=None), 1),
                "cores": psutil.cpu_count(logical=True),
            }
            virtual_memory = psutil.virtual_memory()
            snapshot["memory"] = {
                "total_gb": round(virtual_memory.total / (1024**3), 2),
                "used_gb": round(virtual_memory.used / (1024**3), 2),
                "percent": round(virtual_memory.percent, 1),
                "available_gb": round(virtual_memory.available / (1024**3), 2),
            }
            disk_usage = psutil.disk_usage(os.path.abspath(os.sep))
            snapshot["disk"] = {
                "total_gb": round(disk_usage.total / (1024**3), 2),
                "used_gb": round(disk_usage.used / (1024**3), 2),
                "percent": round(disk_usage.percent, 1),
                "free_gb": round(disk_usage.free / (1024**3), 2),
            }
            snapshot["network"] = self._get_network_metrics(now)
            snapshot["process"] = self._get_process_metrics()
            snapshot["top_processes"] = self._get_top_processes()

        snapshot["containers"] = self._get_container_metrics()
        snapshot["alerts"] = self._get_alerts(snapshot)
        return snapshot

    def record_sample(self, snapshot: Dict[str, Any]) -> None:
        """Persist one history sample, rate-limited to keep the file bounded."""
        now = datetime.now(timezone.utc)
        with self._lock:
            if self._history:
                previous = self._parse_timestamp(self._history[-1].get("sampled_at"))
                if previous and (now - previous).total_seconds() < self.sample_interval_seconds:
                    return

            sample = {
                "sampled_at": snapshot["sampled_at"],
                "cpu_percent": snapshot["cpu"].get("percent"),
                "memory_percent": snapshot["memory"].get("percent"),
                "disk_percent": snapshot["disk"].get("percent"),
                "network_sent_bytes_per_second": snapshot["network"].get(
                    "bytes_sent_per_second"
                ),
                "network_received_bytes_per_second": snapshot["network"].get(
                    "bytes_received_per_second"
                ),
            }
            cutoff = now - timedelta(seconds=self.HISTORY_RETENTION_SECONDS)
            self._history = [
                item
                for item in self._history
                if (self._parse_timestamp(item.get("sampled_at")) or now) >= cutoff
            ]
            self._history.append(sample)
            self._history = self._history[-self.HISTORY_MAX_SAMPLES :]
            self._save_history()

    def get_history(self, limit: int = HISTORY_MAX_SAMPLES) -> List[Dict[str, Any]]:
        """Return the newest retained samples in chronological order."""
        safe_limit = max(1, min(int(limit), self.HISTORY_MAX_SAMPLES))
        with self._lock:
            return [dict(sample) for sample in self._history[-safe_limit:]]

    def _get_network_metrics(self, now: float) -> Dict[str, Optional[float]]:
        counters = psutil.net_io_counters() if psutil is not None else None
        if counters is None:
            return {
                "bytes_sent_per_second": None,
                "bytes_received_per_second": None,
                "total_bytes_sent": None,
                "total_bytes_received": None,
            }

        current = {
            "sent": int(counters.bytes_sent),
            "received": int(counters.bytes_recv),
        }
        elapsed = now - self._previous_network_time if self._previous_network_time else 0
        previous = self._previous_network
        self._previous_network = current
        self._previous_network_time = now

        sent_rate = None
        received_rate = None
        if previous is not None and elapsed > 0:
            sent_rate = round(max(0, current["sent"] - previous["sent"]) / elapsed, 1)
            received_rate = round(
                max(0, current["received"] - previous["received"]) / elapsed, 1
            )
        return {
            "bytes_sent_per_second": sent_rate,
            "bytes_received_per_second": received_rate,
            "total_bytes_sent": current["sent"],
            "total_bytes_received": current["received"],
        }

    @staticmethod
    def _get_process_metrics() -> Dict[str, Optional[float]]:
        if psutil is None:
            return {"cpu_percent": None, "memory_mb": None}
        process = psutil.Process(os.getpid())
        return {
            "cpu_percent": round(process.cpu_percent(interval=None), 1),
            "memory_mb": round(process.memory_info().rss / (1024**2), 1),
        }

    @staticmethod
    def _get_top_processes() -> List[Dict[str, Any]]:
        if psutil is None:
            return []
        processes = []
        for process in psutil.process_iter(["pid", "name", "memory_info"]):
            try:
                info = process.info
                memory_info = info.get("memory_info")
                if memory_info is None:
                    continue
                processes.append(
                    {
                        "pid": info["pid"],
                        "name": info.get("name") or "unknown",
                        "memory_mb": round(memory_info.rss / (1024**2), 1),
                    }
                )
            except (psutil.AccessDenied, psutil.NoSuchProcess, psutil.ZombieProcess):
                continue
        processes.sort(key=lambda item: item["memory_mb"], reverse=True)
        return processes[:5]

    def _get_container_metrics(self) -> Dict[str, Any]:
        with self._container_lock:
            if (
                self._container_cache is not None
                and time.monotonic() - self._container_cache_time < 15
            ):
                return dict(self._container_cache)

            try:
                result = subprocess.run(
                    [
                        "docker",
                        "stats",
                        "--no-stream",
                        "--format",
                        "{{json .}}",
                    ],
                    check=True,
                    capture_output=True,
                    text=True,
                    timeout=1,
                )
            except FileNotFoundError:
                data = {"status": "UNAVAILABLE", "items": [], "reason": "Docker CLI not installed"}
            except subprocess.TimeoutExpired:
                data = {"status": "UNAVAILABLE", "items": [], "reason": "Docker stats timed out"}
            except subprocess.CalledProcessError:
                data = {"status": "UNAVAILABLE", "items": [], "reason": "Docker daemon unavailable"}
            else:
                items = []
                for line in result.stdout.splitlines():
                    try:
                        row = json.loads(line)
                        items.append(
                            {
                                "id": row.get("ID") or row.get("Container") or "",
                                "name": row.get("Name") or "unknown",
                                "cpu_percent": row.get("CPUPerc"),
                                "memory_usage": row.get("MemUsage"),
                                "memory_percent": row.get("MemPerc"),
                                "network_io": row.get("NetIO"),
                                "block_io": row.get("BlockIO"),
                                "pids": row.get("PIDs"),
                            }
                        )
                    except json.JSONDecodeError:
                        logger.warning("Ignoring an unparseable line from docker stats")
                data = {
                    "status": "UP",
                    "items": items,
                    "sampled_at": datetime.now(timezone.utc).isoformat(),
                }

            self._container_cache = data
            self._container_cache_time = time.monotonic()
            return dict(data)

    @classmethod
    def _get_thresholds(cls) -> Dict[str, Dict[str, float]]:
        thresholds = {}
        for metric, defaults in cls.DEFAULT_THRESHOLDS.items():
            try:
                warning = float(
                    os.getenv(f"METRICS_{metric.upper()}_WARNING", defaults["warning"])
                )
                critical = float(
                    os.getenv(f"METRICS_{metric.upper()}_CRITICAL", defaults["critical"])
                )
            except ValueError:
                logger.warning("Invalid %s thresholds; using defaults", metric)
                thresholds[metric] = dict(defaults)
                continue
            if not 0 <= warning < critical <= 100:
                logger.warning("Invalid %s thresholds; using defaults", metric)
                thresholds[metric] = dict(defaults)
            else:
                thresholds[metric] = {"warning": warning, "critical": critical}
        return thresholds

    @staticmethod
    def _get_alerts(snapshot: Dict[str, Any]) -> List[Dict[str, str]]:
        alerts = []
        for metric in ("cpu", "memory", "disk"):
            reading = snapshot[metric].get("percent")
            if reading is None:
                continue
            thresholds = snapshot["thresholds"][metric]
            if reading >= thresholds["critical"]:
                state = "critical"
            elif reading >= thresholds["warning"]:
                state = "warning"
            else:
                continue
            alerts.append(
                {
                    "metric": metric,
                    "state": state,
                    "message": f"{metric.title()} utilization is {reading:.1f}%.",
                }
            )
        return alerts

    def _load_history(self) -> List[Dict[str, Any]]:
        try:
            with open(self.history_path, "r", encoding="utf-8") as history_file:
                data = json.load(history_file)
        except FileNotFoundError:
            return []
        except (OSError, json.JSONDecodeError):
            logger.exception("Unable to load persisted metrics history from %s", self.history_path)
            return []

        if not isinstance(data, list):
            logger.warning("Ignoring invalid metrics history in %s", self.history_path)
            return []
        cutoff = datetime.now(timezone.utc) - timedelta(
            seconds=self.HISTORY_RETENTION_SECONDS
        )
        valid = [
            item
            for item in data
            if isinstance(item, dict)
            and self._parse_timestamp(item.get("sampled_at")) is not None
            and self._parse_timestamp(item.get("sampled_at")) >= cutoff
        ]
        return valid[-self.HISTORY_MAX_SAMPLES :]

    def _save_history(self) -> None:
        directory = os.path.dirname(os.path.abspath(self.history_path))
        temp_path = None
        try:
            os.makedirs(directory, exist_ok=True)
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=directory,
                prefix=".metrics-history-",
                suffix=".tmp",
                delete=False,
            ) as history_file:
                temp_path = history_file.name
                json.dump(self._history, history_file)
            os.replace(temp_path, self.history_path)
        except OSError:
            logger.exception("Unable to persist metrics history to %s", self.history_path)
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except OSError:
                    logger.exception("Unable to clean temporary metrics history file")

    @staticmethod
    def _parse_timestamp(value: Any) -> Optional[datetime]:
        if not isinstance(value, str):
            return None
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)


if __name__ == "__main__":
    collector = MetricsCollector()
    metrics = collector.get_system_metrics()
    collector.record_sample(metrics)
    print("System Metrics:", metrics)

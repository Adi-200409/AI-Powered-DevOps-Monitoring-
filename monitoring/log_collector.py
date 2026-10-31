"""Log Collector Module.

Module 4 in the DevOps Monitoring pipeline.
Responsible for reading application log files (application.log) and Docker container logs.
Provides streaming/tailing capabilities to feed the error detector in real-time.
"""

import os
import time
import subprocess
from typing import Generator, List, Optional


class LogCollector:
    """Collects logs from local files or running Docker containers."""

    def __init__(self, log_file_path: Optional[str] = None, container_name: Optional[str] = None):
        if log_file_path:
            self.log_file_path = log_file_path
        else:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            self.log_file_path = os.getenv("LOG_FILE_PATH", os.path.join(base_dir, "logs", "application.log"))
        
        self.container_name = container_name or os.getenv("CONTAINER_NAME", "user-service")
        self._last_position = 0

    def read_all_logs(self, max_lines: int = 500) -> List[str]:
        """Read the most recent lines from the application log file."""
        if not os.path.exists(self.log_file_path):
            return []

        try:
            with open(self.log_file_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
                return [line.rstrip("\r\n") for line in lines[-max_lines:]]
        except Exception as exc:
            print(f"[LogCollector] Error reading log file: {exc}")
            return []

    def tail_log_stream(self, interval_seconds: float = 1.0) -> Generator[str, None, None]:
        """Continuously tail and yield newly appended log lines from the file."""
        if not os.path.exists(self.log_file_path):
            # Create if missing
            os.makedirs(os.path.dirname(self.log_file_path), exist_ok=True)
            open(self.log_file_path, "a", encoding="utf-8").close()

        with open(self.log_file_path, "r", encoding="utf-8", errors="ignore") as f:
            # Start from the current end of file
            f.seek(0, os.SEEK_END)
            self._last_position = f.tell()

            while True:
                line = f.readline()
                if line:
                    yield line.rstrip("\r\n")
                else:
                    time.sleep(interval_seconds)

    def fetch_docker_logs(self, tail: int = 100) -> List[str]:
        """Fetch logs directly from a Docker container if running."""
        try:
            result = subprocess.run(
                ["docker", "logs", "--tail", str(tail), self.container_name],
                capture_output=True,
                text=True,
                check=False
            )
            if result.returncode == 0:
                return result.stdout.splitlines()
            return [f"Docker CLI returned code {result.returncode}: {result.stderr.strip()}"]
        except FileNotFoundError:
            return ["[LogCollector] Docker CLI not found on host."]
        except Exception as exc:
            return [f"[LogCollector] Error retrieving Docker logs: {exc}"]


if __name__ == "__main__":
    collector = LogCollector()
    print(f"Reading logs from: {collector.log_file_path}")
    recent = collector.read_all_logs(max_lines=10)
    print(f"Found {len(recent)} recent log lines:")
    for l in recent:
        print("  ", l)

"""Log Collector Module.

Module 4 in the DevOps Monitoring pipeline.
Responsible for reading application log files (application.log) and Docker container logs.
Provides streaming/tailing capabilities to feed the error detector in real-time.
"""

import os
import queue
import re
import time
import subprocess
import threading
from typing import Generator, List, Optional


class LogCollector:
    """Collects logs from local files or running Docker containers."""

    TIMESTAMP_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}")
    DOCKER_TIMESTAMP_PATTERN = re.compile(
        r"^(?P<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))\s+(?P<line>.*)$"
    )

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
        except OSError as exc:
            raise RuntimeError(f"Unable to read application log file: {exc}") from exc

    def tail_log_stream(
        self,
        interval_seconds: float = 0.5,
        stop_event: Optional[threading.Event] = None,
    ) -> Generator[str, None, None]:
        """Yield newly appended lines, reopening the file after rotation or truncation."""
        stop_event = stop_event or threading.Event()
        file_handle = None
        position = 0
        file_identity = None
        has_opened = False

        try:
            os.makedirs(os.path.dirname(self.log_file_path) or ".", exist_ok=True)
            with open(self.log_file_path, "a", encoding="utf-8"):
                pass
            while not stop_event.is_set():
                if not os.path.exists(self.log_file_path):
                    stop_event.wait(interval_seconds)
                    continue

                try:
                    file_stat = os.stat(self.log_file_path)
                except FileNotFoundError:
                    if file_handle is not None:
                        file_handle.close()
                        file_handle = None
                        file_identity = None
                    continue

                current_identity = (file_stat.st_dev, file_stat.st_ino)
                if file_handle is None or current_identity != file_identity:
                    if file_handle is not None:
                        file_handle.close()
                    file_handle = open(self.log_file_path, "r", encoding="utf-8", errors="ignore")
                    file_identity = current_identity
                    if has_opened:
                        position = 0
                    else:
                        position = file_handle.seek(0, os.SEEK_END)
                        has_opened = True

                current_size = file_stat.st_size
                if current_size < position:
                    file_handle.seek(0)
                    position = 0
                elif file_handle.tell() != position:
                    file_handle.seek(position)

                line = file_handle.readline()
                if line:
                    position = file_handle.tell()
                    yield line.rstrip("\r\n")
                else:
                    stop_event.wait(interval_seconds)
        finally:
            if file_handle is not None:
                file_handle.close()

    def tail_log_events(self, interval_seconds: float = 0.5) -> Generator[List[str], None, None]:
        """Continuously tail log file and yield multi-line log events.
        
        Groups a timestamped log line with any immediate stack trace continuation lines.
        """
        if not os.path.exists(self.log_file_path):
            os.makedirs(os.path.dirname(self.log_file_path), exist_ok=True)
            open(self.log_file_path, "a", encoding="utf-8").close()

        with open(self.log_file_path, "r", encoding="utf-8", errors="ignore") as f:
            f.seek(0, os.SEEK_END)
            current_event: List[str] = []

            while True:
                line = f.readline()
                if line:
                    stripped = line.rstrip("\r\n")
                    if self.TIMESTAMP_PATTERN.match(stripped):
                        # Yield previous accumulated event if non-empty
                        if current_event:
                            yield current_event
                        current_event = [stripped]
                    else:
                        # Continuation line (stack trace or multiline body)
                        if current_event:
                            current_event.append(stripped)
                        else:
                            current_event = [stripped]
                else:
                    if current_event:
                        yield current_event
                        current_event = []
                    time.sleep(interval_seconds)

    def fetch_docker_logs(self, tail: int = 100) -> List[str]:
        """Fetch logs directly from a Docker container if running."""
        try:
            result = subprocess.run(
                ["docker", "logs", "--timestamps", "--tail", str(tail), self.container_name],
                capture_output=True,
                text=True,
                check=False,
                timeout=5,
            )
            if result.returncode == 0:
                return result.stdout.splitlines()
            detail = result.stderr.strip() or f"exit code {result.returncode}"
            raise RuntimeError(f"Unable to read Docker logs for '{self.container_name}': {detail}")
        except FileNotFoundError as exc:
            raise RuntimeError("Docker CLI is not installed or is not available on PATH.") from exc
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(f"Timed out while reading Docker logs for '{self.container_name}'.") from exc
        except OSError as exc:
            raise RuntimeError(f"Unable to start Docker log reader: {exc}") from exc

    def tail_docker_logs(
        self,
        stop_event: threading.Event,
        since_seconds: int = 2,
    ) -> Generator[str, None, None]:
        """Follow new Docker log lines until stopped or the container exits."""
        try:
            process = subprocess.Popen(
                [
                    "docker",
                    "logs",
                    "--follow",
                    "--timestamps",
                    "--since",
                    f"{since_seconds}s",
                    self.container_name,
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
        except FileNotFoundError as exc:
            raise RuntimeError("Docker CLI is not installed or is not available on PATH.") from exc
        except OSError as exc:
            raise RuntimeError(f"Unable to start Docker log reader: {exc}") from exc

        output_queue = queue.Queue(maxsize=256)

        def enqueue_output(value):
            while not stop_event.is_set():
                try:
                    output_queue.put(value, timeout=0.25)
                    return
                except queue.Full:
                    continue

        def read_output():
            if process.stdout is None:
                enqueue_output(None)
                return
            for output_line in process.stdout:
                enqueue_output(output_line.rstrip("\r\n"))
            enqueue_output(None)

        reader = threading.Thread(target=read_output, daemon=True)
        reader.start()
        try:
            while not stop_event.is_set():
                try:
                    line = output_queue.get(timeout=0.25)
                except queue.Empty:
                    if process.poll() is not None:
                        break
                    continue
                if line is None:
                    break
                yield line

            return_code = process.poll()
            if not stop_event.is_set() and return_code:
                detail = process.stderr.read().strip() if process.stderr else ""
                raise RuntimeError(
                    f"Unable to follow Docker logs for '{self.container_name}': "
                    f"{detail or f'exit code {return_code}'}"
                )
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
            if process.stdout:
                process.stdout.close()
            if process.stderr:
                process.stderr.close()
            reader.join(timeout=1)

    def tail_docker_log_events(
        self,
        stop_event: threading.Event,
        since_seconds: int = 2,
    ) -> Generator[List[str], None, None]:
        """Group followed Docker records into timestamped application events."""
        current_event: List[str] = []
        for docker_line in self.tail_docker_logs(stop_event, since_seconds):
            match = self.DOCKER_TIMESTAMP_PATTERN.match(docker_line)
            content = match.group("line") if match else docker_line
            timestamp = None
            if match:
                timestamp = match.group("timestamp")[:19].replace("T", " ")

            if timestamp and not self.TIMESTAMP_PATTERN.match(content):
                if re.match(r"^(INFO|WARNING|ERROR|CRITICAL)\b", content):
                    content = f"{timestamp} {content}"
                elif current_event:
                    current_event.append(content)
                    continue
                else:
                    content = f"{timestamp} {content}"

            if self.TIMESTAMP_PATTERN.match(content):
                if current_event:
                    yield current_event
                current_event = [content]
            elif current_event:
                current_event.append(content)
            else:
                current_event = [content]

        if current_event:
            yield current_event


if __name__ == "__main__":
    collector = LogCollector()
    print(f"Reading logs from: {collector.log_file_path}")
    recent = collector.read_all_logs(max_lines=10)
    print(f"Found {len(recent)} recent log lines:")
    for l in recent:
        print("  ", l)

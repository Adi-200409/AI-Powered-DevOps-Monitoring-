"""Code Analyzer Module.

Extracts file, function, and line references from stack traces.
Retrieves code context snippets from the local codebase.
Sanitizes code and stack traces by masking sensitive credentials, passwords, and API keys
prior to passing context to the external LLM.
"""

import os
import re
from typing import Dict, Optional, Tuple


class CodeAnalyzer:
    """Parses stack traces, reads nearby code snippets, and masks sensitive secrets."""

    # Regex patterns for Python stack traces
    TRACE_PATTERN = re.compile(
        r'File\s+["\'](?P<file>[^"\']+)["\'],\s+line\s+(?P<line>\d+)(?:,\s+in\s+(?P<func>\w+))?',
        re.IGNORECASE
    )

    # Patterns to mask sensitive data
    SECRET_PATTERNS = [
        (re.compile(r'(?i)(password|passwd|pwd|secret|api_key|token|auth)\s*[:=]\s*["\']?([^"\'\s]+)["\']?'), r'\1="***MASKED***"'),
        (re.compile(r'gsk_[A-Za-z0-9_-]{20,}'), '***GROQ_API_KEY_MASKED***'),
        (re.compile(r'AKIA[0-9A-Z]{16}'), '***AWS_KEY_MASKED***'),
        (re.compile(r'(?:postgres|postgresql)(?:\+psycopg2)?://([^:]+):([^@]+)@'), r'postgresql://***USER***:***PASS***@'),
        (re.compile(r'mongodb(?:\+srv)?://([^:]+):([^@]+)@'), r'mongodb://***USER***:***PASS***@'),
        (re.compile(r'Bearer\s+[A-Za-z0-9_\-\.]+'), 'Bearer ***TOKEN_MASKED***'),
        (re.compile(r'https://hooks\.slack\.com/services/[A-Za-z0-9/_-]+'), 'https://hooks.slack.com/services/***MASKED_WEBHOOK***'),
    ]

    def __init__(self, workspace_root: Optional[str] = None):
        if workspace_root:
            self.workspace_root = workspace_root
        else:
            self.workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    def mask_secrets(self, text: str) -> str:
        """Removes API keys, passwords, and connection credentials from text."""
        sanitized = text
        for pattern, replacement in self.SECRET_PATTERNS:
            sanitized = pattern.sub(replacement, sanitized)
        return sanitized

    def parse_traceback_location(self, text: str) -> Optional[Tuple[str, int, str]]:
        """Parses the most relevant (file, line_number, function) from an error or stack trace."""
        matches = list(self.TRACE_PATTERN.finditer(text))
        if not matches:
            return None

        # Take the most recent call in the trace (last frame)
        target_match = matches[-1]
        file_name = target_match.group("file")
        line_num = int(target_match.group("line"))
        func_name = target_match.group("func") or "global_or_unknown"
        return file_name, line_num, func_name

    def locate_file_in_workspace(self, target_filename: str) -> Optional[str]:
        """Finds the absolute path of a file within the workspace.

        Prefer project files over virtual environment and dependency vendored copies
        that share the same basename (for example, database.py under .venv/site-packages).
        """
        base_name = os.path.basename(target_filename)
        candidates = []
        excluded_dirs = {'.git', '.venv', 'venv', '__pycache__', 'node_modules', '.pytest_cache'}

        for root, dirs, files in os.walk(self.workspace_root):
            dirs[:] = [d for d in dirs if d not in excluded_dirs and not d.startswith('.')]
            if base_name not in files:
                continue

            full_path = os.path.join(root, base_name)
            normalized = os.path.normpath(full_path)
            parts = normalized.split(os.sep)
            if any(part in {'site-packages', '.venv', 'venv'} for part in parts):
                candidates.append((1, full_path))
            else:
                candidates.append((0, full_path))

        if not candidates:
            return None

        candidates.sort(key=lambda item: item[0])
        return candidates[0][1]

    def get_code_context(self, file_path: str, line_number: int, window: int = 5) -> str:
        """Fetches the source code snippet around the target line number."""
        resolved_path = file_path if os.path.isabs(file_path) else self.locate_file_in_workspace(file_path)
        if not resolved_path or not os.path.exists(resolved_path):
            return f"# Source file '{file_path}' not found in workspace."

        try:
            with open(resolved_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()

            total_lines = len(lines)
            start_idx = max(0, line_number - 1 - window)
            end_idx = min(total_lines, line_number + window)

            snippet = []
            for idx in range(start_idx, end_idx):
                curr_line_num = idx + 1
                prefix = "-> " if curr_line_num == line_number else "   "
                snippet.append(f"{prefix}{curr_line_num:4d} | {lines[idx].rstrip()}")

            return "\n".join(snippet)
        except Exception as exc:
            return f"# Error reading source code: {exc}"

    def analyze(self, error_message: str, stack_trace: str = "") -> Dict[str, str]:
        """Full code context retrieval and sanitization pipeline."""
        combined_text = f"{error_message}\n{stack_trace}"
        parsed = self.parse_traceback_location(combined_text)

        if parsed:
            file_name, line_num, func_name = parsed
            code_snippet = self.get_code_context(file_name, line_num)
            potential_location = f"{os.path.basename(file_name)} (Line: {line_num}, Function: {func_name})"
        else:
            file_name, line_num, func_name = "unknown", 0, "unknown"
            code_snippet = "# No specific file location identified in traceback."
            potential_location = "Location not determined from traceback"

        # Mask secrets before returning
        sanitized_trace = self.mask_secrets(combined_text)
        sanitized_snippet = self.mask_secrets(code_snippet)

        return {
            "file": file_name,
            "line": line_num,
            "function": func_name,
            "potential_code_location": potential_location,
            "code_snippet": sanitized_snippet,
            "sanitized_trace": sanitized_trace
        }


if __name__ == "__main__":
    analyzer = CodeAnalyzer()
    sample_trace = 'File "database.py", line 25\nConnectionError: Database unavailable'
    res = analyzer.analyze("Database connection failed", sample_trace)
    print("Potential Location:", res["potential_code_location"])
    print("Snippet preview:\n", res["code_snippet"][:200])


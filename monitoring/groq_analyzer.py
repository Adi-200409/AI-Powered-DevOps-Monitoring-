"""Groq LLM Incident Analysis Module.

Module 5 in the DevOps Monitoring pipeline.
Submits sanitized error messages and extracted code context to Groq API.
Enforces rate limiting, deduplication, and structured JSON output.
Provides graceful offline fallback when an API key is not yet configured.
"""

import os
import json
import hashlib
import time
from typing import Dict, Any, Optional

try:
    from groq import Groq
except ImportError:
    Groq = None


class GroqAnalyzer:
    """Interacts with Groq API for root-cause analysis and code-level remediation suggestions."""

    DEFAULT_MODEL = "llama-3.3-70b-versatile"

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY", "")
        self.model = model or os.getenv("GROQ_MODEL", self.DEFAULT_MODEL)
        self.client = Groq(api_key=self.api_key) if (Groq and self.api_key and not self.api_key.startswith("gsk_your")) else None
        
        # Deduplication cache to respect Groq rate limits
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._last_call_time = 0.0
        self._min_interval = 2.0  # seconds between consecutive calls

    def _hash_incident(self, error_message: str, location: str) -> str:
        """Computes unique digest to prevent duplicate queries for repeated errors."""
        key = f"{error_message.strip()}::{location.strip()}".encode("utf-8")
        return hashlib.md5(key).hexdigest()

    def analyze_incident(
        self,
        error_message: str,
        sanitized_trace: str,
        code_snippet: str,
        potential_location: str,
        container_name: str = "user-service",
        service_name: str = "User Management System"
    ) -> Dict[str, str]:
        """Queries Groq LLM to diagnose the root cause and suggest code-level solutions."""
        incident_id = self._hash_incident(error_message, potential_location)

        # Check deduplication cache
        if incident_id in self._cache:
            return self._cache[incident_id]

        # If Groq client is not initialized, return a structured fallback response
        if not self.client:
            fallback_res = self._generate_fallback_diagnosis(
                error_message=error_message,
                potential_location=potential_location,
                container_name=container_name
            )
            self._cache[incident_id] = fallback_res
            return fallback_res

        # Rate limiting throttle
        elapsed = time.time() - self._last_call_time
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)

        prompt = (
            f"You are an expert DevOps and Site Reliability Engineer (SRE). "
            f"Analyze the following application failure in '{service_name}' (container '{container_name}').\n\n"
            f"--- ERROR DETAILS ---\n"
            f"Message: {error_message}\n"
            f"Potential Code Location: {potential_location}\n\n"
            f"--- RELEVANT CODE SNIPPET ---\n"
            f"{code_snippet}\n\n"
            f"--- STACK TRACE ---\n"
            f"{sanitized_trace}\n\n"
            f"Respond ONLY with a valid JSON object strictly matching this schema:\n"
            f"{{\n"
            f'  "severity": "High" | "Medium" | "Critical",\n'
            f'  "detected_error": "<concise error title>",\n'
            f'  "probable_root_cause": "<detailed explanation of what failed>",\n'
            f'  "potential_code_location": "{potential_location} (based on the supplied repository context, not an automatically verified diagnosis)",\n'
            f'  "suggested_solution": "1. <step 1> 2. <step 2> 3. <step 3>",\n'
            f'  "ai_recommendation": "<immediate operational action before restarting>"\n'
            f"}}"
        )

        try:
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You analyze system errors and produce concise, structured JSON remediation reports."},
                    {"role": "user", "content": prompt}
                ],
                model=self.model,
                response_format={"type": "json_object"},
                temperature=0.2,
                max_tokens=600
            )

            self._last_call_time = time.time()
            content = chat_completion.choices[0].message.content
            parsed = json.loads(content)
            self._cache[incident_id] = parsed
            return parsed
        except Exception as exc:
            print(f"[GroqAnalyzer] API call failed: {exc}. Utilizing rule-based fallback.")
            fallback = self._generate_fallback_diagnosis(error_message, potential_location, container_name)
            self._cache[incident_id] = fallback
            return fallback

    def _generate_fallback_diagnosis(self, error_message: str, potential_location: str, container_name: str) -> Dict[str, str]:
        """Provides simulated/offline diagnosis matching the project brief when API is unavailable."""
        if "database" in error_message.lower() or "connection" in error_message.lower():
            return {
                "severity": "High",
                "detected_error": "PostgreSQL connection timeout / Database unavailable",
                "probable_root_cause": "The FastAPI app cannot connect to the PostgreSQL server: an invalid connection string, unavailable database container, or network port 5432 restrictions",
                "potential_code_location": f"{potential_location} (based on the supplied repository context, not an automatically verified diagnosis)",
                "suggested_solution": "1. Verify DATABASE_URL URI and credentials. 2. Verify that PostgreSQL container is running on port 5432. 3. Check Docker network bridge between app and postgres. 4. Implement connection pooling and retry timeout.",
                "ai_recommendation": "Verify PostgreSQL service status and DATABASE_URL in .env before restarting the FastAPI application."
            }
        
        return {
            "severity": "Critical" if "critical" in error_message.lower() else "High",
            "detected_error": error_message.split("\n")[0][:100],
            "probable_root_cause": f"Unhandled runtime exception encountered in container {container_name}.",
            "potential_code_location": f"{potential_location} (based on the supplied repository context, not an automatically verified diagnosis)",
            "suggested_solution": "1. Inspect recent code changes around the potential location. 2. Verify environment variable configurations. 3. Check container logs for dependencies.",
            "ai_recommendation": "Review potential code location and redeploy after unit testing."
        }


if __name__ == "__main__":
    analyzer = GroqAnalyzer()
    res = analyzer.analyze_incident(
        error_message="ConnectionError: Database unavailable",
        sanitized_trace="database.py:25",
        code_snippet="conn = psycopg2.connect(DATABASE_URL)",
        potential_location="database.py:25"
    )
    print("AI Analysis Output:\n", json.dumps(res, indent=2))


# ==========================================
# Root Dockerfile for CI/CD Container Build
# ==========================================
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /workspace

# Install curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install all project dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all source modules
COPY application/ application/
COPY monitoring/ monitoring/
COPY dashboard/ dashboard/
COPY tests/ tests/
COPY logs/ logs/

EXPOSE 5000 5050

# Default entrypoint launches the application
CMD ["python", "-m", "application.app"]


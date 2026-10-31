# ==========================================
# Root Dockerfile for CI/CD Container Build
# ==========================================
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /workspace

# Install curl and PostgreSQL development libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq-dev \
    gcc \
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

# Default entrypoint launches the FastAPI application
CMD ["uvicorn", "application.app:app", "--host", "0.0.0.0", "--port", "5000"]

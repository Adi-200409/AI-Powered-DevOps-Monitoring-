# ==========================================
# Dockerfile for FastAPI Sample Application
# ==========================================
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_PORT=5000

WORKDIR /app

# Install system dependencies (curl for health check, libpq for PostgreSQL)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY application/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY application/ /app/application/
COPY logs/ /app/logs/

# Create logs directory
RUN mkdir -p /app/logs

EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Run FastAPI via Uvicorn
CMD ["uvicorn", "application.app:app", "--host", "0.0.0.0", "--port", "5000"]

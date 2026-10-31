# ==========================================
# Dockerfile for Sample Application
# ==========================================
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_PORT=5000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
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

# Run application
CMD ["python", "-m", "application.app"]

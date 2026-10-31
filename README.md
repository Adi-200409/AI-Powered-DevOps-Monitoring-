# AI-Powered DevOps Monitoring & Intelligent Incident Resolution System

[![Tech Stack](https://img.shields.io/badge/Stack-React%2018%20%7C%20FastAPI%20%7C%20Python%20%7C%20PostgreSQL-61dafb.svg)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%2016-336791.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Containers-blue)](https://www.docker.com/)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-Jenkins%207--Stage-orange)](Jenkinsfile)
[![AI Analysis](https://img.shields.io/badge/LLM-Groq%20API-green)](https://groq.com)
[![Alerts](https://img.shields.io/badge/Alerts-Slack%20Webhook-4A154B)](https://slack.com)

An automated DevOps observability platform built with **React**, **FastAPI**, **Python**, and **PostgreSQL**. The system watches deployed microservices, detects critical errors in real-time, extracts code context while masking sensitive credentials, asks an LLM (via Groq API) for the probable root cause and code-level remediation, and dispatches actionable alerts directly to Slack.

---

## 1. System Architecture

The system connects delivery, runtime, log monitoring, AI root-cause analysis, and notification across 5 distinct layers:

```
[Developer] ---> [GitHub] ---> [Jenkins CI/CD] ---> [AWS ECR]
                                                        │
                                          (Deploy Image)│
                                                        ▼
┌── AWS EC2 Instance / Docker Host ───────────────────────────────────────────┐
│                                                                             │
│   [FastAPI Application]  ──── writes logs ────> [logs/application.log]      │
│            │                                           │                    │
│   (PostgreSQL 16)                                      ▼                    │
│                                              [Python Monitor Service]       │
│                                                        │                    │
│   [React 18 Dashboard]  <─── feeds status ── (Detect ERROR & CRITICAL)      │
│   (FastAPI Backend)                                    │                    │
│                                                        ▼                    │
│                                             [Code Context Analyzer]         │
│                                             (Traceback + Mask Secrets)      │
│                                                        │                    │
└────────────────────────────────────────────────────────┼────────────────────┘
                                                         │
                        ┌────────────────────────────────┴────────────────┐
                        ▼                                                 ▼
          [Groq API (Llama LLM)]                             [Slack Webhook]
       (Root Cause + Remediations)                        (#devops-alerts Channel)
```

---

## 2. Updated Technology Stack

| Layer | Technology | Role & Functionality |
| :--- | :--- | :--- |
| **Frontend** | **React 18** (Vite / SPA) | Centralized 9-panel monitoring dashboard with live polling, gauges, and AI reports. |
| **Backend API** | **FastAPI** (Python 3.12) | High-performance async REST API, health probes (`/health`), and test failure endpoints. |
| **Database** | **PostgreSQL 16** | Relational datastore for microservices (`psycopg2-binary`, `SQLAlchemy`). |
| **Monitoring Backend** | **Python** (`psutil`) | Log tailing, regex error parsing, secret masking, CPU/RAM metrics collection. |
| **AI / LLM** | **Groq API** (Llama 3.3) | Fast inference for automated root cause analysis, code path identification, and remediation. |
| **Alerts & ChatOps**| **Slack Webhook** | Instant notifications sent directly to `#devops-alerts`. |
| **Containerization** | **Docker & Compose** | Containerized microservices for App, PostgreSQL, Monitor, and Dashboard. |
| **CI/CD Automation** | **Jenkins** | 7-stage automated deployment pipeline. |

---

## 3. Repository Structure

```
AI-DEVOPS-MONITORING/
├── application/                    # Monitored FastAPI Microservice (Module 3)
│   ├── __init__.py
│   ├── app.py                      # FastAPI app with /health, /api/items, and failure simulations
│   ├── database.py                 # PostgreSQL connection pool with connection error hooks
│   ├── requirements.txt            # FastAPI & PostgreSQL dependencies
│   └── Dockerfile                  # Container definition for application service
│
├── monitoring/                     # Core Monitoring & AI Engine (Modules 4, 5, 6)
│   ├── __init__.py
│   ├── log_collector.py            # Tails application.log and Docker container logs
│   ├── error_detector.py           # Filters ERROR/CRITICAL and parses tracebacks
│   ├── code_analyzer.py            # Extracts code snippets & masks PostgreSQL credentials/API keys
│   ├── groq_analyzer.py            # Groq API integration (PostgreSQL root-cause & fix suggestions)
│   ├── slack_alert.py              # Posts structured alerts to #devops-alerts
│   ├── metrics_collector.py        # Gathers host CPU, Memory, Disk, and Uptime
│   └── main.py                     # Continuous pipeline orchestrator
│
├── dashboard/                      # Centralized Monitoring Dashboard (Module 9/10)
│   ├── __init__.py
│   ├── app.py                      # FastAPI dashboard backend & REST endpoints
│   ├── templates/
│   │   └── index.html              # Standalone React 18 dashboard (zero-build execution)
│   └── frontend/                   # Full React 18 + Vite source code
│       ├── package.json            # React dependencies
│       ├── vite.config.js          # Vite config & API proxy
│       ├── index.html              # HTML shell
│       └── src/
│           ├── App.jsx             # 9-panel React dashboard component
│           ├── main.jsx            # React root mount
│           └── index.css           # Modern dark-mode DevOps theme
│
├── logs/
│   ├── .gitkeep                    # Retains logs directory in git
│   ├── application.log             # Active application log file
│   └── incidents.json              # Local persistent incident cache for dashboard
│
├── tests/                          # Automated Pytest Suite (Jenkins Stage 3)
│   ├── __init__.py
│   └── test_app.py                 # Unit and integration tests for FastAPI, Postgres & Monitor
│
├── Dockerfile                      # Root Dockerfile for CI/CD builds
├── docker-compose.yml              # Multi-container orchestration (FastAPI, PostgreSQL, Monitor, React)
├── Jenkinsfile                     # 7-Stage Declarative CI/CD Pipeline
├── pytest.ini                      # Pytest discovery configuration
├── requirements.txt                # Workspace root python dependencies
├── .env.example                    # Environment variable template
├── .gitignore                      # Git ignore rules
└── README.md                       # Project documentation and team onboarding guide
```

---

## 4. The 9-Panel Central Dashboard (React 18)

The React web dashboard (`http://localhost:5050` or Vite on `http://localhost:5173`) visualizes:

1. **System Overview**: Live health check of the monitored FastAPI service (`/health`).
2. **CPU Monitoring**: Real-time server CPU utilization and core count (`metrics_collector.py`).
3. **Memory Monitoring**: RAM utilization percentage, allocated GB, and available memory.
4. **Log Viewer**: Live scrolling terminal displaying `application.log`.
5. **Error Detection**: Active alert list with timestamps, log levels, and messages (`error_detector.py`).
6. **AI Analysis** _(Highlighted)_: Groq LLM diagnosis containing severity, root cause, and remediation steps.
7. **Code Path**: Identified source file, line number, and code snippet with line indicator `->`.
8. **Slack Notifications**: Delivery status indicator and preview of sent alerts.
9. **Deployment History**: Jenkins 7-stage CI/CD execution pipeline status.

---

## 5. Jenkins 7-Stage CI/CD Pipeline

Defined in [`Jenkinsfile`](file:///d:/Projects/AI-Powered%20DevOps%20Monitoring/Jenkinsfile):

```
┌──────────────┐     ┌─────────┐     ┌────────┐     ┌──────────────┐
│ 1. Source    │ ──> │ 2.Build │ ──> │ 3.Test │ ──> │ 4.Docker     │
│    Code      │     │  (pip)  │     │(pytest)│     │   Build      │
└──────────────┘     └─────────┘     └────────┘     └──────────────┘
                                                           │
┌──────────────┐     ┌─────────┐     ┌──────────────┐      │
│ 7. Health    │ <── │ 6.Deploy│ <── │ 5.Push Image │ <────┘
│    Check     │     │  (EC2)  │     │  (AWS ECR)   │
└──────────────┘     └─────────┘     └──────────────┘
```

A failed stage stops the pipeline immediately so only verified builds reach production.

---

## 6. Getting Started (Local Development)

### 1. Environment Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd AI-DEVOPS-MONITORING

# Copy environment variables
cp .env.example .env

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Run Automated Tests
```bash
pytest tests/ -v
```

### 3. Running Services

#### Option A: Docker Compose (Recommended)
Spins up PostgreSQL 16, FastAPI microservice, Python monitor, and React dashboard:
```bash
docker compose up --build
```

#### Option B: Run Standalone Python Processes
- **FastAPI Application (Port 5000):**
  ```bash
  python -m application.app
  ```
- **Monitoring Engine:**
  ```bash
  python -m monitoring.main
  ```
- **React Dashboard Backend (Port 5050):**
  ```bash
  python -m dashboard.app
  ```
  *(Dashboard is immediately visible at `http://localhost:5050`).*

- **Optional - React Vite Frontend Development Server:**
  ```bash
  cd dashboard/frontend
  npm install
  npm run dev
  ```
  *(Opens on `http://localhost:5173` with hot-module reloading and proxy to FastAPI backend).*

---

## 7. How to Test the Failure & AI Resolution Flow

1. With the services running, trigger the simulated PostgreSQL connection failure:
   ```bash
   curl http://localhost:5000/api/simulate-db-error
   ```
2. **Observe the automated triage pipeline:**
   - **Log detection:** The error detector identifies `ConnectionError: Database unavailable`.
   - **Code Context:** The code analyzer extracts `database.py`, line 25, and masks any database credentials.
   - **AI Analysis:** Groq analyzes the code context and generates the root cause and remediation for PostgreSQL.
   - **Slack Alert:** An alert is sent to `#devops-alerts`.
   - **React Dashboard:** Panels 5, 6, and 7 update with live incident diagnostics.

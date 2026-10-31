# AI-Powered DevOps Monitoring & Intelligent Incident Resolution System

[![Tech Stack](https://img.shields.io/badge/Stack-React%2018%20%7C%20FastAPI%20%7C%20Python%20%7C%20PostgreSQL-61dafb.svg)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%2016-336791.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Containers-blue)](https://www.docker.com/)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-Jenkins%207--Stage-orange)](Jenkinsfile)
[![AI Analysis](https://img.shields.io/badge/LLM-Groq%20API-green)](https://groq.com)
[![Alerts](https://img.shields.io/badge/Alerts-Slack%20Webhook-4A154B)](https://slack.com)

An automated DevOps observability platform built with **React 18**, **FastAPI**, **Python**, and **PostgreSQL**. The system watches deployed microservices, detects critical errors in real-time, extracts code context while masking sensitive credentials, asks an LLM (via Groq API) for the probable root cause and code-level remediation, and dispatches actionable alerts directly to Slack.

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

## 2. Technology Stack

| Layer | Technology | Role & Functionality |
| :--- | :--- | :--- |
| **Frontend** | **React 18** (Vite / SPA) | Modern, responsive 9-panel monitoring dashboard with **Light Theme** (default) & Dark Theme toggle, live telemetry sparklines, log filters, and incident controls. |
| **Icons & UI** | **Lucide React** | Sleek SVG iconography for DevOps infrastructure, pipelines, AI diagnostics, and terminal actions. |
| **Backend API** | **FastAPI** (Python 3.12+) | High-performance async REST API, health probes (`/health`), metrics, and failure simulation endpoints. |
| **Database** | **PostgreSQL 16** | Relational datastore for microservices (`psycopg2-binary`, `SQLAlchemy`). |
| **Monitoring Backend** | **Python** (`psutil`) | Log tailing, regex error parsing, secret masking, CPU/RAM metrics collection. |
| **AI / LLM** | **Groq API** (Llama 3.3 70B) | Fast inference for automated root cause analysis, code path identification, and remediation. |
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
│       ├── package.json            # React dependencies & scripts
│       ├── vite.config.js          # Vite configuration & /api proxy to FastAPI
│       ├── index.html              # HTML entry point
│       └── src/
│           ├── main.jsx            # React root mount
│           ├── App.jsx             # Main dashboard layout with left rail, analytics & sidebar
│           ├── index.css           # Premium dark-plum AMOLED theme with neon violet accents
│           ├── hooks/
│           │   └── useDevOpsData.js # Live polling hook, 20-point rolling telemetry & simulation
│           ├── utils/
│           │   └── mockData.js     # Realistic demo telemetry & incident fallback
│           └── components/
│               ├── Sidebar.jsx     # Floating slim left navigation rail with glowing badges
│               ├── TopBar.jsx      # Brand logo, search pill, team status & profile widget
│               ├── TelemetryChart.jsx # Interactive wave chart with purple area & dashed gold curve
│               ├── ServiceCards.jsx # Ongoing service cards with signature status dot matrix
│               ├── RightSidebar.jsx # Starting calls, break timers & sunset gradient card
│               ├── DiagnosticsModal.jsx # Full-screen SRE diagnostics hub (AI, Slack, Logs, CI/CD)
│               ├── AiTriagePanel.jsx # Groq LLM root-cause & copyable remediation
│               ├── CodeContextPanel.jsx # Code snippet & secrets masking
│               ├── SlackNotificationPanel.jsx # #devops-alerts message card
│               ├── PipelineHistory.jsx # Jenkins 7-stage CI/CD execution pipeline
│               └── LogTerminal.jsx # Filterable & searchable application.log console
│
├── logs/
│   ├── .gitkeep                    # Retains logs directory in git
│   ├── application.log             # Active application log file
│   └── incidents.json              # Local persistent incident cache for dashboard
│
├── tests/                          # Automated Pytest Suite (Jenkins Stage 3)
│   ├── __init__.py
│   ├── test_app.py                 # Unit tests for FastAPI, Postgres & Monitor
│   └── test_pipeline.py            # End-to-end integration tests for the full monitoring loop
│
├── Dockerfile                      # Root Dockerfile for CI/CD builds
├── docker-compose.yml              # Multi-container orchestration (FastAPI, PostgreSQL, Monitor, React)
├── Jenkinsfile                     # 7-Stage Declarative CI/CD Pipeline
├── pytest.ini                      # Pytest discovery configuration
├── requirements.txt                # Workspace root python dependencies
├── .env.example                    # Environment variable template
├── .gitignore                      # Git ignore rules (node_modules, dist, logs, venv)
└── README.md                       # Project documentation and team onboarding guide
```

---

## 4. The Central Observability Dashboard (React 18)

The React web dashboard (`http://localhost:5050` or Vite on `http://localhost:5173`) features a design inspired by modern high-end observability interfaces:

1. **Floating Navigation Rail**: Slim rounded sidebar with active purple glow rings, hot-pink notification counters (`2`), settings, and instant fault-injection triggers.
2. **Global Header & Search**: Search bar pill, team workload status pill (`12 of 15 on work`, `2 on break`), and SRE Admin profile widget.
3. **Telemetry Statistics Wave Chart**: Dual-curve interactive canvas featuring a glowing solid purple wave area chart with cubic bezier curves, alongside a secondary dashed neon yellow baseline curve, day/week/month filters, and interactive date selector pills (`01 Sat` through `13 Thu`, with active white pill highlight).
4. **Active Microservice Cards**: 3 feature cards with service avatars, call timers, uptime pills, lead attribution, and the signature **purple & yellow status dot-matrix**.
5. **Right Operational Column**: Real-time incident feeds (`Starting calls`), diagnostic timers with colored badges (`Break`), and the **Sunset Gradient Banner Card** (`+278k Autonomous Incidents Resolved`).
6. **Diagnostics & SRE Hub**: Clicking any card or rail icon opens a glassmorphism modal with Groq AI root-cause analysis, secret-masked code snippets, Slack dispatch previews, Jenkins 7-stage pipeline timelines, and streaming log terminal controls.

1. **System Health & Probes**: Real-time status (`200 OK` / `OFFLINE`), microservice uptime, and PostgreSQL connection pool telemetry.
2. **CPU Utilization**: Live host CPU load %, core count, alert thresholds, and rolling 20-point animated SVG sparkline telemetry.
3. **Memory Allocation**: RAM allocation %, allocated vs. total GB breakdown, and dynamic trend sparklines.
4. **Log Stream Terminal**: Interactive terminal displaying `application.log` with level filters (`ALL`, `INFO`, `WARN`, `ERROR`, `CRITICAL`), real-time search, auto-scroll lock, line numbering, and copy controls.
5. **Error Detection Engine**: Detected incident feed with severity badges (`CRITICAL`, `ERROR`), container source, and click-to-inspect incident switching that syncs all diagnostic panels.
6. **AI Root Cause Analysis** *(Groq LLM / Llama 3.3)*: Detailed incident breakdown with probable root causes, one-click copyable remediation snippets, and long-term reliability recommendations.
7. **Code Context & Secret Masking**: Identified file and line number, sensitive credential masking badge (`Credentials Redacted`), error line highlighting (`>>>>`), and sanitized traceback toggle.
8. **Slack Notification Dispatch**: Authentic Slack card preview for `#devops-alerts`, webhook delivery indicator, and raw JSON payload inspector.
9. **CI/CD Deployment Pipeline**: Visual Jenkins 7-stage pipeline flow with stage status indicators (`SUCCESS` / `FAILED`), stage durations, commit info, and expandable build drawer.

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

### 2. Frontend Setup (React 18 + Vite)
```bash
cd dashboard/frontend

# Install dependencies (pnpm or npm)
pnpm install
# or: npm install

# Run the Vite development server (hot-reloading on port 5173)
pnpm run dev
# or: npm run dev

# Build for production (outputs to dashboard/frontend/dist)
pnpm run build
# or: npm run build
```

### 3. Run Automated Tests
```bash
pytest tests/ -v
```

### 4. Running the Complete System

#### Option A: Docker Compose (Recommended)
Spins up PostgreSQL 16, FastAPI microservice, Python monitor, and React dashboard:
```bash
docker compose up --build
```

#### Option B: Standalone Services
- **FastAPI Monitored Microservice (Port 5000):**
  ```bash
  python -m application.app
  ```
- **Monitoring & AI Triage Engine:**
  ```bash
  python -m monitoring.main
  ```
- **FastAPI Dashboard Backend (Port 5050 - Serves compiled React SPA):**
  ```bash
  python -m dashboard.app
  ```
  *(Opens on `http://localhost:5050`)*.

- **Vite React Dev Server (Port 5173 - Hot Module Replacement):**
  ```bash
  cd dashboard/frontend
  pnpm run dev
  ```
  *(Opens on `http://localhost:5173` with automatic `/api` proxy to port 5050)*.

---

## 7. How to Test the Failure & AI Resolution Flow

You can trigger and observe automated incident triage using either the Web UI or curl:

### Option A: From the React Dashboard (One-Click)
1. Open the dashboard at `http://localhost:5173` or `http://localhost:5050`.
2. Click the **"Simulate Incident"** button in the top navigation header.
3. Choose either:
   - **PostgreSQL Pool Failure**: Simulates connection exhaustion on port 5432.
   - **Critical OOM RuntimeError**: Simulates an unhandled memory exception in transaction logic.
4. Watch the incident immediately register in **Error Detection (Panel 5)**, generate root-cause analysis in **Groq AI Triage (Panel 6)**, show masked code in **Code Context (Panel 7)**, and render a formatted notification in **Slack Dispatch (Panel 8)**.

### Option B: From the Terminal
```bash
# Trigger simulated PostgreSQL connection failure
curl http://localhost:5000/api/simulate-db-error

# Or trigger critical crash
curl http://localhost:5000/api/simulate-crash
```

**Observe the automated triage pipeline:**
- **Log detection:** The error detector identifies `ConnectionError: Database unavailable`.
- **Code Context:** The code analyzer extracts `database.py`, line 25, and masks any database credentials.
- **AI Analysis:** Groq analyzes the code context and generates the root cause and remediation for PostgreSQL.
- **Slack Alert:** An alert is sent to `#devops-alerts`.
- **React Dashboard:** Panels 5, 6, 7, and 8 update with live incident diagnostics.

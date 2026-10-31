# AI-Powered DevOps Monitoring & Intelligent Incident Resolution System

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://www.docker.com/)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-Jenkins%207--Stage-orange)](Jenkinsfile)
[![AI Analysis](https://img.shields.io/badge/LLM-Groq%20API-green)](https://groq.com)
[![Alerts](https://img.shields.io/badge/Alerts-Slack%20Webhook-4A154B)](https://slack.com)

An automated DevOps observability platform that watches deployed applications, detects errors and critical failures in real-time, extracts code context while masking sensitive credentials, asks an LLM (via Groq API) for the probable root cause and code-level remediation, and dispatches actionable alerts directly to Slack.

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
│   [Flask Application]  ──── writes logs ────>  [logs/application.log]       │
│                                                        │                    │
│   [Central Dashboard]  <─── feeds status ───           ▼                    │
│   (9 Health Panels)                         [Python Monitor Service]        │
│                                                        │                    │
│                                           (Detect ERROR & CRITICAL)         │
│                                                        │                    │
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

## 2. Repository Structure

```
AI-DEVOPS-MONITORING/
├── application/                    # Monitored Web Application (Module 3)
│   ├── __init__.py
│   ├── app.py                      # Flask service with /health & failure trigger routes
│   ├── database.py                 # MongoDB connector with error handling & simulation
│   ├── requirements.txt            # App-specific python dependencies
│   └── Dockerfile                  # Container definition for application service
│
├── monitoring/                     # Core Monitoring & AI Engine (Modules 4, 5, 6)
│   ├── __init__.py
│   ├── log_collector.py            # Tails application.log and Docker container logs
│   ├── error_detector.py           # Filters ERROR/CRITICAL and parses tracebacks
│   ├── code_analyzer.py            # Extracts code snippets & masks API keys/credentials
│   ├── groq_analyzer.py            # Groq API integration (root cause & remediation)
│   ├── slack_alert.py              # Posts structured alerts to #devops-alerts
│   ├── metrics_collector.py        # Gathers host CPU, Memory, Disk, and Uptime
│   └── main.py                     # Orchestrator running the continuous event loop
│
├── dashboard/                      # Centralized Monitoring Dashboard (Module 9/10)
│   ├── __init__.py
│   ├── app.py                      # Flask dashboard API backend
│   └── templates/
│       └── index.html              # Modern 9-panel UI matching project wireframe
│
├── logs/
│   ├── .gitkeep                    # Retains logs directory in git
│   ├── application.log             # Active application log file
│   └── incidents.json              # Local persistent incident cache for dashboard
│
├── tests/                          # Automated Pytest Suite (Jenkins Stage 3)
│   ├── __init__.py
│   └── test_app.py                 # Unit and integration tests for all modules
│
├── Dockerfile                      # Root Dockerfile for CI/CD builds
├── docker-compose.yml              # Multi-container orchestration (App, Mongo, Monitor, Dashboard)
├── Jenkinsfile                     # 7-Stage Declarative CI/CD Pipeline
├── pytest.ini                      # Pytest discovery configuration
├── requirements.txt                # Workspace root python dependencies
├── .env.example                    # Environment variable template
├── .gitignore                      # Git ignore rules
└── README.md                       # Project documentation and team onboarding guide
```

---

## 3. Module Responsibilities & Team Breakdown

Assign tasks to team members based on the 6 project modules:

| Module | Core Responsibility | Files Involved | Team Member |
| :--- | :--- | :--- | :--- |
| **1. AWS Integration** | Host EC2, configure ECR registry, IAM roles, and CloudWatch metrics. | Cloud Infrastructure | _DevOps Lead_ |
| **2. CI/CD Pipeline** | Automate build, test, Docker image push, EC2 deployment, and health check. | `Jenkinsfile` | _DevOps / CI Engineer_ |
| **3. Containerization & App** | Implement Flask app, simulated endpoints, MongoDB connector, and Dockerfile. | `application/*`, `docker-compose.yml` | _Backend Engineer_ |
| **4. Log Monitoring** | Stream log events, detect `ERROR`/`CRITICAL`, and ignore `INFO`/`WARNING`. | `monitoring/log_collector.py`, `monitoring/error_detector.py` | _Monitoring Lead_ |
| **5. AI Error Resolution** | Retrieve code context, sanitize secrets, call Groq API, format JSON diagnosis. | `monitoring/code_analyzer.py`, `monitoring/groq_analyzer.py` | _AI / Python Engineer_ |
| **6. Slack Notifications** | Format alert payloads and post to Slack incoming webhook. | `monitoring/slack_alert.py` | _Automation Engineer_ |
| **Dashboard** | Unified 9-panel web interface visualizing metrics, incidents, logs, and CI/CD. | `dashboard/*` | _Full-stack / Frontend_ |

---

## 4. The 9-Panel Central Dashboard

The web dashboard (`http://localhost:5050`) fulfills all 9 panels specified in the project architecture:

1. **System Overview**: Live health check of the monitored application (`/health` endpoint).
2. **CPU Monitoring**: Real-time server CPU utilization and core count (`metrics_collector.py`).
3. **Memory Monitoring**: RAM utilization percentage, allocated GB, and available memory.
4. **Log Viewer**: Live scrolling console reading `application.log`.
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

### Prerequisites
- Python 3.10+ (Python 3.12 recommended)
- Docker & Docker Compose (optional for pure Python local run)
- Groq API Key ([Get free API key](https://console.groq.com/keys))
- Slack Incoming Webhook URL

### 1. Clone & Set Up Environment
```bash
git clone <your-repo-url>
cd AI-DEVOPS-MONITORING

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```
Edit `.env`:
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 3. Run Automated Tests
```bash
pytest tests/ -v
```

### 4. Running the Services Locally

#### Option A: Run Individual Components (Terminal)
Open 3 terminal windows:

* **Terminal 1: Start Application (Port 5000)**
  ```bash
  python -m application.app
  ```

* **Terminal 2: Start Monitoring Engine**
  ```bash
  python -m monitoring.main
  ```

* **Terminal 3: Start Dashboard (Port 5050)**
  ```bash
  python -m dashboard.app
  ```

Open your browser at `http://localhost:5050` to view the dashboard!

#### Option B: Run with Docker Compose
```bash
docker compose up --build
```

---

## 7. How to Test the Failure & AI Resolution Flow

To test the entire automated incident workflow:

1. Ensure the application, monitoring service, and dashboard are running.
2. In your browser or with curl, trigger the simulated database failure:
   ```bash
   curl http://localhost:5000/api/simulate-db-error
   ```
3. **Observe the pipeline in action:**
   - **Log detection:** The error detector identifies `ConnectionError: Database unavailable`.
   - **Code Context:** The code analyzer extracts `database.py`, line 25, and masks any database credentials.
   - **AI Analysis:** Groq analyzes the code context and generates the root cause and remediation.
   - **Slack Alert:** A notification appears in `#devops-alerts`.
   - **Dashboard:** Panel 5, 6, and 7 immediately update with the diagnosis and code context.

---

## 8. Security & Operational Rules

1. **Secret Masking:** Never send raw passwords, API keys, AWS credentials, or MongoDB URI credentials to Groq. `code_analyzer.py` automatically enforces token masking.
2. **Advisory Wording:** AI output is always presented as `potential code location` and `probable root cause` — it advises the human engineer, and does not alter production code directly in version 1.
3. **Groq Free Tier Optimization:** The monitor implements deduplication caching (`_hash_incident`) and interval throttling to operate comfortably within free-tier rate limits.


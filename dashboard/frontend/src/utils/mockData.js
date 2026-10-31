export const initialMockSystemStatus = {
  status: 'UP',
  service: 'User Management Service (FastAPI)',
  http_code: 200,
  details: {
    status: 'healthy',
    service: 'User Management Service',
    uptime: 'active',
    database: 'postgresql',
    db_pool: 'connected (min=2, max=10)',
    latency_ms: 18
  }
};

export const initialMockMetrics = {
  cpu: { percent: 28.4, cores: 8 },
  memory: { percent: 46.2, used_gb: 7.4, total_gb: 16.0, available_gb: 8.6 },
  uptime: { formatted: '4d 11h 23m' },
  disk: { percent: 34.8, free_gb: 128.4, total_gb: 256.0 }
};

export const initialMockIncidents = [
  {
    id: 'inc-101',
    timestamp: '2026-10-31 18:24:12',
    level: 'CRITICAL',
    container: 'user-service',
    error_message: 'ConnectionError: Database unavailable - FATAL: password authentication failed for user "app_user"',
    code_context: {
      potential_code_location: 'application/database.py:28 in get_db_connection',
      sanitized_trace: 'Traceback (most recent call last):\n  File "application/app.py", line 77, in get_items\n    items = get_application_data()\n  File "application/database.py", line 28, in get_db_connection\n    conn = psycopg2.connect(DATABASE_URL)\nConnectionError: Database unavailable',
      code_snippet: '25  def get_db_connection():\n26      """Establishes connection to PostgreSQL cluster."""\n27      try:\n28  >>>>    conn = psycopg2.connect("postgresql://app_user:****@postgres:5432/userdb")\n29          return conn\n30      except Exception as exc:\n31          logger.error("Database connection failed\\nFile \\"database.py\\", line 25...")',
      secrets_masked: true
    },
    ai_diagnosis: {
      detected_error: 'PostgreSQL Credential Rejection / ConnectionRefusedError',
      probable_root_cause: 'The application attempted to authenticate to PostgreSQL port 5432 using stale credentials from the environment variable POSTGRES_PASSWORD following the automated schema migration in Build #42.',
      suggested_solution: '1. Verify POSTGRES_PASSWORD secret in AWS Secrets Manager / .env.\n2. Execute credentials rotation in docker-compose.yml.\n3. Restart user-service container to pick up refreshed connection pool tokens.',
      ai_recommendation: 'Add connection retry logic with exponential backoff (e.g. tenacity library) to prevent cascading connection exhaustion.'
    },
    slack_delivered: true
  },
  {
    id: 'inc-100',
    timestamp: '2026-10-31 16:45:00',
    level: 'ERROR',
    container: 'user-service',
    error_message: 'HTTPException 500: Internal Server Error in /api/items query timeout',
    code_context: {
      potential_code_location: 'application/database.py:44 in get_application_data',
      sanitized_trace: 'QueryTimeout: statement timeout after 5000ms\n  File "application/database.py", line 44',
      code_snippet: '42      cursor = conn.cursor()\n43      # Unindexed full table scan on large dataset\n44  >>>>cursor.execute("SELECT id, username, email FROM users ORDER BY created_at DESC LIMIT 100")\n45      rows = cursor.fetchall()',
      secrets_masked: true
    },
    ai_diagnosis: {
      detected_error: 'Slow Query Timeout on unindexed users.created_at',
      probable_root_cause: 'Table users has grown past 500,000 rows without an index on created_at column, causing sequential scans exceeding 5000ms timeout.',
      suggested_solution: 'CREATE INDEX CONCURRENTLY idx_users_created_at ON users (created_at DESC);',
      ai_recommendation: 'Set up automated slow-query logging in postgresql.conf (log_min_duration_statement = 2000).'
    },
    slack_delivered: true
  }
];

export const initialMockLogs = [
  '2026-10-31 18:30:00 [INFO] [application] Application startup complete on 0.0.0.0:5000',
  '2026-10-31 18:30:02 [INFO] [application] Health check probe received from Jenkins CI/CD - HTTP 200 OK',
  '2026-10-31 18:30:05 [INFO] [application] Database connection pool initialized (min=2, max=10)',
  '2026-10-31 18:30:10 [INFO] [application] GET /api/items - 200 OK - 24ms',
  '2026-10-31 18:30:15 [INFO] [application] GET /health - 200 OK - 2ms',
  '2026-10-31 18:30:22 [WARNING] [monitoring] PostgreSQL connection latency elevated to 140ms',
  '2026-10-31 18:30:28 [ERROR] [application] Database connection failed File "database.py", line 25 ConnectionError: Database unavailable',
  '2026-10-31 18:30:29 [CRITICAL] [monitoring] Actionable error detected in application.log -> Triage queued',
  '2026-10-31 18:30:30 [INFO] [monitoring] CodeAnalyzer: Stack trace parsed, masked credentials in postgresql://app_user:****@postgres:5432/userdb',
  '2026-10-31 18:30:31 [INFO] [monitoring] Groq Llama 3.3 API inference complete (latency 420ms)',
  '2026-10-31 18:30:32 [INFO] [monitoring] Slack webhook alert dispatched successfully to #devops-alerts',
  '2026-10-31 18:30:35 [INFO] [application] GET /health - 200 OK - 3ms'
];

export const initialMockDeployments = [
  {
    build_number: 43,
    branch: 'main',
    commit: 'fix(db): update PostgreSQL connection string and retry handling',
    status: 'SUCCESS',
    timestamp: '2026-10-31 11:15:00',
    duration: '1m 32s',
    author: 'DevOps Engineer',
    stages: [
      { name: 'Source Code', status: 'SUCCESS', duration: '4s' },
      { name: 'Build', status: 'SUCCESS', duration: '18s' },
      { name: 'Test', status: 'SUCCESS', duration: '22s' },
      { name: 'Docker Build', status: 'SUCCESS', duration: '25s' },
      { name: 'Push Image', status: 'SUCCESS', duration: '12s' },
      { name: 'Deploy', status: 'SUCCESS', duration: '8s' },
      { name: 'Health Check', status: 'SUCCESS', duration: '3s' }
    ]
  },
  {
    build_number: 42,
    branch: 'main',
    commit: 'feat(user): migrate from MongoDB to PostgreSQL schema',
    status: 'FAILED',
    timestamp: '2026-10-31 10:30:00',
    duration: '2m 05s',
    author: 'Backend Team',
    stages: [
      { name: 'Source Code', status: 'SUCCESS', duration: '4s' },
      { name: 'Build', status: 'SUCCESS', duration: '20s' },
      { name: 'Test', status: 'SUCCESS', duration: '24s' },
      { name: 'Docker Build', status: 'SUCCESS', duration: '28s' },
      { name: 'Push Image', status: 'SUCCESS', duration: '15s' },
      { name: 'Deploy', status: 'SUCCESS', duration: '9s' },
      { name: 'Health Check', status: 'FAILED', duration: '25s' }
    ]
  },
  {
    build_number: 41,
    branch: 'feat/ai-telemetry',
    commit: 'feat(ai): integrate Groq LLM root-cause analyzer',
    status: 'SUCCESS',
    timestamp: '2026-10-30 16:40:00',
    duration: '1m 45s',
    author: 'AI Platform Lead',
    stages: [
      { name: 'Source Code', status: 'SUCCESS', duration: '3s' },
      { name: 'Build', status: 'SUCCESS', duration: '19s' },
      { name: 'Test', status: 'SUCCESS', duration: '28s' },
      { name: 'Docker Build', status: 'SUCCESS', duration: '26s' },
      { name: 'Push Image', status: 'SUCCESS', duration: '14s' },
      { name: 'Deploy', status: 'SUCCESS', duration: '11s' },
      { name: 'Health Check', status: 'SUCCESS', duration: '4s' }
    ]
  }
];


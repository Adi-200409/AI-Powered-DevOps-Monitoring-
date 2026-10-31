import { useState, useEffect, useCallback, useRef } from 'react';
import {
  initialMockSystemStatus,
  initialMockMetrics,
  initialMockIncidents,
  initialMockLogs,
  initialMockDeployments
} from '../utils/mockData';

const API_BASE = import.meta.env?.VITE_API_URL || '';

export function useDevOpsData() {
  const [systemStatus, setSystemStatus] = useState(initialMockSystemStatus);
  const [metrics, setMetrics] = useState(initialMockMetrics);
  const [logs, setLogs] = useState({ lines: initialMockLogs, count: initialMockLogs.length });
  const [incidents, setIncidents] = useState(initialMockIncidents);
  const [deployments, setDeployments] = useState(initialMockDeployments);
  const [selectedIncidentId, setSelectedIncidentId] = useState(initialMockIncidents[0]?.id || null);

  const [backendConnected, setBackendConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [pollInterval, setPollInterval] = useState(5000); // ms, 0 = paused

  // Telemetry trend arrays (last 20 data points)
  const [cpuHistory, setCpuHistory] = useState([
    18, 22, 25, 20, 24, 29, 32, 28, 25, 26, 30, 35, 29, 31, 28, 26, 27, 29, 28, 28.4
  ]);
  const [memoryHistory, setMemoryHistory] = useState([
    42, 43, 43, 44, 44, 45, 45, 46, 46, 46, 47, 46, 46, 45, 46, 46, 47, 46, 46.2, 46.2
  ]);

  const pollIntervalRef = useRef(pollInterval);
  pollIntervalRef.current = pollInterval;

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    let apiSuccess = false;

    try {
      // 1. System Health
      const sRes = await fetch(`${API_BASE}/api/system-status`, { signal: AbortSignal.timeout(3000) });
      if (sRes.ok) {
        const data = await sRes.json();
        setSystemStatus(data);
        apiSuccess = true;
      }
    } catch {
      // Keep previous or fallback
    }

    try {
      // 2. Metrics
      const mRes = await fetch(`${API_BASE}/api/metrics`, { signal: AbortSignal.timeout(3000) });
      if (mRes.ok) {
        const data = await mRes.json();
        setMetrics(data);
        apiSuccess = true;

        if (data.cpu?.percent !== undefined) {
          setCpuHistory((prev) => [...prev.slice(1), data.cpu.percent]);
        }
        if (data.memory?.percent !== undefined) {
          setMemoryHistory((prev) => [...prev.slice(1), data.memory.percent]);
        }
      } else {
        // Subtle simulated oscillation when offline
        const jitter = (Math.random() - 0.48) * 3;
        setCpuHistory((prev) => {
          const last = prev[prev.length - 1];
          const next = Math.max(5, Math.min(95, parseFloat((last + jitter).toFixed(1))));
          return [...prev.slice(1), next];
        });
      }
    } catch {
      // Subtle oscillation
      const jitter = (Math.random() - 0.48) * 3;
      setCpuHistory((prev) => {
        const last = prev[prev.length - 1];
        const next = Math.max(5, Math.min(95, parseFloat((last + jitter).toFixed(1))));
        return [...prev.slice(1), next];
      });
    }

    try {
      // 3. Application Logs
      const lRes = await fetch(`${API_BASE}/api/logs?max_lines=150`, { signal: AbortSignal.timeout(3000) });
      if (lRes.ok) {
        const data = await lRes.json();
        if (data.lines && data.lines.length > 0) {
          setLogs(data);
          apiSuccess = true;
        }
      }
    } catch {}

    try {
      // 4. Incidents & AI Triage
      const iRes = await fetch(`${API_BASE}/api/incidents`, { signal: AbortSignal.timeout(3000) });
      if (iRes.ok) {
        const data = await iRes.json();
        if (data.incidents && data.incidents.length > 0) {
          setIncidents(data.incidents);
          setSelectedIncidentId((current) => current || data.incidents[0]?.id);
          apiSuccess = true;
        }
      }
    } catch {}

    try {
      // 5. Jenkins Deployments
      const dRes = await fetch(`${API_BASE}/api/deployments`, { signal: AbortSignal.timeout(3000) });
      if (dRes.ok) {
        const data = await dRes.json();
        if (data.deployments) {
          setDeployments(data.deployments);
          apiSuccess = true;
        }
      }
    } catch {}

    setBackendConnected(apiSuccess);
    setLastUpdated(new Date());
    setTimeout(() => setIsRefreshing(false), 300);
  }, []);

  useEffect(() => {
    fetchData();
    if (pollInterval > 0) {
      const timer = setInterval(() => {
        fetchData();
      }, pollInterval);
      return () => clearInterval(timer);
    }
  }, [fetchData, pollInterval]);

  // Selected incident object
  const activeIncident = incidents.find((i) => i.id === selectedIncidentId) || incidents[0] || null;

  // Simulation handler for demonstration
  const triggerSimulation = async (type = 'db_error') => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    let simulatedIncident = null;

    if (type === 'db_error') {
      simulatedIncident = {
        id: `inc-${Date.now()}`,
        timestamp,
        level: 'CRITICAL',
        container: 'user-service',
        error_message: 'ConnectionError: PostgreSQL pool connection refused on 5432 - Max client connections reached (100/100)',
        code_context: {
          potential_code_location: 'application/database.py:32 in get_db_connection',
          sanitized_trace: 'Traceback (most recent call last):\n  File "application/database.py", line 32, in get_db_connection\n    conn = psycopg2.pool.SimpleConnectionPool(...)\nConnectionError: connection pool exhausted',
          code_snippet: '30  def get_db_connection():\n31      try:\n32  >>>>    return connection_pool.getconn()\n33      except Exception as exc:\n34          logger.error("Connection pool exhausted: %s", exc)',
          secrets_masked: true
        },
        ai_diagnosis: {
          detected_error: 'PostgreSQL Pool Connection Exhaustion (100/100)',
          probable_root_cause: 'Database connection leaks from unclosed cursors in shopping cart endpoint /api/items under concurrent requests.',
          suggested_solution: '1. Wrap DB calls in "with connection_pool.getconn() as conn:" context manager to guarantee connection return.\n2. Increase max_connections in postgresql.conf from 100 to 250.',
          ai_recommendation: 'Enable PgBouncer connection pooler in docker-compose.yml to multiplex idle application connections.'
        },
        slack_delivered: true
      };
    } else if (type === 'crash') {
      simulatedIncident = {
        id: `inc-${Date.now()}`,
        timestamp,
        level: 'CRITICAL',
        container: 'user-service',
        error_message: 'RuntimeError: Fatal out-of-memory in transaction calculation pipeline',
        code_context: {
          potential_code_location: 'application/app.py:85 in process_transaction',
          sanitized_trace: 'RuntimeError: Memory buffer exceeded\n  File "application/app.py", line 85',
          code_snippet: '83  def process_transaction(items):\n84      # Infinite generator buffer accumulation\n85  >>>>buffer = [item for item in stream_all_records()]\n86      return calculate_summary(buffer)',
          secrets_masked: true
        },
        ai_diagnosis: {
          detected_error: 'Process Out-Of-Memory (OOM) / Buffer Overflow',
          probable_root_cause: 'stream_all_records() collects unchunked rows directly into RAM without batching.',
          suggested_solution: 'Batch record processing in chunks of 500 records using itertools.islice() or a streaming generator.',
          ai_recommendation: 'Configure Docker memory limit to 512MB and attach cgroup alerts in Prometheus.'
        },
        slack_delivered: true
      };
    }

    if (simulatedIncident) {
      setIncidents((prev) => [simulatedIncident, ...prev.slice(0, 49)]);
      setSelectedIncidentId(simulatedIncident.id);
      setLogs((prev) => ({
        ...prev,
        lines: [
          `${timestamp} [CRITICAL] [monitoring] SIMULATED ALERT: ${simulatedIncident.error_message}`,
          `${timestamp} [INFO] [monitoring] Groq Llama 3.3 Root Cause Analysis completed in 380ms`,
          `${timestamp} [INFO] [monitoring] Dispatched notification to Slack (#devops-alerts)`,
          ...prev.lines
        ],
        count: prev.count + 3
      }));
    }

    // Also attempt to notify actual backend if running
    try {
      if (type === 'db_error') {
        await fetch(`http://localhost:5000/api/simulate-db-error`, { method: 'POST' });
      } else {
        await fetch(`http://localhost:5000/api/simulate-crash`, { method: 'POST' });
      }
    } catch {}
  };

  return {
    systemStatus,
    metrics,
    logs,
    incidents,
    deployments,
    selectedIncidentId,
    setSelectedIncidentId,
    activeIncident,
    backendConnected,
    isRefreshing,
    lastUpdated,
    pollInterval,
    setPollInterval,
    cpuHistory,
    memoryHistory,
    fetchData,
    triggerSimulation
  };
}


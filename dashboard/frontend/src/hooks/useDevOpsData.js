import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = import.meta.env?.VITE_API_URL || '';

async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = typeof body.detail === 'string' ? `: ${body.detail}` : '';
    } catch {
      detail = '';
    }
    throw new Error(`Request failed (${response.status}) for ${path}${detail}`);
  }
  return response.json();
}

export function useDevOpsData() {
  const [systemStatus, setSystemStatus] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [logs, setLogs] = useState({ lines: [], count: 0, source: 'all' });
  const [incidents, setIncidents] = useState([]);
  const [errorIntelligence, setErrorIntelligence] = useState({
    patterns: [],
    correlations: [],
    anomalies: [],
    summary: {},
    remediation: { enabled: false, approval_required: true, available_runbooks: [] }
  });
  const [deployments, setDeployments] = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);

  const [backendConnected, setBackendConnected] = useState(false);
  const [endpointStatus, setEndpointStatus] = useState({
    systemStatus: false,
    metrics: false,
    metricsHistory: false,
    logs: false,
    incidents: false,
    errorIntelligence: false,
    deployments: false
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [pollInterval, setPollInterval] = useState(5000); // ms, 0 = paused

  const [cpuHistory, setCpuHistory] = useState([]);
  const [memoryHistory, setMemoryHistory] = useState([]);
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [metricsHistoryError, setMetricsHistoryError] = useState(null);
  const refreshInFlight = useRef(false);
  const selectedLogSource = useRef('all');

  const fetchData = useCallback(async (source) => {
    if (source) selectedLogSource.current = source;
    const requestedSource = selectedLogSource.current;
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setIsRefreshing(true);
    try {
      const results = await Promise.allSettled([
        fetchJson('/api/system-status'),
        fetchJson('/api/metrics'),
        fetchJson(`/api/logs?max_lines=150&source=${encodeURIComponent(requestedSource)}`),
        fetchJson('/api/incidents'),
        fetchJson('/api/deployments'),
        fetchJson('/api/error-intelligence')
      ]);
      const nextEndpointStatus = {
        systemStatus: results[0].status === 'fulfilled',
        metrics: results[1].status === 'fulfilled',
        logs: results[2].status === 'fulfilled',
        incidents: results[3].status === 'fulfilled',
        deployments: results[4].status === 'fulfilled',
        errorIntelligence: results[5].status === 'fulfilled'
      };

      if (nextEndpointStatus.systemStatus) setSystemStatus(results[0].value);
      if (nextEndpointStatus.metrics) {
        const data = results[1].value;
        setMetrics(data);
        if (data.cpu?.percent !== undefined) {
          setCpuHistory((prev) => [...prev.slice(1), data.cpu.percent]);
        }
        if (data.memory?.percent !== undefined) {
          setMemoryHistory((prev) => [...prev.slice(1), data.memory.percent]);
        }
      }
      if (nextEndpointStatus.logs) {
        const data = results[2].value;
        const lines = Array.isArray(data.lines) ? data.lines : [];
        setLogs((current) => ({
          lines,
          count: data.count ?? lines.length,
          source: data.source ?? requestedSource,
          containerName: data.container_name,
          summary: data.summary,
          sourceErrors: data.source_errors || {},
          streamStatus: current.source === requestedSource ? current.streamStatus : 'connecting'
        }));
      } else {
        const error = results[2].reason;
        setLogs((current) => ({
          ...current,
          source: requestedSource,
          sourceErrors: {
            ...current.sourceErrors,
            [requestedSource]: error instanceof Error ? error.message : 'Log request failed'
          },
          streamStatus: 'connecting'
        }));
      }
      if (nextEndpointStatus.incidents) {
        const data = results[3].value;
        const nextIncidents = Array.isArray(data.incidents) ? data.incidents : [];
        setIncidents(nextIncidents);
        setSelectedIncidentId((current) =>
          nextIncidents.some((incident) => incident.id === current)
            ? current
            : nextIncidents[0]?.id || null
        );
      }
      if (nextEndpointStatus.deployments) {
        const data = results[4].value;
        setDeployments(Array.isArray(data.deployments) ? data.deployments : []);
      }
      if (nextEndpointStatus.errorIntelligence) {
        setErrorIntelligence(results[5].value);
      }

      let historyAvailable = false;
      if (nextEndpointStatus.metrics) {
        try {
          const history = await fetchJson('/api/metrics/history?limit=10080&window_seconds=604800');
          if (!Array.isArray(history.samples)) {
            throw new Error('Metrics history response did not contain a samples array');
          }
          setMetricsHistory(history.samples);
          setMetricsHistoryError(null);
          historyAvailable = true;
        } catch (error) {
          setMetricsHistoryError(error instanceof Error ? error.message : 'Metrics history request failed');
        }
      } else {
        setMetricsHistoryError('Metrics are unavailable; history has not been refreshed.');
      }

      nextEndpointStatus.metricsHistory = historyAvailable;
      setEndpointStatus(nextEndpointStatus);
      setBackendConnected(Object.values(nextEndpointStatus).some(Boolean));
      setLastUpdated(new Date());
    } finally {
      refreshInFlight.current = false;
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const source = logs.source || 'all';
    const streamUrl = `${API_BASE}/api/logs/stream?source=${encodeURIComponent(source)}`;
    const eventSource = new EventSource(streamUrl);

    eventSource.onopen = () => {
      setLogs((current) => ({ ...current, streamStatus: 'live' }));
    };
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.error) {
          setLogs((current) => ({
            ...current,
            sourceErrors: { ...current.sourceErrors, [payload.source]: payload.error }
          }));
          return;
        }
        if (typeof payload.line !== 'string') return;

        const line = source === 'all' ? `[${payload.source}] ${payload.line}` : payload.line;
        setLogs((current) => {
          const nextLines = [...(current.lines || []), line].slice(-500);
          return {
            ...current,
            lines: nextLines,
            count: nextLines.length,
            sourceErrors: { ...current.sourceErrors, [payload.source]: undefined }
          };
        });
      } catch {
        setLogs((current) => ({ ...current, streamStatus: 'error' }));
      }
    };
    eventSource.onerror = () => {
      setLogs((current) => ({
        ...current,
        streamStatus: eventSource.readyState === EventSource.CLOSED ? 'offline' : 'reconnecting'
      }));
    };

    return () => eventSource.close();
  }, [logs.source]);

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

  // Simulation trigger: dispatches error to backend for monitoring pipeline to detect
  const triggerSimulation = async (type = 'db_error') => {
    const errorType = type === 'crash' ? 'crash' : 'db';
    try {
      await fetchJson(`/api/simulate-error?error_type=${encodeURIComponent(errorType)}`);
    } catch {
      try {
        const directUrl = errorType === 'crash'
          ? 'http://localhost:5000/api/simulate-crash'
          : 'http://localhost:5000/api/simulate-db-error';
        await fetch(directUrl, { method: 'POST' });
      } catch (err) {
        console.error('Failed to trigger simulation:', err);
      }
    }
    // Refresh to fetch real incident created by the monitoring orchestrator
    setTimeout(() => {
      fetchData();
    }, 1200);
  };

  const remediateIncident = useCallback(async (incidentId, runbook) => {
    const response = await fetch(`${API_BASE}/api/incidents/${encodeURIComponent(incidentId)}/remediate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runbook, approved: true })
    });
    if (!response.ok) {
      let detail = `Remediation request failed (${response.status})`;
      try {
        const body = await response.json();
        if (typeof body.detail === 'string') detail = body.detail;
      } catch {
        // Keep the HTTP status as the explicit failure when no response body is available.
      }
      throw new Error(detail);
    }
    const result = await response.json();
    await fetchData();
    return result;
  }, [fetchData]);

  return {
    systemStatus,
    metrics,
    metricsHistory,
    metricsHistoryError,
    logs,
    incidents,
    errorIntelligence,
    deployments,
    selectedIncidentId,
    setSelectedIncidentId,
    activeIncident,
    backendConnected,
    endpointStatus,
    isRefreshing,
    lastUpdated,
    pollInterval,
    setPollInterval,
    cpuHistory,
    memoryHistory,
    fetchData,
    remediateIncident,
    triggerSimulation
  };
}

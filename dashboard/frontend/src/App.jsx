import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env?.VITE_API_URL || '';

export default function App() {
  const [systemStatus, setSystemStatus] = useState({ status: 'CHECKING', service: 'FastAPI Service' });
  const [metrics, setMetrics] = useState({
    cpu: { percent: 0, cores: 0 },
    memory: { percent: 0, used_gb: 0, total_gb: 0, available_gb: 0 },
    uptime: { formatted: '-' }
  });
  const [logs, setLogs] = useState({ lines: [], count: 0 });
  const [incidents, setIncidents] = useState([]);
  const [deployments, setDeployments] = useState([]);

  const fetchData = async () => {
    try {
      // 1. Health
      const sRes = await fetch(`${API_BASE}/api/system-status`);
      if (sRes.ok) setSystemStatus(await sRes.json());
    } catch (e) {
      setSystemStatus({ status: 'DOWN', service: 'FastAPI Service' });
    }

    try {
      // 2. Metrics
      const mRes = await fetch(`${API_BASE}/api/metrics`);
      if (mRes.ok) setMetrics(await mRes.json());
    } catch (e) {}

    try {
      // 3. Logs
      const lRes = await fetch(`${API_BASE}/api/logs`);
      if (lRes.ok) setLogs(await lRes.json());
    } catch (e) {}

    try {
      // 4. Incidents & AI Triage
      const iRes = await fetch(`${API_BASE}/api/incidents`);
      if (iRes.ok) {
        const data = await iRes.json();
        setIncidents(data.incidents || []);
      }
    } catch (e) {}

    try {
      // 5. Deployments
      const dRes = await fetch(`${API_BASE}/api/deployments`);
      if (dRes.ok) {
        const data = await dRes.json();
        setDeployments(data.deployments || []);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const latestIncident = incidents.length > 0 ? incidents[0] : null;

  return (
    <div>
      <header>
        <div className="brand-title">
          <h1>AI-Powered DevOps Monitoring Dashboard</h1>
          <span className="react-badge">React 18</span>
          <span className="tech-badge">FastAPI + PostgreSQL</span>
        </div>
        <div className="refresh-badge">
          <span className="pulse-dot"></span>
          <span>Live Polling Active (5s)</span>
        </div>
      </header>

      <main className="dashboard-grid">
        {/* Panel 1: System Overview */}
        <div className="panel col-4">
          <div className="panel-header">
            <span className="panel-title">1. System Overview</span>
            <span className={`status-pill ${systemStatus.status === 'UP' ? 'up' : 'down'}`}>
              {systemStatus.status === 'UP' ? 'HEALTHY' : 'DOWN'}
            </span>
          </div>
          <div>
            <div className="metric-value" style={{ color: systemStatus.status === 'UP' ? '#10b981' : '#ef4444' }}>
              {systemStatus.status === 'UP' ? 'ONLINE' : 'OFFLINE'}
            </div>
            <div className="metric-sub">{systemStatus.service}</div>
            <div className="metric-sub" style={{ marginTop: '0.5rem' }}>
              Uptime: <strong>{metrics.uptime?.formatted || '-'}</strong>
            </div>
          </div>
        </div>

        {/* Panel 2: CPU Monitoring */}
        <div className="panel col-4">
          <div className="panel-header">
            <span className="panel-title">2. CPU Monitoring</span>
            <span className="metric-sub">{metrics.cpu?.cores || 0} Cores</span>
          </div>
          <div>
            <div className="metric-value">{metrics.cpu?.percent || 0}%</div>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${metrics.cpu?.percent || 0}%` }}></div>
            </div>
            <div className="metric-sub">Host Server CPU Utilization</div>
          </div>
        </div>

        {/* Panel 3: Memory Monitoring */}
        <div className="panel col-4">
          <div className="panel-header">
            <span className="panel-title">3. Memory Monitoring</span>
            <span className="metric-sub">{metrics.memory?.used_gb || 0} GB used</span>
          </div>
          <div>
            <div className="metric-value">{metrics.memory?.percent || 0}%</div>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${metrics.memory?.percent || 0}%`, background: '#a855f7' }}></div>
            </div>
            <div className="metric-sub">
              Total: {metrics.memory?.total_gb || 0} GB | Free: {metrics.memory?.available_gb || 0} GB
            </div>
          </div>
        </div>

        {/* Panel 4: Application Log Records */}
        <div className="panel col-6">
          <div className="panel-header">
            <span className="panel-title">4. Application Log Records (application.log)</span>
            <span className="metric-sub">{logs.count || 0} lines</span>
          </div>
          <div className="terminal-window">
            {logs.lines && logs.lines.length > 0 ? logs.lines.map((l, i) => (
              <div key={i} style={{
                color: l.includes('CRITICAL') ? '#fb7185' : l.includes('ERROR') ? '#f87171' : l.includes('INFO') ? '#60a5fa' : '#94a3b8'
              }}>
                {l}
              </div>
            )) : 'Waiting for log entries...'}
          </div>
        </div>

        {/* Panel 5: Error Detection */}
        <div className="panel col-6">
          <div className="panel-header">
            <span className="panel-title">5. Error Detection (ERROR & CRITICAL)</span>
            <span className="tech-badge">{incidents.length} Alerts</span>
          </div>
          <div className="terminal-window">
            {incidents.length > 0 ? incidents.map((inc, i) => (
              <div key={i} style={{ marginBottom: '0.6rem', paddingBottom: '0.6rem', borderBottom: '1px solid #1f2937' }}>
                <span style={{ color: '#f87171', fontWeight: 600 }}>[{inc.level}]</span>{' '}
                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{inc.timestamp}</span>
                <div style={{ color: '#e2e8f0', marginTop: '0.2rem' }}>{inc.error_message}</div>
              </div>
            )) : 'No critical anomalies detected in active monitoring cycle.'}
          </div>
        </div>

        {/* Panel 6: AI Root Cause Analysis (Groq LLM) - HIGHLIGHTED */}
        <div className="panel col-6 panel-ai-highlight">
          <div className="panel-header">
            <span className="panel-title">6. AI Root Cause Analysis (Groq LLM)</span>
            <span className="ai-badge">AI INSIGHT</span>
          </div>
          <div style={{ fontSize: '0.85rem' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Detected Error:</span>{' '}
              <strong style={{ color: '#f87171' }}>
                {latestIncident?.ai_diagnosis?.detected_error || latestIncident?.error_message || 'None detected'}
              </strong>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Probable Root Cause:</span>
              <p style={{ color: '#e2e8f0', marginTop: '0.2rem' }}>
                {latestIncident?.ai_diagnosis?.probable_root_cause || 'FastAPI service operating within expected parameters.'}
              </p>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Suggested Solution:</span>
              <p style={{ color: '#38bdf8', marginTop: '0.2rem' }}>
                {latestIncident?.ai_diagnosis?.suggested_solution || 'No manual remediation required.'}
              </p>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Operational Recommendation:</span>
              <p style={{ color: '#34d399', marginTop: '0.2rem' }}>
                {latestIncident?.ai_diagnosis?.ai_recommendation || 'Continuous telemetry active.'}
              </p>
            </div>
          </div>
        </div>

        {/* Panel 7: Code Path */}
        <div className="panel col-6">
          <div className="panel-header">
            <span className="panel-title">7. Code Context & Location</span>
            <span className="tech-badge">
              {latestIncident?.code_context?.potential_code_location || 'Repository Context'}
            </span>
          </div>
          <div className="code-box">
            {latestIncident?.code_context?.code_snippet || '# Code snippet around identified stack trace will display here...'}
          </div>
        </div>

        {/* Panel 8: Slack Notifications */}
        <div className="panel col-6">
          <div className="panel-header">
            <span className="panel-title">8. Slack Notifications (#devops-alerts)</span>
            <span className={`status-pill ${latestIncident?.slack_delivered ? 'up' : 'down'}`}>
              {latestIncident?.slack_delivered ? 'SENT TO SLACK' : 'PENDING / MOCKED'}
            </span>
          </div>
          <div className="terminal-window" style={{ height: '140px' }}>
            {latestIncident ? (
              `[Delivered to #devops-alerts]\nApplication: ${latestIncident.container || 'user-service'}\nError: ${latestIncident.error_message}\nAI Root Cause: ${latestIncident.ai_diagnosis?.probable_root_cause || 'N/A'}`
            ) : 'Waiting for actionable alert trigger...'}
          </div>
        </div>

        {/* Panel 9: Deployment History (Jenkins 7-Stage Pipeline) */}
        <div className="panel col-6">
          <div className="panel-header">
            <span className="panel-title">9. Deployment History (Jenkins CI/CD)</span>
            <span className="tech-badge">7-Stage Pipeline</span>
          </div>
          <div>
            {deployments.map((dep, idx) => (
              <div key={idx} style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '0.4rem', padding: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                  <strong>Build #{dep.build_number} ({dep.commit})</strong>
                  <span className={`status-pill ${dep.status === 'SUCCESS' ? 'up' : 'down'}`} style={{ fontSize: '0.7rem' }}>
                    {dep.status}
                  </span>
                </div>
                <div className="pipeline-stages">
                  {dep.stages.map((stage, sIdx) => (
                    <div key={sIdx} className={`pipeline-stage ${stage.status === 'SUCCESS' ? 'stage-success' : 'stage-failed'}`}>
                      <span>{stage.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}

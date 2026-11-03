import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleHelp,
  Cpu,
  Database,
  FileText,
  HardDrive,
  Server,
  Workflow
} from 'lucide-react';

function formatValue(value, unit = '') {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}${unit}` : '—';
}

function StatusBadge({ healthy, children }) {
  return (
    <span className={`ops-status-badge ${healthy ? 'is-healthy' : 'is-critical'}`}>
      <span className="ops-status-dot" />
      {children}
    </span>
  );
}

function ResourceChart({ title, current, history, color, unit = '%' }) {
  const safeHistory = history?.length ? history : [];
  const points = safeHistory.map((value, index) => {
    const x = safeHistory.length < 2 ? 0 : (index / (safeHistory.length - 1)) * 1000;
    const y = 176 - (Math.max(0, Math.min(100, Number(value) || 0)) / 100) * 156;
    return `${x},${y}`;
  });
  const line = points.length > 1 ? `M ${points.join(' L ')}` : '';
  const area = line ? `${line} L 1000,190 L 0,190 Z` : '';

  return (
    <div className="ops-resource">
      <div className="ops-resource-heading">
        <span className="ops-resource-name">{title}</span>
        <strong>{formatValue(current, unit)}</strong>
      </div>
      <svg className="ops-resource-chart" viewBox="0 0 1000 200" preserveAspectRatio="none" role="img" aria-label={`${title} recent samples`}>
        <defs>
          <linearGradient id={`fill-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 70, 120, 170].map((y) => <line key={y} x1="0" y1={y} x2="1000" y2={y} className="ops-chart-gridline" />)}
        {area && <path d={area} fill={`url(#fill-${title.replace(/\s+/g, '-')})`} />}
        {line && <path d={line} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" />}
      </svg>
      {safeHistory.length > 1
        ? <div className="ops-chart-axis"><span>Oldest sample</span><span>Latest sample</span></div>
        : <div className="ops-chart-empty">A second live sample is needed to show a trend.</div>}
    </div>
  );
}

function severityClass(level = '') {
  return String(level).toLowerCase() === 'critical' ? 'severity-critical' : 'severity-warning';
}

function logLevel(line = '') {
  const match = line.match(/(?:\[|\s)(INFO|WARNING|WARN|ERROR|CRITICAL)(?:\]|\s)/i);
  return match?.[1]?.toUpperCase() || 'LOG';
}

export default function OverviewPage({
  systemStatus,
  metrics,
  backendConnected,
  endpointStatus,
  hasMetricHistory,
  logs,
  incidents,
  deployments,
  selectedIncidentId,
  onSelectIncident,
  onNavigate,
  cpuHistory,
  memoryHistory
}) {
  const serviceHealthy = systemStatus?.status === 'UP' || systemStatus?.status === 'healthy';
  const cpu = metrics?.cpu?.percent;
  const memory = metrics?.memory?.percent;
  const disk = metrics?.disk?.percent;
  const recentIncidents = incidents.slice(0, 5);
  const recentLogs = (logs?.lines || []).slice(-6).reverse();
  const latestDeployment = deployments[0];
  const sourceLabel = endpointStatus?.metrics
    ? 'Live host metrics'
    : hasMetricHistory
      ? 'Last known metrics'
      : backendConnected
      ? 'Partial API data'
      : 'Sample snapshot';

  return (
    <div className="ops-page ops-overview">
      <div className="ops-page-heading">
        <div>
          <p className="ops-eyebrow">PRODUCTION / CLUSTER OVERVIEW</p>
          <h1>System overview</h1>
          <p className="ops-page-description">Current service health, host resources, and operational signals.</p>
        </div>
        <span className={`ops-source-tag ${endpointStatus?.metrics ? 'source-live' : hasMetricHistory ? 'source-stale' : 'source-sample'}`}>
          <span className="ops-status-dot" />{sourceLabel}
        </span>
      </div>

      <section className="ops-kpi-grid" aria-label="Current telemetry">
        <article className="ops-kpi-card">
          <div className="ops-kpi-label"><Cpu size={15} /> Host CPU</div>
          <div className="ops-kpi-value">{formatValue(cpu, '%')}</div>
          <div className="ops-kpi-note">{metrics?.cpu?.cores ?? '—'} logical cores · {endpointStatus?.metrics ? 'host measurement' : 'bundled sample'}</div>
        </article>
        <article className="ops-kpi-card">
          <div className="ops-kpi-label"><HardDrive size={15} /> Memory use</div>
          <div className="ops-kpi-value">{formatValue(memory, '%')}</div>
          <div className="ops-kpi-note">{metrics?.memory?.used_gb ?? '—'} / {metrics?.memory?.total_gb ?? '—'} GB used</div>
        </article>
        <article className="ops-kpi-card">
          <div className="ops-kpi-label"><AlertTriangle size={15} /> Recorded incidents</div>
          <div className="ops-kpi-value">{incidents.length}</div>
          <div className="ops-kpi-note">From the incident store · latest 50 retained</div>
        </article>
        <article className="ops-kpi-card">
          <div className="ops-kpi-label"><FileText size={15} /> Log records</div>
          <div className="ops-kpi-value">{logs?.count ?? logs?.lines?.length ?? 0}</div>
          <div className="ops-kpi-note">Current application log window</div>
        </article>
      </section>

      <div className="ops-overview-columns">
        <section className="ops-panel ops-resource-panel">
          <div className="ops-panel-header">
            <div>
              <h2>Host resource utilization</h2>
              <p>{endpointStatus?.metrics && hasMetricHistory ? 'Recent samples collected by the host metrics collector' : 'No live history is available; sample values are shown above'}</p>
            </div>
            <button className="ops-text-action" onClick={() => onNavigate('monitoring')}>
              Monitoring details <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="ops-resource-grid">
            <ResourceChart title="CPU" current={cpu} history={cpuHistory} color="#3182ce" />
            <ResourceChart title="Memory" current={memory} history={memoryHistory} color="#16877b" />
          </div>
          <div className="ops-resource-foot">
            <span>Disk {formatValue(disk, '%')}</span>
            <span>Monitoring process uptime {metrics?.uptime?.formatted || '—'}</span>
            <span>Samples shown: {Math.max(cpuHistory?.length || 0, memoryHistory?.length || 0)}</span>
          </div>
        </section>

        <section className="ops-panel">
          <div className="ops-panel-header">
            <div>
              <h2>Service health</h2>
              <p>Latest health probe results</p>
            </div>
            <button className="ops-icon-action" title="Open services" onClick={() => onNavigate('services')}>
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="ops-service-list">
            <div className="ops-service-row">
              <span className="ops-service-icon"><Server size={16} /></span>
              <div className="ops-service-main">
                <strong>{systemStatus?.service || 'User Management Service'}</strong>
                <span>HTTP health endpoint · {systemStatus?.http_code || 'No response'}</span>
              </div>
              <StatusBadge healthy={serviceHealthy}>{serviceHealthy ? 'Healthy' : 'Down'}</StatusBadge>
            </div>
            <div className="ops-service-row">
              <span className="ops-service-icon"><Activity size={16} /></span>
              <div className="ops-service-main">
                <strong>Monitoring API</strong>
                <span>Metrics, logs, incidents, and deployment endpoints</span>
              </div>
              <StatusBadge healthy={backendConnected}>{backendConnected ? 'Connected' : 'Offline'}</StatusBadge>
            </div>
            <div className="ops-service-row">
              <span className="ops-service-icon"><Database size={16} /></span>
              <div className="ops-service-main">
                <strong>Database dependency</strong>
                <span>Reported by application health response</span>
              </div>
              <span className="ops-service-detail">{systemStatus?.details?.database || 'Not reported'}</span>
            </div>
          </div>
        </section>
      </div>

      <div className="ops-overview-columns ops-lower-columns">
        <section className="ops-panel">
          <div className="ops-panel-header">
            <div>
              <h2>Recent incidents</h2>
              <p>Latest records from the monitoring pipeline</p>
            </div>
            <button className="ops-text-action" onClick={() => onNavigate('incidents')}>
              Incident queue <ArrowUpRight size={14} />
            </button>
          </div>
          {recentIncidents.length ? (
            <div className="ops-table-wrap">
              <table className="ops-table">
                <thead><tr><th>Severity</th><th>Incident</th><th>Service</th><th>Time</th><th>Notify</th></tr></thead>
                <tbody>
                  {recentIncidents.map((incident) => (
                    <tr
                      key={incident.id}
                      className={`ops-clickable-row ${selectedIncidentId === incident.id ? 'is-selected' : ''}`}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelectIncident(incident.id);
                          onNavigate('incidents');
                        }
                      }}
                      onClick={() => {
                        onSelectIncident(incident.id);
                        onNavigate('incidents');
                      }}
                    >
                      <td><span className={`ops-severity ${severityClass(incident.level)}`}>{incident.level || 'ERROR'}</span></td>
                      <td className="ops-incident-summary">{incident.error_message || 'Incident details unavailable'}</td>
                      <td className="ops-mono">{incident.container || '—'}</td>
                      <td className="ops-nowrap">{incident.timestamp || '—'}</td>
                      <td>{incident.slack_delivered ? <span className="ops-inline-state is-ok"><CheckCircle2 size={13} /> Sent</span> : <span className="ops-inline-state">Not sent</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="ops-empty-state"><CheckCircle2 size={19} /><span>No incidents are recorded in the current incident store.</span></div>
          )}
        </section>

        <section className="ops-panel ops-activity-panel">
          <div className="ops-panel-header">
            <div>
              <h2>Recent log activity</h2>
              <p>Tail of the application log</p>
            </div>
            <button className="ops-text-action" onClick={() => onNavigate('logs')}>
              Open explorer <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="ops-log-preview">
            {recentLogs.length ? recentLogs.map((line, index) => (
              <div className="ops-log-line" key={`${index}-${line}`}>
                <span className={`ops-log-level level-${logLevel(line).toLowerCase()}`}>{logLevel(line)}</span>
                <span>{line}</span>
              </div>
            )) : <div className="ops-empty-state"><CircleHelp size={18} /><span>No log records returned.</span></div>}
          </div>
        </section>
      </div>

      <section className="ops-panel ops-deploy-panel">
        <div className="ops-panel-header">
          <div>
            <h2>Deployment data</h2>
            <p>The current API endpoint returns built-in Jenkins example records, not a live CI integration.</p>
          </div>
          <button className="ops-text-action" onClick={() => onNavigate('cicd')}>
            Pipeline history <ArrowUpRight size={14} />
          </button>
        </div>
        {latestDeployment ? (
          <div className="ops-deployment-row">
            <span className={`ops-deploy-state ${String(latestDeployment.status).toLowerCase()}`}>
              <Workflow size={15} /> Build #{latestDeployment.build_number} · {latestDeployment.status}
            </span>
            <span className="ops-mono">{latestDeployment.branch || '—'}</span>
            <span className="ops-deploy-commit">{latestDeployment.commit || 'No commit message provided'}</span>
            <span>{latestDeployment.duration || '—'}</span>
          </div>
        ) : (
          <div className="ops-empty-state"><CircleHelp size={18} /><span>No deployment records returned.</span></div>
        )}
      </section>

      {!endpointStatus?.metrics && (
        <div className="ops-data-notice">
          <CircleHelp size={15} />
          <span>{hasMetricHistory ? 'Host metrics could not be refreshed; resource values are the last successful readings.' : backendConnected ? 'Host metrics are unavailable; resource values are from the bundled sample snapshot.' : 'Monitoring API is unavailable. The dashboard is showing its bundled sample snapshot; values above are not live.'}</span>
        </div>
      )}
    </div>
  );
}

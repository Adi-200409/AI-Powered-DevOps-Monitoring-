import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  HardDrive,
  Server,
  Settings2
} from 'lucide-react';
import AiTriagePanel from './AiTriagePanel';
import CodeContextPanel from './CodeContextPanel';
import ErrorIntelligencePanel from './ErrorIntelligencePanel';
import LiveMonitoringPanel from './LiveMonitoringPanel';
import LogTerminal from './LogTerminal';
import PipelineHistory from './PipelineHistory';
import SlackNotificationPanel from './SlackNotificationPanel';

const descriptions = {
  monitoring: 'Live host resource readings and sampling details from the monitoring service.',
  logs: 'Search, filter, inspect, and copy records returned by the application log collector.',
  errors: 'Correlate services, identify recurring failures, inspect measured anomaly signals, and dispatch approved runbooks.',
  incidents: 'Investigate recorded incidents, AI diagnosis, sanitized traces, and notification status.',
  rootcause: 'Compare the detected failure with the analyzer’s probable cause and remediation guidance.',
  ai: 'Review AI-assisted incident analysis. Validate recommendations before applying changes.',
  cicd: 'Inspect the API’s built-in Jenkins example records and individual pipeline stage results.',
  infrastructure: 'Current host capacity, disk allocation, and monitoring process uptime.',
  services: 'Health checks exposed by the application and monitoring API.',
  alerts: 'Review notification status and the latest incident alert payload.',
  reporting: 'A current snapshot of measured resources and records; no historical rollups are fabricated.',
  integrations: 'Inspect the incident notification integration payload and delivery status.',
  settings: 'Configure local polling behavior and check the monitoring connection.'
};

function isHealthy(status) {
  return status === 'UP' || status === 'healthy';
}

function value(value, suffix = '') {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}${suffix}` : '—';
}

function MetricTile({ label, reading, detail, Icon }) {
  return (
    <article className="ops-kpi-card ops-module-metric">
      <div className="ops-kpi-label"><Icon size={15} /> {label}</div>
      <div className="ops-kpi-value">{reading}</div>
      <div className="ops-kpi-note">{detail}</div>
    </article>
  );
}

function IncidentTable({ incidents, selectedId, onSelect }) {
  return incidents.length ? (
    <div className="ops-table-wrap">
      <table className="ops-table">
        <thead><tr><th>Severity</th><th>Incident</th><th>Service</th><th>Timestamp</th><th>Notification</th></tr></thead>
        <tbody>
          {incidents.map((incident) => (
            <tr
              key={incident.id}
              className={`ops-clickable-row ${selectedId === incident.id ? 'is-selected' : ''}`}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(incident.id);
                }
              }}
              onClick={() => onSelect(incident.id)}
            >
              <td><span className={`ops-severity ${String(incident.level).toLowerCase() === 'critical' ? 'severity-critical' : 'severity-warning'}`}>{incident.level || 'ERROR'}</span></td>
              <td className="ops-incident-summary">{incident.error_message || 'Incident details unavailable'}</td>
              <td className="ops-mono">{incident.container || '—'}</td>
              <td className="ops-nowrap">{incident.timestamp || '—'}</td>
              <td>{incident.slack_delivered ? <span className="ops-inline-state is-ok"><CheckCircle2 size={13} /> Delivered</span> : <span className="ops-inline-state">Not delivered</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="ops-empty-state"><CheckCircle2 size={19} /><span>No incident records are available.</span></div>
  );
}

function ServiceTable({ systemStatus, backendConnected }) {
  const database = systemStatus?.dependencies?.postgresql || { status: 'UNKNOWN' };
  const rows = [
    { name: systemStatus?.service || 'User Management Service', probe: 'Application /health', state: isHealthy(systemStatus?.status) ? 'UP' : 'DOWN', result: systemStatus?.http_code ? `HTTP ${systemStatus.http_code}${systemStatus.latency_ms != null ? ` · ${systemStatus.latency_ms} ms` : ''}` : 'No response' },
    { name: 'PostgreSQL dependency', probe: 'Direct SELECT 1 probe', state: database.status, result: database.status === 'UP' ? `Connected · ${database.latency_ms} ms` : database.reason || database.error_type || database.status },
    { name: 'Monitoring API', probe: 'Dashboard API endpoints', state: backendConnected ? 'UP' : 'DOWN', result: backendConnected ? 'Connected' : 'Unavailable' }
  ];

  return (
    <div className="ops-panel">
      <div className="ops-panel-header"><div><h2>Observed service checks</h2><p>Only endpoints actually queried by the dashboard are represented here.</p></div></div>
      <div className="ops-table-wrap">
        <table className="ops-table">
          <thead><tr><th>Service</th><th>Probe</th><th>Latest result</th><th>Status</th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td><td className="ops-mono">{row.probe}</td><td>{row.result}</td>
              <td><span className={`ops-status-badge ${row.state === 'UP' ? 'is-healthy' : row.state === 'UNKNOWN' ? 'is-unknown' : 'is-critical'}`}><span className="ops-status-dot" />{row.state === 'UP' ? 'Healthy' : row.state === 'UNKNOWN' ? 'Unknown' : 'Unavailable'}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="ops-dependency-note"><Database size={15} /><span>Database: {systemStatus?.details?.database || 'The application health response did not report a database dependency.'} · the current health endpoint reports configuration, not a direct database connectivity probe.</span></div>
    </div>
  );
}

function SettingsPanel({ backendConnected, pollInterval, setPollInterval }) {
  return (
    <div className="ops-panel ops-settings-panel">
      <div className="ops-panel-header"><div><h2>Dashboard polling</h2><p>Controls how often the browser requests current telemetry.</p></div><Settings2 size={18} /></div>
      <label className="ops-setting-row">
        <span><strong>Refresh interval</strong><small>Zero pauses automatic polling. Manual refresh remains available.</small></span>
        <select value={pollInterval} onChange={(event) => setPollInterval(Number(event.target.value))}>
          <option value={0}>Paused</option>
          <option value={5000}>5 seconds</option>
          <option value={15000}>15 seconds</option>
          <option value={60000}>60 seconds</option>
        </select>
      </label>
      <div className="ops-setting-connection">
        <span className={`ops-status-badge ${backendConnected ? 'is-healthy' : 'is-critical'}`}><span className="ops-status-dot" />{backendConnected ? 'Monitoring API connected' : 'Monitoring API unavailable'}</span>
        <span>API base URL is controlled by <code>VITE_API_URL</code>; otherwise the frontend uses its same-origin API.</span>
      </div>
    </div>
  );
}

export default function OperationsPage({
  activeTab,
  systemStatus,
  metrics,
  metricsHistory,
  metricsHistoryError,
  backendConnected,
  endpointStatus,
  hasMetricHistory,
  logs,
  incidents,
  errorIntelligence,
  deployments,
  selectedIncidentId,
  activeIncident,
  onSelectIncident,
  isRefreshing,
  onRefresh,
  remediateIncident,
  pollInterval,
  setPollInterval
}) {
  const titles = {
    monitoring: 'Live monitoring',
    logs: 'Log explorer',
    errors: 'Error intelligence',
    incidents: 'Incident management',
    rootcause: 'Root cause analysis',
    ai: 'AI troubleshooter',
    cicd: 'CI/CD pipelines',
    infrastructure: 'Infrastructure',
    services: 'Services & apps',
    alerts: 'Alerts & notifications',
    reporting: 'Reports & analytics',
    integrations: 'Integrations',
    settings: 'Settings'
  };
  const title = titles[activeTab] || 'Operations';
  const sourceKey = {
    monitoring: 'metrics',
    infrastructure: 'metrics',
    reporting: 'metrics',
    logs: 'logs',
    errors: 'errorIntelligence',
    incidents: 'incidents',
    rootcause: 'incidents',
    ai: 'incidents',
    cicd: 'deployments',
    services: 'systemStatus',
    alerts: 'incidents',
    integrations: 'incidents'
  }[activeTab];
  const pageSourceStatus = sourceKey ? endpointStatus?.[sourceKey] : false;
  const sourceLabel = activeTab === 'cicd'
    ? 'API examples'
    : pageSourceStatus
      ? 'API response'
      : hasMetricHistory && sourceKey === 'metrics'
        ? 'Last known metrics'
        : backendConnected
          ? 'Partial API data'
          : 'Sample snapshot';

  let content;
  if (activeTab === 'monitoring') {
    content = (
      <LiveMonitoringPanel
        systemStatus={systemStatus}
        metrics={metrics}
        history={metricsHistory}
        historyError={metricsHistoryError}
        endpointStatus={endpointStatus}
      />
    );
  } else if (activeTab === 'logs') {
    content = <div className="ops-legacy-content"><LogTerminal logs={logs} isRefreshing={isRefreshing} onRefresh={onRefresh} /></div>;
  } else if (activeTab === 'cicd') {
    content = (
      <>
        <div className="ops-data-notice"><AlertTriangle size={15} /><span>The current deployments endpoint contains static example builds. Connect a Jenkins integration before treating these records as production deployment history.</span></div>
        <div className="ops-legacy-content"><PipelineHistory deployments={deployments} /></div>
      </>
    );
  } else if (activeTab === 'errors') {
    content = (
      <>
        <section className="ops-panel">
          <div className="ops-panel-header"><div><h2>Incident records</h2><p>Select an incident to inspect recurrence and approve a runbook action.</p></div><span className="ops-record-count">{incidents.length} records</span></div>
          <IncidentTable incidents={incidents} selectedId={selectedIncidentId} onSelect={onSelectIncident} />
        </section>
        <ErrorIntelligencePanel
          intelligence={errorIntelligence}
          activeIncident={activeIncident}
          remediateIncident={remediateIncident}
        />
      </>
    );
  } else if (['incidents', 'rootcause', 'ai'].includes(activeTab)) {
    content = (
      <>
        <section className="ops-panel">
          <div className="ops-panel-header"><div><h2>Incident records</h2><p>Select a record to inspect its captured diagnosis and code context.</p></div><span className="ops-record-count">{incidents.length} records</span></div>
          <IncidentTable incidents={incidents} selectedId={selectedIncidentId} onSelect={onSelectIncident} />
        </section>
        <div className="ops-investigation-grid ops-legacy-content">
          <AiTriagePanel activeIncident={activeIncident} />
          <CodeContextPanel activeIncident={activeIncident} />
        </div>
      </>
    );
  } else if (activeTab === 'alerts' || activeTab === 'integrations') {
    content = incidents.length ? (
      <div className="ops-legacy-content"><SlackNotificationPanel activeIncident={activeIncident} /></div>
    ) : (
      <section className="ops-panel"><div className="ops-empty-state"><CheckCircle2 size={19} /><span>No incident notification payload is available until an incident is recorded.</span></div></section>
    );
  } else if (activeTab === 'services') {
    content = <ServiceTable systemStatus={systemStatus} backendConnected={backendConnected} />;
  } else if (activeTab === 'settings') {
    content = <SettingsPanel backendConnected={backendConnected} pollInterval={pollInterval} setPollInterval={setPollInterval} />;
  } else {
    content = (
      <>
        <section className="ops-kpi-grid">
          <MetricTile label="CPU utilization" reading={value(metrics?.cpu?.percent, '%')} detail={`${metrics?.cpu?.cores ?? '—'} logical cores`} Icon={Cpu} />
          <MetricTile label="Memory utilization" reading={value(metrics?.memory?.percent, '%')} detail={`${metrics?.memory?.used_gb ?? '—'} / ${metrics?.memory?.total_gb ?? '—'} GB used`} Icon={HardDrive} />
          <MetricTile label="Disk utilization" reading={value(metrics?.disk?.percent, '%')} detail={`${metrics?.disk?.used_gb ?? '—'} / ${metrics?.disk?.total_gb ?? '—'} GB used`} Icon={Server} />
          <MetricTile label="Monitoring process uptime" reading={metrics?.uptime?.formatted || '—'} detail="Since monitoring process started" Icon={Database} />
        </section>
        <section className="ops-panel ops-report-note">
          <div className="ops-panel-header"><div><h2>{activeTab === 'reporting' ? 'Current measured snapshot' : 'Resource telemetry'}</h2><p>{descriptions[activeTab]}</p></div></div>
          <p>Historical rollups and SLO calculations are not exposed by the current API. This view reports the readings currently returned by the metrics collector.</p>
          {!endpointStatus?.metrics && <div className="ops-data-notice"><AlertTriangle size={15} /><span>{hasMetricHistory ? 'The metrics endpoint is unavailable; displayed resource values are the last successful readings.' : backendConnected ? 'Host metrics are unavailable; displayed resource values are the bundled sample snapshot, not live readings.' : 'The monitoring API is offline; displayed values are the bundled sample snapshot, not live readings.'}</span></div>}
        </section>
      </>
    );
  }

  return (
    <div className="ops-page">
      <div className="ops-page-heading">
        <div>
          <p className="ops-eyebrow">OPERATIONS</p>
          <h1>{title}</h1>
          <p className="ops-page-description">{descriptions[activeTab] || 'Operational monitoring workspace.'}</p>
        </div>
        {activeTab !== 'settings' && <span className={`ops-source-tag ${pageSourceStatus ? 'source-live' : sourceLabel === 'Last known metrics' || sourceLabel === 'API examples' ? 'source-stale' : 'source-sample'}`}><span className="ops-status-dot" />{sourceLabel}</span>}
      </div>
      <div className="ops-module-content">{content}</div>
    </div>
  );
}

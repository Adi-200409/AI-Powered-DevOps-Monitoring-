import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  HardDrive,
  Network,
  Server,
  Workflow
} from 'lucide-react';

const RANGE_OPTIONS = [
  { label: '1 hour', seconds: 3600 },
  { label: '6 hours', seconds: 21600 },
  { label: '24 hours', seconds: 86400 },
  { label: '7 days', seconds: 604800 }
];

function formatNumber(number, suffix = '') {
  return number !== null && number !== undefined && Number.isFinite(Number(number))
    ? `${Number(number).toFixed(1)}${suffix}`
    : '—';
}

function formatBytesPerSecond(value) {
  if (!Number.isFinite(Number(value))) return '—';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let amount = Number(value);
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  return `${amount.toFixed(unitIndex ? 1 : 0)} ${units[unitIndex]}`;
}

function timeAgo(sampledAt, now) {
  if (!sampledAt) return 'No sample timestamp';
  const age = Math.max(0, Math.floor((now - new Date(sampledAt).getTime()) / 1000));
  if (!Number.isFinite(age)) return 'Invalid sample timestamp';
  if (age < 5) return 'Updated just now';
  if (age < 60) return `Updated ${age}s ago`;
  return `Updated ${Math.floor(age / 60)}m ago`;
}

function StateBadge({ state, children }) {
  const normalized = String(state || 'unknown').toLowerCase();
  const statusClass = normalized === 'up' || normalized === 'healthy'
    ? 'is-healthy'
    : normalized === 'warning' || normalized === 'degraded'
      ? 'is-warning'
      : normalized === 'critical' || normalized === 'down'
        ? 'is-critical'
        : 'is-unknown';
  return <span className={`ops-status-badge ${statusClass}`}><span className="ops-status-dot" />{children || normalized}</span>;
}

function ResourceHistoryChart({ title, field, history, threshold, color, rangeSeconds }) {
  const cutoff = Date.now() - rangeSeconds * 1000;
  const points = history.filter((sample) => {
    const time = new Date(sample.sampled_at).getTime();
    return Number.isFinite(time)
      && time >= cutoff
      && sample[field] !== null
      && sample[field] !== undefined
      && Number.isFinite(Number(sample[field]));
  });
  const chartPoints = points.map((sample, index) => {
    const x = points.length < 2 ? 0 : (index / (points.length - 1)) * 1000;
    const y = 176 - (Math.max(0, Math.min(100, Number(sample[field])) / 100) * 156);
    return { x, y, value: Number(sample[field]), sampledAt: sample.sampled_at };
  });
  const path = chartPoints.length > 1
    ? `M ${chartPoints.map((point) => `${point.x},${point.y}`).join(' L ')}`
    : '';
  const warningY = 176 - (threshold.warning / 100) * 156;
  const criticalY = 176 - (threshold.critical / 100) * 156;

  return (
    <article className="ops-history-card">
      <div className="ops-history-card-heading">
        <div><h3>{title}</h3><span>{points.length} stored samples</span></div>
        <div className="ops-history-legend"><span><i style={{ background: color }} />Utilization</span></div>
      </div>
      {points.length < 2 ? (
        <div className="ops-chart-empty-state">
          <Activity size={17} />
          <span>{points.length ? 'Waiting for another persisted sample.' : 'No samples in this time range.'}</span>
        </div>
      ) : (
        <svg className="ops-history-chart" viewBox="0 0 1000 200" preserveAspectRatio="none" role="img" aria-label={`${title} over selected time range`}>
          {[20, 70, 120, 170].map((y) => <line key={`grid-${y}`} x1="0" y1={y} x2="1000" y2={y} className="ops-chart-gridline" />)}
          <line x1="0" y1={warningY} x2="1000" y2={warningY} className="ops-threshold-line threshold-warning" />
          <line x1="0" y1={criticalY} x2="1000" y2={criticalY} className="ops-threshold-line threshold-critical" />
          <path d={path} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" />
          {chartPoints.map((point, index) => (
            <circle key={`${point.sampledAt}-${index}`} cx={point.x} cy={point.y} r="3" fill={color}>
              <title>{`${new Date(point.sampledAt).toLocaleString()}: ${point.value.toFixed(1)}%`}</title>
            </circle>
          ))}
        </svg>
      )}
      <div className="ops-history-card-foot">
        <span>Warn {threshold.warning}%</span><span>Critical {threshold.critical}%</span>
        <span>{points[0] ? new Date(points[0].sampled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
        <span>{points.at(-1) ? new Date(points.at(-1).sampled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
      </div>
    </article>
  );
}

function NetworkHistoryChart({ history, rangeSeconds }) {
  const cutoff = Date.now() - rangeSeconds * 1000;
  const points = history.filter((sample) => {
    const time = new Date(sample.sampled_at).getTime();
    return Number.isFinite(time)
      && time >= cutoff
      && ((sample.network_received_bytes_per_second !== null
        && sample.network_received_bytes_per_second !== undefined
        && Number.isFinite(Number(sample.network_received_bytes_per_second)))
        || (sample.network_sent_bytes_per_second !== null
          && sample.network_sent_bytes_per_second !== undefined
          && Number.isFinite(Number(sample.network_sent_bytes_per_second))));
  });
  const maxRate = Math.max(
    1,
    ...points.flatMap((sample) => [
      Number(sample.network_received_bytes_per_second) || 0,
      Number(sample.network_sent_bytes_per_second) || 0
    ])
  );
  const getPath = (field) => {
    const values = points.filter((sample) => (
      sample[field] !== null
      && sample[field] !== undefined
      && Number.isFinite(Number(sample[field]))
    ));
    if (values.length < 2) return '';
    return `M ${values.map((sample, index) => {
      const x = (index / (values.length - 1)) * 1000;
      const y = 176 - (Math.min(maxRate, Number(sample[field])) / maxRate) * 156;
      return `${x},${y}`;
    }).join(' L ')}`;
  };
  const receivePath = getPath('network_received_bytes_per_second');
  const sendPath = getPath('network_sent_bytes_per_second');

  return (
    <article className="ops-history-card">
      <div className="ops-history-card-heading">
        <div><h3>Network throughput</h3><span>{points.length} stored samples</span></div>
        <div className="ops-network-legend">
          <span><i className="received" />Received</span><span><i className="sent" />Sent</span>
        </div>
      </div>
      {points.length < 2 ? (
        <div className="ops-chart-empty-state"><Network size={17} /><span>Waiting for two network samples in this range.</span></div>
      ) : (
        <svg className="ops-history-chart" viewBox="0 0 1000 200" preserveAspectRatio="none" role="img" aria-label="Network throughput over selected time range">
          {[20, 70, 120, 170].map((y) => <line key={`network-grid-${y}`} x1="0" y1={y} x2="1000" y2={y} className="ops-chart-gridline" />)}
          {receivePath && <path d={receivePath} fill="none" stroke="#347fbe" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
          {sendPath && <path d={sendPath} fill="none" stroke="#198c7b" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
        </svg>
      )}
      <div className="ops-history-card-foot is-network-scale"><span>Scale maximum</span><span>{formatBytesPerSecond(maxRate)}</span><span>0 B/s</span></div>
    </article>
  );
}

function ResourceCard({ title, value, unit, metric, icon: Icon, metrics, thresholds, sampledAt, now }) {
  const alert = metrics?.alerts?.find((item) => item.metric === metric);
  const state = alert?.state || (value === null || value === undefined ? 'unknown' : 'healthy');
  const limit = thresholds?.[metric];
  return (
    <article className="ops-kpi-card ops-resource-kpi">
      <div className="ops-kpi-label"><Icon size={15} />{title}<StateBadge state={state}>{alert?.state || (state === 'healthy' ? 'Normal' : 'Unavailable')}</StateBadge></div>
      <div className="ops-kpi-value">{formatNumber(value, unit)}</div>
      <div className="ops-resource-kpi-footer">
        <span>Warning {limit?.warning ?? '—'}% · Critical {limit?.critical ?? '—'}%</span>
        <span>{timeAgo(sampledAt, now)}</span>
      </div>
    </article>
  );
}

function ServiceMetric({ label, value, detail, Icon, state }) {
  return (
    <div className="ops-service-metric">
      <span className="ops-service-icon"><Icon size={15} /></span>
      <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
      {state && <StateBadge state={state} />}
    </div>
  );
}

export default function LiveMonitoringPanel({
  systemStatus,
  metrics,
  history,
  historyError,
  endpointStatus
}) {
  const [rangeSeconds, setRangeSeconds] = useState(3600);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const historyInRange = useMemo(() => {
    const cutoff = now - rangeSeconds * 1000;
    return history.filter((sample) => new Date(sample.sampled_at).getTime() >= cutoff);
  }, [history, now, rangeSeconds]);
  const thresholds = metrics?.thresholds || {};
  const service = metrics?.service || {};
  const database = systemStatus?.dependencies?.postgresql || { status: 'UNKNOWN' };
  const containers = metrics?.containers || { status: 'UNAVAILABLE', items: [] };
  const processes = metrics?.top_processes || [];
  const metricFresh = endpointStatus?.metrics && metrics?.sampled_at
    && now - new Date(metrics.sampled_at).getTime() < 30_000;

  return (
    <div className="ops-live-monitor">
      <div className="ops-live-toolbar">
        <div className="ops-live-freshness">
          <span className={`ops-freshness-indicator ${metricFresh ? 'is-fresh' : 'is-stale'}`} />
          <span>{timeAgo(metrics?.sampled_at, now)}</span>
          <span className="ops-live-host">{metrics?.host?.name || 'Host not reported'} · {metrics?.host?.platform || 'Platform unavailable'}</span>
        </div>
        <label className="ops-range-selector">
          <Clock3 size={14} />
          <span>History</span>
          <select value={rangeSeconds} onChange={(event) => setRangeSeconds(Number(event.target.value))}>
            {RANGE_OPTIONS.map((option) => <option key={option.seconds} value={option.seconds}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <section className="ops-kpi-grid ops-live-resource-grid" aria-label="Host utilization and thresholds">
        <ResourceCard title="CPU utilization" value={metrics?.cpu?.percent} unit="%" metric="cpu" icon={Cpu} metrics={metrics} thresholds={thresholds} sampledAt={metrics?.sampled_at} now={now} />
        <ResourceCard title="Memory utilization" value={metrics?.memory?.percent} unit="%" metric="memory" icon={HardDrive} metrics={metrics} thresholds={thresholds} sampledAt={metrics?.sampled_at} now={now} />
        <ResourceCard title="Disk utilization" value={metrics?.disk?.percent} unit="%" metric="disk" icon={Server} metrics={metrics} thresholds={thresholds} sampledAt={metrics?.sampled_at} now={now} />
      </section>

      <section className="ops-panel">
        <div className="ops-panel-header">
          <div><h2>Persisted resource history</h2><p>{historyInRange.length} samples in the selected window · collected at one-minute intervals · retained for up to 7 days</p></div>
          <StateBadge state={endpointStatus?.metricsHistory ? 'healthy' : 'unknown'}>
            {endpointStatus?.metricsHistory ? 'History available' : 'History unavailable'}
          </StateBadge>
        </div>
        {historyError && <div className="ops-data-notice"><AlertTriangle size={15} /><span>History request failed: {historyError}</span></div>}
        <div className="ops-history-grid">
          <ResourceHistoryChart title="CPU" field="cpu_percent" history={history} threshold={thresholds.cpu || { warning: 70, critical: 90 }} color="#347fbe" rangeSeconds={rangeSeconds} />
          <ResourceHistoryChart title="Memory" field="memory_percent" history={history} threshold={thresholds.memory || { warning: 80, critical: 90 }} color="#198c7b" rangeSeconds={rangeSeconds} />
          <ResourceHistoryChart title="Disk" field="disk_percent" history={history} threshold={thresholds.disk || { warning: 80, critical: 90 }} color="#8b6db0" rangeSeconds={rangeSeconds} />
          <NetworkHistoryChart history={history} rangeSeconds={rangeSeconds} />
        </div>
      </section>

      <div className="ops-live-columns">
        <section className="ops-panel">
          <div className="ops-panel-header"><div><h2>Traffic and application health</h2><p>Host data {timeAgo(metrics?.sampled_at, now)} · application data {timeAgo(service.sampled_at, now)} · health probe {timeAgo(systemStatus?.sampled_at, now)}</p></div></div>
          <div className="ops-service-metrics">
            <ServiceMetric label="Network received" value={formatBytesPerSecond(metrics?.network?.bytes_received_per_second)} detail="Host-wide receive rate" Icon={Network} />
            <ServiceMetric label="Network sent" value={formatBytesPerSecond(metrics?.network?.bytes_sent_per_second)} detail="Host-wide transmit rate" Icon={Network} />
            <ServiceMetric label="Request rate" value={`${formatNumber(service.requests_per_second)} req/s`} detail={`${service.requests_total ?? '—'} requests since process start`} Icon={Activity} state={service.status === 'UNAVAILABLE' ? 'unknown' : 'healthy'} />
            <ServiceMetric label="5xx error rate" value={service.status === 'UNAVAILABLE' ? '—' : `${formatNumber(service.error_rate_percent)}%`} detail={`${service.errors_total ?? '—'} server errors since process start`} Icon={AlertTriangle} state={service.error_rate_percent > 0 ? 'warning' : service.status === 'UNAVAILABLE' ? 'unknown' : 'healthy'} />
            <ServiceMetric label="p95 latency" value={service.status === 'UNAVAILABLE' ? '—' : `${formatNumber(service.latency_ms_p95)} ms`} detail={`Average ${service.latency_ms_avg ?? '—'} ms · ${service.window_seconds ?? '—'}s window`} Icon={Clock3} state={service.status === 'UNAVAILABLE' ? 'unknown' : 'healthy'} />
            <ServiceMetric label="Database probe" value={database.status || 'UNKNOWN'} detail={database.latency_ms != null ? `${database.latency_ms} ms · SELECT 1` : database.reason || database.error_type || 'Direct connectivity status'} Icon={Database} state={database.status || 'unknown'} />
          </div>
        </section>

        <section className="ops-panel">
          <div className="ops-panel-header"><div><h2>Monitored process</h2><p>Dashboard collector process on this host</p></div></div>
          <div className="ops-process-summary">
            <span>PID <strong>{metrics?.host?.process_id ?? '—'}</strong></span>
            <span>CPU <strong>{formatNumber(metrics?.process?.cpu_percent, '%')}</strong></span>
            <span>RSS <strong>{formatNumber(metrics?.process?.memory_mb, ' MB')}</strong></span>
            <span>Uptime <strong>{metrics?.uptime?.formatted || '—'}</strong></span>
          </div>
          <div className="ops-panel-subheading"><Server size={14} />Top host processes by memory</div>
          {processes.length ? (
            <div className="ops-table-wrap">
              <table className="ops-table">
                <thead><tr><th>Process</th><th>PID</th><th>Memory</th></tr></thead>
                <tbody>{processes.map((process) => (
                  <tr key={`${process.pid}-${process.name}`}><td>{process.name}</td><td className="ops-mono">{process.pid}</td><td>{formatNumber(process.memory_mb, ' MB')}</td></tr>
                ))}</tbody>
              </table>
            </div>
          ) : <div className="ops-empty-state"><Server size={16} /><span>Process data is unavailable.</span></div>}
        </section>
      </div>

      <section className="ops-panel">
        <div className="ops-panel-header"><div><h2>Container telemetry</h2><p>Docker stats from the host Docker CLI; unavailable when the daemon or CLI cannot be reached.</p></div><StateBadge state={containers.status}>{containers.status}</StateBadge></div>
        {containers.reason && containers.status !== 'UP' && <div className="ops-data-notice"><Workflow size={15} /><span>{containers.reason}</span></div>}
        {containers.items?.length ? (
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead><tr><th>Container</th><th>CPU</th><th>Memory</th><th>Network I/O</th><th>Block I/O</th><th>Processes</th></tr></thead>
              <tbody>{containers.items.map((container) => (
                <tr key={container.id || container.name}>
                  <td>{container.name}</td><td>{container.cpu_percent || '—'}</td><td>{container.memory_usage || '—'} ({container.memory_percent || '—'})</td>
                  <td>{container.network_io || '—'}</td><td>{container.block_io || '—'}</td><td>{container.pids || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : containers.status === 'UP' ? (
          <div className="ops-empty-state"><CheckCircle2 size={17} /><span>No running Docker containers were returned.</span></div>
        ) : null}
      </section>

      <section className="ops-panel ops-live-alerts">
        <div className="ops-panel-header"><div><h2>Threshold events</h2><p>Current resource readings against configured thresholds</p></div></div>
        {metrics?.alerts?.length ? metrics.alerts.map((alert) => (
          <div className={`ops-threshold-alert ${alert.state}`} key={alert.metric}>
            <AlertTriangle size={15} /><strong>{alert.metric.toUpperCase()}</strong><span>{alert.message}</span>
            <StateBadge state={alert.state}>{alert.state}</StateBadge>
          </div>
        )) : (
          <div className="ops-empty-state"><CheckCircle2 size={17} /><span>No resource thresholds are currently breached.</span></div>
        )}
      </section>
    </div>
  );
}

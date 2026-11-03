import React, { useState } from 'react';
import { Activity, AlertTriangle, GitBranch, ShieldCheck, Wrench } from 'lucide-react';

function MetricSignal({ signal }) {
  return (
    <article className="ops-kpi-card intel-signal">
      <div className="ops-kpi-label"><Activity size={15} /> {signal.metric} utilization</div>
      <div className="ops-kpi-value">{signal.current}%</div>
      <div className="ops-kpi-note">
        Baseline {signal.baseline}% · {signal.trend_per_minute > 0 ? '+' : ''}{signal.trend_per_minute}% / min
        {signal.estimated_minutes_to_warning != null && ` · ~${signal.estimated_minutes_to_warning} min to warning`}
      </div>
    </article>
  );
}

export default function ErrorIntelligencePanel({
  intelligence,
  activeIncident,
  remediateIncident
}) {
  const [selectedRunbook, setSelectedRunbook] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const patterns = intelligence?.patterns || [];
  const correlations = intelligence?.correlations || [];
  const anomalies = intelligence?.anomalies || [];
  const remediation = intelligence?.remediation || {};
  const runbooks = remediation.available_runbooks || [];

  const requestRemediation = async () => {
    if (!activeIncident || !selectedRunbook || !remediation.enabled) return;
    const runbook = runbooks.find((item) => item.id === selectedRunbook);
    if (!runbook || !window.confirm(`Approve "${runbook.label}" for ${activeIncident.container || 'this service'}?`)) return;
    setSubmitting(true);
    setActionError('');
    setActionMessage('');
    try {
      const result = await remediateIncident(activeIncident.id, selectedRunbook);
      setActionMessage(`${result.remediation.label} was dispatched to the configured runbook runner.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Remediation dispatch failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="intel-stack">
      <section className="ops-kpi-grid" aria-label="Error intelligence summary">
        <article className="ops-kpi-card">
          <div className="ops-kpi-label"><AlertTriangle size={15} /> Analyzed incidents</div>
          <div className="ops-kpi-value">{intelligence?.summary?.incidents_analyzed ?? 0}</div>
          <div className="ops-kpi-note">Recorded in the last {intelligence?.history_window_days ?? 7} days</div>
        </article>
        <article className="ops-kpi-card">
          <div className="ops-kpi-label"><GitBranch size={15} /> Recurring patterns</div>
          <div className="ops-kpi-value">{intelligence?.summary?.recurring_patterns ?? 0}</div>
          <div className="ops-kpi-note">Stable fingerprints with repeat occurrences</div>
        </article>
        <article className="ops-kpi-card">
          <div className="ops-kpi-label"><GitBranch size={15} /> Cross-service correlations</div>
          <div className="ops-kpi-value">{intelligence?.summary?.correlated_service_events ?? 0}</div>
          <div className="ops-kpi-note">Shared dependency failures within 15 minutes</div>
        </article>
        <article className="ops-kpi-card">
          <div className="ops-kpi-label"><Activity size={15} /> Anomaly signals</div>
          <div className="ops-kpi-value">{intelligence?.summary?.anomaly_signals ?? 0}</div>
          <div className="ops-kpi-note">Based on measured resource history</div>
        </article>
      </section>

      <section className="ops-panel">
        <div className="ops-panel-header">
          <div><h2>Predictive resource signals</h2><p>Trend and baseline checks; estimates are indicative, not a forecast guarantee.</p></div>
        </div>
        {anomalies.length ? (
          <div className="intel-signal-grid">{anomalies.map((signal) => <MetricSignal key={signal.metric} signal={signal} />)}</div>
        ) : (
          <div className="ops-empty-state"><ShieldCheck size={19} /><span>No resource anomaly detected from available measured history.</span></div>
        )}
      </section>

      <section className="ops-panel">
        <div className="ops-panel-header">
          <div><h2>Recurring error patterns</h2><p>Matching errors are grouped by a normalized, stable fingerprint.</p></div>
        </div>
        {patterns.length ? (
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead><tr><th>Error pattern</th><th>Occurrences</th><th>Services</th><th>Last seen</th></tr></thead>
              <tbody>{patterns.map((pattern) => (
                <tr key={pattern.fingerprint}>
                  <td className="ops-incident-summary">{pattern.message}</td>
                  <td>{pattern.occurrences}</td>
                  <td>{pattern.services.join(', ')}</td>
                  <td className="ops-nowrap">{pattern.last_seen || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="ops-empty-state"><span>No historical error patterns are available yet.</span></div>}
      </section>

      <section className="ops-panel">
        <div className="ops-panel-header">
          <div><h2>Correlated service incidents</h2><p>Correlates errors that name the same dependency across services within 15 minutes.</p></div>
        </div>
        {correlations.length ? correlations.map((item, index) => (
          <div className="intel-correlation" key={`${item.dependency}-${item.window_start}-${index}`}>
            <strong>{item.dependency}</strong>
            <span>{item.occurrences} incidents · {item.services.join(', ')}</span>
            <small>{item.window_start}</small>
          </div>
        )) : <div className="ops-empty-state"><span>No cross-service dependency correlation found in retained incidents.</span></div>}
      </section>

      <section className="ops-panel">
        <div className="ops-panel-header">
          <div><h2>Approved remediation</h2><p>Dispatches only named runbooks to the configured external runner; approval is always required.</p></div>
          <Wrench size={17} />
        </div>
        <div className="intel-remediation">
          <label>
            <span>Selected incident: {activeIncident?.error_message || 'Select an incident above'}</span>
            <select
              value={selectedRunbook}
              onChange={(event) => setSelectedRunbook(event.target.value)}
              disabled={!remediation.enabled || !activeIncident || submitting}
            >
              <option value="">Choose an approved runbook</option>
              {runbooks.map((runbook) => <option key={runbook.id} value={runbook.id}>{runbook.label}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="ops-text-action intel-remediate-button"
            onClick={requestRemediation}
            disabled={!remediation.enabled || !activeIncident || !selectedRunbook || submitting}
          >
            {submitting ? 'Dispatching…' : 'Approve & dispatch'}
          </button>
        </div>
        {!remediation.enabled && <div className="ops-data-notice"><AlertTriangle size={15} /><span>{remediation.reason || 'Configure the remediation runner to enable approved actions.'}</span></div>}
        {activeIncident?.remediation_history?.length > 0 && (
          <div className="intel-history">
            <strong>Action history</strong>
            {activeIncident.remediation_history.map((item, index) => (
              <span key={`${item.requested_at}-${index}`}>{item.label} · {item.status} · {item.requested_at}</span>
            ))}
          </div>
        )}
        {actionMessage && <p className="intel-action-success">{actionMessage}</p>}
        {actionError && <p className="intel-action-error" role="alert">{actionError}</p>}
      </section>
    </div>
  );
}

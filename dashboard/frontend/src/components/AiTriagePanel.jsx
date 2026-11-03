import React, { useState } from 'react';
import { Sparkles, Copy, Check, Lightbulb, ShieldCheck, Terminal, AlertTriangle } from 'lucide-react';

export default function AiTriagePanel({ activeIncident }) {
  const [copyStatus, setCopyStatus] = useState('');

  const diagnosis = activeIncident?.ai_diagnosis || {};
  const detectedError = diagnosis.detected_error || activeIncident?.error_message;
  const solution = diagnosis.suggested_solution;
  const severity = diagnosis.severity || activeIncident?.level;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(solution);
      setCopyStatus('copied');
    } catch (error) {
      console.error('Unable to copy the suggested remediation.', error);
      setCopyStatus('error');
    }
    setTimeout(() => setCopyStatus(''), 2000);
  };

  return (
    <div className="card card-ai-glow ai-triage-card">
      <div className="ai-triage-header">
        <div className="ai-triage-heading">
          <span className="ai-triage-icon"><Sparkles size={18} /></span>
          <div>
            <h2 className="ai-triage-title">AI incident triage</h2>
            <p className="ai-triage-subtitle">A clear diagnosis and the next best actions</p>
          </div>
        </div>
        <span className="ai-triage-model"><span className="ai-status-dot"></span>AI-assisted</span>
      </div>

      {activeIncident ? (
        <div className="ai-triage-content">
          <div className="ai-incident-meta">
            <span className={`ai-severity-pill ${severity?.toLowerCase() || 'unknown'}`}>
              <AlertTriangle size={13} />
              {severity || 'Severity unknown'}
            </span>
            <span className="ai-incident-service">{activeIncident.container || 'Service unavailable'}</span>
            {activeIncident.timestamp && <time>{activeIncident.timestamp}</time>}
          </div>

          <section className="ai-insight-block ai-error-block">
            <div className="ai-insight-label">What happened</div>
            <p>{detectedError || 'No error details were captured for this incident.'}</p>
          </section>

          <section className="ai-insight-block ai-root-cause-block">
            <div className="ai-insight-label"><Lightbulb size={14} /> Probable root cause</div>
            <p>{diagnosis.probable_root_cause || 'Root cause analysis is not available for this incident yet.'}</p>
          </section>

          <section className="ai-insight-block ai-remediation-block">
            <div className="ai-insight-heading-row">
              <div className="ai-insight-label"><Terminal size={14} /> Suggested next steps</div>
              {solution && (
                <button className="btn-copy-small ai-copy-button" onClick={handleCopy} title="Copy suggested next steps">
                  {copyStatus === 'copied' ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Copy failed' : 'Copy steps'}</span>
                </button>
              )}
            </div>
            <p className="ai-remediation-text">
              {solution || 'No remediation steps were provided for this incident.'}
            </p>
          </section>

          <section className="ai-recommendation-block">
            <ShieldCheck size={17} />
            <div>
              <div className="ai-insight-label">Operational recommendation</div>
              <p>{diagnosis.ai_recommendation || 'Review the incident and validate the suggested actions before making changes.'}</p>
            </div>
          </section>
          <p className="ai-advisory-note">AI-generated guidance can be incomplete. Verify each action before applying it.</p>
        </div>
      ) : (
        <div className="ai-empty-state">
          <span className="ai-empty-icon"><Sparkles size={20} /></span>
          <h3>No incident to analyze</h3>
          <p>When monitoring detects an error, its likely cause and recommended next steps will appear here.</p>
        </div>
      )}
    </div>
  );
}

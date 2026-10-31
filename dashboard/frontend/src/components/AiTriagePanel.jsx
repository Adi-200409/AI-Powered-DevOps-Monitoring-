import React, { useState } from 'react';
import { Sparkles, Copy, Check, Lightbulb, ShieldCheck, Terminal } from 'lucide-react';

export default function AiTriagePanel({ activeIncident }) {
  const [copied, setCopied] = useState(false);

  const diagnosis = activeIncident?.ai_diagnosis || {};
  const solution = diagnosis.suggested_solution || 'No manual remediation required at this stage.';

  const handleCopy = () => {
    navigator.clipboard.writeText(solution);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card card-ai-glow">
      <div className="card-header">
        <div className="card-title-wrap">
          <Sparkles size={18} className="icon-ai" />
          <span className="card-title">6. AI Root Cause Analysis</span>
        </div>
        <div className="header-badges">
          <span className="badge-ai-model">Groq • Llama 3.3 70B</span>
          <span className="badge-latency">~380ms latency</span>
        </div>
      </div>

      <div className="ai-content-body">
        {/* Identified Error */}
        <div className="ai-section">
          <div className="section-label">
            <span className="label-dot red"></span>
            <span>Identified Issue:</span>
          </div>
          <div className="ai-error-box">
            {diagnosis.detected_error || activeIncident?.error_message || 'Awaiting incoming anomalies...'}
          </div>
        </div>

        {/* Probable Root Cause */}
        <div className="ai-section">
          <div className="section-label">
            <Lightbulb size={14} className="text-warning" />
            <span>Probable Root Cause:</span>
          </div>
          <p className="ai-text-block">
            {diagnosis.probable_root_cause ||
              'FastAPI user microservice and PostgreSQL datastore operating within nominal SLO parameters.'}
          </p>
        </div>

        {/* Suggested Solution & Code Fix */}
        <div className="ai-section">
          <div className="section-header-row">
            <div className="section-label">
              <Terminal size={14} className="text-accent" />
              <span>Suggested Code Remediation:</span>
            </div>
            {diagnosis.suggested_solution && (
              <button className="btn-copy-small" onClick={handleCopy} title="Copy suggested fix">
                {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}
          </div>
          <div className="solution-code-block">
            <pre>{solution}</pre>
          </div>
        </div>

        {/* Operational Recommendation */}
        <div className="ai-section">
          <div className="section-label">
            <ShieldCheck size={14} className="text-success" />
            <span>Operational Reliability Recommendation:</span>
          </div>
          <div className="recommendation-callout">
            <p>{diagnosis.ai_recommendation || 'Continuous synthetic health probes active every 10 seconds.'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}


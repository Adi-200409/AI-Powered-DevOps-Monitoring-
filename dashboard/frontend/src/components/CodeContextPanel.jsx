import React, { useState } from 'react';
import { FileCode, Lock, Copy, Check, Eye } from 'lucide-react';

export default function CodeContextPanel({ activeIncident }) {
  const [copied, setCopied] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  if (!activeIncident) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title-wrap">
            <FileCode size={18} className="icon-header" />
            <span className="card-title">7. Code Context & Secret Masking</span>
          </div>
          <div className="header-badges">
            <span className="badge-security">
              <Lock size={11} />
              <span>Credentials Redacted</span>
            </span>
          </div>
        </div>
        <div className="code-panel-body">
          <div className="ops-empty-state" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            <p>No code context available. Code locations and snippets appear when an incident is detected.</p>
          </div>
        </div>
      </div>
    );
  }

  const codeCtx = activeIncident.code_context || {};
  const codeSnippet = codeCtx.code_snippet || '# No code snippet captured for this incident.';
  const location = codeCtx.potential_code_location || 'Location not determined';
  const trace = codeCtx.sanitized_trace || '';

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-wrap">
          <FileCode size={18} className="icon-header" />
          <span className="card-title">7. Code Context & Secret Masking</span>
        </div>
        <div className="header-badges">
          <span className="badge-security">
            <Lock size={11} />
            <span>Credentials Redacted</span>
          </span>
        </div>
      </div>

      <div className="code-panel-body">
        <div className="location-bar">
          <span className="location-label">Location:</span>
          <code className="location-path">{location}</code>
          <div className="location-actions">
            {trace && (
              <button
                className={`btn-ghost-small ${showTrace ? 'active' : ''}`}
                onClick={() => setShowTrace(!showTrace)}
              >
                <Eye size={12} />
                <span>{showTrace ? 'Show Code' : 'Show Traceback'}</span>
              </button>
            )}
            <button className="btn-copy-small" onClick={handleCopy} title="Copy snippet">
              {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <div className="terminal-viewer code-viewer">
          {showTrace ? (
            <pre className="trace-text">{trace || 'No traceback captured.'}</pre>
          ) : (
            <pre className="snippet-text">
              {codeSnippet.split('\n').map((line, idx) => {
                const isHighlighted = line.includes('>>>>');
                return (
                  <div
                    key={idx}
                    className={`code-line ${isHighlighted ? 'code-line-highlight' : ''}`}
                  >
                    {line}
                  </div>
                );
              })}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}


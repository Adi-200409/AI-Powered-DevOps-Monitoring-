import React from 'react';
import { AlertTriangle, ShieldAlert, ArrowRight, Check } from 'lucide-react';

export default function IncidentFeed({ incidents, selectedId, onSelectIncident }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-wrap">
          <ShieldAlert size={18} className="icon-header icon-alert" />
          <span className="card-title">5. Error Detection Engine</span>
        </div>
        <div className="badge-count">
          <span className="pulse-danger-dot"></span>
          <span>{incidents.length} Detected</span>
        </div>
      </div>

      <div className="incident-list-container">
        {incidents.length === 0 ? (
          <div className="empty-state">
            <Check size={28} color="#10b981" />
            <p>Zero critical anomalies detected across active monitoring cycle.</p>
          </div>
        ) : (
          incidents.map((incident) => {
            const isSelected = incident.id === selectedId;
            const isCritical = incident.level === 'CRITICAL';

            return (
              <div
                key={incident.id}
                onClick={() => onSelectIncident(incident.id)}
                className={`incident-item ${isSelected ? 'incident-selected' : ''} ${
                  isCritical ? 'border-critical' : 'border-error'
                }`}
              >
                <div className="incident-meta">
                  <span className={`pill-badge ${isCritical ? 'pill-critical' : 'pill-warning'}`}>
                    <AlertTriangle size={11} />
                    <span>{incident.level}</span>
                  </span>
                  <span className="incident-container">{incident.container || 'user-service'}</span>
                  <span className="incident-time">{incident.timestamp}</span>
                  {isSelected && <span className="pill-active-tag">Active View</span>}
                </div>

                <div className="incident-msg">{incident.error_message}</div>

                <div className="incident-action-hint">
                  <span>View Groq AI root cause & sanitized code snippet</span>
                  <ArrowRight size={12} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


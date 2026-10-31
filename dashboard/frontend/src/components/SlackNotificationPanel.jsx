import React, { useState } from 'react';
import { Send, CheckCircle2, MessageSquare, Code } from 'lucide-react';

export default function SlackNotificationPanel({ activeIncident }) {
  const [showJson, setShowJson] = useState(false);

  const isDelivered = activeIncident?.slack_delivered ?? true;
  const container = activeIncident?.container || 'user-service';
  const errorMsg = activeIncident?.error_message || 'Simulated exception logged.';
  const rootCause = activeIncident?.ai_diagnosis?.probable_root_cause || 'FastAPI service operating within nominal limits.';
  const solution = activeIncident?.ai_diagnosis?.suggested_solution || 'No manual fix needed.';

  const payload = {
    channel: '#devops-alerts',
    username: 'DevOps Incident Bot',
    icon_emoji: ':rotating_light:',
    attachments: [
      {
        color: activeIncident?.level === 'CRITICAL' ? '#ef4444' : '#f59e0b',
        title: `🚨 [${activeIncident?.level || 'ERROR'}] Incident in ${container}`,
        fields: [
          { title: 'Timestamp', value: activeIncident?.timestamp || 'Now', short: true },
          { title: 'Container', value: container, short: true },
          { title: 'Error Summary', value: errorMsg, short: false },
          { title: 'Groq AI Root Cause', value: rootCause, short: false },
          { title: 'Remediation', value: solution, short: false }
        ],
        footer: 'DevOps Auto-Remediation System • Groq Llama 3.3'
      }
    ]
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-wrap">
          <MessageSquare size={18} className="icon-header icon-slack" />
          <span className="card-title">8. Slack Notification Dispatch</span>
        </div>
        <div className="header-badges">
          <span className="channel-badge">#devops-alerts</span>
          <span className={`pill-badge ${isDelivered ? 'pill-success' : 'pill-warning'}`}>
            <CheckCircle2 size={11} />
            <span>{isDelivered ? 'SENT VIA WEBHOOK' : 'STANDBY'}</span>
          </span>
        </div>
      </div>

      <div className="slack-panel-body">
        {/* Slack Card Simulation */}
        <div className="slack-message-bubble">
          <div className="slack-avatar">🤖</div>
          <div className="slack-content">
            <div className="slack-author-line">
              <span className="slack-author-name">DevOps Incident Bot</span>
              <span className="slack-bot-tag">APP</span>
              <span className="slack-timestamp">{activeIncident?.timestamp || 'just now'}</span>
              <button
                className="btn-ghost-tiny"
                onClick={() => setShowJson(!showJson)}
                title="Toggle Slack JSON webhook payload"
              >
                <Code size={11} />
                <span>{showJson ? 'View Message' : 'View Payload'}</span>
              </button>
            </div>

            {showJson ? (
              <pre className="slack-json-box">
                {JSON.stringify(payload, null, 2)}
              </pre>
            ) : (
              <div
                className={`slack-attachment-border ${
                  activeIncident?.level === 'CRITICAL' ? 'border-slack-critical' : 'border-slack-warning'
                }`}
              >
                <div className="slack-alert-header">
                  <strong>🚨 [{activeIncident?.level || 'ALERT'}] Incident Alert: {container}</strong>
                </div>

                <div className="slack-field-grid">
                  <div className="slack-field">
                    <span className="slack-field-title">APPLICATION</span>
                    <span className="slack-field-value">{container}</span>
                  </div>
                  <div className="slack-field">
                    <span className="slack-field-title">STATUS</span>
                    <span className="slack-field-value" style={{ color: '#ef4444', fontWeight: 600 }}>
                      {activeIncident?.level || 'CRITICAL'}
                    </span>
                  </div>
                </div>

                <div className="slack-field-full">
                  <span className="slack-field-title">ERROR TRACE</span>
                  <div className="slack-code-pill">{errorMsg}</div>
                </div>

                <div className="slack-field-full">
                  <span className="slack-field-title">🤖 GROQ AI ROOT CAUSE</span>
                  <p className="slack-ai-text">{rootCause}</p>
                </div>

                <div className="slack-footer">
                  <span>DevOps Auto-Remediation System</span>
                  <span>•</span>
                  <span>Webhook 200 OK</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


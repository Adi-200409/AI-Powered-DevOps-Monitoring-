import React from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  MessageSquare,
  Cpu,
  Lock,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

export default function RightSidebar({ onOpenDetails, activeIncidentCount = 2 }) {
  const activeIncidents = [
    {
      id: 'inc-101',
      title: 'PostgreSQL Pool Failure',
      severity: 'CRITICAL',
      container: 'user-service:5432',
      tab: 'ai',
      badgeColor: '#ef4444',
      icon: <AlertTriangle size={15} color="#ef4444" />
    },
    {
      id: 'inc-100',
      title: 'Slow Query Timeout (5s)',
      severity: 'ERROR',
      container: 'database.py:44',
      tab: 'ai',
      badgeColor: '#f59e0b',
      icon: <AlertOctagon size={15} color="#f59e0b" />
    }
  ];

  const sreOperations = [
    {
      id: 'sre-1',
      name: 'Slack Webhook Dispatched',
      subtitle: 'Delivered to #devops-alerts',
      timePill: '00:17',
      pillColor: '#facc15',
      pillBg: 'rgba(250, 204, 21, 0.15)',
      iconComponent: <MessageSquare size={15} color="#facc15" />,
      tab: 'slack'
    },
    {
      id: 'sre-2',
      name: 'Groq AI Root Cause Diagnostic',
      subtitle: 'Llama 3.3 70B triage complete',
      timePill: '00:19',
      pillColor: '#c084fc',
      pillBg: 'rgba(192, 132, 252, 0.15)',
      iconComponent: <Cpu size={15} color="#c084fc" />,
      tab: 'ai'
    },
    {
      id: 'sre-3',
      name: 'Code Traceback Sanitizer',
      subtitle: 'Passwords & tokens masked',
      timePill: '10:51',
      pillColor: '#818cf8',
      pillBg: 'rgba(129, 140, 248, 0.15)',
      iconComponent: <Lock size={15} color="#818cf8" />,
      tab: 'ai'
    },
    {
      id: 'sre-4',
      name: 'Jenkins Stage 7 Health Probe',
      subtitle: 'GET /health returned HTTP 200',
      timePill: '30:42',
      pillColor: '#fbbf24',
      pillBg: 'rgba(251, 191, 36, 0.15)',
      iconComponent: <CheckCircle2 size={15} color="#fbbf24" />,
      tab: 'pipeline'
    }
  ];

  return (
    <aside className="right-panel-container">
      {/* 1. Active Incidents & Alerts Section */}
      <div className="side-section">
        <div className="side-section-header">
          <h3 className="section-heading">Active Incidents</h3>
          <span className="incident-badge-count">{activeIncidentCount} Active</span>
        </div>

        <div className="starting-calls-list">
          {activeIncidents.map((item) => (
            <div
              key={item.id}
              className="starting-call-card"
              onClick={() => onOpenDetails && onOpenDetails(item.tab)}
            >
              <div className="incident-icon-avatar" style={{ borderColor: item.badgeColor }}>
                {item.icon}
              </div>
              <div className="starting-call-info">
                <div className="starting-call-name">{item.title}</div>
                <div className="starting-call-sub">{item.container}</div>
              </div>
              <ArrowRight size={12} className="card-arrow-indicator" />
            </div>
          ))}
        </div>
      </div>

      {/* 2. Autonomous SRE Operations Section */}
      <div className="side-section">
        <h3 className="section-heading">SRE Operations</h3>

        <div className="break-list">
          {sreOperations.map((item) => (
            <div
              key={item.id}
              className="break-item clickable-op"
              onClick={() => onOpenDetails && onOpenDetails(item.tab)}
            >
              <div className="sre-op-icon-avatar">
                {item.iconComponent}
              </div>
              <div className="break-info">
                <div className="break-name">{item.name}</div>
                <div className="break-sub">{item.subtitle}</div>
              </div>
              <div
                className="break-pill"
                style={{ color: item.pillColor, backgroundColor: item.pillBg }}
              >
                {item.timePill}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

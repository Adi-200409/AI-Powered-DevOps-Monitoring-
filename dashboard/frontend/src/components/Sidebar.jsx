import React from 'react';
import {
  Activity,
  PieChart,
  Server,
  Layers,
  MessageSquare,
  Settings,
  LogOut,
  Zap,
  Terminal
} from 'lucide-react';

export default function Sidebar({
  activeTab = 'analytics',
  onSelectTab,
  onOpenLogs,
  onOpenTriage,
  onSimulate
}) {
  return (
    <nav className="left-nav-rail">
      {/* Brand Icon Mark */}
      <div className="nav-brand-mark" title="AetherOps DevOps Observability">
        <div className="brand-dot-glow"></div>
        <Activity size={22} color="#ffffff" />
      </div>

      {/* Main Navigation Stack */}
      <div className="nav-icon-group">
        {/* 1. Live System Observability */}
        <button
          className={`nav-rail-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
          onClick={() => onSelectTab('telemetry')}
          title="System Telemetry & Health"
        >
          <Activity size={18} />
        </button>

        {/* 2. Performance Analytics & Workload Curves (Active in Screenshot) */}
        <button
          className={`nav-rail-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => onSelectTab('analytics')}
          title="Workload & Performance Curves"
        >
          <PieChart size={18} />
        </button>

        {/* 3. Microservices & Containers */}
        <button
          className={`nav-rail-btn ${activeTab === 'services' ? 'active' : ''}`}
          onClick={() => onSelectTab('services')}
          title="Monitored Microservices"
        >
          <Server size={18} />
        </button>

        {/* 4. CI/CD Pipeline Deployments */}
        <button
          className={`nav-rail-btn ${activeTab === 'cicd' ? 'active' : ''}`}
          onClick={() => onSelectTab('cicd')}
          title="Jenkins 7-Stage CI/CD Pipeline"
        >
          <Layers size={18} />
        </button>

        {/* 5. Slack Webhook Alerts */}
        <button
          className={`nav-rail-btn has-badge ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => onSelectTab('alerts')}
          title="Slack Notifications (#devops-alerts)"
        >
          <MessageSquare size={18} />
          <span className="nav-badge-pink">2</span>
        </button>

        {/* 6. Live Application Log Terminal */}
        <button
          className={`nav-rail-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={onOpenLogs}
          title="Streaming Application Logs (application.log)"
        >
          <Terminal size={18} />
        </button>
      </div>

      {/* Bottom Actions */}
      <div className="nav-bottom-group">
        {/* Instant Failure Simulation Trigger */}
        <button
          className="nav-rail-btn simulate-btn"
          onClick={onSimulate}
          title="Inject Test PostgreSQL Failure (Fault Injection)"
        >
          <Zap size={18} color="#f59e0b" />
        </button>

        {/* Cluster Configuration */}
        <button
          className="nav-rail-btn"
          onClick={() => onSelectTab('settings')}
          title="Cluster Telemetry Settings"
        >
          <Settings size={18} />
        </button>

        {/* Refresh Session */}
        <button
          className="nav-rail-btn"
          onClick={() => window.location.reload()}
          title="Reload Observability Session"
        >
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );
}

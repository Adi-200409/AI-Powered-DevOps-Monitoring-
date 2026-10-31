import React, { useState } from 'react';
import {
  Search,
  RefreshCw,
  Zap,
  Activity,
  Server,
  Database,
  Cpu,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export default function TopBar({
  isRefreshing,
  onRefresh,
  onSimulate,
  backendConnected = false,
  activeAlertCount = 1
}) {
  const [searchVal, setSearchVal] = useState('');

  return (
    <header className="topbar-container">
      {/* Brand: AetherOps */}
      <div className="topbar-brand">
        <div className="brand-logo-badge">
          <Activity size={18} color="#a855f7" />
        </div>
        <span className="brand-logo-text">
          Aether<span className="brand-dot-accent">Ops</span>
        </span>
        <span className="topbar-env-pill">Production Cluster</span>
      </div>

      {/* Middle: Search Pill + Microservice Cluster Status */}
      <div className="topbar-center">
        {/* Search Input Pill */}
        <div className="topbar-search-pill">
          <Search size={15} className="search-icon-dark" />
          <input
            type="text"
            placeholder="Search microservices, logs, tracebacks, deployments..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="topbar-search-input"
          />
        </div>

        {/* Cluster Health Pill */}
        <div className="topbar-team-status-pill">
          <div className="mini-icon-stack">
            <span className="cluster-icon-chip chip-app" title="FastAPI User Service">
              <Server size={12} color="#10b981" />
            </span>
            <span className="cluster-icon-chip chip-db" title="PostgreSQL 16 Cluster">
              <Database size={12} color="#38bdf8" />
            </span>
            <span className="cluster-icon-chip chip-ai" title="Groq Llama 3.3 AI Triage">
              <Cpu size={12} color="#c084fc" />
            </span>
            <span className="mini-av-count">4</span>
          </div>

          <div className="status-work-text">
            <strong>4 of 4 Services</strong> <span className="text-dim">Online</span>
          </div>

          <div className={`status-break-pill ${activeAlertCount > 0 ? 'pill-alert' : ''}`}>
            <span>{activeAlertCount > 0 ? `${activeAlertCount} Alert Active` : 'All Systems Nominal'}</span>
          </div>
        </div>
      </div>

      {/* Right: SRE Profile & Simulation Action */}
      <div className="topbar-right">
        {/* Quick Fault Injection Simulation */}
        <button
          className="topbar-sim-btn"
          onClick={() => onSimulate('db_error')}
          title="Inject Test PostgreSQL Failure"
        >
          <Zap size={13} />
          <span>Simulate Fault</span>
        </button>

        {/* Sync Button */}
        <button
          className="topbar-sync-btn"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Sync Real-time Telemetry"
        >
          <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
        </button>

        {/* SRE Lead User Identity */}
        <div className="user-profile-widget">
          <div className="user-meta">
            <span className="user-name">DevOps Lead</span>
            <span className="user-role">SRE / Reliability Engineer</span>
          </div>
          <div className="user-avatar-wrap">
            <div className="user-icon-badge">
              <ShieldCheck size={18} color="#facc15" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

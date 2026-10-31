import React, { useState } from 'react';
import {
  Activity,
  RefreshCw,
  Play,
  Pause,
  AlertTriangle,
  Zap,
  Server,
  Database,
  Sun,
  Moon
} from 'lucide-react';

export default function Header({
  backendConnected,
  isRefreshing,
  lastUpdated,
  pollInterval,
  setPollInterval,
  theme,
  onToggleTheme,
  onRefresh,
  onSimulate
}) {
  const [showSimulateMenu, setShowSimulateMenu] = useState(false);

  return (
    <header className="header-container">
      <div className="header-left">
        <div className="brand-icon">
          <Activity className="icon-pulse" size={24} color={theme === 'light' ? '#0284c7' : '#38bdf8'} />
        </div>
        <div>
          <div className="brand-title-wrap">
            <h1>DevOps Intelligent Telemetry</h1>
            <span className="badge-ai">Groq Llama 3.3 AI</span>
            <span className="badge-stack">FastAPI + Postgres</span>
          </div>
          <p className="header-subtitle">
            Autonomous Incident Detection, Code Sanitization, and Remediation Hub
          </p>
        </div>
      </div>

      <div className="header-right">
        {/* Connection status */}
        <div
          className={`conn-pill ${backendConnected ? 'conn-online' : 'conn-demo'}`}
          title={
            backendConnected
              ? 'Connected to live FastAPI backend on port 5050'
              : 'FastAPI backend offline; displaying simulated real-time telemetry'
          }
        >
          <span className="status-dot"></span>
          <span>{backendConnected ? 'Live Backend (5050)' : 'Dev Telemetry Mode'}</span>
        </div>

        {/* Theme Toggle (Light / Dark) */}
        <button
          className="btn-theme-toggle"
          onClick={onToggleTheme}
          title={theme === 'light' ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? (
            <>
              <Moon size={14} className="theme-icon" />
              <span className="theme-text">Dark</span>
            </>
          ) : (
            <>
              <Sun size={14} className="theme-icon" />
              <span className="theme-text">Light</span>
            </>
          )}
        </button>

        {/* Polling interval selector */}
        <div className="poll-controls">
          <button
            className={`btn-icon ${pollInterval === 0 ? 'active' : ''}`}
            onClick={() => setPollInterval(pollInterval === 0 ? 5000 : 0)}
            title={pollInterval === 0 ? 'Resume Auto-Polling' : 'Pause Auto-Polling'}
          >
            {pollInterval === 0 ? <Play size={14} /> : <Pause size={14} />}
          </button>

          <select
            className="poll-select"
            value={pollInterval}
            onChange={(e) => setPollInterval(Number(e.target.value))}
            title="Polling frequency"
          >
            <option value="3000">3s interval</option>
            <option value="5000">5s interval</option>
            <option value="10000">10s interval</option>
            <option value="0">Paused</option>
          </select>
        </div>

        {/* Manual Refresh button */}
        <button
          className={`btn-action ${isRefreshing ? 'refreshing' : ''}`}
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Manual refresh telemetry"
        >
          <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
          <span>Sync</span>
        </button>

        {/* Simulate Test Incident Trigger */}
        <div className="simulate-menu-wrapper">
          <button
            className="btn-simulate"
            onClick={() => setShowSimulateMenu(!showSimulateMenu)}
          >
            <Zap size={14} />
            <span>Simulate Incident</span>
          </button>

          {showSimulateMenu && (
            <div className="simulate-dropdown">
              <div className="dropdown-header">Test Monitoring Pipeline</div>
              <button
                className="dropdown-item"
                onClick={() => {
                  onSimulate('db_error');
                  setShowSimulateMenu(false);
                }}
              >
                <Database size={14} color="#d97706" />
                <div>
                  <strong>PostgreSQL Pool Failure</strong>
                  <span>Simulates ConnectionRefused / 5432 down</span>
                </div>
              </button>

              <button
                className="dropdown-item"
                onClick={() => {
                  onSimulate('crash');
                  setShowSimulateMenu(false);
                }}
              >
                <AlertTriangle size={14} color="#dc2626" />
                <div>
                  <strong>Critical OOM RuntimeError</strong>
                  <span>Triggers unhandled exception in transaction logic</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

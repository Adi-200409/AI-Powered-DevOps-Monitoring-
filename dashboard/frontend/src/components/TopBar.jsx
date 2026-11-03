import React from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Zap } from 'lucide-react';

export default function TopBar({
  pageTitle,
  isRefreshing,
  onRefresh,
  onSimulate,
  backendConnected = false,
  lastUpdated,
  activeAlertCount = 0,
  onOpenAlerts
}) {
  const updatedAt = lastUpdated instanceof Date && !Number.isNaN(lastUpdated.getTime())
    ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Not synced';

  return (
    <header className="ops-topbar">
      <div className="ops-breadcrumb">
        <span>Platform</span><span className="ops-breadcrumb-divider">/</span><strong>{pageTitle}</strong>
      </div>
      <div className="ops-topbar-actions">
        <span className={`ops-connection ${backendConnected ? 'is-connected' : 'is-disconnected'}`}>
          {backendConnected ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {backendConnected ? 'API connected' : 'API offline'}
        </span>
        <span className="ops-updated-at">Updated {updatedAt}</span>
        <button type="button" className="ops-topbar-icon" onClick={onOpenAlerts} aria-label={`${activeAlertCount} incident records`} title="Open incident queue">
          <AlertTriangle size={16} />
          {activeAlertCount > 0 && <span className="ops-alert-count">{activeAlertCount}</span>}
        </button>
        <button type="button" className="ops-button ops-button-secondary" onClick={() => onSimulate('db_error')}>
          <Zap size={14} /> Test fault
        </button>
        <button type="button" className="ops-button ops-button-primary" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw size={14} className={isRefreshing ? 'ops-spin' : ''} />
          {isRefreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>
    </header>
  );
}

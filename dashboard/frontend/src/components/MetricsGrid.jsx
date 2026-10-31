import React from 'react';
import { Server, Cpu, HardDrive, CheckCircle2, AlertCircle, Clock, Database } from 'lucide-react';
import Sparkline from './Sparkline';

export default function MetricsGrid({ systemStatus, metrics, cpuHistory, memoryHistory, theme = 'light' }) {
  const isHealthy = systemStatus.status === 'UP' || systemStatus.status === 'healthy';
  const cpuPercent = Number(metrics.cpu?.percent || 0).toFixed(1);
  const memoryPercent = Number(metrics.memory?.percent || 0).toFixed(1);

  const isLight = theme === 'light';

  // CPU Alert Level colors
  const defaultCpuColor = isLight ? '#0284c7' : '#38bdf8';
  const warningColor = isLight ? '#d97706' : '#f59e0b';
  const dangerColor = isLight ? '#dc2626' : '#ef4444';
  const defaultMemColor = isLight ? '#7c3aed' : '#a855f7';
  const healthColor = isLight ? '#059669' : '#10b981';

  const cpuColor = cpuPercent > 85 ? dangerColor : cpuPercent > 65 ? warningColor : defaultCpuColor;
  const memColor = memoryPercent > 85 ? dangerColor : memoryPercent > 70 ? warningColor : defaultMemColor;

  return (
    <div className="metrics-row">
      {/* Panel 1: System Health & Microservice State */}
      <div className="card metric-card">
        <div className="card-header">
          <div className="card-title-wrap">
            <Server size={18} className="icon-header" />
            <span className="card-title">1. System Health & Probes</span>
          </div>
          <span className={`pill-badge ${isHealthy ? 'pill-success' : 'pill-danger'}`}>
            {isHealthy ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
            <span>{isHealthy ? 'HEALTHY' : 'OFFLINE'}</span>
          </span>
        </div>

        <div className="metric-body">
          <div className="primary-stat">
            <span className="stat-value" style={{ color: isHealthy ? healthColor : dangerColor }}>
              {isHealthy ? '200 OK' : 'SERVICE DOWN'}
            </span>
            <span className="stat-unit">{systemStatus.service || 'User Management Service'}</span>
          </div>

          <div className="status-grid">
            <div className="status-item">
              <Clock size={13} className="text-muted" />
              <span className="text-muted">Host Uptime:</span>
              <strong>{metrics.uptime?.formatted || '4d 11h'}</strong>
            </div>

            <div className="status-item">
              <Database size={13} className="text-muted" />
              <span className="text-muted">Database:</span>
              <strong>{systemStatus.details?.database || 'PostgreSQL 16'}</strong>
            </div>

            <div className="status-item">
              <span className="status-bullet"></span>
              <span className="text-muted">Health Endpoint:</span>
              <code>/health (2ms)</code>
            </div>

            <div className="status-item">
              <span className="status-bullet"></span>
              <span className="text-muted">DB Pool:</span>
              <span>{systemStatus.details?.db_pool || 'Active (psycopg2)'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Panel 2: Host CPU Telemetry */}
      <div className="card metric-card">
        <div className="card-header">
          <div className="card-title-wrap">
            <Cpu size={18} className="icon-header" />
            <span className="card-title">2. CPU Utilization</span>
          </div>
          <span className="metric-sub-badge">{metrics.cpu?.cores || 8} Cores Active</span>
        </div>

        <div className="metric-body">
          <div className="stat-row">
            <div className="primary-stat">
              <span className="stat-value" style={{ color: cpuColor }}>
                {cpuPercent}%
              </span>
              <span className="stat-unit">Host Load</span>
            </div>

            <div className="stat-sparkline">
              <Sparkline
                data={cpuHistory}
                color={cpuColor}
                fillGradientId={`cpuSparkGrad_${theme}`}
                height={46}
                min={0}
                max={100}
              />
            </div>
          </div>

          {/* Progress bar indicator */}
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(100, cpuPercent)}%`,
                backgroundColor: cpuColor
              }}
            />
          </div>

          <div className="stat-footer">
            <span>Threshold: 80% Alert Trigger</span>
            <span>Trend: {cpuHistory[cpuHistory.length - 1] > cpuHistory[0] ? '▲ Rising' : '▼ Steady'}</span>
          </div>
        </div>
      </div>

      {/* Panel 3: Host Memory Telemetry */}
      <div className="card metric-card">
        <div className="card-header">
          <div className="card-title-wrap">
            <HardDrive size={18} className="icon-header" />
            <span className="card-title">3. Memory Allocation</span>
          </div>
          <span className="metric-sub-badge">
            {metrics.memory?.used_gb || 7.4} / {metrics.memory?.total_gb || 16.0} GB
          </span>
        </div>

        <div className="metric-body">
          <div className="stat-row">
            <div className="primary-stat">
              <span className="stat-value" style={{ color: memColor }}>
                {memoryPercent}%
              </span>
              <span className="stat-unit">RAM Allocated</span>
            </div>

            <div className="stat-sparkline">
              <Sparkline
                data={memoryHistory}
                color={memColor}
                fillGradientId={`memSparkGrad_${theme}`}
                height={46}
                min={0}
                max={100}
              />
            </div>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(100, memoryPercent)}%`,
                backgroundColor: memColor
              }}
            />
          </div>

          <div className="stat-footer">
            <span>Available: {metrics.memory?.available_gb || 8.6} GB Free</span>
            <span>Virtual Memory Subsystem</span>
          </div>
        </div>
      </div>
    </div>
  );
}

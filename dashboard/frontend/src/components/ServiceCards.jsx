import React from 'react';
import {
  Server,
  Cpu,
  GitBranch,
  Database,
  Globe,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ShieldCheck,
  Boxes,
  Activity,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export default function ServiceCards({ onSelectService, systemStatus }) {
  const isAppUp = systemStatus?.status === 'UP' || systemStatus?.status === 'healthy';

  const cards = [
    {
      id: '5000',
      serviceName: 'User Management Microservice',
      serviceSubtitle: 'FastAPI 0.115 • PostgreSQL 16',
      iconComponent: <Server size={20} color={isAppUp ? '#10b981' : '#ef4444'} />,
      statusRing: isAppUp ? '#10b981' : '#ef4444',
      statusPill: isAppUp ? 'HTTP 200 OK' : 'SERVICE DOWN',
      statusPillColor: isAppUp ? '#34d399' : '#f87171',
      stat1: { icon: 'up', val: '99.98% SLO', color: '#10b981' },
      stat2: { icon: 'clock', val: '24ms Ping', color: '#cbd5e1' },
      leadIcon: <Server size={12} color="#94a3b8" />,
      leadName: 'user-service:5000',
      leadBadge: 'v1.0',
      row1Dots: [
        'p','p','p','p','p','p','p','y','p','p','p','p','p','p','p','p','p','y','p','p','p'
      ],
      row2Dots: [
        'p','p','y','p','p','p','p','p','p','p','y','p','p','p','p','p','p','p','p','p','p'
      ],
      footerIcons: [
        { icon: <Database size={13} />, title: 'PostgreSQL 16 Cluster' },
        { icon: <Globe size={13} />, title: 'Docker Network Bridge' },
        { icon: <ShieldCheck size={13} />, title: 'Health Checked' }
      ],
      tabTarget: 'logs'
    },
    {
      id: 'LLM-70B',
      serviceName: 'Groq AI Root Cause Analyzer',
      serviceSubtitle: 'Llama 3.3 70B • SRE Triage',
      iconComponent: <Cpu size={20} color="#c084fc" />,
      statusRing: '#8b5cf6',
      statusPill: 'ACTIVE INFERENCE',
      statusPillColor: '#c084fc',
      stat1: { icon: 'down', val: '1 Anomaly Detected', color: '#f59e0b' },
      stat2: { icon: 'clock', val: '380ms Latency', color: '#cbd5e1' },
      leadIcon: <Sparkles size={12} color="#94a3b8" />,
      leadName: 'Groq Cloud Llama-3.3',
      leadBadge: '70B',
      row1Dots: [
        'y','p','p','p','p','p','y','p','p','p','p','p','y','p','p','p','p','p','y','p','p'
      ],
      row2Dots: [
        'p','p','p','y','p','p','p','p','p','y','p','p','p','p','p','y','p','p','p','p','p'
      ],
      footerIcons: [
        { icon: <Cpu size={13} />, title: 'Groq TPU Hardware Acceleration' },
        { icon: <Lock size={13} />, title: 'Credentials Redacted' },
        { icon: <ShieldCheck size={13} />, title: 'Schema Enforced' }
      ],
      tabTarget: 'ai'
    },
    {
      id: 'CI-43',
      serviceName: 'Jenkins 7-Stage CI/CD Pipeline',
      serviceSubtitle: 'Docker Compose • AWS EC2',
      iconComponent: <GitBranch size={20} color="#f59e0b" />,
      statusRing: '#f59e0b',
      statusPill: 'BUILD #43 SUCCESS',
      statusPillColor: '#34d399',
      stat1: { icon: 'up', val: '7/7 Stages OK', color: '#10b981' },
      stat2: { icon: 'clock', val: '1m 32s Deploy', color: '#cbd5e1' },
      leadIcon: <Boxes size={12} color="#94a3b8" />,
      leadName: 'main (fix: db retry)',
      leadBadge: '#43',
      row1Dots: [
        'p','p','p','p','p','y','p','p','p','p','p','y','p','p','p','p','y','p','p','p','p'
      ],
      row2Dots: [
        'p','p','p','p','p','p','p','p','p','p','p','p','p','p','p','p','p','p','p','p','p'
      ],
      footerIcons: [
        { icon: <Boxes size={13} />, title: 'Docker Container Build' },
        { icon: <Globe size={13} />, title: 'ECR Image Registry' },
        { icon: <CheckCircle2 size={13} />, title: 'Automated Pytest Passed' }
      ],
      tabTarget: 'pipeline'
    }
  ];

  return (
    <div className="ongoing-section">
      <div className="section-title-row">
        <h3 className="section-heading">Monitored Microservices & Delivery Pipelines</h3>
        <span className="section-subtitle">Real-time health telemetry, AI triage & CI/CD deployment</span>
      </div>

      <div className="ongoing-cards-grid">
        {cards.map((c) => (
          <div
            key={c.id}
            className="ongoing-card"
            onClick={() => onSelectService && onSelectService(c.tabTarget)}
          >
            {/* Top row: Professional SVG Icon Badge & Status Pill */}
            <div className="ongoing-card-top">
              <div
                className="card-avatar-wrap service-avatar-box"
                style={{ borderColor: c.statusRing }}
              >
                {c.iconComponent}
              </div>

              <div className="card-identity">
                <div className="card-name">{c.serviceName}</div>
                <div className="card-subtitle-small">{c.serviceSubtitle}</div>
                <div className="card-time-pill" style={{ borderColor: c.statusRing }}>
                  <span className="live-dot" style={{ backgroundColor: c.statusRing }}></span>
                  <span style={{ color: c.statusPillColor }}>{c.statusPill}</span>
                </div>
              </div>
            </div>

            {/* Metrics pills: SLO % and Ping latency */}
            <div className="ongoing-metrics-row">
              <div className="metric-tag" style={{ color: c.stat1.color }}>
                {c.stat1.icon === 'up' ? (
                  <ArrowUpRight size={13} />
                ) : (
                  <ArrowDownRight size={13} />
                )}
                <span>{c.stat1.val}</span>
              </div>

              <div className="metric-tag text-muted">
                <Clock size={12} />
                <span>{c.stat2.val}</span>
              </div>
            </div>

            {/* Service Host / Pipeline details */}
            <div className="ongoing-lead-row">
              <span className="lead-icon-svg">{c.leadIcon}</span>
              <span className="lead-name">{c.leadName}</span>
              <span className="lead-badge">{c.leadBadge}</span>
            </div>

            {/* Signature Dot Matrix (purple & yellow status dots) */}
            <div className="dot-matrix-container">
              <div className="dot-matrix-row">
                {c.row1Dots.map((dot, dIdx) => (
                  <span
                    key={`r1-${dIdx}`}
                    className={`matrix-dot ${dot === 'y' ? 'dot-yellow' : 'dot-purple'}`}
                  />
                ))}
              </div>
              <div className="dot-matrix-row">
                {c.row2Dots.map((dot, dIdx) => (
                  <span
                    key={`r2-${dIdx}`}
                    className={`matrix-dot ${dot === 'y' ? 'dot-yellow' : 'dot-purple'}`}
                  />
                ))}
              </div>
            </div>

            {/* Card Footer: Host ID + Professional SVG Status Icons */}
            <div className="ongoing-card-footer">
              <span className="card-footer-id">HOST: {c.id}</span>
              <div className="card-footer-icons">
                {c.footerIcons.map((fItem, fIdx) => (
                  <span key={fIdx} className="footer-icon-wrap" title={fItem.title}>
                    {fItem.icon}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import React from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  Cpu,
  FileText,
  GitBranch,
  Globe,
  HardDrive,
  Layers3,
  Server,
  Settings,
  Shield,
  Sparkles,
  Workflow,
  Zap
} from 'lucide-react';

const groups = [
  {
    label: 'WORKSPACE',
    items: [{ id: 'overview', label: 'Overview', icon: Activity }]
  },
  {
    label: 'OBSERVABILITY',
    items: [
      { id: 'monitoring', label: 'Live monitoring', icon: Cpu },
      { id: 'logs', label: 'Log explorer', icon: FileText },
      { id: 'errors', label: 'Error intelligence', icon: Shield },
      { id: 'incidents', label: 'Incidents', icon: Workflow },
      { id: 'rootcause', label: 'Root cause', icon: GitBranch },
      { id: 'ai', label: 'AI troubleshooter', icon: Sparkles }
    ]
  },
  {
    label: 'DELIVERY & FLEET',
    items: [
      { id: 'cicd', label: 'CI/CD pipelines', icon: Layers3 },
      { id: 'infrastructure', label: 'Infrastructure', icon: HardDrive },
      { id: 'services', label: 'Services & apps', icon: Server }
    ]
  },
  {
    label: 'ADMINISTRATION',
    items: [
      { id: 'alerts', label: 'Alerts & notifications', icon: Bell },
      { id: 'reporting', label: 'Reports & analytics', icon: BarChart3 },
      { id: 'integrations', label: 'Integrations', icon: Globe },
      { id: 'settings', label: 'Settings', icon: Settings }
    ]
  }
];

export default function Sidebar({ activeTab = 'overview', onSelectTab, onSimulate }) {
  return (
    <aside className="ops-sidebar">
      <div className="ops-brand">
        <div className="ops-brand-mark"><Activity size={19} /></div>
        <div><strong>AetherOps</strong><span>OPERATIONS CONSOLE</span></div>
      </div>

      <div className="ops-workspace-switcher">
        <span className="ops-workspace-avatar">P</span>
        <span><strong>Platform Engineering</strong><small>Production workspace</small></span>
        <span className="ops-chevron">⌄</span>
      </div>

      <nav className="ops-navigation" aria-label="Primary navigation">
        {groups.map((group) => (
          <div className="ops-nav-group" key={group.label}>
            <div className="ops-nav-label">{group.label}</div>
            {group.items.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                className={`ops-nav-item ${activeTab === id ? 'is-active' : ''}`}
                onClick={() => onSelectTab?.(id)}
                aria-current={activeTab === id ? 'page' : undefined}
              >
                <Icon size={16} strokeWidth={1.8} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="ops-sidebar-footer">
        <button type="button" className="ops-nav-item ops-simulate-link" onClick={() => onSimulate?.('db_error')}>
          <Zap size={16} /><span>Simulate test fault</span>
        </button>
        <div className="ops-sidebar-user">
          <div className="ops-user-avatar">DE</div>
          <div><strong>DevOps Engineer</strong><span>Reliability team</span></div>
          <span className="ops-user-menu">···</span>
        </div>
      </div>
    </aside>
  );
}

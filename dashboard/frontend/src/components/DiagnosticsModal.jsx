import React, { useState } from 'react';
import {
  X,
  Sparkles,
  FileCode,
  MessageSquare,
  GitCommit,
  Terminal,
  Zap,
  Check,
  Copy,
  AlertTriangle,
  Lock,
  Database
} from 'lucide-react';
import LogTerminal from './LogTerminal';
import PipelineHistory from './PipelineHistory';
import AiTriagePanel from './AiTriagePanel';
import CodeContextPanel from './CodeContextPanel';
import SlackNotificationPanel from './SlackNotificationPanel';

export default function DiagnosticsModal({
  isOpen,
  onClose,
  initialTab = 'ai',
  activeIncident,
  incidents = [],
  onSelectIncident,
  deployments = [],
  logs = { lines: [], count: 0 },
  onSimulate,
  isRefreshing,
  onRefresh
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content-window" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <span className="modal-title">DevOps Diagnostics & Observability Hub</span>
            <span className="modal-pill-active">Active SRE Session</span>
          </div>

          <div className="modal-tabs">
            <button
              className={`modal-tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              <Sparkles size={14} />
              <span>AI Triage & Code</span>
            </button>

            <button
              className={`modal-tab-btn ${activeTab === 'slack' ? 'active' : ''}`}
              onClick={() => setActiveTab('slack')}
            >
              <MessageSquare size={14} />
              <span>Slack Webhook</span>
            </button>

            <button
              className={`modal-tab-btn ${activeTab === 'pipeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('pipeline')}
            >
              <GitCommit size={14} />
              <span>Jenkins Pipeline</span>
            </button>

            <button
              className={`modal-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              <Terminal size={14} />
              <span>Log Console</span>
            </button>
          </div>

          <div className="modal-header-right">
            <button
              className="btn-modal-simulate"
              onClick={() => onSimulate('db_error')}
              title="Inject test PostgreSQL Connection Error"
            >
              <Zap size={13} />
              <span>Simulate DB Fault</span>
            </button>

            <button className="btn-close-modal" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {activeTab === 'ai' && (
            <div className="modal-grid-2">
              <AiTriagePanel activeIncident={activeIncident} />
              <CodeContextPanel activeIncident={activeIncident} />
            </div>
          )}

          {activeTab === 'slack' && (
            <div className="modal-single-col">
              <SlackNotificationPanel activeIncident={activeIncident} />
            </div>
          )}

          {activeTab === 'pipeline' && (
            <div className="modal-single-col">
              <PipelineHistory deployments={deployments} />
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="modal-single-col">
              <LogTerminal logs={logs} isRefreshing={isRefreshing} onRefresh={onRefresh} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


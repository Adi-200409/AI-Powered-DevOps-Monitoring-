import React, { useState } from 'react';
import { GitCommit, GitBranch, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';

export default function PipelineHistory({ deployments }) {
  const [expandedBuild, setExpandedBuild] = useState(deployments[0]?.build_number || null);

  const toggleExpand = (buildNum) => {
    setExpandedBuild(expandedBuild === buildNum ? null : buildNum);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-wrap">
          <GitCommit size={18} className="icon-header icon-pipeline" />
          <span className="card-title">9. CI/CD Deployment Pipeline</span>
        </div>
        <div className="header-badges">
          <span className="badge-pipeline-tag">Jenkins 7-Stage CI/CD</span>
        </div>
      </div>

      <div className="pipeline-body">
        {deployments.map((dep) => {
          const isSuccess = dep.status === 'SUCCESS';
          const isExpanded = expandedBuild === dep.build_number;

          return (
            <div
              key={dep.build_number}
              className={`pipeline-build-card ${isSuccess ? 'pipeline-success' : 'pipeline-failed'}`}
            >
              <div
                className="pipeline-card-header"
                onClick={() => toggleExpand(dep.build_number)}
              >
                <div className="build-info-left">
                  <span className={`pill-badge ${isSuccess ? 'pill-success' : 'pill-danger'}`}>
                    {isSuccess ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                    <span>Build #{dep.build_number}</span>
                  </span>

                  <span className="build-commit-msg">{dep.commit}</span>
                </div>

                <div className="build-info-right">
                  <div className="branch-badge">
                    <GitBranch size={11} />
                    <span>{dep.branch}</span>
                  </div>

                  <div className="duration-tag">
                    <Clock size={11} />
                    <span>{dep.duration}</span>
                  </div>

                  <button className="btn-expand" title="Toggle stage details">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* 7-Stage Visual Flow */}
              <div className="pipeline-stages-flow">
                {dep.stages.map((stage, idx) => {
                  const stageSuccess = stage.status === 'SUCCESS';
                  return (
                    <div key={idx} className="stage-step-wrap">
                      <div
                        className={`stage-step ${stageSuccess ? 'stage-ok' : 'stage-err'}`}
                        title={`${stage.name}: ${stage.status} (${stage.duration || ''})`}
                      >
                        <div className="stage-icon-dot">
                          {stageSuccess ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        </div>
                        <div className="stage-text">
                          <span className="stage-index">{idx + 1}</span>
                          <span className="stage-name">{stage.name}</span>
                        </div>
                        {stage.duration && (
                          <span className="stage-duration">{stage.duration}</span>
                        )}
                      </div>

                      {idx < dep.stages.length - 1 && (
                        <div
                          className={`stage-connector ${
                            stageSuccess ? 'connector-ok' : 'connector-err'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {isExpanded && (
                <div className="build-details-drawer">
                  <div className="build-meta-row">
                    <span>
                      <strong>Timestamp:</strong> {dep.timestamp}
                    </span>
                    <span>
                      <strong>Triggered by:</strong> {dep.author || 'Automated Webhook'}
                    </span>
                    <span>
                      <strong>Target Cluster:</strong> Docker Compose (EC2 Host)
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


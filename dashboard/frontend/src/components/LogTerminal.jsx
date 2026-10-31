import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Terminal, Search, Filter, Copy, Check, ArrowDownCircle, RefreshCw } from 'lucide-react';

export default function LogTerminal({ logs, isRefreshing, onRefresh }) {
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef(null);

  const lines = logs.lines || [];

  const filteredLines = useMemo(() => {
    return lines.filter((line) => {
      // Level filter
      if (filterLevel !== 'ALL') {
        if (!line.includes(`[${filterLevel}]`) && !line.includes(filterLevel)) {
          return false;
        }
      }
      // Search filter
      if (searchQuery.trim() !== '') {
        return line.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [lines, filterLevel, searchQuery]);

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLines, autoScroll]);

  const handleCopy = () => {
    navigator.clipboard.writeText(filteredLines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLineClass = (line) => {
    if (line.includes('CRITICAL')) return 'log-critical';
    if (line.includes('ERROR')) return 'log-error';
    if (line.includes('WARNING') || line.includes('WARN')) return 'log-warning';
    if (line.includes('INFO')) return 'log-info';
    return 'log-default';
  };

  return (
    <div className="card terminal-card">
      <div className="card-header">
        <div className="card-title-wrap">
          <Terminal size={18} className="icon-header icon-terminal" />
          <span className="card-title">4. Application Log Stream (application.log)</span>
        </div>

        <div className="terminal-actions">
          {/* Level Filter Pills */}
          <div className="filter-pill-group">
            {['ALL', 'INFO', 'WARN', 'ERROR', 'CRITICAL'].map((lvl) => (
              <button
                key={lvl}
                className={`filter-btn ${filterLevel === lvl ? 'active' : ''} filter-${lvl.toLowerCase()}`}
                onClick={() => setFilterLevel(lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>

          <div className="badge-line-count">
            <span>{filteredLines.length} / {lines.length} lines</span>
          </div>
        </div>
      </div>

      {/* Terminal Toolbar: Search & Auto-scroll */}
      <div className="terminal-toolbar">
        <div className="search-bar">
          <Search size={13} className="search-icon" />
          <input
            type="text"
            placeholder="Filter logs by keyword (e.g. database, health, postgres)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button className="btn-clear" onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>

        <div className="terminal-btn-group">
          <button
            className={`btn-ghost-small ${autoScroll ? 'active' : ''}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title="Toggle auto-scroll to bottom"
          >
            <ArrowDownCircle size={12} />
            <span>Auto-Scroll</span>
          </button>

          <button className="btn-ghost-small" onClick={handleCopy} title="Copy visible logs">
            {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Terminal Content Window */}
      <div className="terminal-console">
        {filteredLines.length === 0 ? (
          <div className="terminal-empty">
            No matching log records for the current filter criteria.
          </div>
        ) : (
          filteredLines.map((line, idx) => (
            <div key={idx} className={`log-row ${getLineClass(line)}`}>
              <span className="log-line-num">{idx + 1}</span>
              <span className="log-line-text">{line}</span>
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}


import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Terminal, Search, Copy, Check, ArrowDownCircle, RefreshCw, History, AlertTriangle } from 'lucide-react';

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'application', label: 'Application log' },
  { value: 'docker', label: 'Docker logs' }
];

function parseLogEntries(lines, defaultSource = 'application', containerName = 'container') {
  const entries = [];
  const timestampPattern = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/;
  const levelPattern = /\[(DEBUG|INFO|WARN|WARNING|ERROR|CRITICAL)\]|\b(DEBUG|INFO|WARN|WARNING|ERROR|CRITICAL)\b/i;

  lines.forEach((value) => {
    const raw = String(value ?? '');
    let normalized = raw.trim();
    let source = defaultSource;
    const sourceMatch = normalized.match(/^\[(application|docker)\]\s*/i);
    if (sourceMatch) {
      source = sourceMatch[1].toLowerCase();
      normalized = normalized.slice(sourceMatch[0].length);
    }

    const timestampMatch = normalized.match(timestampPattern);
    const timestamp = timestampMatch?.[1] || null;
    if (timestampMatch) normalized = normalized.slice(timestampMatch[0].length).trim();

    const levelMatch = normalized.match(levelPattern);
    if (!timestamp && !levelMatch && entries.length && entries[entries.length - 1].source === source) {
      const previous = entries[entries.length - 1];
      previous.lines.push(raw);
      previous.raw = `${previous.raw}\n${raw}`;
      previous.stackTrace.push(raw);
      return;
    }

    let level = (levelMatch?.[1] || levelMatch?.[2] || 'UNKNOWN').toUpperCase();
    if (level === 'WARN') level = 'WARNING';
    const withoutLevel = normalized.replace(levelPattern, '');
    const serviceMatch = withoutLevel.match(/\[([^\]]+)\]/);
    const service = serviceMatch?.[1]?.trim() || (source === 'docker' ? containerName : 'application');
    const message = withoutLevel
      .replace(/\[[^\]]+\]/, '')
      .replace(/^[-:>\s]+/, '')
      .trim();

    entries.push({
      raw,
      lines: [raw],
      stackTrace: [],
      source,
      timestamp,
      level,
      service,
      message: message || normalized || raw
    });
  });

  return entries;
}

function isWithinDateRange(timestamp, startDate, endDate) {
  if (!timestamp) return !startDate && !endDate;
  const date = timestamp.slice(0, 10);
  return (!startDate || date >= startDate) && (!endDate || date <= endDate);
}

export default function LogTerminal({ logs, isRefreshing, onRefresh }) {
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('log-explorer-search-history') || '[]');
      return Array.isArray(saved) ? saved.filter((query) => typeof query === 'string').slice(0, 8) : [];
    } catch {
      return [];
    }
  });
  const [source, setSource] = useState(logs?.source || 'all');
  const terminalEndRef = useRef(null);

  useEffect(() => {
    setSource(logs?.source || 'all');
  }, [logs?.source]);
  const lines = logs.lines || [];
  const parsedEntries = useMemo(
    () => parseLogEntries(lines, source, logs.containerName),
    [lines, source, logs.containerName]
  );
  const services = useMemo(
    () => [...new Set(parsedEntries.map((entry) => entry.service).filter(Boolean))].sort(),
    [parsedEntries]
  );

  const filteredLines = useMemo(() => {
    return parsedEntries.filter((entry) => {
      if (filterLevel !== 'ALL' && entry.level !== filterLevel) return false;
      if (selectedService !== 'ALL' && entry.service !== selectedService) return false;
      if (!isWithinDateRange(entry.timestamp, startDate, endDate)) return false;

      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        return entry.raw.toLowerCase().includes(query)
          || entry.stackTrace.join('\n').toLowerCase().includes(query)
          || entry.service.toLowerCase().includes(query)
          || entry.source.toLowerCase().includes(query)
          || entry.level.toLowerCase().includes(query);
      }
      return true;
    });
  }, [parsedEntries, filterLevel, selectedService, startDate, endDate, searchQuery]);

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLines, autoScroll]);

  const summary = {
    total: parsedEntries.length,
    info: parsedEntries.filter((entry) => entry.level === 'INFO').length,
    warning: parsedEntries.filter((entry) => entry.level === 'WARNING').length,
    error: parsedEntries.filter((entry) => entry.level === 'ERROR' || entry.level === 'CRITICAL').length,
  };

  const rememberSearch = (query) => {
    const normalized = query.trim();
    if (!normalized) return;
    const nextHistory = [normalized, ...searchHistory.filter((item) => item !== normalized)].slice(0, 8);
    setSearchHistory(nextHistory);
    setShowHistory(false);
    try {
      window.localStorage.setItem('log-explorer-search-history', JSON.stringify(nextHistory));
    } catch {
      setFeedbackError('Search history could not be saved in this browser.');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(filteredLines.map((entry) => entry.raw).join('\n'));
      setFeedbackError('');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFeedbackError('Clipboard access is unavailable in this browser.');
    }
  };

  const handleSourceChange = (nextSource) => {
    setSource(nextSource);
    if (typeof onRefresh === 'function') {
      onRefresh(nextSource);
    }
  };

  const getLineClass = (level) => {
    if (level === 'CRITICAL') return 'log-critical';
    if (level === 'ERROR') return 'log-error';
    if (level === 'WARNING') return 'log-warning';
    if (level === 'INFO' || level === 'DEBUG') return 'log-info';
    return 'log-default';
  };

  return (
    <div className="card terminal-card">
      <div className="card-header">
        <div className="card-title-wrap">
          <Terminal size={18} className="icon-header icon-terminal" />
          <span className="card-title">4. Application Log Explorer</span>
          <span className={`log-stream-state is-${logs.streamStatus || 'connecting'}`}>
            <span className="ops-status-dot" />
            {logs.streamStatus === 'live' ? 'Live' : logs.streamStatus === 'reconnecting' ? 'Reconnecting' : logs.streamStatus === 'offline' ? 'Offline' : 'Connecting'}
          </span>
        </div>

        <div className="terminal-actions">
          <div className="source-switch" aria-label="Log source selector">
            {SOURCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`filter-btn ${source === option.value ? 'active' : ''}`}
                onClick={() => handleSourceChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="filter-pill-group">
            {['ALL', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'].map((lvl) => (
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
            <span>{filteredLines.length} / {parsedEntries.length} events</span>
          </div>
        </div>
      </div>

      <div className="terminal-toolbar">
        <div className="log-search-wrap">
          <div className="search-bar">
            <Search size={13} className="search-icon" />
            <input
              type="search"
              placeholder="Search message, service, level, or stack trace..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') rememberSearch(searchQuery);
              }}
              className="search-input"
            />
            {searchQuery && (
              <button className="btn-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
                ×
              </button>
            )}
            <button
              className={`btn-ghost-small ${showHistory ? 'active' : ''}`}
              onClick={() => setShowHistory((visible) => !visible)}
              title="Show recent searches"
              aria-label="Show recent searches"
            >
              <History size={12} />
            </button>
          </div>
          {showHistory && searchHistory.length > 0 && (
            <div className="log-search-history">
              {searchHistory.map((query) => (
                <button key={query} onClick={() => { setSearchQuery(query); setShowHistory(false); }}>
                  {query}
                </button>
              ))}
            </div>
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

          <button
            className="btn-ghost-small"
            onClick={() => onRefresh && onRefresh(source)}
            title="Refresh log view"
            disabled={isRefreshing}
          >
            <RefreshCw size={12} className={isRefreshing ? 'refreshing' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button className="btn-ghost-small" onClick={handleCopy} title="Copy visible logs">
            {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      <div className="log-filter-row">
        <label>
          <span>Service</span>
          <select value={selectedService} onChange={(event) => setSelectedService(event.target.value)}>
            <option value="ALL">All services</option>
            {services.map((service) => <option key={service} value={service}>{service}</option>)}
          </select>
        </label>
        <label><span>From</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label><span>To</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        <span className="log-filter-count">Showing {filteredLines.length} of {parsedEntries.length} events</span>
      </div>

      {Object.entries(logs.sourceErrors || {}).map(([failedSource, message]) => message && (
        <div className="log-source-error" key={failedSource}>
          <AlertTriangle size={14} />
          <span><strong>{failedSource} logs unavailable:</strong> {message}</span>
        </div>
      ))}
      {feedbackError && <div className="log-source-error" role="status">{feedbackError}</div>}

      <div className="terminal-summary" style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem 0.75rem', fontSize: '0.72rem' }}>
        <span><strong>{summary.total || 0}</strong> total</span>
        <span><strong>{summary.info || 0}</strong> info</span>
        <span><strong>{summary.warning || 0}</strong> warnings</span>
        <span><strong>{summary.error || 0}</strong> errors</span>
      </div>

      <div className="terminal-console">
        {filteredLines.length === 0 ? (
          <div className="terminal-empty">
            No matching log events. Try changing the source, date range, or filters.
          </div>
        ) : (
          filteredLines.map((entry, idx) => (
            <article key={`${entry.raw}-${idx}`} className={`log-event ${getLineClass(entry.level)}`}>
              <div className="log-row">
                <span className="log-line-num">{idx + 1}</span>
                <span className="log-line-type">{entry.level}</span>
                <span className="log-line-source">{entry.source}</span>
                <span className="log-service">{entry.service}</span>
                <time className="log-timestamp">{entry.timestamp || 'No timestamp'}</time>
                <span className="log-line-text">{entry.message}</span>
              </div>
              {entry.stackTrace.length > 0 && (
                <details className="log-stacktrace">
                  <summary>{entry.stackTrace.length} continuation / stack-trace lines</summary>
                  <pre>{entry.stackTrace.join('\n')}</pre>
                </details>
              )}
            </article>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}

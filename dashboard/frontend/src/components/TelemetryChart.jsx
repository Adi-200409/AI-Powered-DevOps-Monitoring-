import React, { useState } from 'react';

export default function TelemetryChart({ cpuHistory = [], memoryHistory = [] }) {
  const [activeRange, setActiveRange] = useState('24h');
  const [selectedDay, setSelectedDay] = useState(10);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const days = [
    { num: '01', day: 'Sat', val: 1 },
    { num: '02', day: 'Sun', val: 2 },
    { num: '03', day: 'Mon', val: 3 },
    { num: '04', day: 'Tue', val: 4 },
    { num: '05', day: 'Wed', val: 5 },
    { num: '06', day: 'Thu', val: 6 },
    { num: '07', day: 'Fri', val: 7 },
    { num: '08', day: 'Sat', val: 8 },
    { num: '09', day: 'Sun', val: 9 },
    { num: '10', day: 'Mon', val: 10 },
    { num: '11', day: 'Tue', val: 11 },
    { num: '12', day: 'Wed', val: 12 },
    { num: '13', day: 'Thu', val: 13 }
  ];

  const timeLabels = [
    '7 am', '8 am', '9 am', '10 am', '11 am', '12 pm',
    '1 pm', '2 pm', '3 pm', '4 pm', '5 pm', '6 pm',
    '7 pm', '8 pm', '9 pm', '10 pm'
  ];

  // Curve data points for the telemetry wave:
  // Purple curve = Host CPU load (%)
  // Yellow dashed curve = RAM / Memory allocation (%)
  const purplePoints = [
    { x: 0, y: 105, label: '7 am', cpu: 22, mem: 42 },
    { x: 50, y: 98, label: '8 am', cpu: 26, mem: 44 },
    { x: 100, y: 104, label: '9 am', cpu: 20, mem: 41 },
    { x: 150, y: 90, label: '10 am', cpu: 35, mem: 46 },
    { x: 200, y: 84, label: '11 am', cpu: 42, mem: 50 },
    { x: 250, y: 108, label: '12 pm', cpu: 18, mem: 39 },
    { x: 300, y: 142, label: '1 pm', cpu: 8, mem: 35 },
    { x: 350, y: 18, label: '2 pm (Spike)', cpu: 94, mem: 88 },
    { x: 400, y: 32, label: '3 pm', cpu: 84, mem: 78 },
    { x: 450, y: 94, label: '4 pm', cpu: 29, mem: 48 },
    { x: 500, y: 102, label: '5 pm', cpu: 23, mem: 45 },
    { x: 550, y: 88, label: '6 pm', cpu: 36, mem: 52 },
    { x: 600, y: 110, label: '7 pm', cpu: 16, mem: 38 },
    { x: 650, y: 90, label: '8 pm', cpu: 34, mem: 49 },
    { x: 700, y: 98, label: '9 pm', cpu: 27, mem: 43 },
    { x: 750, y: 100, label: '10 pm', cpu: 24, mem: 42 }
  ];

  const yellowPoints = [
    { x: 0, y: 96 },
    { x: 50, y: 92 },
    { x: 100, y: 112 },
    { x: 150, y: 100 },
    { x: 200, y: 82 },
    { x: 250, y: 86 },
    { x: 300, y: 120 },
    { x: 350, y: 96 },
    { x: 400, y: 56 },
    { x: 450, y: 48 },
    { x: 500, y: 52 },
    { x: 550, y: 96 },
    { x: 600, y: 114 },
    { x: 650, y: 126 },
    { x: 700, y: 86 },
    { x: 750, y: 80 }
  ];

  const generateSmoothPath = (pts) => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? i : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const purpleLinePath = generateSmoothPath(purplePoints);
  const purpleAreaPath = `${purpleLinePath} L 750 160 L 0 160 Z`;
  const yellowLinePath = generateSmoothPath(yellowPoints);

  return (
    <div className="telemetry-chart-container">
      {/* Header: Title, Legend & Time Range Filters */}
      <div className="chart-header">
        <div className="chart-title-legend">
          <h2 className="chart-title">System Telemetry & Workload</h2>
          <div className="telemetry-legend">
            <span className="legend-item purple">
              <span className="legend-dot dot-p"></span>
              <span>Host CPU Load (%)</span>
            </span>
            <span className="legend-item yellow">
              <span className="legend-dot dot-y"></span>
              <span>Memory Threshold (%)</span>
            </span>
          </div>
        </div>

        <div className="range-pills">
          {['Live', '24h', '7d', '30d'].map((r) => (
            <button
              key={r}
              className={`range-pill ${activeRange === r ? 'active' : ''}`}
              onClick={() => setActiveRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Horizontal Date Selector Pills */}
      <div className="date-strip-wrapper">
        <div className="date-strip">
          {days.map((item) => {
            const isSelected = selectedDay === item.val;
            return (
              <button
                key={item.num}
                className={`date-pill ${isSelected ? 'date-pill-selected' : ''}`}
                onClick={() => setSelectedDay(item.val)}
              >
                <span className="date-num">{item.num}</span>
                <span className="date-day">{item.day}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Wave Chart Canvas */}
      <div className="chart-canvas-wrapper">
        {/* Y Axis Guide Labels */}
        <div className="y-axis-labels">
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
        </div>

        {/* SVG Curve Canvas */}
        <div className="svg-canvas-box">
          <svg
            viewBox="0 0 750 160"
            className="telemetry-svg"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="purpleGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#7c3aed" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
              </linearGradient>

              <filter id="neonPurpleGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#8b5cf6" floodOpacity="0.8" />
              </filter>
            </defs>

            {/* Horizontal Grid lines */}
            <line x1="0" y1="20" x2="750" y2="20" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            <line x1="0" y1="60" x2="750" y2="60" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            <line x1="0" y1="100" x2="750" y2="100" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            <line x1="0" y1="140" x2="750" y2="140" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

            {/* Purple Area Fill */}
            <path d={purpleAreaPath} fill="url(#purpleGlow)" />

            {/* Dashed Yellow Line (Memory threshold / baseline) */}
            <path
              d={yellowLinePath}
              fill="none"
              stroke="#facc15"
              strokeWidth="2"
              strokeDasharray="5,6"
              strokeLinecap="round"
              opacity="0.9"
            />

            {/* Main Purple Wave Line */}
            <path
              d={purpleLinePath}
              fill="none"
              stroke="#9333ea"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#neonPurpleGlow)"
            />

            {/* Interactive Points on Purple Wave */}
            {purplePoints.map((pt, idx) => (
              <circle
                key={idx}
                cx={pt.x}
                cy={pt.y}
                r={hoveredPoint === idx ? 5 : 2.5}
                fill={hoveredPoint === idx ? '#ffffff' : '#a855f7'}
                stroke="#6b21a8"
                strokeWidth="2"
                className="interactive-dot"
                onMouseEnter={() => setHoveredPoint(idx)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            ))}
          </svg>

          {/* Tooltip on hover */}
          {hoveredPoint !== null && (
            <div
              className="chart-tooltip"
              style={{
                left: `${(purplePoints[hoveredPoint].x / 750) * 100}%`,
                top: `${purplePoints[hoveredPoint].y - 35}px`
              }}
            >
              <div className="tooltip-title">{purplePoints[hoveredPoint].label}</div>
              <div className="tooltip-item cpu">CPU Load: {purplePoints[hoveredPoint].cpu}%</div>
              <div className="tooltip-item mem">RAM Allocation: {purplePoints[hoveredPoint].mem}%</div>
            </div>
          )}
        </div>
      </div>

      {/* Time Axis Labels */}
      <div className="time-axis-labels">
        {timeLabels.map((lbl, idx) => (
          <span key={idx}>{lbl}</span>
        ))}
      </div>
    </div>
  );
}

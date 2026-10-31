import React from 'react';

export default function Sparkline({
  data = [],
  color = '#38bdf8',
  fillGradientId = 'sparklineGrad',
  height = 42,
  min = 0,
  max = 100
}) {
  if (!data || data.length < 2) {
    return <div style={{ height }} />;
  }

  const width = 220;
  const paddingY = 4;
  const usableHeight = height - paddingY * 2;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const clampedVal = Math.max(min, Math.min(max, val));
    const y = height - paddingY - ((clampedVal - min) / (max - min)) * usableHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polylinePoints = points.join(' ');
  const areaPoints = `0,${height} ${polylinePoints} ${width},${height}`;

  const lastPoint = points[points.length - 1].split(',');
  const lastX = parseFloat(lastPoint[0]);
  const lastY = parseFloat(lastPoint[1]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="sparkline-svg"
      preserveAspectRatio="none"
      style={{ width: '100%', height: `${height}px` }}
    >
      <defs>
        <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Gradient Fill Area */}
      <polygon points={areaPoints} fill={`url(#${fillGradientId})`} />

      {/* Trend Line */}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylinePoints}
      />

      {/* Live Head Pulse Dot */}
      <circle cx={lastX} cy={lastY} r="3" fill={color} />
      <circle cx={lastX} cy={lastY} r="5" fill={color} opacity="0.4" className="pulse-circle" />
    </svg>
  );
}


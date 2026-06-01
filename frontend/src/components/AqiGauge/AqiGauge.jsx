const AQI_ZONES = [
  { max: 50,  color: "#2f9e44", label: "Good" },
  { max: 100, color: "#e67700", label: "Moderate" },
  { max: 150, color: "#e8590c", label: "Sensitive" },
  { max: 200, color: "#e03131", label: "Unhealthy" },
  { max: 300, color: "#862e9c", label: "Very Unhealthy" },
  { max: 500, color: "#7f1d1d", label: "Hazardous" },
];

function getZoneColor(value) {
  for (const zone of AQI_ZONES) {
    if (value <= zone.max) return zone.color;
  }
  return "#7f1d1d";
}

export default function AQIGauge({ value }) {
  const safeValue = Math.min(Math.max(Number(value) || 0, 0), 500);
  const color = getZoneColor(safeValue);

  // Arc math — 180° semicircle
  const R = 70;
  const cx = 100;
  const cy = 95;
  const startAngle = -180;
  const endAngle = 0;
  const totalRange = 500;

  const toRad = (deg) => (deg * Math.PI) / 180;

  const describeArc = (startDeg, endDeg) => {
    const start = {
      x: cx + R * Math.cos(toRad(startDeg)),
      y: cy + R * Math.sin(toRad(startDeg)),
    };
    const end = {
      x: cx + R * Math.cos(toRad(endDeg)),
      y: cy + R * Math.sin(toRad(endDeg)),
    };
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  // Needle angle: -180 (left) to 0 (right)
  const needleAngle = startAngle + (safeValue / totalRange) * 180;
  const needleLen = 56;
  const needleX = cx + needleLen * Math.cos(toRad(needleAngle));
  const needleY = cy + needleLen * Math.sin(toRad(needleAngle));

  // Build zone arcs
  let prevAngle = -180;
  const zoneArcs = AQI_ZONES.map((zone) => {
    const zoneEndAngle = startAngle + (zone.max / totalRange) * 180;
    const path = describeArc(prevAngle, zoneEndAngle);
    prevAngle = zoneEndAngle;
    return { path, color: zone.color };
  });

  // Value arc (filled progress)
  const valueArc = describeArc(-180, needleAngle);

  return (
    <div className="aqi-gauge-wrapper">
      <svg viewBox="0 0 200 105" className="aqi-gauge-svg" aria-label={`AQI gauge showing ${safeValue}`}>
        {/* Zone track arcs (background) */}
        {zoneArcs.map((z, i) => (
          <path
            key={i}
            d={z.path}
            fill="none"
            stroke={z.color}
            strokeWidth="12"
            strokeLinecap="butt"
            opacity="0.18"
          />
        ))}

        {/* Active filled arc */}
        <path
          d={valueArc}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
        />

        {/* Zone tick marks */}
        {[50, 100, 150, 200, 300].map((tick) => {
          const angle = toRad(-180 + (tick / 500) * 180);
          const inner = R - 8;
          const outer = R + 2;
          return (
            <line
              key={tick}
              x1={cx + inner * Math.cos(angle)}
              y1={cy + inner * Math.sin(angle)}
              x2={cx + outer * Math.cos(angle)}
              y2={cy + outer * Math.sin(angle)}
              stroke="var(--border-strong)"
              strokeWidth="1.5"
            />
          );
        })}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 1px 3px ${color}99)` }}
        />
        <circle cx={cx} cy={cy} r="5" fill={color} />
        <circle cx={cx} cy={cy} r="2.5" fill="var(--card-bg)" />

        {/* Min / Max labels */}
        <text x="22" y="100" fontSize="9" fill="var(--muted)" textAnchor="middle" fontFamily="var(--font-mono)">0</text>
        <text x="178" y="100" fontSize="9" fill="var(--muted)" textAnchor="middle" fontFamily="var(--font-mono)">500</text>
      </svg>

      {/* Value display */}
      <div className="aqi-gauge-value" style={{ color }}>
        {safeValue}
      </div>
      <div className="aqi-gauge-label">AQI</div>

      {/* Zone legend */}
      <div className="aqi-gauge-legend">
        {AQI_ZONES.map((z) => (
          <div key={z.label} className="aqi-gauge-legend-item">
            <span className="aqi-gauge-legend-dot" style={{ background: z.color }} />
            <span>{z.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
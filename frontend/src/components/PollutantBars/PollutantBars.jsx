const WHO_LIMITS = {
  pm25: { limit: 15,   unit: "µg/m³", label: "PM2.5", fullName: "Fine Particles" },
  pm10: { limit: 45,   unit: "µg/m³", label: "PM10",  fullName: "Coarse Particles" },
  no2:  { limit: 25,   unit: "µg/m³", label: "NO₂",   fullName: "Nitrogen Dioxide" },
  so2:  { limit: 40,   unit: "µg/m³", label: "SO₂",   fullName: "Sulfur Dioxide" },
  o3:   { limit: 100,  unit: "µg/m³", label: "O₃",    fullName: "Ozone" },
  co:   { limit: 4,    unit: "mg/m³", label: "CO",    fullName: "Carbon Monoxide" },
};

function getBarColor(pct) {
  if (pct <= 50)  return "#2f9e44"; // safe
  if (pct <= 80)  return "#e67700"; // caution
  if (pct <= 100) return "#e03131"; // at limit
  return "#7f1d1d";                 // exceeded
}

function getBarStatus(pct) {
  if (pct <= 50)  return { label: "Safe",     color: "#2f9e44" };
  if (pct <= 80)  return { label: "Caution",  color: "#e67700" };
  if (pct <= 100) return { label: "At limit", color: "#e03131" };
  return { label: "Exceeded", color: "#7f1d1d" };
}

function PollutantBar({ pollutantKey, value }) {
  const meta = WHO_LIMITS[pollutantKey];
  if (!meta || value == null || value === "—") return null;

  const numVal = parseFloat(value);
  if (isNaN(numVal)) return null;

  const pct = Math.min((numVal / meta.limit) * 100, 130); // cap visual at 130%
  const displayPct = Math.round((numVal / meta.limit) * 100);
  const color = getBarColor(displayPct);
  const status = getBarStatus(displayPct);

  return (
    <div className="pollutant-bar-row">
      <div className="pollutant-bar-header">
        <div className="pollutant-bar-name">
          <strong>{meta.label}</strong>
          <span>{meta.fullName}</span>
        </div>
        <div className="pollutant-bar-values">
          <span className="pollutant-bar-current" style={{ color }}>
            {numVal} {meta.unit}
          </span>
          <span
            className="pollutant-bar-status"
            style={{ color: status.color, background: `${status.color}18`, border: `1px solid ${status.color}33` }}
          >
            {status.label}
          </span>
        </div>
      </div>

      <div className="pollutant-bar-track">
        <div
          className="pollutant-bar-fill"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: `linear-gradient(90deg, ${color}cc, ${color})`,
            boxShadow: `0 0 8px ${color}44`,
          }}
        />
        {/* WHO limit marker */}
        <div className="pollutant-bar-limit-marker" title={`WHO limit: ${meta.limit} ${meta.unit}`} />
      </div>

      <div className="pollutant-bar-footer">
        <span>{displayPct}% of WHO limit</span>
        <span>WHO: {meta.limit} {meta.unit}</span>
      </div>
    </div>
  );
}

export default function PollutantBars({ pollutants }) {
  if (!pollutants) return null;

  return (
    <div className="pollutant-bars-wrapper">
      <div className="pollutant-bars-title">
        <strong>Pollutant levels vs WHO guidelines</strong>
        <span>24-hour WHO safe limits</span>
      </div>
      <div className="pollutant-bars-list">
        {Object.keys(WHO_LIMITS).map((key) => (
          <PollutantBar key={key} pollutantKey={key} value={pollutants[key]} />
        ))}
      </div>
    </div>
  );
}
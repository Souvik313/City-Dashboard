const FILTERS = [
  { key: "all",      label: "All",       icon: "🚨" },
  { key: "hospitals",label: "Hospitals", icon: "🏥" },
  { key: "police",   label: "Police",    icon: "🚔" },
  { key: "fire",     label: "Fire",      icon: "🚒" },
  { key: "pharmacy", label: "Pharmacy",  icon: "💊" },
];

export default function EmergencyFilterBar({
  activeFilter,
  onFilterChange,
  counts = {}
}) {
  return (
    <div className="emergency-filter-bar">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          className={`emergency-filter-btn ${activeFilter === f.key ? "active" : ""}`}
          onClick={() => onFilterChange(f.key)}
        >
          <span className="emergency-filter-icon">{f.icon}</span>
          <span className="emergency-filter-label">{f.label}</span>
          {counts[f.key] != null && (
            <span className="emergency-filter-count">
              {counts[f.key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
import {useState} from 'react';

const typeIcon = {
  bus:       "🚌",
  metro:     "🚇",
  rail:      "🚆",
  tram:      "🚊",
  ferry:     "⛴️",
  trolleybus:"🚎",
  monorail:  "🚝",
};

const inferTypeFromRouteName = (routeName) => {
  if (!routeName) return "bus";
  const name = routeName.toUpperCase();
  if (name.includes("METRO") || name.includes("DMRC")) return "metro";
  if (name.includes("RRTS") || name.includes("RAIL") || name.includes("RAILWAY")) return "rail";
  if (name.includes("TRAM")) return "tram";
  if (name.includes("FERRY")) return "ferry";
  return "bus";
};

const getStopDominantType = (stop) => {
  if (!stop.routes?.length) return "bus";
  const types = stop.routes.map(inferTypeFromRouteName);
  // Pick the "most significant" type present
  const priority = ["metro", "rail", "tram", "ferry", "trolleybus", "bus"];
  for (const p of priority) {
    if (types.includes(p)) return p;
  }
  return "bus";
};

export default function NearbyStopsList({ stops = [] }) {
  const [activeFilter, setActiveFilter] = useState("all");

  if (!stops.length) {
    return (
      <div className="transit-empty">
        No nearby stops found.
      </div>
    );
  }

  // Tag each stop with its dominant type
  const taggedStops = stops.map((stop) => ({
    ...stop,
    dominantType: getStopDominantType(stop),
  }));

  // Build filter tabs from types that actually exist
  const typesInData = [...new Set(taggedStops.map((s) => s.dominantType))];

  const filters = [
    { key: "all", label: "All Stops", count: stops.length },
    ...typesInData.map((type) => ({
      key: type,
      label: `${typeIcon[type] || "🚌"} ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      count: taggedStops.filter((s) => s.dominantType === type).length,
    })),
  ];

  const filteredStops =
    activeFilter === "all"
      ? taggedStops
      : taggedStops.filter((s) => s.dominantType === activeFilter);

  return (
    <div className="transit-section">
      <div className="section-header">
        <h4>Nearby Stops</h4>
        <span>{filteredStops.length} of {stops.length} stops</span>
      </div>

      {/* Filter tab bar — reuses same CSS as routes filter */}
      <div className="transit-filter-bar">
        {filters.map((f) => (
          <button
            key={f.key}
            className={`transit-filter-btn ${activeFilter === f.key ? "active" : ""}`}
            onClick={() => setActiveFilter(f.key)}
          >
            {f.label}
            <span className="transit-filter-count">{f.count}</span>
          </button>
        ))}
      </div>

      {filteredStops.length === 0 ? (
        <div className="transit-empty">
          No {activeFilter} stops found nearby.
        </div>
      ) : (
        <div className="stops-grid">
          {filteredStops.map((stop) => (
            <div key={stop.stopId} className="stop-card">
              <div className="stop-card-header">
                <h5>{stop.stopName}</h5>
                <span className="stop-type-badge">
                  {typeIcon[stop.dominantType] || "🚌"}
                </span>
              </div>

              {stop.distance != null && (
                <span>Distance: {stop.distance} km</span>
              )}

              <div className="stop-routes">
                {(stop.routes || []).map((route) => (
                  <span key={route} className="route-chip">
                    {route}
                  </span>
                ))}
              </div>

              {stop.accessibility?.wheelchair && (
                <div className="stop-accessibility">
                  ♿ Accessible
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
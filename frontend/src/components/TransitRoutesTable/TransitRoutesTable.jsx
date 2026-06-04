import {useState} from 'react';

const typeIcon = {
  bus:       "🚌",
  metro:     "🚇",
  rail:      "🚆",
  tram:      "🚊",
  ferry:     "⛴️",
  trolleybus:"🚎",
  monorail:  "🚝",
  aerial:    "🚡",
};

export default function TransitRoutesTable({ routes = [] }) {
  const [activeFilter, setActiveFilter] = useState("all");

  if (!routes.length) {
    return (
      <div className="transit-empty">
        No active routes available.
      </div>
    );
  }

  const typesInData = [...new Set(routes.map((r) => r.type).filter(Boolean))];

  const filters = [
    { key: "all", label: "All Routes", count: routes.length },
    ...typesInData.map((type) => ({
      key: type,
      label: `${typeIcon[type] || "🚌"} ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      count: routes.filter((r) => r.type === type).length,
    })),
  ];

  const filteredRoutes =
    activeFilter === "all"
      ? routes
      : routes.filter((r) => r.type === activeFilter);

  return (
    <div className="transit-section">
      <div className="section-header">
        <h4>Active Routes</h4>
        <span>{filteredRoutes.length} of {routes.length} routes</span>
      </div>

      {/* Filter tab bar */}
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

      {filteredRoutes.length === 0 ? (
        <div className="transit-empty">
          No {activeFilter} routes found.
        </div>
      ) : (
        <div className="transit-routes-table">
          <div className="table-head">
            <span>Route</span>
            <span>Status</span>
            <span>Delay</span>
            <span>Crowding</span>
          </div>

          {filteredRoutes.map((route) => (
            <div key={route.routeId} className="table-row">
              <div>
                <strong>
                  {typeIcon[route.type] || "🚌"} {route.routeName}
                </strong>
                <small>{route.typeLabel || route.operator}</small>
              </div>

              <span className={`status-pill ${normalizeStatus(route.status)}`}>
                {route.status}
              </span>

              <span>{route.averageDelay ?? "—"} min</span>

              <span className={`crowd-pill ${route.crowdLevel}`}>
                {route.crowdLevel}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const normalizeStatus = (status) => {
  const s = status?.toLowerCase();
  if (s === "operational" || s === "on time" || s === "running") return "on-time";
  if (s === "delayed") return "delayed";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  return "on-time";
};
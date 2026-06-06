import { useState, useEffect } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000";

const typeIcon = {
  bus:       "🚌",
  metro:     "🚇",
  rail:      "🚆",
  tram:      "🚊",
  ferry:     "⛴️",
  trolleybus:"🚎",
  monorail:  "🚝",
};

const normalizeStatus = (status) => {
  const s = status?.toLowerCase();
  if (s === "operational" || s === "on time" || s === "running") return "on-time";
  if (s === "delayed") return "delayed";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  return "on-time";
};

export default function NearbyRoutesList({
  routes = [],
  userLocation = null
}) {
  const [activeFilter, setActiveFilter]       = useState("all");
  const [viewMode, setViewMode]               = useState("city");
  const [liveRoutes, setLiveRoutes]           = useState([]);
  const [liveLoading, setLiveLoading]         = useState(false);
  const [liveError, setLiveError]             = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError]     = useState(null);

  // ── fetch live routes when userLocation available and nearme mode active ──
  useEffect(() => {
    if (!userLocation || viewMode !== "nearme") return;

    const fetchLiveRoutes = async () => {
      setLiveLoading(true);
      setLiveError(null);

      try {
        const res = await axios.get(`${API_URL}/api/v1/nearby/routes`, {
          params: {
            lat: userLocation.lat,
            lon: userLocation.lon
          }
        });
        setLiveRoutes(res.data?.data || []);
      } catch (err) {
        setLiveError("Failed to fetch routes near your location.");
        console.error("Live routes fetch error:", err.message);
      } finally {
        setLiveLoading(false);
      }
    };

    fetchLiveRoutes();
  }, [userLocation, viewMode]);

  // ── request location and switch to nearme mode ──
  const handleNearMe = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }

    if (userLocation) {
      setViewMode("nearme");
      setActiveFilter("all");
      return;
    }

    setLocationLoading(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      () => {
        setViewMode("nearme");
        setActiveFilter("all");
        setLocationLoading(false);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setLocationError("Location access denied.");
            break;
          case err.POSITION_UNAVAILABLE:
            setLocationError("Location unavailable. Try again.");
            break;
          case err.TIMEOUT:
            setLocationError("Location request timed out.");
            break;
          default:
            setLocationError("Failed to get your location.");
        }
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleCityMode = () => {
    setViewMode("city");
    setActiveFilter("all");
    setLiveRoutes([]);
    setLiveError(null);
  };

  // ── decide which routes to show ──
  const activeRoutes = viewMode === "nearme" && liveRoutes.length > 0
    ? liveRoutes
    : routes;

  // ── build filter tabs ──
  const typesInData = [...new Set(activeRoutes.map((r) => r.type).filter(Boolean))];

  const filters = [
    { key: "all", label: "All Routes", count: activeRoutes.length },
    ...typesInData.map((type) => ({
      key: type,
      label: `${typeIcon[type] || "🚌"} ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      count: activeRoutes.filter((r) => r.type === type).length,
    })),
  ];

  const filteredRoutes = activeFilter === "all"
    ? activeRoutes
    : activeRoutes.filter((r) => r.type === activeFilter);

  // ── empty state ──
  if (viewMode === "city" && !routes.length) {
    return (
      <div className="transit-section">
        <div className="section-header">
          <h4>Active Routes</h4>
        </div>
        <div className="transit-nearme-bar">
          <button
            className="transit-nearme-btn"
            onClick={handleNearMe}
            disabled={locationLoading}
          >
            {locationLoading ? "Getting location…" : "📍 Find routes near me"}
          </button>
        </div>
        {locationError && <div className="error">{locationError}</div>}
        <div className="transit-empty">No routes available.</div>
      </div>
    );
  }

  return (
    <div className="transit-section">

      {/* ── section header ── */}
      <div className="section-header">
        <h4>Active Routes</h4>
        <span>
          {filteredRoutes.length} of {activeRoutes.length} routes
          {viewMode === "nearme" && (
            <span className="nearme-badge">📍 Near you</span>
          )}
        </span>
      </div>

      {/* ── view mode toggle ── */}
      <div className="transit-nearme-bar">
        <button
          className={`transit-nearme-btn ${viewMode === "city" ? "active" : ""}`}
          onClick={handleCityMode}
        >
          🏙️ City routes
        </button>
        <button
          className={`transit-nearme-btn ${viewMode === "nearme" ? "active" : ""}`}
          onClick={handleNearMe}
          disabled={locationLoading}
        >
          {locationLoading ? "Getting location…" : "📍 Near me"}
        </button>
      </div>

      {/* ── location error ── */}
      {locationError && (
        <div className="error">{locationError}</div>
      )}

      {/* ── loading skeleton ── */}
      {liveLoading && (
        <div className="transit-routes-skeleton">
          <div className="transit-skeleton-header">
            <div className="skeleton" style={{width: '160px', height: '14px'}}/>
            <div className="skeleton" style={{width: '80px', height: '14px'}}/>
          </div>
          <div className="transit-routes-table">
            <div className="table-head">
              <span>Route</span>
              <span>Status</span>
              <span>Delay</span>
              <span>Crowding</span>
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="table-row table-row-skeleton">
                <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
                  <div className="skeleton" style={{width:'70%', height:'13px'}}/>
                  <div className="skeleton" style={{width:'50%', height:'11px'}}/>
                </div>
                <div className="skeleton" style={{width:'72px', height:'22px', borderRadius:'999px'}}/>
                <div className="skeleton" style={{width:'48px', height:'13px'}}/>
                <div className="skeleton" style={{width:'64px', height:'22px', borderRadius:'999px'}}/>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── live error ── */}
      {liveError && !liveLoading && (
        <div className="transit-nearme-error">
          <span>{liveError}</span>
          <button
            className="transit-nearme-btn"
            onClick={() => {
              setLiveError(null);
              setViewMode("nearme");
            }}
          >
            ↺ Retry
          </button>
        </div>
      )}

      {/* ── nearme mode no results ── */}
      {viewMode === "nearme" && !liveLoading &&
       liveRoutes.length === 0 && !liveError && (
        <div className="transit-empty">
          {userLocation
            ? "No routes found near your location."
            : "Allow location access to see routes near you."
          }
        </div>
      )}

      {/* ── filter bar + table ── */}
      {filteredRoutes.length > 0 && !liveLoading && (
        <>
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
              No {activeFilter} routes found nearby.
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
        </>
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';
import axios from 'axios';
import useUserLocation from "../../hooks/useUserLocation.js";

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
  const priority = ["metro", "rail", "tram", "ferry", "trolleybus", "bus"];
  for (const p of priority) {
    if (types.includes(p)) return p;
  }
  return "bus";
};

export default function NearbyStopsList({ stops = [], userLocation = null }) {
  const [activeFilter, setActiveFilter]   = useState("all");
  const [viewMode, setViewMode]           = useState("city");   // "city" | "nearme"
  const [liveStops, setLiveStops]         = useState([]);
  const [liveLoading, setLiveLoading]     = useState(false);
  const [liveError, setLiveError]         = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);

  const {openDirections} = useUserLocation();

  // ── fetch live stops whenever userLocation is set and nearme mode is active ──
  useEffect(() => {
    if (!userLocation || viewMode !== "nearme") return;

    const fetchLiveStops = async () => {
      setLiveLoading(true);
      setLiveError(null);

      try {
        const res = await axios.get(`${API_URL}/api/v1/nearby/transit`, {
          params: {
            lat: userLocation.lat,
            lon: userLocation.lon
          }
        });
        setLiveStops(res.data?.data || []);
      } catch (err) {
        setLiveError("Failed to fetch stops near your location.");
        console.error("Live stops fetch error:", err.message);
      } finally {
        setLiveLoading(false);
      }
    };

    fetchLiveStops();
  }, [userLocation, viewMode]);

  // ── request location and switch to nearme mode ──
  const handleNearMe = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }

    // If location already available just switch mode
    if (userLocation) {
      setViewMode("nearme");
      setActiveFilter("all");
      return;
    }

    setLocationLoading(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      () => {
        // location handled by parent via useUserLocation hook
        setViewMode("nearme");
        setActiveFilter("all");
        setLocationLoading(false);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setLocationError("Location access denied. Please allow location in your browser.");
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
    setLiveStops([]);
    setLiveError(null);
  };

  // ── decide which stops to show based on view mode ──
  const activeStops = viewMode === "nearme" && liveStops.length > 0
    ? liveStops
    : stops;

  // ── tag stops with dominant type ──
  const taggedStops = activeStops.map((stop) => ({
    ...stop,
    dominantType: getStopDominantType(stop),
  }));

  // ── build filter tabs ──
  const typesInData = [...new Set(taggedStops.map((s) => s.dominantType))];

  const filters = [
    { key: "all", label: "All Stops", count: taggedStops.length },
    ...typesInData.map((type) => ({
      key: type,
      label: `${typeIcon[type] || "🚌"} ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      count: taggedStops.filter((s) => s.dominantType === type).length,
    })),
  ];

  const filteredStops = activeFilter === "all"
    ? taggedStops
    : taggedStops.filter((s) => s.dominantType === activeFilter);

  // ── empty state (city mode with no stored stops) ──
  if (viewMode === "city" && !stops.length) {
    return (
      <div className="transit-section">
        <div className="section-header">
          <h4>Nearby Stops</h4>
        </div>
        <div className="transit-nearme-bar">
          <button
            className="transit-nearme-btn"
            onClick={handleNearMe}
            disabled={locationLoading}
          >
            {locationLoading ? "Getting location…" : "📍 Find stops near me"}
          </button>
        </div>
        {locationError && <div className="error">{locationError}</div>}
        <div className="transit-empty">No nearby stops found.</div>
      </div>
    );
  }

  return (
    <div className="transit-section">

      {/* ── section header ── */}
      <div className="section-header">
        <h4>Nearby Stops</h4>
        <span>
          {filteredStops.length} of {taggedStops.length} stops
          {viewMode === "nearme" && (
            <span className="nearme-badge">📍 Near you</span>
          )}
        </span>
      </div>

      {/* ── view mode toggle + near me button ── */}
      <div className="transit-nearme-bar">
        <button
          className={`transit-nearme-btn ${viewMode === "city" ? "active" : ""}`}
          onClick={handleCityMode}
        >
          🏙️ City stops
        </button>

        <button
          className={`transit-nearme-btn ${viewMode === "nearme" ? "active" : ""}`}
          onClick={handleNearMe}
          disabled={locationLoading}
        >
          {locationLoading
            ? "Getting location…"
            : "📍 Near me"
          }
        </button>
      </div>

      {/* ── location error ── */}
      {locationError && (
        <div className="error">{locationError}</div>
      )}

      {/* ── live loading state ── */}
      {liveLoading && (
        <div className="transit-stops-skeleton">
          <div className="transit-skeleton-header">
            <div className="skeleton" style={{width: '140px', height: '14px'}}/>
            <div className="skeleton" style={{width: '80px', height: '14px'}}/>
          </div>
          <div className="stops-grid">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="stop-card stop-card-skeleton">
                <div className="skeleton" style={{width: '70%', height: '14px'}}/>
                <div className="skeleton" style={{width: '45%', height: '12px'}}/>
                <div className="stop-routes">
                  <div className="skeleton" style={{width: '48px', height: '22px', borderRadius: '999px'}}/>
                  <div className="skeleton" style={{width: '48px', height: '22px', borderRadius: '999px'}}/>
                </div>
                <div className="skeleton" style={{width: '60%', height: '12px'}}/>
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
                setViewMode("nearme"); // re-triggers the useEffect
              }}
            >
              ↺ Retry
            </button>
          </div>
        )}

      {/* ── nearme mode with no results yet ── */}
      {viewMode === "nearme" && !liveLoading && liveStops.length === 0 && !liveError && (
        <div className="transit-empty">
          {userLocation
            ? "No stops found near your location."
            : "Allow location access to see stops near you."
          }
        </div>
      )}

      {/* ── filter bar — only show when we have stops to filter ── */}
      {filteredStops.length > 0 && !liveLoading && (
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
                    <span>
                      {viewMode === "nearme" ? "📍 " : ""}
                      {stop.distance} km away
                    </span>
                  )}

                  <div className="stop-routes">
  {(stop.routes || []).map((route) => (
    <span key={route} className="route-chip">
      {route}
    </span>
  ))}
</div>

<div className="stop-actions">
  <button
    className="directions-btn"
    onClick={() =>
    {
      openDirections(
        stop.latitude || stop.lat,
        stop.longitude || stop.lon,
        stop.stopName
      )
    }}
  >
    {"🧭 Directions"}
  </button>
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
        </>
      )}
    </div>
  );
}
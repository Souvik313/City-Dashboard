import { useState, useEffect } from "react";
import axios from "axios";
import useUserLocation from "../../hooks/useUserLocation.js";
import EmergencyPlaceCard from "./EmergencyPlaceCard.jsx";
import EmergencyFilterBar from "./EmergencyFilterBar.jsx";
import "./EmergencyMode.css";

const API_URL = "http://localhost:5000";

const SOS_NUMBERS = [
  { label: "Police",    number: "100", icon: "🚔" },
  { label: "Ambulance", number: "108", icon: "🚑" },
  { label: "Fire",      number: "101", icon: "🚒" },
  { label: "Emergency", number: "112", icon: "🆘" },
];

const TYPE_MAP = {
  all:       null,   // null means show everything
  hospitals: ["hospital", "clinic", "doctors"],
  police:    ["police"],
  fire:      ["fire_station"],
  pharmacy:  ["pharmacy"],
};

export default function EmergencyMode({ onExit }) {
  const [activeFilter, setActiveFilter] = useState("all");
    const [allPlaces, setAllPlaces] = useState([]);  // all fetched once
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState(null);
    const [hasFetched, setHasFetched] = useState(false);

  // ── useUserLocation hook ──────────────────────────────────────────────────
  const {
    userLocation,           // { lat, lon, accuracy } — null until granted
    error: locationError,
    loading: locationLoading,
    requestLocation
  } = useUserLocation();

  // ── auto-fetch places when location becomes available ────────────────────
  useEffect(() => {
    if (!userLocation || hasFetched) return;
    fetchAllPlaces();
  }, [userLocation]);

  useEffect(() => {
  if (!userLocation || hasFetched) return;

  // wait 1.5s before firing — avoids collision with transit Overpass calls
  const timer = setTimeout(fetchAllPlaces, 1500);
  return () => clearTimeout(timer);
}, [userLocation]);

  // ── fetch places from backend ─────────────────────────────────────────────
  const fetchAllPlaces = async () => {
  setLoading(true);
  setError(null);

    try {
    const res = await axios.get(`${API_URL}/api/v1/nearby/emergency`, {
      params: {
        lat: userLocation.lat,
        lon: userLocation.lon,
        type: "all"           // always fetch all — filter client-side
      }
    });
    setAllPlaces(res.data?.data || []);
    setHasFetched(true);
  } catch (err) {
    setError("Failed to fetch nearby emergency places. Please try again.");
    console.error("Emergency places fetch error:", err.message);
  } finally {
    setLoading(false);
  }
  };

  // ── handle filter change ──────────────────────────────────────────────────
   const handleFilterChange = (type) => {
    setActiveFilter(type);
    // no fetchPlaces call here — filtering is now client-side
  };

  const places = activeFilter === "all"
  ? allPlaces
  : allPlaces.filter((p) =>
      TYPE_MAP[activeFilter]?.includes(p.type)
    );

  // ── build counts for filter bar badges ───────────────────────────────────
  const counts = {
    all:       allPlaces.length,
    hospitals: allPlaces.filter(p =>
        ["hospital", "clinic", "doctors"].includes(p.type)).length,
    police:    allPlaces.filter(p => p.type === "police").length,
    fire:      allPlaces.filter(p => p.type === "fire_station").length,
    pharmacy:  allPlaces.filter(p => p.type === "pharmacy").length,
};

  // ── skeleton cards ────────────────────────────────────────────────────────
  const renderSkeleton = () => (
    <div className="emergency-grid">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="emergency-place-card emergency-card-skeleton">
          <div className="emergency-place-header">
            <div className="skeleton" style={{width:'44px', height:'44px', borderRadius:'12px'}}/>
            <div style={{flex:1, display:'flex', flexDirection:'column', gap:'6px'}}>
              <div className="skeleton" style={{width:'70%', height:'14px'}}/>
              <div className="skeleton" style={{width:'40%', height:'12px'}}/>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'4px', alignItems:'flex-end'}}>
              <div className="skeleton" style={{width:'36px', height:'16px'}}/>
              <div className="skeleton" style={{width:'24px', height:'12px'}}/>
            </div>
          </div>
          <div className="skeleton" style={{width:'80%', height:'12px'}}/>
          <div style={{display:'flex', gap:'8px', marginTop:'4px'}}>
            <div className="skeleton" style={{flex:1, height:'36px', borderRadius:'8px'}}/>
            <div className="skeleton" style={{flex:1, height:'36px', borderRadius:'8px'}}/>
          </div>
        </div>
      ))}
    </div>
  );

  // ── PHASE 1: location not yet granted ─────────────────────────────────────
  if (!userLocation && !locationLoading) {
    return (
      <div className="emergency-mode">
        <div className="emergency-header">
          <div className="emergency-title-row">
            <span className="emergency-badge-icon">🚨</span>
            <h2>Emergency Mode</h2>
          </div>
          <button className="emergency-exit-btn" onClick={onExit}>
            ✕ Exit Emergency
          </button>
        </div>

        {/* SOS numbers always visible — no location needed */}
        <div className="sos-grid">
          {SOS_NUMBERS.map((s) => (
            <a
              key={s.label}
              href={`tel:${s.number}`}
              className="sos-card"
            >
              <span className="sos-icon">{s.icon}</span>
              <strong>{s.number}</strong>
              <span>{s.label}</span>
            </a>
          ))}
        </div>

        <div className="emergency-location-prompt">
          <div className="emergency-location-icon">📍</div>
          <h3>Enable location to find nearby help</h3>
          <p>
            CityPulse needs your location to show the nearest
            hospitals, police stations, fire stations and pharmacies.
          </p>
          <button
            className="emergency-location-btn"
            onClick={requestLocation}
          >
            Share my location
          </button>
          {locationError && (
            <div className="emergency-location-error">
              {locationError}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── PHASE 2: location loading ─────────────────────────────────────────────
  if (locationLoading) {
    return (
      <div className="emergency-mode">
        <div className="emergency-header">
          <div className="emergency-title-row">
            <span className="emergency-badge-icon">🚨</span>
            <h2>Emergency Mode</h2>
          </div>
          <button className="emergency-exit-btn" onClick={onExit}>
            ✕ Exit Emergency
          </button>
        </div>
        <div className="sos-grid">
          {SOS_NUMBERS.map((s) => (
            <a key={s.label} href={`tel:${s.number}`} className="sos-card">
              <span className="sos-icon">{s.icon}</span>
              <strong>{s.number}</strong>
              <span>{s.label}</span>
            </a>
          ))}
        </div>
        <div className="emergency-locating">
          <div className="emergency-pulse-dot"/>
          <p>Getting your location…</p>
        </div>
      </div>
    );
  }

  // ── PHASE 3: location available — main emergency UI ───────────────────────
  return (
    <div className="emergency-mode">

      {/* ── header ── */}
      <div className="emergency-header">
        <div className="emergency-title-row">
          <span className="emergency-badge-icon">🚨</span>
          <h2>Emergency Mode</h2>
          <span className="emergency-location-tag">
            📍 {userLocation.lat.toFixed(4)}, {userLocation.lon.toFixed(4)}
          </span>
        </div>
        <button className="emergency-exit-btn" onClick={onExit}>
          ✕ Exit Emergency
        </button>
      </div>

      {/* ── SOS numbers ── */}
      <div className="sos-grid">
        {SOS_NUMBERS.map((s) => (
          <a key={s.label} href={`tel:${s.number}`} className="sos-card">
            <span className="sos-icon">{s.icon}</span>
            <strong>{s.number}</strong>
            <span>{s.label}</span>
          </a>
        ))}
      </div>

      {/* ── filter bar ── */}
      <EmergencyFilterBar
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        counts={counts}
      />

      {/* ── error ── */}
      {error && !loading && (
        <div className="emergency-error">
          <span>{error}</span>
          <button
            className="emergency-retry-btn"
            onClick={() => fetchAllPlaces()}
          >
            ↺ Retry
          </button>
        </div>
      )}

      {/* ── loading skeleton ── */}
      {loading && renderSkeleton()}

      {/* ── empty state ── */}
      {!loading && !error && hasFetched && places.length === 0 && (
        <div className="emergency-empty">
          <span>😔</span>
          <p>No {activeFilter === "all" ? "emergency places" : activeFilter} found within 3km of your location.</p>
        </div>
      )}

      {/* ── places grid ── */}
      {!loading && places.length > 0 && (
        <div className="emergency-grid">
          {places.map((place) => (
            <EmergencyPlaceCard
              key={place.id}
              place={place}
            />
          ))}
        </div>
      )}

    </div>
  );
}
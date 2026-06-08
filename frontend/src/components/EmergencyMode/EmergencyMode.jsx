import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import useUserLocation from "../../hooks/useUserLocation.js";
import EmergencyPlaceCard from "./EmergencyPlaceCard.jsx";
import EmergencyFilterBar from "./EmergencyFilterBar.jsx";
import "./EmergencyMode.css";

const API_URL = import.meta.env.VITE_APP_API_URL || "http://localhost:5000";

const SOS_NUMBERS = [
  { label: "Police",    number: "100", icon: "🚔" },
  { label: "Ambulance", number: "108", icon: "🚑" },
  { label: "Fire",      number: "101", icon: "🚒" },
  { label: "Emergency", number: "112", icon: "🆘" },
];

const TYPE_MAP = {
  all:       null,
  hospitals: ["hospital", "clinic", "doctors"],
  police:    ["police"],
  fire:      ["fire_station"],
  pharmacy:  ["pharmacy"],
};

export default function EmergencyMode({ onExit, selectedCity }) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [allPlaces, setAllPlaces]       = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [searchMode, setSearchMode]     = useState(null);

  // track which coords we last fetched for
  // prevents double-fetch when both useEffects fire
  const lastFetchedCoordsRef = useRef(null);
  const isFetchingRef        = useRef(false);

  const {
    userLocation: liveLocation,
    error: locationError,
    loading: locationLoading,
    requestLocation
  } = useUserLocation();

  // ── resolve active coordinates from current mode ──────────────────────────
  const getActiveCoords = useCallback(() => {
    if (searchMode === "live" && liveLocation) {
      return { lat: liveLocation.lat, lon: liveLocation.lon };
    }
    if (searchMode === "city" && selectedCity) {
      return {
        lat: selectedCity.latitude,
        lon: selectedCity.longitude
      };
    }
    return null;
  }, [searchMode, liveLocation, selectedCity]);

  // ── single fetch function — guards against duplicate calls ────────────────
  const fetchAllPlaces = useCallback(async (coords) => {
    if (!coords) return;
    if (isFetchingRef.current) return; // already fetching

    // skip if we already fetched these exact coordinates
    const coordKey = `${coords.lat},${coords.lon}`;
    if (lastFetchedCoordsRef.current === coordKey) return;

    isFetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await axios.get(`${API_URL}/api/v1/nearby/emergency`, {
        params: { lat: coords.lat, lon: coords.lon, type: "all" }
      });

      setAllPlaces(res.data?.data || []);
      lastFetchedCoordsRef.current = coordKey;

    } catch (err) {
      setError("Failed to fetch nearby emergency places. Please try again.");
      console.error("Emergency fetch error:", err.message);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // ── fetch when city mode is selected ─────────────────────────────────────
  // only fires once when searchMode becomes "city"
  useEffect(() => {
    if (searchMode !== "city" || !selectedCity) return;

    const coords = {
      lat: selectedCity.latitude,
      lon: selectedCity.longitude
    };

    const timer = setTimeout(() => fetchAllPlaces(coords), 500);
    return () => clearTimeout(timer);
  }, [searchMode, selectedCity]);

  // ── fetch when live location becomes available ────────────────────────────
  // only fires once when liveLocation is first set in live mode
  useEffect(() => {
    if (searchMode !== "live" || !liveLocation) return;

    const coords = { lat: liveLocation.lat, lon: liveLocation.lon };
    fetchAllPlaces(coords);
  }, [searchMode, liveLocation]);

  // ── client-side filtering — no API calls ─────────────────────────────────
  const places = activeFilter === "all"
    ? allPlaces
    : allPlaces.filter((p) => TYPE_MAP[activeFilter]?.includes(p.type));

  const counts = {
    all:       allPlaces.length,
    hospitals: allPlaces.filter(p =>
      ["hospital", "clinic", "doctors"].includes(p.type)).length,
    police:    allPlaces.filter(p => p.type === "police").length,
    fire:      allPlaces.filter(p => p.type === "fire_station").length,
    pharmacy:  allPlaces.filter(p => p.type === "pharmacy").length,
  };

  // ── mode handlers ─────────────────────────────────────────────────────────
  const handleUseLiveLocation = () => {
    if (searchMode === "live") return; // already in live mode
    lastFetchedCoordsRef.current = null; // allow fresh fetch for new coords
    setAllPlaces([]);
    setError(null);
    setActiveFilter("all");
    setSearchMode("live");
    if (!liveLocation) requestLocation();
  };

  const handleUseCityLocation = () => {
    if (searchMode === "city") return; // already in city mode
    lastFetchedCoordsRef.current = null; // allow fresh fetch for new coords
    setAllPlaces([]);
    setError(null);
    setActiveFilter("all");
    setSearchMode("city");
  };

  const handleFilterChange = (type) => {
    setActiveFilter(type); // client-side only — no fetch
  };

  const handleRetry = () => {
    lastFetchedCoordsRef.current = null; // reset so fetch runs again
    isFetchingRef.current = false;
    const coords = getActiveCoords();
    if (coords) fetchAllPlaces(coords);
  };

  // ── skeleton ──────────────────────────────────────────────────────────────
  const renderSkeleton = () => (
    <div className="emergency-grid">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="emergency-place-card emergency-card-skeleton">
          <div className="emergency-place-header">
            <div className="skeleton"
              style={{width:'44px', height:'44px', borderRadius:'12px'}}/>
            <div style={{flex:1, display:'flex',
                         flexDirection:'column', gap:'6px'}}>
              <div className="skeleton" style={{width:'70%', height:'14px'}}/>
              <div className="skeleton" style={{width:'40%', height:'12px'}}/>
            </div>
            <div style={{display:'flex', flexDirection:'column',
                         gap:'4px', alignItems:'flex-end'}}>
              <div className="skeleton" style={{width:'36px', height:'16px'}}/>
              <div className="skeleton" style={{width:'24px', height:'12px'}}/>
            </div>
          </div>
          <div className="skeleton" style={{width:'80%', height:'12px'}}/>
          <div style={{display:'flex', gap:'8px', marginTop:'4px'}}>
            <div className="skeleton"
              style={{flex:1, height:'36px', borderRadius:'8px'}}/>
            <div className="skeleton"
              style={{flex:1, height:'36px', borderRadius:'8px'}}/>
          </div>
        </div>
      ))}
    </div>
  );

  // ── PHASE 0: mode not selected yet ───────────────────────────────────────
  if (!searchMode) {
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

        <div className="emergency-mode-select">
          <h3>How would you like to search?</h3>
          <p>
            Find nearby emergency services using your live location
            or browse services in the currently loaded city.
          </p>

          <div className="emergency-mode-options">
            <button
              className="emergency-mode-option"
              onClick={handleUseLiveLocation}
              disabled={locationLoading}
            >
              <span className="emergency-mode-option-icon">📍</span>
              <div className="emergency-mode-option-text">
                <strong>Use my location</strong>
                <span>
                  Find emergency services near where you are right now
                </span>
              </div>
              {locationLoading && <div className="emergency-pulse-dot"/>}
            </button>

            <button
              className="emergency-mode-option"
              onClick={handleUseCityLocation}
              disabled={!selectedCity}
            >
              <span className="emergency-mode-option-icon">🏙️</span>
              <div className="emergency-mode-option-text">
                <strong>
                  Search in {selectedCity?.name || "current city"}
                </strong>
                <span>
                  Browse emergency services in the loaded city
                  without sharing your location
                </span>
              </div>
            </button>
          </div>

          {!selectedCity && (
            <p className="emergency-no-city-note">
              Load a city from the dashboard to use city-based search.
            </p>
          )}

          {locationError && (
            <div className="emergency-location-error">
              {locationError}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── PHASE 1: live mode — waiting for location ────────────────────────────
  if (searchMode === "live" && locationLoading) {
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

  // ── PHASE 2: live mode — location denied ─────────────────────────────────
  if (searchMode === "live" && !liveLocation && !locationLoading) {
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
        <div className="emergency-location-prompt">
          <div className="emergency-location-icon">📍</div>
          <h3>Location access needed</h3>
          <p>
            {locationError ||
              "Please allow location access to find emergency services near you."}
          </p>
          <div className="emergency-prompt-actions">
            <button
              className="emergency-location-btn"
              onClick={requestLocation}
            >
              Try again
            </button>
            <button
              className="emergency-switch-btn"
              onClick={handleUseCityLocation}
              disabled={!selectedCity}
            >
              🏙️ Search in {selectedCity?.name || "city"} instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE 3: main emergency UI ────────────────────────────────────────────
  const coordLabel = searchMode === "live" && liveLocation
    ? `📍 ${liveLocation.lat.toFixed(4)}, ${liveLocation.lon.toFixed(4)}`
    : `🏙️ ${selectedCity?.name || "City"}`;

  return (
    <div className="emergency-mode">

      <div className="emergency-header">
        <div className="emergency-title-row">
          <span className="emergency-badge-icon">🚨</span>
          <h2>Emergency Mode</h2>
          <span className="emergency-location-tag">{coordLabel}</span>
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

      <div className="emergency-mode-switcher">
        <button
          className={`emergency-mode-switch-btn
            ${searchMode === "live" ? "active" : ""}`}
          onClick={handleUseLiveLocation}
          disabled={locationLoading}
        >
          📍 My location
        </button>
        <button
          className={`emergency-mode-switch-btn
            ${searchMode === "city" ? "active" : ""}`}
          onClick={handleUseCityLocation}
          disabled={!selectedCity}
        >
          🏙️ {selectedCity?.name || "City"}
        </button>
      </div>

      <EmergencyFilterBar
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        counts={counts}
      />

      {error && !loading && (
        <div className="emergency-error">
          <span>{error}</span>
          <button className="emergency-retry-btn" onClick={handleRetry}>
            ↺ Retry
          </button>
        </div>
      )}

      {loading && renderSkeleton()}

      {!loading && !error && allPlaces.length === 0 &&
       lastFetchedCoordsRef.current && (
        <div className="emergency-empty">
          <span>😔</span>
          <p>
            No {activeFilter === "all"
              ? "emergency places"
              : activeFilter} found within 3km of{" "}
            {searchMode === "live"
              ? "your location"
              : selectedCity?.name}.
          </p>
        </div>
      )}

      {!loading && places.length > 0 && (
        <div className="emergency-grid">
          {places.map((place) => (
            <EmergencyPlaceCard key={place.id} place={place} />
          ))}
        </div>
      )}

    </div>
  );
}
import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import TravelPlaceCard from "./TravelPlaceCard.jsx";
import "./TravelSearch.css";

const API_URL = import.meta.env.VITE_APP_API_URL || "http://localhost:5000";

const CATEGORIES = [
  { key: "all",         label: "All",          icon: "✨" },
  { key: "hotels",      label: "Hotels",        icon: "🏨" },
  { key: "budget",      label: "Budget Stay",   icon: "🛏️" },
  { key: "restaurants", label: "Restaurants",   icon: "🍽️" },
  { key: "fastfood",    label: "Cafes & Fast Food", icon: "🍔" },
  { key: "attractions", label: "Attractions",   icon: "🗺️" },
];

export default function TravelSearch({ cityName }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [allPlaces, setAllPlaces]                 = useState([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState(null);

  const fetchAllPlaces = useCallback(async () => {
    if (!cityName) return;

    setLoading(true);
    setError(null);

    try {
      const res = await axios.get(`${API_URL}/api/v1/travel/search`, {
        params: { city: cityName, category: "all", radius: 5000 }
      });
      setAllPlaces(res.data?.data || []);
    } catch (err) {
      setError("Failed to fetch travel places. Please try again.");
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [cityName]);

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
  };

  // auto-fetch on first render
  useEffect(() => {
  if (!cityName) return;

  fetchAllPlaces();
}, [cityName]);

  const filteredPlaces =
  activeCategory === "all"
    ? allPlaces
    : allPlaces.filter(
        (p) => p.category === activeCategory
      );

  useEffect(() => {
    setAllPlaces([]);
  }, [cityName]);

  return (
    <div className="travel-search">

      <div className="travel-search-header">
        <h4>🗺️ Travel & Stay Guide</h4>
        <p>
          Find hotels, restaurants, and attractions in {cityName}
          for your visit.
        </p>
      </div>

      {/* ── category filter bar ── */}
      <div className="travel-filter-bar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`travel-filter-btn
              ${activeCategory === cat.key ? "active" : ""}`}
            onClick={() => handleCategoryChange(cat.key)}
            disabled={loading}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* ── loading skeleton ── */}
      {loading && (
        <div className="travel-results-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i}
              className="travel-place-card travel-card-skeleton">
              <div className="travel-place-header">
                <div className="skeleton"
                  style={{width:'44px', height:'44px',
                          borderRadius:'12px'}}/>
                <div style={{flex:1, display:'flex',
                             flexDirection:'column', gap:'6px'}}>
                  <div className="skeleton"
                    style={{width:'65%', height:'14px'}}/>
                  <div className="skeleton"
                    style={{width:'40%', height:'12px'}}/>
                </div>
                <div className="skeleton"
                  style={{width:'40px', height:'32px'}}/>
              </div>
              <div className="skeleton"
                style={{width:'80%', height:'12px'}}/>
              <div style={{display:'flex', gap:'8px'}}>
                <div className="skeleton"
                  style={{flex:1, height:'36px',
                          borderRadius:'8px'}}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── error ── */}
      {error && !loading && (
        <div className="error">{error}</div>
      )}

      {/* ── results count ── */}
      {!loading && allPlaces.length > 0 && (
        <div className="travel-results-meta">
          <span>
            <strong>{filteredPlaces.length}</strong> places found in{" "}
            {cityName}
          </span>
        </div>
      )}

      {/* ── empty ── */}
      {!loading && allPlaces.length > 0 && filteredPlaces.length === 0 && (
        <div className="travel-empty">
          <span>😔</span>
          <p>No places found for this category in {cityName}.</p>
        </div>
      )}

      {/* ── results grid ── */}
      {!loading && filteredPlaces.length > 0 && (
        <div className="travel-results-grid">
          {filteredPlaces.map((place) => (
            <TravelPlaceCard key={place.id} place={place} />
          ))}
        </div>
      )}

    </div>
  );
}
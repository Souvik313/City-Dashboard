import { useState } from "react";
import axios from "axios";
import HealthResultCard from "./HealthResultCard.jsx";
import "./HealthSearch.css";

const API_URL = import.meta.env.VITE_APP_API_URL || "http://localhost:5000";

const SUGGESTED_CONDITIONS = [
  "Heart disease", "Cancer", "Kidney failure",
  "Brain tumor", "Eye surgery", "Diabetes",
  "Mental health", "Bone fracture", "Liver disease",
  "Lung disease", "Skin disease", "Fertility"
];

export default function HealthSearch({ cityName }) {
  const [condition, setCondition] = useState("");
  const [results, setResults]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [searched, setSearched]   = useState(false);

  const handleSearch = async (searchTerm = condition) => {
    const term = searchTerm.trim();
    if (!term || !cityName) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await axios.get(`${API_URL}/api/v1/health/search`, {
        params: { city: cityName, condition: term, radius: 15000 }
      });
      setResults(res.data);
      setSearched(true);
      setCondition(term);
    } catch (err) {
      setError("Failed to search. Please try again.");
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestion = (s) => {
    setCondition(s);
    handleSearch(s);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleClear = () => {
    setResults(null);
    setSearched(false);
    setCondition("");
    setError(null);
  };

  return (
    <div className="health-search">

      {/* ── header ── */}
      <div className="health-search-header">
        <h4>🏥 Find Specialists by Health Condition</h4>
        <p>
          Enter a health condition or disease to find hospitals
          and specialists available in {cityName}.
        </p>
      </div>

      {/* ── search input ── */}
      <div className="health-search-bar">
        <input
          type="text"
          className="health-search-input"
          placeholder="e.g. heart disease, cancer, kidney failure…"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="health-search-btn"
          onClick={() => handleSearch()}
          disabled={loading || !condition.trim()}
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {/* ── suggestions — only before first search ── */}
      {!searched && (
        <div className="health-suggestions">
          <span className="health-suggestions-label">
            Common searches:
          </span>
          <div className="health-suggestions-chips">
            {SUGGESTED_CONDITIONS.map((s) => (
              <button
                key={s}
                className="health-suggestion-chip"
                onClick={() => handleSuggestion(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── loading skeleton ── */}
      {loading && (
        <div className="health-results-skeleton">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="health-result-card health-card-skeleton"
            >
              <div className="health-result-header">
                <div
                  className="skeleton"
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px"
                  }}
                />
                <div style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}>
                  <div
                    className="skeleton"
                    style={{ width: "65%", height: "14px" }}
                  />
                  <div
                    className="skeleton"
                    style={{ width: "40%", height: "12px" }}
                  />
                </div>
                <div
                  className="skeleton"
                  style={{ width: "40px", height: "32px" }}
                />
              </div>
              <div
                className="skeleton"
                style={{ width: "80%", height: "12px" }}
              />
              <div style={{ display: "flex", gap: "8px" }}>
                <div
                  className="skeleton"
                  style={{
                    flex: 1,
                    height: "36px",
                    borderRadius: "8px"
                  }}
                />
                <div
                  className="skeleton"
                  style={{
                    flex: 1,
                    height: "36px",
                    borderRadius: "8px"
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── error ── */}
      {error && !loading && (
        <div className="error">{error}</div>
      )}

      {/* ── results section ── */}
      {results && !loading && (
        <div className="health-results">

          {/* ── results meta row ── */}
          <div className="health-results-meta">
            <span>
              Showing{" "}
              <strong>{results.results?.length ?? 0}</strong> results
              for{" "}
              <strong>{results.specialtyLabel}</strong> in {cityName}
              {results.source === "groq" && (
                <span className="health-source-tag">
                  🤖 AI-assisted
                </span>
              )}
            </span>
            <button 
              className="health-refresh-btn"
              onClick={() => handleSearch(condition)}
            >
              ↺ Refresh
            </button>
            <button
              className="health-clear-btn"
              onClick={handleClear}
            >
              ✕ Clear
            </button>
          </div>

          {/* ── note (no specialty match warning) ── */}
          {results.note && (
            <div className="health-note">
              ℹ️ {results.note}
            </div>
          )}

          {/* ══ AI ADVICE PANEL ══════════════════════════════════════════
              Placed here — after meta, before hospital cards.
              Shows for both "groq" source and "overpass" source
              whenever aiAdvice is present.
          ══════════════════════════════════════════════════════════════ */}
          {results.aiAdvice && (
            <div className="health-ai-panel">

              {/* urgency indicator */}
              {results.aiAdvice.urgencyLevel && (
                <div className={`health-urgency-badge urgency-${results.aiAdvice.urgencyLevel}`}>
                  {results.aiAdvice.urgencyLevel === "emergency" ? "🚨"
                    : results.aiAdvice.urgencyLevel === "high"   ? "⚠️"
                    : results.aiAdvice.urgencyLevel === "medium" ? "🔶"
                    : "🟢"}
                  {results.aiAdvice.urgencyNote}
                </div>
              )}

              {/* specialty advice */}
              {results.aiAdvice.specialtyAdvice && (
                <div className="health-ai-section">
                  <strong>👨‍⚕️ Which specialist to visit</strong>
                  <p>{results.aiAdvice.specialtyAdvice}</p>
                </div>
              )}

              {/* 2-column grid for the detail sections */}
              <div className="health-ai-grid">

                {/* medications */}
                {results.aiAdvice.medications?.length > 0 && (
                  <div className="health-ai-section">
                    <strong>💊 Common medications</strong>
                    <ul>
                      {results.aiAdvice.medications.map((m, i) => (
                        <li key={i}>
                          <span className="health-med-name">
                            {m.name}
                          </span>
                          <span className="health-med-purpose">
                            {" "}— {m.purpose}
                          </span>
                          {m.note && (
                            <span className="health-med-note">
                              {" "}({m.note})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="health-ai-disclaimer">
                      ⚠️ Always consult a doctor before taking
                      any medication.
                    </p>
                  </div>
                )}

                {/* questions to ask */}
                {results.aiAdvice.questionsToAsk?.length > 0 && (
                  <div className="health-ai-section">
                    <strong>❓ Questions to ask your doctor</strong>
                    <ul>
                      {results.aiAdvice.questionsToAsk.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* health advice */}
                {results.aiAdvice.healthAdvice?.length > 0 && (
                  <div className="health-ai-section">
                    <strong>💡 Health advice</strong>
                    <ul>
                      {results.aiAdvice.healthAdvice.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* alternative cities */}
                {results.aiAdvice.alternativeCities?.length > 0 && (
                  <div className="health-ai-section">
                    <strong>
                      🏙️ Better facilities available in
                    </strong>
                    <ul>
                      {results.aiAdvice.alternativeCities.map(
                        (c, i) => (
                          <li key={i}>
                            <span className="health-alt-city">
                              {c.city}
                            </span>
                            {c.reason && ` — ${c.reason}`}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}

              </div>

              {/* groq source disclaimer */}
              {results.source === "groq" && (
                <p className="health-groq-disclaimer">
                  🤖 Hospital suggestions are AI-generated based
                  on known facilities. Distances unavailable —
                  please verify the hospital exists before visiting.
                </p>
              )}

            </div>
          )}
          {/* ══ END AI ADVICE PANEL ══════════════════════════════════ */}

          {/* ── hospital cards or empty state ── */}
          {!results.results?.length ? (
            <div className="health-empty">
              <span>😔</span>
              <p>
                No {results.specialtyLabel} found within 15km
                of {cityName}.
                {results.source !== "groq" && " Try a nearby major city."}
              </p>
              <button
                className="health-retry-btn"
                onClick={() => handleSearch(condition)}
                disabled={loading}
              >
                ↺ Try again
              </button>
            </div>
          ) : (
            <div className="health-results-grid">
              {results.results.map((r) => (
                <HealthResultCard key={r.id} result={r} />
              ))}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
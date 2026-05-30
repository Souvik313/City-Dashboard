import React from "react";
import { formatPredictionTime } from "../../hooks/useDashboardPredictions.js";
import "./PredictionInsight.css";

export default function PredictionInsight({
  title = "Next-hour forecast",
  loading,
  error,
  fallback,
  timestamp,
  message,
  children,
  className = "",
}) {
  return (
    <section className={`prediction-insight ${className}`}>
      <div className="prediction-insight-header">
        <div>
          <h4>{title}</h4>
          {timestamp && (
            <p className="prediction-insight-time">Around {formatPredictionTime(timestamp)}</p>
          )}
        </div>
        <span className={`prediction-source-badge ${fallback ? "trend" : "model"}`}>
          {fallback ? "Trend estimate" : "ML model"}
        </span>
      </div>

      {loading && <div className="skeleton">Loading forecast…</div>}
      {error && !loading && <div className="prediction-insight-error">{error}</div>}

      {!loading && !error && children}

      {message && !loading && !error && (
        <p className="prediction-insight-note">{message}</p>
      )}
    </section>
  );
}

export function PredictionDelta({ delta, label = "vs now" }) {
  if (!delta) return null;

  const icon = delta.direction === "up" ? "↑" : delta.direction === "down" ? "↓" : "→";

  return (
    <span className={`prediction-delta ${delta.direction}`}>
      {icon} {delta.text} {label}
    </span>
  );
}

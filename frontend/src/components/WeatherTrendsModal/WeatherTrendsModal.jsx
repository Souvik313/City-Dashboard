import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import useWeatherTrends from "../../hooks/useWeatherTrends.js";
import "./WeatherTrendsModal.css";

const formatTime = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function WeatherTrendsModal({ cityName, onClose }) {
  const [period, setPeriod] = useState("24h");
  const { trends, history, loading, error } = useWeatherTrends(cityName, {
    period,
    withHistory: true,
  });

  const chartData =
    history?.map((r) => ({
      time: formatTime(r.recordedAt),
      fullTime: r.recordedAt,
      temp: r.temperature,
      humidity: r.humidity != null ? r.humidity : undefined,
      pressure: r.pressure != null ? r.pressure : undefined,
    })) ?? [];

  const avgTemp = trends?.averageTemp;

  return (
    <div className="weather-trends-overlay" onClick={onClose}>
      <div className="weather-trends-modal" onClick={(e) => e.stopPropagation()}>
        <header className="weather-trends-header">
          <h2>🌤️ Weather Latest Trends — {cityName || "City"}</h2>
          <div className="weather-trends-period">
            <span>Period:</span>
            <button
              className={period === "24h" ? "active" : ""}
              onClick={() => setPeriod("24h")}
            >
              24h
            </button>
            <button
              className={period === "7d" ? "active" : ""}
              onClick={() => setPeriod("7d")}
            >
              7d
            </button>
          </div>
          <button type="button" className="weather-trends-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="weather-trends-body">
          {loading && (
            <div className="weather-trends-loading">Loading trends…</div>
          )}
          {error && (
            <div className="weather-trends-error">⚠ {error}</div>
          )}

          {!loading && !error && trends && (
            <>
              <section className="weather-trends-cards">
                <div className="trend-card current">
                  <span className="label">Current temp</span>
                  <span className="value">{trends.current?.temperature ?? "—"}°C</span>
                  <span className="sub">{trends.current?.condition ?? ""}</span>
                </div>
                <div className={`trend-card direction ${trends.direction}`}>
                  <span className="label">Trend</span>
                  <span className="value">{trends.direction ?? "—"}</span>
                  <span className="sub">{trends.summary}</span>
                </div>
                <div className="trend-card">
                  <span className="label">Period avg temp</span>
                  <span className="value">{trends.averageTemp ?? "—"}°C</span>
                  <span className="sub">Min: {trends.minTemp ?? "—"}°C · Max: {trends.maxTemp ?? "—"}°C</span>
                </div>
                <div className="trend-card">
                  <span className="label">Avg humidity</span>
                  <span className="value">{trends.averageHumidity ?? "—"}%</span>
                </div>
                <div className={`trend-card cloudDirection ${trends.cloudTrend?.direction}`}>
                  <span className="label">Avg cloud cover</span>
                  <span className="value">{trends.averageCloudCover ?? "—"}%</span>
                  <span className="sub">
                    {trends.cloudTrend?.direction === "increasing" && "Cloudiness increasing"}
                    {trends.cloudTrend?.direction === "decreasing" && "Skies clearing"}
                    {trends.cloudTrend?.direction === "stable" && "Little change expected"}
                  </span>
                </div>
                <div className="trend-card">
                  <span className="label">Most common condition</span>
                  <span className="value">{trends.mostCommonCondition ?? "—"}</span>
                </div>
                {trends.peakHour != null && (
                  <div className="trend-card">
                    <span className="label">Warmest hour (UTC)</span>
                    <span className="value">{trends.peakHour.hour}:00</span>
                    <span className="sub">Avg: {trends.peakHour.averageTemp}°C</span>
                  </div>
                )}
              </section>

              {chartData.length > 0 && (
                <section className="weather-trends-chart">
                  <h3>Temperature & humidity over time</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 11 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis yAxisId="temp" domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="humidity" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.fullTime
                            ? formatDate(payload[0].payload.fullTime)
                            : ""
                        }
                        formatter={(value, name) => [
                          name === "temp" ? `${value}°C` : `${value}%`,
                          name === "temp" ? "Temp" : "Humidity",
                        ]}
                      />
                      <Legend />
                      {typeof avgTemp === "number" && (
                        <ReferenceLine yAxisId="temp" y={avgTemp} stroke="#94a3b8" strokeDasharray="4 4" />
                      )}
                      <Line
                        yAxisId="temp"
                        type="monotone"
                        dataKey="temp"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={false}
                        name="temp"
                      />
                      <Line
                        yAxisId="humidity"
                        type="monotone"
                        dataKey="humidity"
                        stroke="#059669"
                        strokeWidth={2}
                        dot={false}
                        name="humidity"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </section>
                
              )}
              {chartData.length > 0 && chartData.some((d) => d.pressure != null) && (
                <section className="weather-trends-chart">
                  <h3>Pressure over time</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 11 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis yAxisId="pressure" domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                      <Tooltip
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.fullTime
                            ? formatDate(payload[0].payload.fullTime)
                            : ""
                        }
                        formatter={(value) => [`${value} hPa`, "Pressure"]}
                      />
                      <Legend />
                      <Line
                        yAxisId="pressure"
                        type="monotone"
                        dataKey="pressure"
                        stroke="#7c3aed"
                        strokeWidth={2}
                        dot={false}
                        name="pressure"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </section>
              )}

              {!loading && trends && !trends.current && (
                <p className="weather-trends-empty">No weather data in this period.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

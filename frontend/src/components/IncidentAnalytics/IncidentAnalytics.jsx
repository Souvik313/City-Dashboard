import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import useIncidentAnalytics from "../../hooks/useIncidentAnalytics.js";
import "./IncidentAnalytics.css";

const CATEGORY_COLORS = {
  Pothole: "#6366f1",
  "Broken streetlight": "#f59e0b",
  "Waste issue": "#10b981",
  Flooding: "#3b82f6",
  "Public Safety": "#ef4444",
  "Fire Hazard": "#f97316",
  Other: "#94a3b8",
};

const STATUS_COLORS = {
  Reported: "#f59e0b",
  "In Progress": "#3b82f6",
  Resolved: "#10b981",
};

const getCategoryColor = (name) => CATEGORY_COLORS[name] || CATEGORY_COLORS.Other;
const getStatusColor = (name) => STATUS_COLORS[name] || "#94a3b8";

function SummaryCard({ label, value, sub, accent = "default" }) {
  return (
    <div className={`incident-analytics-card ${accent}`}>
      <span className="incident-analytics-card-label">{label}</span>
      <strong className="incident-analytics-card-value">{value}</strong>
      {sub && <span className="incident-analytics-card-sub">{sub}</span>}
    </div>
  );
}

export default function IncidentAnalytics({ city, refreshKey = 0 }) {
  const [period, setPeriod] = useState("24h");
  const { analytics, loading, error } = useIncidentAnalytics(city?._id, {
    period,
    enabled: Boolean(city?._id),
    refreshKey,
  });

  if (!city?._id) {
    return null;
  }

  const categoryData = analytics?.byCategory ?? [];
  const statusData = analytics?.byStatus ?? [];
  const timeSeries = analytics?.timeSeries ?? [];
  const hasChartData = timeSeries.some((point) => point.count > 0);

  return (
    <section className="incident-analytics">
      <div className="incident-analytics-header">
        <div>
          <h3>Incident analytics</h3>
          <p className="incident-analytics-subtitle">
            Reports for {city.name} · {analytics?.summary?.last24h ?? 0} in last 24h ·{" "}
            {analytics?.summary?.last7d ?? 0} in last 7 days
          </p>
        </div>
        <div className="incident-analytics-period">
          <button
            type="button"
            className={period === "24h" ? "active" : ""}
            onClick={() => setPeriod("24h")}
          >
            24h
          </button>
          <button
            type="button"
            className={period === "7d" ? "active" : ""}
            onClick={() => setPeriod("7d")}
          >
            7d
          </button>
        </div>
      </div>

      {loading && <div className="incident-analytics-loading">Loading analytics…</div>}
      {error && !loading && <div className="incident-analytics-error">{error}</div>}

      {!loading && !error && analytics && (
        <>
          <div className="incident-analytics-summary">
            <SummaryCard
              label={`Total (${period})`}
              value={analytics.summary.inPeriod}
              sub={`${analytics.dataPoints} data points`}
              accent="primary"
            />
            <SummaryCard
              label="Last 24 hours"
              value={analytics.summary.last24h}
              sub="All statuses"
              accent="highlight"
            />
            <SummaryCard
              label="Last 7 days"
              value={analytics.summary.last7d}
              sub="Rolling window"
            />
            <SummaryCard
              label="Top category"
              value={analytics.summary.topCategory || "—"}
              sub={`${analytics.summary.reported} reported · ${analytics.summary.resolved} resolved`}
            />
          </div>

          <div className="incident-analytics-status-row">
            <SummaryCard label="Reported" value={analytics.summary.reported} accent="reported" />
            <SummaryCard
              label="In progress"
              value={analytics.summary.inProgress}
              accent="progress"
            />
            <SummaryCard label="Resolved" value={analytics.summary.resolved} accent="resolved" />
          </div>

          <div className="incident-analytics-charts">
            <div className="incident-analytics-chart-panel wide">
              <div className="incident-analytics-chart-head">
                <h4>Reports over time</h4>
                <span>{period === "24h" ? "Hourly buckets" : "Daily buckets"}</span>
              </div>
              {hasChartData ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={timeSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value) => [value, "Reports"]}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.timestamp
                          ? new Date(payload[0].payload.timestamp).toLocaleString()
                          : ""
                      }
                    />
                    <Legend />
                    <Bar
                      dataKey="count"
                      name="Incidents"
                      fill="#6366f1"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="incident-analytics-empty">
                  No incidents in this period yet. Charts will appear once reports are submitted.
                </div>
              )}
            </div>

            <div className="incident-analytics-chart-panel">
              <div className="incident-analytics-chart-head">
                <h4>By category</h4>
                <span>Distribution</span>
              </div>
              {categoryData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={84}
                        paddingAngle={2}
                      >
                        {categoryData.map((entry) => (
                          <Cell key={entry.name} fill={getCategoryColor(entry.name)} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [value, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="incident-analytics-legend">
                    {categoryData.map((entry) => (
                      <div key={entry.name} className="incident-analytics-legend-item">
                        <span
                          className="incident-analytics-legend-swatch"
                          style={{ background: getCategoryColor(entry.name) }}
                        />
                        <span>{entry.name}</span>
                        <strong>{entry.count}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="incident-analytics-empty">No category data for this period.</div>
              )}
            </div>

            <div className="incident-analytics-chart-panel">
              <div className="incident-analytics-chart-head">
                <h4>By status</h4>
                <span>Workflow breakdown</span>
              </div>
              {statusData.some((item) => item.count > 0) ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={statusData}
                      layout="vertical"
                      margin={{ top: 8, right: 12, left: 12, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={92}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip formatter={(value) => [value, "Reports"]} />
                      <Bar dataKey="count" name="Incidents" radius={[0, 6, 6, 0]}>
                        {statusData.map((entry) => (
                          <Cell key={entry.name} fill={getStatusColor(entry.name)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="incident-analytics-legend">
                    {statusData.map((entry) => (
                      <div key={entry.name} className="incident-analytics-legend-item">
                        <span
                          className="incident-analytics-legend-swatch"
                          style={{ background: getStatusColor(entry.name) }}
                        />
                        <span>{entry.name}</span>
                        <strong>{entry.count}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="incident-analytics-empty">No status data for this period.</div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

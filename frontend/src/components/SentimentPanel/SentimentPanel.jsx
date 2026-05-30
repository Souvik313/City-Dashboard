import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import useSentimentTrends from "../../hooks/useSentimentTrends.js";
import "./SentimentPanel.css";

const TOPIC_COLORS = {
  traffic: "#3b82f6",
  pollution: "#ef4444",
  weather: "#22c55e",
  safety: "#f59e0b",
  other: "#8b5cf6",
};

const EMOTION_COLORS = {
  happy: "#22c55e",
  neutral: "#94a3b8",
  anger: "#ef4444",
  sad: "#6366f1",
};

const formatTime = (ts) =>
  new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

const formatDate = (ts) =>
  new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
  });

function scoreToMood(score) {
  if (score == null) {
    return { label: "No data", emoji: "💬", color: "#94a3b8" };
  }
  if (score >= 0.5) return { label: "Very positive", emoji: "😄", color: "#10b981" };
  if (score >= 0.15) return { label: "Positive", emoji: "🙂", color: "#22c55e" };
  if (score > -0.15) return { label: "Neutral", emoji: "😐", color: "#94a3b8" };
  if (score > -0.5) return { label: "Negative", emoji: "😟", color: "#f97316" };
  return { label: "Very negative", emoji: "😠", color: "#ef4444" };
}

function formatDirection(direction) {
  if (direction === "improving") return { text: "Improving", icon: "↑", tone: "up" };
  if (direction === "declining") return { text: "Declining", icon: "↓", tone: "down" };
  return { text: "Stable", icon: "→", tone: "stable" };
}

function SummaryCard({ label, value, sub, accent = "default" }) {
  return (
    <div className={`sentiment-summary-card ${accent}`}>
      <span className="sentiment-summary-label">{label}</span>
      <strong className="sentiment-summary-value">{value}</strong>
      {sub && <span className="sentiment-summary-sub">{sub}</span>}
    </div>
  );
}

function DistributionLegend({ items, colors }) {
  if (!items?.length) return null;

  return (
    <div className="sentiment-distribution-legend">
      {items.map((item) => (
        <div key={item.name} className="sentiment-legend-item">
          <span
            className="sentiment-legend-swatch"
            style={{ background: colors[item.name] || "#94a3b8" }}
          />
          <span className="sentiment-legend-name">{item.name}</span>
          <strong>{item.count}</strong>
          <span className="sentiment-legend-pct">{item.percentage}%</span>
        </div>
      ))}
    </div>
  );
}

export default function SentimentPanel({ cityName, compact = false }) {
  const [period, setPeriod] = useState("24h");
  const { trends, loading, error, refetch } = useSentimentTrends(cityName, { period });

  const chartData = useMemo(
    () =>
      trends?.timeSeries?.map((point) => ({
        time: period === "7d" ? formatDate(point.time) : formatTime(point.time),
        fullTime: point.time,
        score: point.averageScore,
        count: point.count,
      })) ?? [],
    [trends?.timeSeries, period]
  );

  const latestScore = trends?.current?.score ?? null;
  const mood = scoreToMood(latestScore);
  const direction = formatDirection(trends?.direction);
  const gaugePercent =
    latestScore != null ? Math.min(100, Math.max(0, ((latestScore + 1) / 2) * 100)) : 50;

  const topTopic = trends?.topicDistribution?.length
    ? [...trends.topicDistribution].sort((a, b) => b.count - a.count)[0]
    : null;
  const topEmotion = trends?.emotionDistribution?.length
    ? [...trends.emotionDistribution].sort((a, b) => b.count - a.count)[0]
    : null;

  const hasData = trends && trends.dataPoints > 0;

  return (
    <section className={`sentiment-panel ${compact ? "compact" : ""}`}>
      <div className="sentiment-panel-header">
        <div>
          <h3>City sentiment pulse</h3>
          <p className="sentiment-panel-subtitle">
            Mood insights from citizen chatbot messages in {cityName || "this city"}.
            {hasData
              ? ` ${trends.dataPoints} messages analyzed in the last ${period === "7d" ? "7 days" : "24 hours"}.`
              : " Start chatting to generate sentiment data."}
          </p>
        </div>
        <div className="sentiment-panel-actions">
          <div className="sentiment-panel-period">
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
          <button type="button" className="sentiment-panel-refresh" onClick={refetch}>
            Refresh
          </button>
        </div>
      </div>

      {loading && <div className="sentiment-panel-loading">Analyzing citizen sentiment…</div>}
      {error && !loading && <div className="sentiment-panel-error">{error}</div>}

      {!loading && !error && trends && (
        <>
          {!hasData ? (
            <div className="sentiment-panel-empty">
              <div className="sentiment-empty-icon" aria-hidden="true">
                💬
              </div>
              <h4>No sentiment data yet</h4>
              <p>
                Open the chat widget in the bottom-right corner and share feedback about traffic,
                air quality, safety, or weather in {cityName}. Your messages power this dashboard.
              </p>
            </div>
          ) : (
            <>
              <div className="sentiment-hero">
                <div className="sentiment-mood-card">
                  <div className="sentiment-mood-emoji" aria-hidden="true">
                    {mood.emoji}
                  </div>
                  <div>
                    <span className="sentiment-mood-label">Current mood</span>
                    <strong className="sentiment-mood-title" style={{ color: mood.color }}>
                      {mood.label}
                    </strong>
                    <p className="sentiment-mood-meta">
                      Score {latestScore?.toFixed(2) ?? "—"} · {trends.current?.emotion || "—"} ·{" "}
                      topic: {trends.current?.topic || "—"}
                    </p>
                  </div>
                </div>

                <div className="sentiment-gauge-wrap">
                  <div className="sentiment-gauge-header">
                    <span>Sentiment scale</span>
                    <strong>{latestScore?.toFixed(2) ?? "—"}</strong>
                  </div>
                  <div className="sentiment-gauge-track">
                    <div className="sentiment-gauge-gradient" />
                    <div
                      className="sentiment-gauge-marker"
                      style={{ left: `${gaugePercent}%` }}
                      title={`Score: ${latestScore}`}
                    />
                  </div>
                  <div className="sentiment-gauge-labels">
                    <span>−1 Negative</span>
                    <span>0 Neutral</span>
                    <span>+1 Positive</span>
                  </div>
                </div>

                <div className={`sentiment-trend-pill ${direction.tone}`}>
                  <span className="sentiment-trend-icon">{direction.icon}</span>
                  <div>
                    <span>Trend</span>
                    <strong>{direction.text}</strong>
                    <p>{trends.summary}</p>
                  </div>
                </div>
              </div>

              <div className="sentiment-summary-grid">
                <SummaryCard
                  label="Latest score"
                  value={latestScore?.toFixed(2) ?? "—"}
                  sub={`Confidence ${((trends.current?.confidence ?? 0) * 100).toFixed(0)}%`}
                  accent="primary"
                />
                <SummaryCard
                  label="Period average"
                  value={trends.averageScore ?? "—"}
                  sub={`${trends.dataPoints} messages`}
                />
                <SummaryCard
                  label="Top topic"
                  value={topTopic?.name ?? "—"}
                  sub={topTopic ? `${topTopic.percentage}% of messages` : "—"}
                  accent="topic"
                />
                <SummaryCard
                  label="Top emotion"
                  value={topEmotion?.name ?? "—"}
                  sub={topEmotion ? `${topEmotion.percentage}% of messages` : "—"}
                  accent="emotion"
                />
              </div>

              <div className="sentiment-charts-grid">
                {chartData.length > 0 && (
                  <div className="sentiment-chart-panel wide">
                    <div className="sentiment-chart-head">
                      <h4>Sentiment over time</h4>
                      <span>{period === "7d" ? "Daily buckets" : "Hourly buckets"}</span>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                        <YAxis domain={[-1, 1]} tick={{ fontSize: 11 }} />
                        <Tooltip
                          labelFormatter={(_, payload) =>
                            payload?.[0]?.payload?.fullTime
                              ? formatDate(payload[0].payload.fullTime)
                              : ""
                          }
                          formatter={(value, name) =>
                            name === "score" ? [value, "Avg score"] : [value, "Messages"]
                          }
                        />
                        <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                        <ReferenceLine
                          y={trends.averageScore}
                          stroke="#8b5cf6"
                          strokeDasharray="4 4"
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#8b5cf6"
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: "#8b5cf6" }}
                          activeDot={{ r: 5 }}
                          name="score"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {chartData.length > 0 && (
                  <div className="sentiment-chart-panel">
                    <div className="sentiment-chart-head">
                      <h4>Chat activity</h4>
                      <span>Messages per bucket</span>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip
                          labelFormatter={(_, payload) =>
                            payload?.[0]?.payload?.fullTime
                              ? formatDate(payload[0].payload.fullTime)
                              : ""
                          }
                          formatter={(value) => [value, "Messages"]}
                        />
                        <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} name="Messages" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {trends.topicDistribution?.length > 0 && (
                  <div className="sentiment-chart-panel">
                    <div className="sentiment-chart-head">
                      <h4>Topics discussed</h4>
                      <span>What citizens talk about</span>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={trends.topicDistribution}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={78}
                          paddingAngle={2}
                        >
                          {trends.topicDistribution.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={TOPIC_COLORS[entry.name] || "#94a3b8"}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name) => [value, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <DistributionLegend items={trends.topicDistribution} colors={TOPIC_COLORS} />
                  </div>
                )}

                {trends.emotionDistribution?.length > 0 && (
                  <div className="sentiment-chart-panel">
                    <div className="sentiment-chart-head">
                      <h4>Emotion breakdown</h4>
                      <span>How people feel</span>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={trends.emotionDistribution}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={78}
                          paddingAngle={2}
                        >
                          {trends.emotionDistribution.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={EMOTION_COLORS[entry.name] || "#94a3b8"}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name) => [value, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <DistributionLegend items={trends.emotionDistribution} colors={EMOTION_COLORS} />
                  </div>
                )}
              </div>

              <div className="sentiment-panel-tip">
                <strong>Tip:</strong> Sentiment updates as citizens chat about local issues. More
                conversations lead to richer trends and better city insights.
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

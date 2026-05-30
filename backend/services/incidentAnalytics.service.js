import Incident from "../models/incident.model.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const STATUSES = ["Reported", "In Progress", "Resolved"];
const CATEGORIES = [
  "Pothole",
  "Broken streetlight",
  "Waste issue",
  "Flooding",
  "Public Safety",
  "Fire Hazard",
  "Other",
];

function countInWindow(incidents, windowMs) {
  const cutoff = Date.now() - windowMs;
  return incidents.filter((item) => new Date(item.createdAt).getTime() >= cutoff).length;
}

function buildCategoryBreakdown(incidents) {
  const counts = Object.fromEntries(CATEGORIES.map((name) => [name, 0]));

  incidents.forEach((item) => {
    if (counts[item.category] != null) {
      counts[item.category] += 1;
    } else {
      counts.Other += 1;
    }
  });

  return CATEGORIES.map((name) => ({ name, count: counts[name] })).filter((item) => item.count > 0);
}

function buildStatusBreakdown(incidents) {
  const counts = Object.fromEntries(STATUSES.map((name) => [name, 0]));

  incidents.forEach((item) => {
    if (counts[item.status] != null) {
      counts[item.status] += 1;
    }
  });

  return STATUSES.map((name) => ({ name, count: counts[name] }));
}

function buildTimeSeries(incidents, period) {
  if (period === "7d") {
    const buckets = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = incidents.filter((item) => {
        const createdAt = new Date(item.createdAt);
        return createdAt >= dayStart && createdAt < dayEnd;
      }).length;

      buckets.push({
        label: dayStart.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
        count,
        timestamp: dayStart.toISOString(),
      });
    }

    return buckets;
  }

  const buckets = [];
  const now = new Date();
  const windowStart = new Date(now.getTime() - DAY_MS);

  for (let i = 0; i < 24; i++) {
    const bucketStart = new Date(windowStart.getTime() + i * HOUR_MS);
    const bucketEnd = new Date(bucketStart.getTime() + HOUR_MS);

    const count = incidents.filter((item) => {
      const createdAt = new Date(item.createdAt);
      return createdAt >= bucketStart && createdAt < bucketEnd;
    }).length;

    buckets.push({
      label: bucketStart.toLocaleTimeString(undefined, { hour: "numeric" }),
      count,
      timestamp: bucketStart.toISOString(),
    });
  }

  return buckets;
}

/**
 * Incident analytics for dashboard charts.
 * @param {import('mongoose').Types.ObjectId} cityId
 * @param {{ period?: '24h' | '7d' }} options
 */
export async function getIncidentAnalytics(cityId, options = {}) {
  const period = options.period === "7d" ? "7d" : "24h";
  const windowMs = period === "7d" ? 7 * DAY_MS : DAY_MS;
  const startDate = new Date(Date.now() - windowMs);

  const [periodIncidents, recentIncidents] = await Promise.all([
    Incident.find({ city: cityId, createdAt: { $gte: startDate } })
      .sort({ createdAt: 1 })
      .lean(),
    Incident.find({ city: cityId, createdAt: { $gte: new Date(Date.now() - 7 * DAY_MS) } })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const last24h = countInWindow(recentIncidents, DAY_MS);
  const last7d = recentIncidents.length;

  const statusCounts = Object.fromEntries(STATUSES.map((name) => [name, 0]));
  periodIncidents.forEach((item) => {
    if (statusCounts[item.status] != null) {
      statusCounts[item.status] += 1;
    }
  });

  const byCategory = buildCategoryBreakdown(periodIncidents);
  const topCategory = byCategory.length
    ? [...byCategory].sort((a, b) => b.count - a.count)[0].name
    : null;

  return {
    period,
    summary: {
      last24h,
      last7d,
      inPeriod: periodIncidents.length,
      reported: statusCounts.Reported,
      inProgress: statusCounts["In Progress"],
      resolved: statusCounts.Resolved,
      topCategory,
    },
    byCategory,
    byStatus: buildStatusBreakdown(periodIncidents),
    timeSeries: buildTimeSeries(periodIncidents, period),
    dataPoints: periodIncidents.length,
  };
}

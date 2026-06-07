import WeatherData from "../models/WeatherData.model.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Get weather trends for a city over a time period
 * @param {import('mongoose').Types.ObjectId} cityId - City ObjectId
 * @param {{ period?: '24h' | '7d' }} options - period: 24h or 7d (default 24h)
 * @returns {Promise<Object>} Trend summary
 */
export async function getWeatherTrends(cityId, options = {}) {
  const period = options.period || "24h";
  const windowMs = period === "7d" ? 7 * DAY_MS : 24 * HOUR_MS;
  const startDate = new Date(Date.now() - windowMs);

  const records = await WeatherData.find({
    city: cityId,
    recordedAt: { $gte: startDate },
  })
    .sort({ recordedAt: 1 })
    .lean();

  if (!records.length) {
    return {
      period,
      current: null,
      summary: "No weather data in this period.",
      trend: null,
      averageTemp: null,
      minTemp: null,
      maxTemp: null,
      averageHumidity: null,
      direction: null,
      mostCommonCondition: null,
      peakHour: null,
      dataPoints: 0,
    };
  }

  const temps = records.map((r) => r.temperature).filter((v) => v != null);
  const humidities = records.map((r) => r.humidity).filter((v) => v != null);
  const cloudCovers = records
  .map((r) => r.cloudCover)
  .filter((v) => v != null);
  const latest = records[records.length - 1];
  const current = {
    temperature: latest.temperature,
    feelsLike: latest.feelsLiks,
    condition: latest.condition?.description || latest.condition?.main || "—",
    humidity: latest.humidity,
    cloudCover: latest.cloudCover,
    windSpeed: latest.wind?.speed,
    recordedAt: latest.recordedAt,
  };

  const avgTemp = temps.length ? temps.reduce((s, v) => s + v, 0) / temps.length : null;
  const minTemp = temps.length ? Math.min(...temps) : null;
  const maxTemp = temps.length ? Math.max(...temps) : null;
  const avgHumidity =
    humidities.length ? humidities.reduce((s, v) => s + v, 0) / humidities.length : null;
  const avgCloudCover =
  cloudCovers.length
    ? cloudCovers.reduce((s, v) => s + v, 0) / cloudCovers.length
    : null;

  const diffTemp = current.temperature != null && avgTemp != null ? current.temperature - avgTemp : 0;
  let direction = "stable";
  if (diffTemp <= -1) direction = "cooling";
  else if (diffTemp >= 1) direction = "warming";

  const cloudDiff =
  current.cloudCover != null &&
  avgCloudCover != null
    ? current.cloudCover - avgCloudCover
    : 0;

  let cloudTrend = "stable";

  if (cloudDiff >= 10) cloudTrend = "increasing";
  else if (cloudDiff <= -10) cloudTrend = "decreasing";

  const conditionCounts = {};
  records.forEach((r) => {
    const c = r.condition?.main || r.condition?.description || "Unknown";
    conditionCounts[c] = (conditionCounts[c] || 0) + 1;
  });
  let mostCommonCondition = null;
  let maxCount = 0;
  Object.entries(conditionCounts).forEach(([name, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommonCondition = name;
    }
  });

  const byHour = {};
  for (let h = 0; h < 24; h++) byHour[h] = { sum: 0, count: 0 };
  records.forEach((r) => {
    const h = new Date(r.recordedAt).getUTCHours();
    if (r.temperature != null) {
      byHour[h].sum += r.temperature;
      byHour[h].count++;
    }
  });
  let peakHour = null;
  let peakAvg = -Infinity;
  Object.entries(byHour).forEach(([hour, { sum, count }]) => {
    if (count > 0) {
      const avgH = sum / count;
      if (avgH > peakAvg) {
        peakAvg = avgH;
        peakHour = Number(hour);
      }
    }
  });

  const summary =
    direction === "warming"
      ? "Temperature has risen compared to the period average."
      : direction === "cooling"
        ? "Temperature has dropped compared to the period average."
        : "Temperature is stable compared to the period average.";

  return {
    period,
    current,
    summary,
    trend: {
      direction,
      changeFromAverage: avgTemp != null ? Math.round(diffTemp * 10) / 10 : null,
    },
    averageTemp: avgTemp != null ? Math.round(avgTemp * 10) / 10 : null,
    minTemp,
    maxTemp,
    averageHumidity: avgHumidity != null ? Math.round(avgHumidity * 10) / 10 : null,
    averageCloudCover:
    avgCloudCover != null
      ? Math.round(avgCloudCover * 10) / 10
      : null,
    cloudTrend: {
    direction: cloudTrend,
    changeFromAverage:
      avgCloudCover != null
        ? Math.round(cloudDiff * 10) / 10
        : null,
    },
    direction,
    mostCommonCondition,
    peakHour:
      peakHour != null ? { hour: peakHour, averageTemp: Math.round(peakAvg * 10) / 10 } : null,
    dataPoints: records.length,
  };
}

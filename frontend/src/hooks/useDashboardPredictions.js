import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_APP_API_URL || "http://localhost:5000";

const createSection = () => ({
  loading: false,
  data: null,
  error: null,
});

function estimateWeatherNextHour(trends) {
  if (!trends?.current) return null;

  const change = trends.trend?.changeFromAverage ?? 0;
  const predictedTemp =
    trends.current.temperature != null
      ? Math.round((trends.current.temperature + change * 0.2) * 10) / 10
      : null;

  return {
    temperature: predictedTemp,
    condition: trends.mostCommonCondition || trends.current.condition,
    humidity: trends.averageHumidity ?? trends.current.humidity,
    direction: trends.direction,
    timestamp: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    fallback: true,
    source: "trend",
  };
}

function estimateWeatherNextDay(trends) {
  if (!trends?.current) return null;

  const change = trends.trend?.changeFromAverage ?? 0;

  let predictedTemp =
    trends.current.temperature + (change * 0.5);

  predictedTemp = Math.max(
    trends.minTemp,
    Math.min(predictedTemp, trends.maxTemp + 2)
  );

  let condition =
    trends.mostCommonCondition ||
    trends.current.condition;

  if (
    trends.averageHumidity > 80 &&
    predictedTemp < trends.current.temperature
  ) {
    condition = "Rain likely";
  }

  return {
    temperature: Math.round(predictedTemp * 10) / 10,
    condition,
    humidity: trends.averageHumidity,
    direction: trends.direction,
    timestamp: new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString(),
    fallback: true,
    source: "trend",
  };
}

function estimateTrafficNextHour(records) {
  if (!records?.length) return null;

  const recent = records.slice(-6);
  const latest = recent[recent.length - 1];
  const ttis = recent.map((r) => r.congestion?.travelTimeIndex ?? 1).filter(Boolean);
  const speeds = recent.map((r) => r.speed?.average).filter((v) => v != null);

  const slope =
    ttis.length >= 2 ? (ttis[ttis.length - 1] - ttis[0]) / Math.max(ttis.length - 1, 1) : 0;
  const predictedTTI = Math.max(1, ttis[ttis.length - 1] + slope);

  let congestionLevel = latest.congestion?.level ?? "low";
  if (predictedTTI >= 1.45) congestionLevel = "high";
  else if (predictedTTI >= 1.18) congestionLevel = "moderate";
  else congestionLevel = "low";

  const speedSlope =
    speeds.length >= 2
      ? (speeds[speeds.length - 1] - speeds[0]) / Math.max(speeds.length - 1, 1)
      : 0;
  const predictedSpeed =
    speeds.length > 0
      ? Math.max(0, Math.round((speeds[speeds.length - 1] + speedSlope) * 10) / 10)
      : null;

  return {
    congestionLevel,
    avgSpeed: predictedSpeed,
    travelTimeIndex: parseFloat(predictedTTI.toFixed(2)),
    roadClosureCount: latest.roadClosureCount ?? 0,
    timestamp: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    fallback: true,
    source: "trend",
  };
}

export default function useDashboardPredictions(city, { enabled = true } = {}) {
  const [aqi, setAqi] = useState(createSection());
  const [weather, setWeather] = useState(createSection());
  const [traffic, setTraffic] = useState(createSection());

  const fetchAll = useCallback(async () => {
    if (!city) return;

    setAqi((prev) => ({ ...prev, loading: true, error: null }));
    setWeather((prev) => ({ ...prev, loading: true, error: null }));
    setTraffic((prev) => ({ ...prev, loading: true, error: null }));

    const [aqiResult, weather24hResult, weather7dResult, trafficResult] = await Promise.allSettled([
      axios.get(`${API_URL}/api/v1/aqi/predict`, { params: { city } }),
      axios.get(`${API_URL}/api/v1/weather/trends`, { params: { city, period: "24h" } }),
      axios.get(`${API_URL}/api/v1/weather/trends`, { params: { city, period: "7d" } }),
      axios.get(`${API_URL}/api/v1/traffic/history`, { params: { city, limit: 24 } }),
    ]);

    if (aqiResult.status === "fulfilled" && aqiResult.value.data?.status === "success") {
      setAqi({
        loading: false,
        data: aqiResult.value.data.data,
        error: null,
      });
    } else {
      const err =
        aqiResult.status === "rejected"
          ? aqiResult.reason?.response?.data?.message || aqiResult.reason?.message
          : "Unable to load AQI prediction";
      setAqi({ loading: false, data: null, error: err });
    }

    if (
      weather24hResult.status === "fulfilled" &&
      weather7dResult.status === "fulfilled" &&
      weather24hResult.value.data?.status === "success" &&
      weather7dResult.value.data?.status === "success"
    ) {
      const trends24h = weather24hResult.value.data.data;
      const trends7d = weather7dResult.value.data.data;

      setWeather({
        loading: false,
        data: {
          nextHour: estimateWeatherNextHour(trends24h),
          nextDay: estimateWeatherNextDay(trends7d)
        },
        error: null,
      });
    } else {
      const err =
  weather24hResult.status === "rejected"
    ? weather24hResult.reason?.response?.data?.message ||
      weather24hResult.reason?.message
    : weather7dResult.status === "rejected"
    ? weather7dResult.reason?.response?.data?.message ||
      weather7dResult.reason?.message
    : "Unable to load weather forecast";

setWeather({
  loading: false,
  data: null,
  error: err
});
    }

    if (trafficResult.status === "fulfilled" && trafficResult.value.data?.data?.length) {
      const estimate = estimateTrafficNextHour(trafficResult.value.data.data);
      setTraffic({
        loading: false,
        data: estimate,
        error: estimate ? null : "Not enough traffic history for a forecast",
      });
    } else {
      const err =
        trafficResult.status === "rejected"
          ? trafficResult.reason?.response?.data?.message || trafficResult.reason?.message
          : "Unable to load traffic forecast";
      setTraffic({ loading: false, data: null, error: err });
    }
  }, [city]);

  useEffect(() => {
    if (!enabled || !city) {
      setAqi(createSection());
      setWeather(createSection());
      setTraffic(createSection());
      return;
    }
    fetchAll();
  }, [city, enabled, fetchAll]);

  const loading = aqi.loading || weather.loading || traffic.loading;

  return {
    aqi,
    weather,
    traffic,
    loading,
    refreshPredictions: fetchAll,
  };
}

export function formatPredictionTime(isoString) {
  if (!isoString) return "Next hour";
  return new Date(isoString).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDelta(value, unit = "") {
  if (value == null || Number.isNaN(value)) return null;
  if (value === 0) return { text: "No change", direction: "stable" };
  const sign = value > 0 ? "+" : "";
  return {
    text: `${sign}${Math.round(value * 10) / 10}${unit}`,
    direction: value > 0 ? "up" : "down",
  };
}

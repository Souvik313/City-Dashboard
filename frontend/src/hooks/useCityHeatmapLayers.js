import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000";

const ADVERSE_WEATHER = new Set([
  "rain",
  "drizzle",
  "thunderstorm",
  "snow",
  "mist",
  "fog",
  "haze",
  "dust",
  "smoke",
  "sand",
  "ash",
  "squall",
  "tornado",
]);

function aqiZoneStyle(aqiValue) {
  if (aqiValue == null) {
    return { color: "#94a3b8", label: "No AQI data", radius: 2800, opacity: 0.12 };
  }
  if (aqiValue <= 50) {
    return { color: "#10b981", label: "Good air quality", radius: 3200, opacity: 0.18 };
  }
  if (aqiValue <= 100) {
    return { color: "#eab308", label: "Moderate air quality", radius: 3600, opacity: 0.22 };
  }
  if (aqiValue <= 150) {
    return { color: "#f97316", label: "Unhealthy for sensitive groups", radius: 4000, opacity: 0.26 };
  }
  if (aqiValue <= 200) {
    return { color: "#ef4444", label: "Unhealthy air quality", radius: 4400, opacity: 0.3 };
  }
  if (aqiValue <= 300) {
    return { color: "#a855f7", label: "Very unhealthy air quality", radius: 4800, opacity: 0.32 };
  }
  return { color: "#7f1d1d", label: "Hazardous air quality", radius: 5200, opacity: 0.34 };
}

function hotspotStyle(hotspot) {
  const delay = hotspot.delaySeconds ?? 0;
  const severity = hotspot.severity ?? 1;

  let color = "#f59e0b";
  if (delay > 300 || severity >= 4) color = "#ef4444";
  else if (delay > 120 || severity >= 3) color = "#f97316";

  const radius = Math.min(900, Math.max(350, 300 + delay / 2 + severity * 80));

  return { color, radius, opacity: 0.38 };
}

function incidentMarkerColor(category) {
  const map = {
    Pothole: "#6366f1",
    "Broken streetlight": "#f59e0b",
    "Waste issue": "#10b981",
    Flooding: "#3b82f6",
    "Public Safety": "#ef4444",
    "Fire Hazard": "#f97316",
    Other: "#94a3b8",
  };
  return map[category] || map.Other;
}

export default function useCityHeatmapLayers(city, { aqi, weather, traffic, enabled = true } = {}) {
  const [incidents, setIncidents] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  const [incidentsError, setIncidentsError] = useState(null);

  const fetchIncidents = useCallback(async () => {
    if (!city?._id) return;

    setIncidentsLoading(true);
    setIncidentsError(null);

    try {
      const response = await axios.get(`${API_URL}/api/v1/incidents`, {
        params: { cityId: city._id },
      });
      setIncidents(response.data.incidents || []);
    } catch (err) {
      setIncidents([]);
      setIncidentsError(err?.response?.data?.message || err.message);
    } finally {
      setIncidentsLoading(false);
    }
  }, [city?._id]);

  useEffect(() => {
    if (!enabled || !city?._id) {
      setIncidents([]);
      return;
    }
    fetchIncidents();
  }, [city?._id, enabled, fetchIncidents]);

  const layers = useMemo(() => {
    if (!city?.latitude || !city?.longitude) {
      return null;
    }

    const center = { lat: city.latitude, lng: city.longitude };
    const aqiValue = aqi?.data?.aqiValue ?? null;
    const aqiStyle = aqiZoneStyle(aqiValue);

    const weatherMain = String(weather?.data?.condition?.main || "").toLowerCase();
    const isAdverseWeather = ADVERSE_WEATHER.has(weatherMain);

    const hotspots = (traffic?.data?.hotspots || [])
      .filter((spot) => spot.lat != null && spot.lng != null)
      .map((spot, index) => {
        const style = hotspotStyle(spot);
        return {
          id: `hotspot-${index}-${spot.roadName || "road"}`,
          type: "traffic",
          position: { lat: spot.lat, lng: spot.lng },
          radius: style.radius,
          color: style.color,
          opacity: style.opacity,
          title: spot.roadName || "Traffic hotspot",
          meta: {
            delaySeconds: spot.delaySeconds,
            severity: spot.severity,
          },
        };
      });

    const incidentMarkers = incidents
      .filter((item) => item.latitude != null && item.longitude != null)
      .map((item) => ({
        id: item._id,
        type: "incident",
        position: { lat: item.latitude, lng: item.longitude },
        color: incidentMarkerColor(item.category),
        title: item.title,
        meta: {
          category: item.category,
          status: item.status,
          address: item.address,
          createdAt: item.createdAt,
        },
      }));

    return {
      center,
      cityName: city.name,
      aqiZone: {
        enabled: aqiValue != null,
        position: center,
        radius: aqiStyle.radius,
        color: aqiStyle.color,
        opacity: aqiStyle.opacity,
        label: aqiStyle.label,
        value: aqiValue,
        category: aqi?.data?.category,
      },
      weatherZone: {
        enabled: isAdverseWeather,
        position: center,
        radius: 5000,
        color: "#3b82f6",
        opacity: 0.14,
        label: weather?.data?.condition?.description || weatherMain,
        temperature: weather?.data?.temperature,
        humidity: weather?.data?.humidity,
        windSpeed: weather?.data?.wind?.speed,
      },
      hotspots,
      incidents: incidentMarkers,
      stats: {
        hotspotCount: hotspots.length,
        incidentCount: incidentMarkers.length,
        openIncidents: incidentMarkers.filter((item) => item.meta.status !== "Resolved").length,
        congestion: traffic?.data?.congestion?.level,
        avgSpeed: traffic?.data?.speed?.average,
      },
    };
  }, [city, aqi?.data, weather?.data, traffic?.data, incidents]);

  const loading = incidentsLoading || aqi?.loading || weather?.loading || traffic?.loading;
  const error = incidentsError || aqi?.error || weather?.error || traffic?.error;

  return {
    layers,
    loading,
    error,
    refetch: fetchIncidents,
  };
}

export { aqiZoneStyle, ADVERSE_WEATHER };

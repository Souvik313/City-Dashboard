import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000";

/**
 * Fetches weather trends and optional history for charts.
 * @param {string|null} cityNameOrId - City name or ObjectId (null to skip fetch)
 * @param {{ period?: '24h' | '7d', withHistory?: boolean }} options
 */
export default function useWeatherTrends(cityNameOrId, options = {}) {
  const { period = "24h", withHistory = true } = options;
  const [trends, setTrends] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTrends = useCallback(async () => {
    if (!cityNameOrId) return;
    setLoading(true);
    setError(null);
    try {
      const [trendsRes, historyRes] = await Promise.all([
        axios.get(`${API_URL}/api/v1/weather/trends`, {
          params: { city: cityNameOrId, period },
        }),
        withHistory
          ? axios.get(`${API_URL}/api/v1/weather/history`, {
              params: { city: cityNameOrId, limit: period === "7d" ? 200 : 100 },
            })
          : Promise.resolve({ data: {} }),
      ]);
      if (trendsRes.data?.status === "success") setTrends(trendsRes.data.data);
      if (withHistory && historyRes.data?.data?.length)
        setHistory([...historyRes.data.data].reverse());
      else setHistory(null);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
      setTrends(null);
      setHistory(null);
    } finally {
      setLoading(false);
    }
  }, [cityNameOrId, period, withHistory]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  return { trends, history, loading, error, refetch: fetchTrends };
}

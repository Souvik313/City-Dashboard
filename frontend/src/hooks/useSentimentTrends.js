import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_APP_API_URL || "http://localhost:5000";

/**
 * Fetches sentiment trends for a city (chat-driven sentiment).
 * @param {string|null} cityNameOrId - City name or ObjectId (null to skip fetch)
 * @param {{ period?: '24h' | '7d' }} options
 */
export default function useSentimentTrends(cityNameOrId, options = {}) {
  const { period = "24h" } = options;
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTrends = useCallback(async () => {
    if (!cityNameOrId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/api/v1/sentiment/trends`, {
        params: { city: cityNameOrId, period },
      });
      if (res.data?.status === "success") setTrends(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
      setTrends(null);
    } finally {
      setLoading(false);
    }
  }, [cityNameOrId, period]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  return { trends, loading, error, refetch: fetchTrends };
}

import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_APP_API_URL || "http://localhost:5000";

export default function useIncidentAnalytics(cityId, options = {}) {
  const { period = "24h", enabled = true, refreshKey = 0 } = options;
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    if (!cityId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_URL}/api/v1/incidents/analytics`, {
        params: { cityId, period },
      });

      if (response.data?.success) {
        setAnalytics(response.data.data);
      } else {
        setAnalytics(null);
        setError("Unable to load incident analytics.");
      }
    } catch (err) {
      setAnalytics(null);
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [cityId, period]);

  useEffect(() => {
    if (!enabled || !cityId) {
      setAnalytics(null);
      setError(null);
      return;
    }

    fetchAnalytics();
  }, [cityId, enabled, period, refreshKey, fetchAnalytics]);

  return { analytics, loading, error, refetch: fetchAnalytics };
}

import { useState, useEffect } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000";

const createSection = () => ({
  loading: false,
  data: null,
  error: null,
  lastUpdated: null
});

export default function useCityDashboard(
  city,
  { pollingInterval = 0, enabled = true } = {}
) {
  const [aqi, setAqi] = useState(createSection());
  const [weather, setWeather] = useState(createSection());
  const [traffic, setTraffic] = useState(createSection());
  const [cityPulse, setCityPulse] = useState(createSection());
  const [transit , setTransit] = useState(createSection());
  const [transitStats , setTransitStats] = useState(createSection());

const fetchData = async (setState, endpoint) => {
  if (!city) return;

  setState(prev => ({ ...prev, loading: true, error: null }));

  try {
    const res = await axios.get(
      `${API_URL}/api/v1/${endpoint}`,
      { params: { city } }
    );

    setState({
      loading: false,
      data: res.data.data,
      error: null,
      lastUpdated: new Date()
    });
  } catch (err) {
    setState({
      loading: false,
      data: null,
      error: err?.response?.data?.message || err.message,
      lastUpdated: null
    });
  }
};

  const fetchAll = () => {
    fetchData(setAqi, "aqi/latest");
    fetchData(setWeather, "weather/latest");
    fetchData(setTraffic, "traffic/latest");
    fetchData(setCityPulse, "citypulse");
    fetchData(setTransit , "transit/latest");
    fetchData(setTransitStats , "transit/stats");
  };

  useEffect(() => {
    if (!enabled || !city) return;

    fetchAll();

    let intervalId;
    if (pollingInterval > 0) {
      intervalId = setInterval(fetchAll, pollingInterval);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, enabled, pollingInterval]);

  const globalLoading =
    aqi.loading || weather.loading || traffic.loading;

  return {
    aqi,
    weather,
    traffic,
    cityPulse,
    transit,
    transitStats,
    refreshAll: fetchAll,
    refreshAqi: () => fetchData(setAqi, "aqi/latest"),
    refreshWeather: () => fetchData(setWeather, "weather/latest"),
    refreshTraffic: () => fetchData(setTraffic, "traffic/latest"),
    refreshCityPulse: () => fetchData(setCityPulse, "citypulse"),
    globalLoading: globalLoading || cityPulse.loading
  };
}


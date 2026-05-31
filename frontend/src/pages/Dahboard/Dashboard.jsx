import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useCityDashboard from "../../hooks/useCityDashboard.js";
import useDashboardPredictions, { formatDelta } from "../../hooks/useDashboardPredictions.js";
import PredictionInsight, { PredictionDelta } from "../../components/PredictionInsight/PredictionInsight.jsx";
import dashboard_icon from '../../assets/smart-city.png';
import axios from "axios";
import AQITrendsModal from "../../components/AQITrendsModal/AQITrendsModal.jsx";
import WeatherTrendsModal from "../../components/WeatherTrendsModal/WeatherTrendsModal.jsx";
import TrafficTrendsModal from "../../components/TrafficTrendsModal/TrafficTrendsModal.jsx";
import SentimentTrendsModal from "../../components/SentimentTrendsModal/SentimentTrendsModal.jsx";
import ChatbotIcon from '../../assets/ChatbotIcon.svg';
import airQualityIcon from '../../assets/air-quality-icon.svg';
import weatherIcon from '../../assets/weather-icon.svg';
import trafficIcon from '../../assets/traffic-icon.svg';
import sentimentIcon from '../../assets/sentiment-icon.svg';
import incidentIcon from '../../assets/incident-icon.svg';
import heatmapIcon from '../../assets/heatmap-icon.svg';
import weatherClearIcon from '../../assets/weather-clear.svg';
import weatherCloudsIcon from '../../assets/weather-clouds.svg';
import weatherRainIcon from '../../assets/weather-rain.svg';
import weatherStormIcon from '../../assets/weather-storm.svg';
import weatherSnowIcon from '../../assets/weather-snow.svg';
import weatherFogIcon from '../../assets/weather-fog.svg';
import weatherHazeIcon from '../../assets/weather-haze.svg';
import weatherWindIcon from '../../assets/weather-wind.svg';
import weatherUnknownIcon from '../../assets/weather-unknown.svg';
import "./Dashboard.css";
import "../../components/PredictionInsight/PredictionInsight.css";
import Alerts from "../../components/Alerts/Alerts.jsx";
import Chat from "../../components/Chat/Chat.jsx";
import IncidentReport from "../../components/IncidentReport/IncidentReport.jsx";
import CityHeatmap from "../../components/CityHeatmap/CityHeatmap.jsx";
import SentimentPanel from "../../components/SentimentPanel/SentimentPanel.jsx";
const API_URL = "http://localhost:5000";

export default function Dashboard() {
  const [inputCity, setInputCity] = useState("");
  const [selectedCity , setSelectedCity] = useState(null);
  const [showHotspotsModal , setShowHotspotsModal]  = useState(false);
  const [showAqiTrendsModal, setShowAqiTrendsModal] = useState(false);
  const [showWeatherTrendsModal, setShowWeatherTrendsModal] = useState(false);
  const [showTrafficTrendsModal , setShowTrafficTrendsModal] = useState(false);
  const [showSentimentTrendsModal, setShowSentimentTrendsModal] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [darkMode , setDarkMode] = useState(false);

  const weatherIconMap = {
    clear: weatherClearIcon,
    clouds: weatherCloudsIcon,
    rain: weatherRainIcon,
    drizzle: weatherRainIcon,
    thunderstorm: weatherStormIcon,
    snow: weatherSnowIcon,
    mist: weatherFogIcon,
    smoke: weatherHazeIcon,
    haze: weatherHazeIcon,
    dust: weatherHazeIcon,
    fog: weatherFogIcon,
    sand: weatherHazeIcon,
    ash: weatherHazeIcon,
    squall: weatherWindIcon,
    tornado: weatherStormIcon,
    wind: weatherWindIcon,
  };

  const getWeatherIcon = (conditionMain) => {
    const key = String(conditionMain || '').toLowerCase();
    return weatherIconMap[key] || weatherUnknownIcon;
  };

  const getHealthStatus = (score) => {
    if (score == null) {
      return { label: "Unavailable", description: "No health score available yet.", color: "var(--muted)" };
    }

    if (score >= 80) {
      return { label: "Healthy", description: "City systems are performing well across air, traffic, weather, and sentiment.", color: "var(--success)" };
    }

    if (score >= 60) {
      return { label: "Stable", description: "City health is acceptable but there are areas to watch.", color: "var(--warning)" };
    }

    if (score >= 40) {
      return { label: "At risk", description: "Conditions are declining and may need attention soon.", color: "var(--danger)" };
    }

    return { label: "Critical", description: "City health is poor and major issues are impacting urban livability.", color: "var(--danger)" };
  };

  const [activeTopic, setActiveTopic] = useState('air');
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const cityName = selectedCity?.name;

  const topics = [
    { id: 'air', icon: airQualityIcon, label: 'Air Quality', description: 'AQI details, pollutant levels, health impact, and next-hour forecast.' },
    { id: 'weather', icon: weatherIcon, label: 'Weather', description: 'Current conditions and next-hour weather forecast.' },
    { id: 'traffic', icon: trafficIcon, label: 'Traffic', description: 'Congestion status, hotspots, and next-hour traffic outlook.' },
    { id: 'sentiment', icon: sentimentIcon, label: 'Sentiment', description: 'Citizen mood pulse, chat trends, topics, and emotion analytics.' },
    { id: 'incidents', icon: incidentIcon, label: 'Incident Reports', description: 'Submit issues, view analytics, and track recent local reports.' },
    { id: 'heatmap', icon: heatmapIcon, label: 'Heatmap', description: 'Interactive city map with AQI, weather, traffic hotspots, and incident layers.' },
  ];

  const activeTopicMeta = topics.find((topic) => topic.id === activeTopic);

  const renderTopicContent = () => {
    if (!selectedCity) {
      return (
        <div className="dashboard-empty-state">
          <h3>Select a city to explore dashboard topics.</h3>
          <p>Use the search box above to load your city.</p>
        </div>
      );
    }

    switch (activeTopic) {
      case 'weather':
        return (
          <div className="topic-panel">
            <div className="topic-section">
              <h3>Current weather</h3>
              {weather.loading && <div className="skeleton">Loading weather…</div>}
              {weather.error && <div className="error">Weather error: {weather.error}</div>}
              {weather.data && (
                <div className="topic-card">
                  <img
                    src={getWeatherIcon(weather.data.condition?.main)}
                    alt={weather.data.condition?.description || 'Current weather'}
                    className="weather-cond"
                  />
                  <div className="metric-row">
                    <div className="metric">
                      <strong>{weather.data.temperature}°C</strong>
                      <span>Temperature</span>
                    </div>
                    <div className="metric">
                      <strong>{weather.data.condition?.description || '—'}</strong>
                      <span>Condition</span>
                    </div>
                    <div className="metric">
                      <strong>{weather.data.humidity ?? '—'}</strong>
                      <span>Humidity</span>
                    </div>
                    <div className="metric">
                      <strong>{weather.data.wind?.speed || '—'}</strong>
                      <span>Wind speed</span>
                    </div>
                  </div>
                </div>
              )}
              <PredictionInsight
                title="Next-hour weather forecast"
                loading={weatherPrediction.loading}
                error={weatherPrediction.error}
                fallback={weatherPrediction.data?.fallback}
                timestamp={weatherPrediction.data?.timestamp}
              >
                {weatherPrediction.data && (
                  <div className="prediction-metrics">
                    <div className="prediction-metric">
                      <strong>{weatherPrediction.data.temperature ?? "—"}°C</strong>
                      <span>Temperature</span>
                      {weather.data?.temperature != null && weatherPrediction.data.temperature != null && (
                        <PredictionDelta
                          delta={formatDelta(
                            weatherPrediction.data.temperature - weather.data.temperature,
                            "°C"
                          )}
                        />
                      )}
                    </div>
                    <div className="prediction-metric">
                      <strong>{weatherPrediction.data.condition || "—"}</strong>
                      <span>Condition</span>
                    </div>
                    <div className="prediction-metric">
                      <strong>{weatherPrediction.data.humidity ?? "—"}%</strong>
                      <span>Humidity</span>
                    </div>
                  </div>
                )}
              </PredictionInsight>
            </div>
          </div>
        );

      case 'traffic':
        return (
          <div className="topic-panel">
            <div className="topic-section">
              <h3>Traffic status</h3>
              {traffic.loading && <div className="skeleton">Loading traffic…</div>}
              {traffic.error && <div className="error">Traffic error: {traffic.error}</div>}
              {traffic.data && (
                <div className="topic-card">
                  <div className="metric-row">
                    <div className="metric">
                      <strong>{traffic.data.congestion.level}</strong>
                      <span>Congestion</span>
                    </div>
                    <div className="metric">
                      <strong>{traffic.data.speed.average ?? '—'}</strong>
                      <span>Average speed</span>
                    </div>
                    <div className="metric">
                      <strong>{traffic.data.roadClosureCount}</strong>
                      <span>Road closures</span>
                    </div>
                  </div>
                  <div className="hotspots-panel">
                    <strong>Top hotspot</strong>
                    {traffic.data.hotspots && traffic.data.hotspots.length > 0 ? (
                      <>
                        <div className="hotspot-summary">
                          {traffic.data.hotspots[0].roadName} • Delay {secToMin(traffic.data.hotspots[0].delaySeconds)} min
                        </div>
                        {traffic.data.hotspots.length > 1 && (
                          <button className="show-more-btn" disabled={traffic.loading} onClick={() => setShowHotspotsModal(true)}>
                            View all hotspots
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="muted">No major hotspots detected.</div>
                    )}
                  </div>
                </div>
              )}
              <PredictionInsight
                title="Next-hour traffic outlook"
                loading={trafficPrediction.loading}
                error={trafficPrediction.error}
                fallback={trafficPrediction.data?.fallback}
                timestamp={trafficPrediction.data?.timestamp}
              >
                {trafficPrediction.data && (
                  <div className="prediction-metrics">
                    <div className="prediction-metric">
                      <strong>{trafficPrediction.data.congestionLevel}</strong>
                      <span>Congestion</span>
                    </div>
                    <div className="prediction-metric">
                      <strong>{trafficPrediction.data.avgSpeed ?? "—"}</strong>
                      <span>Avg speed (km/h)</span>
                      {traffic.data?.speed?.average != null &&
                        trafficPrediction.data.avgSpeed != null && (
                          <PredictionDelta
                            delta={formatDelta(
                              trafficPrediction.data.avgSpeed - traffic.data.speed.average,
                              " km/h"
                            )}
                          />
                        )}
                    </div>
                    <div className="prediction-metric">
                      <strong>{trafficPrediction.data.travelTimeIndex ?? "—"}</strong>
                      <span>Travel time index</span>
                    </div>
                  </div>
                )}
              </PredictionInsight>
            </div>
          </div>
        );

      case 'sentiment':
        return (
          <div className="topic-panel">
            <div className="topic-section sentiment-section">
              <SentimentPanel cityName={cityName} />
            </div>
          </div>
        );

      case 'incidents':
        return (
          <div className="topic-panel">
            <IncidentReport
              city={selectedCity}
              onSelectIncident={setSelectedIncident}
              selectedIncident={selectedIncident}
              onCloseIncident={() => setSelectedIncident(null)}
            />
          </div>
        );

      case 'heatmap':
        return (
          <div className="topic-panel">
            <div className="topic-section city-heatmap-section">
              <CityHeatmap
                city={selectedCity}
                aqi={aqi}
                weather={weather}
                traffic={traffic}
                aqiPrediction={aqiPrediction}
              />
            </div>
          </div>
        );

      case 'air':
      default:
        return (
          <div className="topic-panel">
            <div className="topic-section">
              <h3>Air quality overview</h3>
              {aqi.loading && <div className="skeleton">Loading air quality data…</div>}
              {aqi.error && <div className="error">⚠ {aqi.error}</div>}
              {aqi.data && (
                <div className="topic-card air-card">
                  <div className="aqi-overview-panel">
                    <div className="aqi-summary">
                      <div className="aqi-value">
                        <span className="value">{aqi.data.aqiValue}</span>
                        <span className="label">AQI</span>
                      </div>
                      <div className="aqi-summary-detail">
                        <span className={`aqi-badge ${aqi.data.category?.toLowerCase().replace(/ /g, "-")}`}>
                          {aqiBadge(aqi.data.category)}
                        </span>
                        <p className="aqi-summary-copy">
                          Current air quality is <strong>{aqi.data.category || "Unknown"}</strong>. This gives a quick view of city-wide risk.
                        </p>
                      </div>
                    </div>

                    <div className="aqi-quick-insights">
                      <div className="aqi-quick-card">
                        <span>Dominant pollutant</span>
                        <strong>{(aqi.data.dominantPollutant || "unknown").toUpperCase()}</strong>
                        <p>Most likely driver of current AQI risk.</p>
                      </div>
                      <div className="aqi-quick-card">
                        <span>Risk level</span>
                        <strong>{aqi.data.category || "Moderate"}</strong>
                        <p>{aqi.data.healthImpact || "Monitor local conditions and reduce exposure if needed."}</p>
                      </div>
                    </div>

                    <div className="aqi-metrics-grid">
                      <div className="pollutant-card">
                        <span>PM2.5</span>
                        <strong>{aqi.data.pollutants?.pm25 ?? "—"}</strong>
                      </div>
                      <div className="pollutant-card">
                        <span>PM10</span>
                        <strong>{aqi.data.pollutants?.pm10 ?? "—"}</strong>
                      </div>
                      <div className="pollutant-card">
                        <span>NO₂</span>
                        <strong>{aqi.data.pollutants?.no2 ?? "—"}</strong>
                      </div>
                      <div className="pollutant-card">
                        <span>SO₂</span>
                        <strong>{aqi.data.pollutants?.so2 ?? "—"}</strong>
                      </div>
                      <div className="pollutant-card">
                        <span>O₃</span>
                        <strong>{aqi.data.pollutants?.o3 ?? "—"}</strong>
                      </div>
                      <div className="pollutant-card">
                        <span>CO</span>
                        <strong>{aqi.data.pollutants?.co ?? "—"}</strong>
                      </div>
                    </div>

                    <div className="aqi-risk-block">
                      <div className="aqi-risk-summary">
                        <strong>Health advice</strong>
                        <p>{aqi.data.healthImpact || "Air quality data is available. Follow local precautions if needed."}</p>
                      </div>
                      <div className="aqi-risk-actions">
                      <div className="risk-section">
                        <span className="section-label">Who is most at risk</span>
                        <ul>
                          {getAQIRiskInfo(aqi.data.category).atRisk.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="risk-section">
                        <span className="section-label">Recommended actions</span>
                        <ul>
                          {getAQIRiskInfo(aqi.data.category).precautions.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    </div>

                    <button className="analyze-btn" disabled={aqi.loading} onClick={() => setShowAqiTrendsModal(true)}>
                      Analyze latest trends
                    </button>
                  </div>
                </div>
              )}
              <PredictionInsight
                title="Next-hour AQI forecast"
                loading={aqiPrediction.loading}
                error={aqiPrediction.error}
                fallback={aqiPrediction.data?.fallback}
                timestamp={aqiPrediction.data?.timestamp}
                message={aqiPrediction.data?.message}
              >
                {aqiPrediction.data && (
                  <>
                    <div className="aqi-summary">
                      <div className="aqi-value">
                        <span className="value">{aqiPrediction.data.prediction}</span>
                        <span className="label">Predicted AQI</span>
                      </div>
                      <span className={`aqi-badge ${aqiPrediction.data.category?.toLowerCase().split(" ")[0]}`}>
                        {aqiBadge(aqiPrediction.data.category)}
                      </span>
                    </div>
                    <div className="prediction-metrics">
                      <div className="prediction-metric">
                        <strong>±{aqiPrediction.data.uncertainty ?? "—"}</strong>
                        <span>Uncertainty</span>
                      </div>
                      <div className="prediction-metric">
                        <strong>{aqiPrediction.data.currentAqi ?? aqi.data?.aqiValue ?? "—"}</strong>
                        <span>Current AQI</span>
                        {aqiPrediction.data.currentAqi != null && (
                          <PredictionDelta
                            delta={formatDelta(
                              aqiPrediction.data.prediction - aqiPrediction.data.currentAqi
                            )}
                          />
                        )}
                      </div>
                    </div>
                  </>
                )}
              </PredictionInsight>
            </div>
          </div>
        );
    }
  };

  useEffect(() => {
    const header = document.querySelector(".dashboard-header");

    const onScroll = () => {
      if (window.scrollY > 10) {
        header.classList.add("scrolled");
      } else {
        header.classList.remove("scrolled");
      }
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    return () => {
      // cleanup: remove dark class when leaving dashboard
      document.documentElement.classList.remove('dark');
    };
  }, []);

  const fetchCityDetails = async(cityName) => {
    try {
      const res = await axios.get(`${API_URL}/api/v1/city/search?city=${encodeURIComponent(cityName)}` ,
      {
        validateStatus: (status) => status === 200 || status === 404
      });


      if(res.data.success){
        setSelectedCity(res.data.city);
        setInputCity(cityName);
        localStorage.setItem("lastCity" , cityName);
      }
    } catch (error) {
      console.log(error.message);
      alert(`Failed to fetch details for city: ${cityName}`);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qCity = params.get("city");

    const fetchCity = async () => {
      if (qCity) {
        await fetchCityDetails(qCity);
      }
    };

    fetchCity();
  }, [location.search]);

  const {
    aqi,
    weather,
    traffic,
    cityPulse,
    refreshAll,
    globalLoading,
  } = useCityDashboard(cityName, { pollingInterval: 0, enabled: Boolean(cityName) });

  const {
    aqi: aqiPrediction,
    weather: weatherPrediction,
    traffic: trafficPrediction,
    refreshPredictions,
  } = useDashboardPredictions(cityName, { enabled: Boolean(cityName) });

  const handleRefreshAll = () => {
    refreshAll();
    refreshPredictions();
  };

  const renderPredictionOverview = () => {
    if (!selectedCity) return null;

    const aqiDelta = aqiPrediction.data
      ? formatDelta(aqiPrediction.data.prediction - (aqiPrediction.data.currentAqi ?? aqi.data?.aqiValue))
      : null;

    return (
      <div className="prediction-overview">
        <div className="prediction-overview-card">
          <h3>Air quality</h3>
          {aqiPrediction.loading ? (
            <div className="skeleton">Loading…</div>
          ) : aqiPrediction.data ? (
            <>
              <div className="overview-value">{aqiPrediction.data.prediction} AQI</div>
              <div className="overview-meta">
                {aqiPrediction.data.category}
                {aqiPrediction.data.uncertainty != null && ` · ±${aqiPrediction.data.uncertainty}`}
              </div>
              <PredictionDelta delta={aqiDelta} />
            </>
          ) : (
            <div className="muted">{aqiPrediction.error || "Forecast unavailable"}</div>
          )}
        </div>

        <div className="prediction-overview-card">
          <h3>Weather</h3>
          {weatherPrediction.loading ? (
            <div className="skeleton">Loading…</div>
          ) : weatherPrediction.data ? (
            <>
              <div className="overview-value">
                {weatherPrediction.data.temperature != null
                  ? `${weatherPrediction.data.temperature}°C`
                  : "—"}
              </div>
              <div className="overview-meta">
                {weatherPrediction.data.condition || "Condition pending"}
              </div>
            </>
          ) : (
            <div className="muted">{weatherPrediction.error || "Forecast unavailable"}</div>
          )}
        </div>

        <div className="prediction-overview-card">
          <h3>Traffic</h3>
          {trafficPrediction.loading ? (
            <div className="skeleton">Loading…</div>
          ) : trafficPrediction.data ? (
            <>
              <div className="overview-value">
                {trafficPrediction.data.congestionLevel}
              </div>
              <div className="overview-meta">
                {trafficPrediction.data.avgSpeed != null
                  ? `${trafficPrediction.data.avgSpeed} km/h avg speed`
                  : "Speed estimate pending"}
              </div>
            </>
          ) : (
            <div className="muted">{trafficPrediction.error || "Forecast unavailable"}</div>
          )}
        </div>

        <div className="prediction-overview-card">
          <h3>City health</h3>
          {cityPulse.loading ? (
            <div className="skeleton">Loading…</div>
          ) : cityPulse.error ? (
            <div className="muted">{cityPulse.error || "Health overview unavailable"}</div>
          ) : cityPulse.data ? (
            <>
              <div className="overview-value">
                {cityPulse.data.pulseScore != null ? `${cityPulse.data.pulseScore}%` : "—"}
              </div>
              <div className="overview-meta" style={{ color: getHealthStatus(cityPulse.data.pulseScore).color }}>
                {getHealthStatus(cityPulse.data.pulseScore).label}
              </div>
              <div className="overview-description">
                {getHealthStatus(cityPulse.data.pulseScore).description}
              </div>
            </>
          ) : (
            <div className="muted">Health overview unavailable</div>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (showHotspotsModal) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => document.body.classList.remove("modal-open");
  }, [showHotspotsModal]);


  const submitCity = async(e) => {
    e.preventDefault();
    const cleaned = inputCity.trim();
    if (!cleaned) return;
    try{
        await axios.post(`${API_URL}/api/v1/city/` , {city : cleaned} ,
      {
        validateStatus: (status) => status === 201 || status === 409
      });
        navigate(`/dashboard?city=${encodeURIComponent(cleaned)}`);
    } catch(error) {
      console.log(error.message);
      alert(`Failed to display dashboard for ${cleaned}`);
    } 
  };

  const aqiBadge = (category) => {
    switch (category?.toLowerCase()) {
      case "good":
        return <div>🍃 {category}</div>;
      case "moderate":
        return <div>😐 {category}</div>;
      case "unhealthy for sensitive groups":
        return <div>🤧 {category}</div>;
      case "unhealthy":
        return <div>😷 {category}</div>;
      case "very unhealthy":
        return <div>⚠️ {category}</div>;
      case "hazardous":
        return <div>☠️ {category}</div>;
      default:
        return <div>🌫️ {category}</div>;
    }
  };

  const getAQIRiskInfo = (category) => {
    switch (String(category || "").toLowerCase()) {
      case "good":
        return {
          summary: "Air quality is good. Outdoor activities are safe for everyone.",
          atRisk: ["Everyone"],
          precautions: ["Enjoy outdoor plans", "Keep windows open if needed", "No special action required"],
        };
      case "moderate":
        return {
          summary: "Air quality is moderate. Sensitive groups should take light precautions.",
          atRisk: ["Children", "Elderly", "People with asthma"],
          precautions: ["Reduce prolonged outdoor exertion", "Monitor symptoms", "Keep indoor air clean"],
        };
      case "unhealthy for sensitive groups":
        return {
          summary: "Air quality is unhealthy for sensitive groups. Limit long outdoor exposure.",
          atRisk: ["People with respiratory issues", "Older adults", "Young children"],
          precautions: ["Avoid heavy exercise outdoors", "Use masks when outside", "Keep windows closed during peak hours"],
        };
      case "unhealthy":
        return {
          summary: "Air quality is unhealthy. Everyone should reduce outdoor activities.",
          atRisk: ["Everyone"],
          precautions: ["Avoid outdoor exercise", "Keep doors and windows closed", "Use air purifiers if available"],
        };
      case "very unhealthy":
        return {
          summary: "Air quality is very unhealthy. Minimize all outdoor exposure.",
          atRisk: ["Everyone"],
          precautions: ["Stay indoors as much as possible", "Use N95 masks if outside", "Avoid traffic-heavy zones"],
        };
      case "hazardous":
        return {
          summary: "Air quality is hazardous. Do not stay outdoors unless absolutely necessary.",
          atRisk: ["Everyone"],
          precautions: ["Stay indoors", "Use high-efficiency air filtration", "Seek medical help if symptoms worsen"],
        };
      default:
        return {
          summary: "AQI category unavailable. Check local conditions and stay alert.",
          atRisk: ["Everyone"],
          precautions: ["Monitor air quality updates", "Limit time outdoors if you feel unwell"],
        };
    }
  };

  const secToMin = (seconds) => {
    if (typeof seconds !== "number" || seconds < 0) return "—";
    return (seconds / 60).toFixed(1);
  }

  const distanceFromCityCenter = (lat, lng) => {
    if (!selectedCity?.latitude || !selectedCity?.longitude) return null;
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRad(lat - selectedCity.latitude);
    const dLon = toRad(lng - selectedCity.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(selectedCity.latitude)) *
      Math.cos(toRad(lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  };

  const openCityMap = () => {
    if(!selectedCity) return;

    const {latitude , longitude} = selectedCity;

    window.open(
      `https://www.google.com/maps?q=${latitude},${longitude}&z=12`,
      "_blank"
    );
  }

  return (
    <>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <h1>
            <img src={dashboard_icon} alt="" className="dashboard-icon"/>
            CityPulse Dashboard
          </h1>
          
          {/* <button
            className="theme-toggle"
            onClick={() => {
              setDarkMode(prev => {
                document.documentElement.classList.toggle('dark', !prev);
                return !prev;
              }}
            }
            aria-label="Toggle dark mode"
          >
            {darkMode ? '☀️' : '🌙'}
          </button> */}
          <form onSubmit={submitCity} className="city-form">
            <input
              value={inputCity}
              onChange={(e) => setInputCity(e.target.value)}
              placeholder="Enter city name (e.g., Lagos)"
              aria-label="City name"
              className="city-input"
            />
            <button type="submit" className="btn-primary">
              Load
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setInputCity("");
              }}
            >
              Clear
            </button>
          </form>
          <button
            className="theme-toggle"
            onClick={() => {
              setDarkMode(prev => {
                document.documentElement.classList.toggle('dark', !prev);
                return !prev;
              })}}
            aria-label="Toggle dark mode"
          >
                {darkMode ? (     
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
          </button>
          <Alerts city={selectedCity} />
          <button
            className="btn-exit"
            onClick={() => navigate("/")}
            aria-label="Exit dashboard"
          >
            Exit
          </button>
        </header>

        <main className="dashboard-main">
          <div className={`dashboard-layout ${sidebarCollapsed ? 'collapsed' : ''}`}>
            <aside className={`dashboard-sidebar-panel ${sidebarCollapsed ? 'collapsed' : ''}`}>
              <div className="sidebar-header">
                <div>
                  <div className="dashboard-sidebar-title">CityPulse Topics</div>
                  <div className="dashboard-sidebar-city">{cityName || 'Choose a city'}</div>
                </div>
                <button
                  type="button"
                  className="sidebar-toggle"
                  onClick={() => setSidebarCollapsed((open) => !open)}
                  aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {sidebarCollapsed ? '›' : '‹'}
                </button>
              </div>
              <hr className="sidebar-divider" />
              <nav className="dashboard-topic-nav">
                {topics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    className={`dashboard-topic-nav-item ${activeTopic === topic.id ? 'active' : ''}`}
                    onClick={() => setActiveTopic(topic.id)}
                    title={sidebarCollapsed ? topic.label : ''}
                  >
                    <span className="topic-icon">
                      <img src={topic.icon} alt={`${topic.label} icon`} />
                    </span>
                    <span className="topic-label">{topic.label}</span>
                  </button>
                ))}
              </nav>
            </aside>

            <section className="dashboard-content-panel">
              <div className="dashboard-controls">
                <div>
                  Active city: <strong>{cityName || '—'}</strong>
                </div>
                <button
                  onClick={handleRefreshAll}
                  disabled={!cityName}
                  className="btn-refresh"
                >
                  ⟳ Refresh all
                </button>
                {(globalLoading || aqiPrediction.loading) && (
                  <span className="loading-indicator">Loading…</span>
                )}
              </div>

              {renderPredictionOverview()}

              <div className="topic-header">
                <div>
                  <h2>{activeTopicMeta?.label || 'Air Quality'}</h2>
                  <p className="topic-description">{activeTopicMeta?.description}</p>
                </div>
                <div className="topic-actions">
                  {activeTopic === 'air' && (
                    <button className="analyze-btn" disabled={!cityName} onClick={() => setShowAqiTrendsModal(true)}>
                      Analyze latest trends
                    </button>
                  )}
                  {activeTopic === 'weather' && (
                    <button className="analyze-btn" disabled={!cityName} onClick={() => setShowWeatherTrendsModal(true)}>
                      Analyze latest trends
                    </button>
                  )}
                  {activeTopic === 'traffic' && (
                    <button className="analyze-btn" disabled={!cityName} onClick={() => setShowTrafficTrendsModal(true)}>
                      Analyze latest trends
                    </button>
                  )}
                  {activeTopic === 'sentiment' && (
                    <button className="analyze-btn" disabled={!cityName} onClick={() => setShowSentimentTrendsModal(true)}>
                      Analyze latest trends
                    </button>
                  )}
                </div>
              </div>

                      {renderTopicContent()}
            </section>
          </div>
        </main>

        {/* Chat widget for city feedback */}
        <div style={{position: 'fixed', right: 16, bottom: 16, zIndex: 60}}>
          <img src={ChatbotIcon} 
              alt="open-chat" 
              onClick={() => setIsChatOpen(prev => !prev)}
              style={{cursor : 'pointer'}}/>
              {isChatOpen && <Chat cityId={selectedCity?._id} />} 
        </div>

        <div className="view-city-map">
          <button className="explore-map" onClick={() => openCityMap()}>View on map</button>
        </div>

        {showAqiTrendsModal && cityName && (
          <AQITrendsModal
            cityName={cityName}
            onClose={() => setShowAqiTrendsModal(false)}
          />
        )}
        {showWeatherTrendsModal && cityName && (
          <WeatherTrendsModal
            cityName={cityName}
            onClose={() => setShowWeatherTrendsModal(false)}
          />
        )}
        {showTrafficTrendsModal && cityName && (
          <TrafficTrendsModal 
            cityName={cityName}
            onClose={() => setShowTrafficTrendsModal(false)}
          />
        )}
        {showHotspotsModal && traffic.data?.hotspots?.length > 0 && (
          <div className="modal-overlay" onClick={() => setShowHotspotsModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>All traffic hotspots</h3>
              <button className="close-modal" onClick={() => setShowHotspotsModal(false)} aria-label="Close hotspots modal">✕</button>
              <div className="modal-hotspot-list">
                {traffic.data.hotspots.map((hotspot, index) => (
                  <div key={`${hotspot.roadName}-${index}`} className="modal-hotspot">
                    <div className="hotspot-info">
                      <strong>{hotspot.roadName || 'Unknown Road'}</strong>
                      <span>{hotspot.delaySeconds != null ? `${secToMin(hotspot.delaySeconds)}min delay` : 'No delay data'}</span>
                    </div>
                    <div className="hotspot-info">
                      <span>{hotspot.severity ? `Severity ${hotspot.severity}` : 'Severity unknown'}</span>
                      <span>{hotspot.lat && hotspot.lng ? `${distanceFromCityCenter(hotspot.lat, hotspot.lng)} km from city center` : 'Location unknown'}</span>
                    </div>
                    {hotspot.lat && hotspot.lng && (
                      <div className="hotspot-map-container">
                        <iframe
                          className="hotspot-map"
                          title={`Map preview for ${hotspot.roadName || 'hotspot'}`}
                          src={`https://www.google.com/maps?q=${hotspot.lat},${hotspot.lng}&z=15&output=embed`}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                        <a
                          className="hotspot-map-overlay"
                          href={`https://www.google.com/maps?q=${hotspot.lat},${hotspot.lng}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in Google Maps
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {showSentimentTrendsModal && cityName && (
          <SentimentTrendsModal
            cityName={cityName}
            onClose={() => setShowSentimentTrendsModal(false)}
          />
        )}
      </div>
    </>
  );
}

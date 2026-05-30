import AQIData from "../models/AQI.model.js";
import WeatherData from "../models/WeatherData.model.js";
import TrafficData from "../models/TrafficData.model.js";
import SentimentRecord from "../models/SentimentRecord.model.js";
import City from "../models/city.model.js";

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Main CityPulse aggregation service
 */
export const generateCityPulse = async (city) => {
  const cityRecord = await City.findOne({
    name: new RegExp(`^${escapeRegex(city.trim())}$`, "i")
  });

  if (!cityRecord) {
    return null;
  }

  const cityId = cityRecord._id;

  // Fetch latest records in parallel
  const [
    latestAQI,
    latestWeather,
    latestTraffic,
    sentimentStats
  ] = await Promise.all([
    AQIData.findOne({ city: cityId }).sort({ recordedAt: -1 }),
    WeatherData.findOne({ city: cityId }).sort({ recordedAt: -1 }),
    TrafficData.findOne({ city: cityId }).sort({ recordedAt: -1 }),
    aggregateRecentSentiment(cityId)
  ]);

  return {
    city,
    timestamp: new Date(),
    airQuality: latestAQI
      ? {
          aqi: latestAQI.aqiValue,
          category: latestAQI.category
        }
      : null,
    weather: latestWeather
      ? {
          temperature: latestWeather.temperature,
          condition: latestWeather.condition,
          humidity: latestWeather.humidity
        }
      : null,
    traffic: latestTraffic
      ? {
          congestionLevel: latestTraffic.congestion?.level,
          averageSpeed: latestTraffic.speed?.average
        }
      : null,
    publicSentiment: sentimentStats,
    pulseScore: calculatePulseScore({
      aqi: latestAQI,
      traffic: latestTraffic,
      weather: latestWeather,
      sentiment: sentimentStats
    })
  };
};

/**
 * Aggregate sentiment for last 1 hour
 */
const aggregateRecentSentiment = async (cityId) => {
  const result = await SentimentRecord.aggregate([
    {
      $match: {
        city: cityId,
        createdAt: {
          $gte: new Date(Date.now() - 60 * 60 * 1000)
        }
      }
    },
    {
      $group: {
        _id: "$emotion",
        count: { $sum: 1 },
        avgScore: { $avg: "$score" }
      }
    }
  ]);

  return result;
};

/**
 * Final CityPulse scoring logic (0–100)
 */
const calculatePulseScore = ({ aqi, traffic, weather, sentiment }) => {
  let score = 100;

  // AQI impact
  const aqiValue = aqi?.aqiValue ?? aqi?.aqi;
  if (typeof aqiValue === "number") {
    if (aqiValue > 300) score -= 30;
    else if (aqiValue > 200) score -= 20;
    else if (aqiValue > 100) score -= 10;
  }

  // Traffic impact
  const congestionLevel =
    traffic?.congestion?.level || traffic?.congestionLevel || "unknown";
  if (congestionLevel.toLowerCase() === "high") score -= 15;
  else if (congestionLevel.toLowerCase() === "moderate") score -= 8;
  else if (congestionLevel.toLowerCase() === "severe") score -= 20;

  // Weather discomfort
  if (weather?.temperature > 40) score -= 10;
  if (weather?.humidity > 80) score -= 5;

  // Sentiment impact
  const negativeEmotion = sentiment?.find(
    (s) => ["anger", "sad", "frustrated"].includes(s._id)
  );
  if (negativeEmotion?.count > 10) score -= 10;

  return Math.max(score, 0);
};

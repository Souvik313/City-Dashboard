import axios from "axios";
import AppError from "../utils/AppError.js";
import WeatherData from "../models/WeatherData.model.js";
import City from "../models/city.model.js";
import DataSource from "../models/dataSource.model.js";
/**
 * Fetch live weather data from OpenWeatherMap API
 * @param {Object} params
 * @param {string} params.city
 * @param {number} params.lat
 * @param {number} params.lon
 */
export const fetchLiveWeather = async ({ city, lat, lon }) => {
  try {
    const API_KEY = process.env.OPENWEATHER_API_KEY;

    if (!API_KEY) {
      throw new AppError("Weather API key not configured", 500);
    }

    const latitude = Number(lat);
    const longitude = Number(lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new AppError(
        `Invalid coordinates for weather: lat=${lat}, lon=${lon}`,
        400
      );
    }

    const response = await axios.get(
      "https://api.openweathermap.org/data/2.5/weather",
      {
        params: {
          lat: latitude,
          lon: longitude,
          appid: API_KEY,
          units: "metric"
        },
        timeout: 5000
      }
    );

    const data = response.data;

    if (!data?.main) {
      throw new AppError("Invalid weather data received", 502);
    }

    return {
      city,
      temperature: data.main.temp,
      feelsLike: data.main.feels_like,
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      windSpeed: data.wind?.speed ?? null,
      windDirection: data.wind?.deg ?? null,
      conditionMain: data.weather?.[0]?.main ?? "unknown",
      weatherCondition: data.weather?.[0]?.description ?? "unknown",
      visibility: data.visibility ?? null,
      cloudCoverage: data.clouds?.all ?? null,
      source: "openweathermap"
    };
  } catch (error) {
    console.error("WEATHER FETCH ERROR →", {
    message: error.message,
    code: error.code,
    status: error.response?.status,
    data: error.response?.data,
    lat,
    lon});
    
    if (error instanceof AppError) throw error;

    throw new AppError("Failed to fetch live weather data", 503);
  }
};

export const fetchAndStoreWeatherForCity = async (cityName) => {
  const cityDoc = await City.findOne({
    name: { $regex: new RegExp(`^${cityName}$`, "i") }
  });

  if (!cityDoc) throw new AppError(`City not found: ${cityName}`, 404);

  const weather = await fetchLiveWeather({
    city: cityDoc.name,
    lat: cityDoc.latitude,
    lon: cityDoc.longitude
  });

  let dataSource = await DataSource.findOne({ name: "OpenWeatherMap api" });
  if (!dataSource) {
    dataSource = await DataSource.create({
      name: "OpenWeatherMap api",
      type: "api",
      reliabilityScore: 9,
      lastFetchedAt: new Date()
    });
  }

  await WeatherData.create({
    city: cityDoc._id,
    source: dataSource._id,
    temperature: Math.round(weather.temperature * 10) / 10,
    feelsLike: weather.feelsLike != null ? Math.round(weather.feelsLike * 10) / 10 : null,
    humidity: weather.humidity ?? null,
    pressure: weather.pressure ?? null,
    wind: weather.windSpeed || weather.windDirection ? {
      speed: weather.windSpeed ?? null,
      direction: weather.windDirection ? String(weather.windDirection) : null
    } : undefined,
    condition: {
      main: weather.conditionMain || "unknown",
      description: weather.weatherCondition || "unknown"
    },
    visibility: weather.visibility ?? null,
    cloudCover: weather.cloudCoverage ?? null,
    recordedAt: new Date()
  });

  return { cityDoc, weather };
};


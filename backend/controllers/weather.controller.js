import WeatherData from "../models/WeatherData.model.js";
import City from "../models/city.model.js";
import DataSource from "../models/dataSource.model.js";
import { fetchLiveWeather } from "../services/weather.service.js";
import { getWeatherTrends as getWeatherTrendsService } from "../services/weatherTrends.service.js";
import axios from 'axios';
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
const WEATHER_CACHE_TIME = 10*60*1000; //10 Minutes

export const fetchAndStoreWeather = catchAsync(async (req, res, next) => {
  const { city } = req.body;

  if (!city) {
    return next(
      new AppError("City name is required", 400)
    );
  }

  // Find or create City document
  let cityDoc = await City.findOne({ name: { $regex: new RegExp(`^${city}$`, 'i') } });
  if (!cityDoc) {

     let latitude = 0, longitude = 0, state = "Unknown", country = "Unknown";

    try {
        const geoRes = await axios.get("http://api.openweathermap.org/geo/1.0/direct", {
            params: {
                q: city,
                limit: 1,
                appid: process.env.OPENWEATHER_API_KEY
            }
        });

        if (geoRes.data && geoRes.data.length > 0) {
            const geoData = geoRes.data[0];
            latitude = geoData.lat;
            longitude = geoData.lon;
            state = geoData.state || "Unknown";
            country = geoData.country || "Unknown";
        }
    } catch (err) {
        console.error("Failed to fetch city coordinates:", err.message);
    } 
    cityDoc = await City.create({
      name: city.trim(),
      state: "Unknown",
      country: "Unknown",
      latitude: latitude,
      longitude: longitude,
      timezone: "UTC"
    });
  }

  // Fetch from external API
  const weather = await fetchLiveWeather({ city: cityDoc.name, lat: cityDoc.latitude, lon : cityDoc.longitude });

  if (!weather) {
    return next(
      new AppError("Unable to fetch weather data", 502)
    );
  }

  // Find or get DataSource for OpenWeatherMap
  let dataSource = await DataSource.findOne({ name: "OpenWeatherMap api" });
  
  if (!dataSource) {
    dataSource = await DataSource.create({
      name: "OpenWeatherMap api",
      type: "api",
      reliabilityScore: 9,
      lastFetchedAt: new Date()
    });
  }

  // Store in MongoDB (time-series collection)
  const weatherRecord = await WeatherData.create({
    city: cityDoc._id,
    source: dataSource._id,
    temperature: weather.temperature,
    feelsLike: weather.feelsLike ?? null,
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

  res.status(201).json({
    status: "success",
    data: weatherRecord
  });
});

export const getLatestWeatherByCity = catchAsync(async (req, res, next) => {
  const { city } = req.query;

  if (!city) {
    return next(new AppError("City query parameter is required", 400));
  }

  const { Types } = (await import("mongoose"));
  let cityDoc;

  if (Types.ObjectId.isValid(city)) {
    cityDoc = await City.findById(city);
  } else {
    cityDoc = await City.findOne({
      name: { $regex: new RegExp(`^${city}$`, "i") }
    });
  }

  if (!cityDoc) {
    return next(new AppError("City not found", 404));
  }

  let latestWeather = await WeatherData.findOne({ city: cityDoc._id })
    .sort({ recordedAt: -1 });

  const isStale = !latestWeather || Date.now() - new Date(latestWeather.recordedAt).getTime() > WEATHER_CACHE_TIME;

  //Auto-fetch
  if (isStale) {

    let dataSource = await DataSource.findOne({ name: "OpenWeatherMap api" });

    if (!dataSource) {
      dataSource = await DataSource.create({
        name: "OpenWeatherMap api",
        type: "api",
        reliabilityScore: 9,
        lastFetchedAt: new Date()
      });
    }

    const weather = await fetchLiveWeather({
      city: cityDoc.name,
      lat: cityDoc.latitude,
      lon: cityDoc.longitude
    });

    latestWeather = await WeatherData.create({
      city: cityDoc._id,
      source: dataSource._id,
      temperature: weather.temperature,
      feelsLike: weather.feelsLike,
      humidity: weather.humidity,
      pressure: weather.pressure,
      wind: {
        speed: weather.windSpeed,
        direction: weather.windDirection
      },
      condition: {
        main: weather.conditionMain,
        description: weather.weatherCondition
      },
      visibility: weather.visibility,
      cloudCover: weather.cloudCoverage,
      recordedAt: new Date()
    });
  }

  res.status(200).json({
    status: "success",
    data: latestWeather
  });
});

export const getWeatherHistory = catchAsync(async (req, res, next) => {
  const { city, limit = 1000 } = req.query;

  if (!city) {
    return next(
      new AppError("City query parameter is required", 400) 
    );
  }

  let cityId = null;
  const { Types } = (await import('mongoose'));

  if (Types.ObjectId.isValid(city)) {
    cityId = city;
  } else {
    const cityDoc = await City.findOne({ name: { $regex: new RegExp(`^${city}$`, 'i') } });
    if (!cityDoc) return next(new AppError("No city found matching the provided name", 404));
    cityId = cityDoc._id;
  }
  
  const history = await WeatherData.find({ city: cityId })
    .sort({ recordedAt: -1 })
    .limit(Number(limit));

  res.status(200).json({
    status: "success",
    results: history.length,
    data: history
  });
});

export const getWeatherTrends = catchAsync(async (req, res, next) => {
  const { city, period = "24h" } = req.query;
  if (!city) {
    return next(new AppError("City query parameter is required", 400));
  }
  const { Types } = await import("mongoose");
  let cityDoc;
  if (Types.ObjectId.isValid(city)) {
    cityDoc = await City.findById(city);
  } else {
    cityDoc = await City.findOne({ name: { $regex: new RegExp(`^${city}$`, "i") } });
  }
  if (!cityDoc) {
    return next(new AppError("City not found", 404));
  }
  const data = await getWeatherTrendsService(cityDoc._id, {
    period: period === "7d" ? "7d" : "24h",
  });
  res.status(200).json({
    status: "success",
    data,
  });
});

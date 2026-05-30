import axios from "axios";
import AppError from "../utils/AppError.js";
import AQIData from "../models/AQI.model.js";
import City from "../models/city.model.js";
import DataSource from "../models/dataSource.model.js";

export const fetchAndStoreAQIForCity = async (cityName) => {
  const cityDoc = await City.findOne({
    name: { $regex: new RegExp(`^${cityName}$`, "i") }
  });

  if (!cityDoc) throw new AppError(`City not found: ${cityName}`, 404);

  const aqi = await fetchLiveAQI({ city: cityDoc.name });

  let dataSource = await DataSource.findOne({ name: /waqi/i });
  if (!dataSource) {
    dataSource = await DataSource.create({
      name: "WAQI API",
      type: "api",
      reliabilityScore: 8,
      lastFetchedAt: new Date()
    });
  }

  await AQIData.create({
    city: cityDoc._id,
    source: dataSource._id,
    pollutants: aqi.pollutants,
    dominantPollutant: aqi.dominantPollutant,
    aqiValue: aqi.aqi,
    category: aqi.category,
    healthImpact: aqi.healthImpact || null,
    recordedAt: new Date()
  });

  return { cityDoc, aqi };
};

export const fetchLiveAQI = async ({ city }) => {
  try {
    if (!city) {
      throw new AppError("City name is required for AQI lookup", 400);
    }

    const API_KEY = process.env.WAQI_API_KEY;

    if (!API_KEY) {
      throw new AppError("AQI API key not configured", 500);
    }

    const response = await axios.get(
      `https://api.waqi.info/feed/${encodeURIComponent(city)}/`,
      {
        params: {
          token: API_KEY
        },
        timeout: 5000
      }
    );

    const data = response.data;

    if (!data || data.status !== "ok") {
      throw new AppError("Invalid AQI data received", 502);
    }

    const aqiValue = Number(data.data?.aqi);
    if(!aqiValue || isNaN(aqiValue)) {
      throw new AppError("AQI data not available for this city", 404);
    }

    const iaqi = data.data.iaqi || {};

    return {
      city,
      aqi: data.data.aqi,
      category: getAQICategory(data.data.aqi),
      dominantPollutant: data.data.dominentpol || null,
      pollutants: {
        pm25: iaqi.pm25?.v ?? null,
        pm10: iaqi.pm10?.v ?? null,
        no2: iaqi.no2?.v ?? null,
        so2: iaqi.so2?.v ?? null,
        o3: iaqi.o3?.v ?? null,
        co: iaqi.co?.v ?? null,
        co2: iaqi.co?.v ?? null
      },
      healthImpact: getHealthImpact(data.data.aqi),
      source: "waqi"
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("Failed to fetch live AQI data", 503);
  }
};

/**
 * Convert AQI value to human-readable category
 */
const getAQICategory = (aqi) => {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
};

const getHealthImpact = (aqi) => {
  if (aqi <= 50) {
    return "Air quality is good. No health risk.";
  }
  if (aqi <= 100) {
    return "Air quality is moderate. Sensitive individuals should take caution.";
  }
  if (aqi <= 150) {
    return "Unhealthy for sensitive groups. Reduce prolonged outdoor exertion.";
  }
  if (aqi <= 200) {
    return "Unhealthy. Everyone may experience health effects.";
  }
  if (aqi <= 300) {
    return "Very unhealthy. Health alert for all individuals.";
  }
  return "Hazardous air quality. Avoid outdoor activity.";
}

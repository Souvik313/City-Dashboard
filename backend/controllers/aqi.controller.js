import AQIData from "../models/AQI.model.js";
import City from "../models/city.model.js";
import DataSource from "../models/dataSource.model.js";
import { fetchLiveAQI } from "../services/aqi.service.js";
import { getAQITrends as getAQITrendsService } from "../services/aqiTrends.service.js";
import aqiPredictService from "../services/aqiPredict.service.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
const AQI_CACHE_TIME = 10*60*1000; //10 Minutes

export const fetchAndStoreAQI = catchAsync(async (req, res, next) => {
  const { city } = req.body;

  if (!city) {
    return next(
      new AppError("City name required", 400)
    );
  }

  // Find or create a City document (case-insensitive match by name)
  let cityDoc = await City.findOne({ name: { $regex: new RegExp(`^${city}$`, 'i') } });
  if (!cityDoc) {
    cityDoc = await City.create({
      name: city.trim(),
      state: "Unknown",
      country: "Unknown",
      timezone: "UTC"
    });
  }

  // Fetch from external AQI API
  const aqi = await fetchLiveAQI({ city: cityDoc.name});

  if (!aqi) {
    return next(
      new AppError("Unable to fetch AQI data", 502)
    );
  }

  // Find or create DataSource for this API
  let dataSource = await DataSource.findOne({ name: /waqi/i });
  if (!dataSource) {
    dataSource = await DataSource.create({
      name: "WAQI API",
      type: "api",
      reliabilityScore: 8,
      lastFetchedAt: new Date()
    });
  }

  // Store in MongoDB (time-series collection) with fields matching schema
  const aqiRecord = await AQIData.create({
    city: cityDoc._id,
    source: dataSource._id,
    pollutants: aqi.pollutants,
    dominantPollutant : aqi.dominantPollutant,
    aqiValue: aqi.aqi,
    category: aqi.category,
    healthImpact: aqi.healthImpact || null,
    recordedAt: new Date()
  });

  res.status(201).json({
    status: "success",
    data: aqiRecord
  });
});

export const getLatestAQIByCity = catchAsync(async (req, res, next) => {
  const { city } = req.query;

  if (!city) {
    return next(
      new AppError("City query parameter is required", 400)
    );
  }

  // Support both ObjectId and city name lookup
  const { Types } = (await import('mongoose'));
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

  let latestAQI = await AQIData.findOne({ city: cityDoc._id })
    .sort({ recordedAt: -1 });

  const isStale = !latestAQI || Date.now() - new Date(latestAQI.recordedAt).getTime() > AQI_CACHE_TIME;

  if (isStale) {
    const AQI = await fetchLiveAQI({
      city: cityDoc.name
    })

      let dataSource = await DataSource.findOne({ name: /waqi/i });
  if (!dataSource) {
    dataSource = await DataSource.create({
      name: "WAQI API",
      type: "api",
      reliabilityScore: 8,
      lastFetchedAt: new Date()
    });
  }
    latestAQI = AQIData.create({
      city: cityDoc._id,
      source: dataSource._id,
      pollutants: AQI.pollutants,
      dominantPollutant : AQI.dominantPollutant,
      aqiValue: AQI.aqi,
      category: AQI.category,
      healthImpact: AQI.healthImpact || null,
      recordedAt: new Date()
      })
  }

  res.status(200).json({
    status: "success",
    data: latestAQI
  });
});

export const getAQIHistory = catchAsync(async (req, res, next) => {
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
    if (!cityDoc) {
      return next(new AppError("No city found matching the provided name", 404));
    }
    cityId = cityDoc._id;
  }

  const history = await AQIData.find({ city: cityId })
    .sort({ recordedAt: -1 })
    .limit(Number(limit));

  res.status(200).json({
    status: "success",
    results: history.length,
    data: history
  });
});

export const getAQITrends = catchAsync(async (req, res, next) => {
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
  const data = await getAQITrendsService(cityDoc._id, {
    period: period === "7d" ? "7d" : "24h",
  });
  res.status(200).json({
    status: "success",
    data,
  });
});

export const getAqiPrediction = catchAsync(async (req, res, next) => {
  const { city } = req.query;
  if (!city) return next(new AppError('City query parameter is required', 400));

  const { Types } = (await import('mongoose'));
  let cityId = null;
  if (Types.ObjectId.isValid(city)) {
    cityId = city;
  } else {
    const cityDoc = await City.findOne({ name: { $regex: new RegExp(`^${city}$`, 'i') } });
    if (!cityDoc) return next(new AppError('City not found', 404));
    cityId = cityDoc._id;
  }

  const modelPath = process.env.PREDICT_AQI_MODEL_PATH || null;
  const prediction = await aqiPredictService.predictNextHour(cityId, modelPath);

  res.status(200).json({ status: 'success', data: prediction });
});

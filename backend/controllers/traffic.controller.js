import TrafficData from "../models/TrafficData.model.js";
import City from "../models/city.model.js";
import DataSource from "../models/dataSource.model.js";
import { fetchLiveTraffic } from "../services/traffic.service.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
const TRAFFIC_CACHE_TIME = 10*60*1000; //10 Minutes

export const fetchAndStoreTraffic = catchAsync(async (req, res, next) => {
  const { city, lat, lon } = req.body;

  if (!city || lat == null || lon == null) {
    return next(
      new AppError("City, latitude and longitude are required", 400)
    );
  }

  // Find or create City
  let cityDoc = await City.findOne({
    latitude: lat,
    longitude: lon
  });

  if (!cityDoc) {
    cityDoc = await City.create({
      name: city.trim(),
      state: "Unknown",
      country: "Unknown",
      latitude: lat,
      longitude: lon,
      timezone: "UTC"
    });
  }

  // Fetch traffic (PASS CITY ID)
  const traffic = await fetchLiveTraffic({
    cityId: cityDoc._id,
    lat,
    lon
  });

  if (!traffic) {
    return next(
      new AppError("Unable to fetch traffic data", 502)
    );
  }

  // Find or create data source
  let dataSource = await DataSource.findOne({ name: "TomTom API" });

  if (!dataSource) {
    dataSource = await DataSource.create({
      name: "TOMTOM api",
      type: "api",
      reliabilityScore: 9
    });
  }

  dataSource.lastFetchedAt = new Date();
  await dataSource.save();

  // Store traffic snapshot
  const trafficRecord = await TrafficData.create({
    city: cityDoc._id,
    source: dataSource._id,
    congestion: {
      level: traffic.congestion.level,
      travelTimeIndex: traffic.congestion.travelTimeIndex
    },
    speed: {
      average: traffic.speed.average,
      freeFlow: traffic.speed.freeFlow
    },
    roadClosureCount: traffic.roadClosureCount,
    incidents: traffic.incidents,
    hotspots: traffic.hotspots,
    ingestionMeta: {
      apiLatencyMs: traffic.ingestionMeta.apiLatencyMs,
      confidence: traffic.ingestionMeta.confidence,
      recordedAt: traffic.ingestionMeta.fetchedAt
    },
    recordedAt: new Date()
  });
  res.status(201).json({
    status: "success",
    data: trafficRecord
  });
});

export const getLatestTrafficByCity = catchAsync(async (req, res, next) => {
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

  let latestTraffic = await TrafficData.findOne({ city: cityDoc._id })
    .sort({ recordedAt: -1 });

  const isStale =
    !latestTraffic ||
    Date.now() - new Date(latestTraffic.recordedAt).getTime() > TRAFFIC_CACHE_TIME;

  if (isStale) {

    let dataSource = await DataSource.findOne({ name: "TOMTOM api" });

    if(!dataSource){
      dataSource = await DataSource.create({
        name: "TOMTOM api",
        type: "api",
        reliabilityScore: 9,
        lastFetchedAt: new Date()
      });
    }

    const trafficData = await fetchLiveTraffic({
      city: cityDoc.name,
      lat: cityDoc.latitude,
      lon: cityDoc.longitude
    });

    latestTraffic = await TrafficData.create({
      city: cityDoc._id,
      source: dataSource._id,
      congestion : {
        level: trafficData.congestion.level,
        travelTimeIndex: trafficData.congestion.travelTimeIndex
      },
      speed: {
        average: trafficData.speed.average,
        freeFlow: trafficData.speed.freeFlow
      },
      roadClosureCount: trafficData.roadClosureCount,
      incidents: trafficData.incidents,
      hotspots: trafficData.hotspots,
      recordedAt: new Date(),
      ingestionMeta: {
        apiLatencyMs: trafficData.ingestionMeta.apiLatencyMs,
        confidence: trafficData.ingestionMeta.confidence,
        recordedAt: trafficData.ingestionMeta.fetchedAt
      }
    });
  }

  res.status(200).json({
    status: "success",
    data: latestTraffic
  });
});

export const getTrafficHistory = catchAsync(async (req, res, next) => {
  const { city, limit = 500 } = req.query;

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

  const history = await TrafficData.find({ city: cityId })
    .sort({ recordedAt: -1 })
    .limit(Number(limit));

  res.status(200).json({
    status: "success",
    results: history.length,
    data: history
  });
});

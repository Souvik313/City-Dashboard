import axios from "axios";
import AppError from "../utils/AppError.js";
import { latLonToTile} from "../utils/latLonToTile.js";
import { getSurroundingTiles } from "../utils/getSurroundingTiles.js";
import TrafficData from "../models/TrafficData.model.js";
import City from "../models/city.model.js";
import DataSource from "../models/dataSource.model.js";

const generateSamplePoints = (lat, lon) => {
  const baseLat = Number(lat);
  const baseLon = Number(lon);

  const offsets = [-0.02, -0.01, 0, 0.01, 0.02];
  const points = [];

  for (const dLat of offsets) {
    for (const dLon of offsets) {
      points.push({
        lat: Number((baseLat + dLat).toFixed(6)),
        lon: Number((baseLon + dLon).toFixed(6))
      });
    }
  }

  return points;
};

const fetchFlowForPoint = async (lat, lon, API_KEY) => {
  try {
    const response = await axios.get(
      "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json",
      {
        params: {
          point: `${lat},${lon}`,
          key: API_KEY
        },
        timeout: 5000
      }
    );

    if (!response?.data?.flowSegmentData) {
      return null;
    }

    return response.data.flowSegmentData;
  } catch (error) {
    console.warn(`Traffic fetch failed at ${lat},${lon}:`, error.response?.data || error.message);
    return null;
  }
};

export const fetchLiveTraffic = async ({ city, lat, lon }) => {
  try {
    const API_KEY = process.env.TOMTOM_API_KEY;
    if (!API_KEY) {
      throw new AppError("Traffic API key not configured", 500);
    }

    /* STEP 1: Generate multiple points */
    const points = generateSamplePoints(lat, lon, 2);

    const allFlows = [];
    const allHotspots = [];

    /* STEP 2: Fetch traffic per point */
    for (const point of points) {
      const flow = await fetchFlowForPoint(
        point.lat,
        point.lon,
        API_KEY
      );

      if (!flow) continue;

      allFlows.push(flow);

      /* STEP 3: Build hotspots per flow */
      const hotspots = await buildHotspots(
        flow,
        point.lat,
        point.lon
      );

      if (Array.isArray(hotspots) && hotspots.length > 0) {
        allHotspots.push(...hotspots);
      }
    }

    if (!allFlows.length) {
      throw new AppError("No traffic data available", 502);
    }

    /* STEP 4: Aggregate metrics */
    const avgSpeed =
      allFlows.reduce((sum, f) => sum + (f.currentSpeed || 0), 0) /
      allFlows.length;

    const avgFreeFlow =
      allFlows.reduce((sum, f) => sum + (f.freeFlowSpeed || 0), 0) /
      allFlows.length;

    return {
      city,
      congestion: {
        level: calculateOverallCongestion(allFlows),
        travelTimeIndex:
          avgFreeFlow > 0 ? avgSpeed / avgFreeFlow : null
      },
      speed: {
        average: Math.round(avgSpeed),
        freeFlow: Math.round(avgFreeFlow)
      },
      roadClosureCount: allFlows.filter(f => f.roadClosure).length,
      incidents: [],
      hotspots: allHotspots,
      recordedAt: new Date(),
      ingestionMeta: {
        fetchedAt: new Date(),
        APILatencyMs: 0,
        confidence:
          allFlows.reduce((sum, f) => sum + (f.confidence ?? 1), 0) /
          allFlows.length
      }
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to fetch live traffic", 500);
  }
};

export const fetchAndStoreTrafficForCity = async (cityName) => {
  const cityDoc = await City.findOne({
    name: { $regex: new RegExp(`^${cityName}$`, "i") }
  });

  if (!cityDoc) throw new AppError(`City not found: ${cityName}`, 404);

  if (!cityDoc.latitude || !cityDoc.longitude) {
    throw new AppError(`No coordinates for city: ${cityName}`, 400);
  }

  const traffic = await fetchLiveTraffic({
    city: cityDoc.name,
    lat: cityDoc.latitude,
    lon: cityDoc.longitude
  });

  let dataSource = await DataSource.findOne({ name: "TOMTOM api" });
  if (!dataSource) {
    dataSource = await DataSource.create({
      name: "TOMTOM api",
      type: "api",
      reliabilityScore: 9,
      lastFetchedAt: new Date()
    });
  }

  dataSource.lastFetchedAt = new Date();
  await dataSource.save();

  await TrafficData.create({
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
    recordedAt: new Date(),
    ingestionMeta: {
      apiLatencyMs: traffic.ingestionMeta.apiLatencyMs,
      confidence: traffic.ingestionMeta.confidence,
      recordedAt: traffic.ingestionMeta.fetchedAt
    }
  });
};

/**
 * Determine congestion level using speed comparison
 */
const calculateOverallCongestion = (segments) => {
  if (!Array.isArray(segments) || segments.length === 0) {
    return "unknown";
  }

  let weightedRatioSum = 0;
  let weightSum = 0;

  for (const s of segments) {
    if (
      typeof s.currentSpeed !== "number" ||
      typeof s.freeFlowSpeed !== "number" ||
      s.freeFlowSpeed === 0
    ) continue;

    const ratio = s.currentSpeed / s.freeFlowSpeed;

    // weight by free-flow speed (bigger roads matter more)
    weightedRatioSum += ratio * s.freeFlowSpeed;
    weightSum += s.freeFlowSpeed;
  }

  if (weightSum === 0) return "unknown";

  const avgRatio = weightedRatioSum / weightSum;

  if (avgRatio > 0.8) return "low";
  if (avgRatio > 0.5) return "moderate";
  if (avgRatio > 0.3) return "high";
  return "severe";
};

const reverseGeoCode = async(lat, lon) => {
  try{
    const res = await axios.get(
    `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lon}.json`,
    {
      params: {
        key: process.env.TOMTOM_API_KEY
      }
    }
  );

  return res.data;
  } catch(err){
    console.error("Reverse geo coding failed:", err.message);
    return null;
  }
};

const buildHotspots = async (flow) => {
  if (!flow?.coordinates?.coordinate?.length) return [];

  const ratio = flow.currentSpeed / flow.freeFlowSpeed;
  const delay = flow.currentTravelTime - flow.freeFlowTravelTime;

  if (!(ratio < 0.65 || delay > 120 || flow.roadClosure)) return [];

  const coords = flow.coordinates.coordinate;
  const midpoint = coords[Math.floor(coords.length / 2)];

  let severity = 1;
  if (ratio < 0.3) severity = 5;
  else if (ratio < 0.4) severity = 4;
  else if (ratio < 0.5) severity = 3;

  let roadName = "Unknown Road";

  try {
    const geo = await reverseGeoCode(midpoint.latitude, midpoint.longitude);
    roadName =
      geo?.addresses?.[0]?.address?.streetName ||
      geo?.addresses?.[0]?.address?.municipality ||
      roadName;
  } catch {}

  return [{
    lat: midpoint.latitude,
    lng: midpoint.longitude,
    severity,
    delaySeconds: Math.round(delay),
    roadName
  }];
};



import PublicTransit from "../models/PublicTransit.model.js";
import City from "../models/city.model.js";
import DataSource from "../models/dataSource.model.js";
import {
  fetchAndStoreTransitForCity,
  getLatestTransitByCity,
  getTransitHistory,
  analyzeTransitAlerts
} from "../services/publicTransit.service.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import getCityByName from "../utils/getCityByName.js";

/**
 * POST /api/v1/transit/fetch
 * Fetch and store transit data for a city
 */
export const fetchAndStoreTransit = catchAsync(async (req, res, next) => {
  const { city } = req.body;

  if (!city) {
    return next(new AppError("City name is required", 400));
  }

  // Check if city exists
  let cityDoc = await getCityByName(city);

  if (!cityDoc) {
    return next(
      new AppError(
        `City "${city}" not found. Please add it first via /api/v1/city/add`,
        404
      )
    );
  }

  // Fetch and store transit data
  const result = await fetchAndStoreTransitForCity(city);

  res.status(201).json({
    success: true,
    data: result.data,
    message: result.message
  });
});

/**
 * GET /api/v1/transit/latest
 * Get the latest transit data for a city
 * Query params: ?cityId=xxx
 */
export const getLatestTransit = catchAsync(async (req, res, next) => {
  const { city } = req.query;

  if (!city) {
    return next(new AppError("City name is required", 400));
  }

  const cityDoc = await getCityByName(city);

  if (!cityDoc) {
    return next(new AppError(`City "${city}" not found`, 404));
  }

  const transitData = await getLatestTransitByCity(cityDoc._id);

  const alerts = analyzeTransitAlerts(transitData);

  res.status(200).json({
    success: true,
    data: {
      ...transitData.toObject(),
      computedAlerts: alerts
    }
  });
});

/**
 * GET /api/v1/transit/history
 * Get transit data history for a city
 * Query params: ?cityId=xxx&startDate=ISO&endDate=ISO&limit=50
 */
export const getTransitHistoryController = catchAsync(async (req, res, next) => {
  const { city, startDate, endDate, limit = 100 } = req.query;

  const cityDoc = await getCityByName(city);

  if (!startDate || !endDate) {
    return next(
      new AppError("Both startDate and endDate are required (ISO format)", 400)
    );
  }

  const history = await getTransitHistory(
    cityDoc._id,
    startDate,
    endDate,
    parseInt(limit)
  );

  res.status(200).json({
    success: true,
    count: history.length,
    data: history
  });
});

/**
 * GET /api/v1/transit/routes
 * Get all routes for a city
 * Query params: ?cityId=xxx
 */
export const getRoutesByCity = catchAsync(async (req, res, next) => {
  const { city } = req.query;

  if (!city) {
    return next(new AppError("City name is required", 400));
  }

  const cityDoc = await getCityByName(city);

  const latestTransit = await getLatestTransitByCity(cityDoc._id);

  res.status(200).json({
    success: true,
    count: latestTransit.routes.length,
    data: latestTransit.routes
  });
});

/**
 * GET /api/v1/transit/nearby-stops
 * Get nearby transit stops for a city
 * Query params: ?cityId=xxx
 */
export const getNearbyStops = catchAsync(async (req, res, next) => {
  const { city } = req.query;

  if (!city) {
    return next(new AppError("City name is required", 400));
  }

  const cityDoc = await getCityByName(city);
  const latestTransit = await getLatestTransitByCity(cityDoc._id);

  res.status(200).json({
    success: true,
    count: latestTransit.nearbyStops.length,
    data: latestTransit.nearbyStops
  });
});

/**
 * GET /api/v1/transit/alerts
 * Get active transit alerts for a city
 * Query params: ?cityId=xxx
 */
export const getTransitAlerts = catchAsync(async (req, res, next) => {
  const { city } = req.query;

  if (!city) {
    return next(new AppError("City name is required", 400));
  }

  const cityDoc = await getCityByName(city);
  const latestTransit = await getLatestTransitByCity(cityDoc._id);
  const alerts = analyzeTransitAlerts(latestTransit);

  res.status(200).json({
    success: true,
    count: alerts.length,
    data: alerts
  });
});

/**
 * GET /api/v1/transit/route-details
 * Get detailed information about a specific route
 * Query params: ?cityId=xxx&routeId=xxx
 */
export const getRouteDetails = catchAsync(async (req, res, next) => {
  const { city, routeId } = req.query;

  if (!city || !routeId) {
    return next(
      new AppError("Both city and routeId are required", 400)
    );
  }

  const cityDoc = await getCityByName(city);
  const latestTransit = await getLatestTransitByCity(cityDoc._id);
  const route = latestTransit.routes.find((r) => r.routeId === routeId);

  if (!route) {
    return next(
      new AppError(
        `Route "${routeId}" not found in this city`,
        404
      )
    );
  }

  res.status(200).json({
    success: true,
    data: route
  });
});

/**
 * GET /api/v1/transit/stats
 * Get transit statistics for a city
 * Query params: ?cityId=xxx
 */
export const getTransitStats = catchAsync(async (req, res, next) => {
  const { city } = req.query;

  if (!city) {
    return next(new AppError("City name is required", 400));
  }

  const cityDoc = await getCityByName(city);

  const latestTransit = await getLatestTransitByCity(cityDoc._id);

  const stats = {
    totalRoutes: latestTransit.routes.length,
    totalStops: latestTransit.nearbyStops.length,
    activeAlerts: latestTransit.alerts.length,
    routesByType: latestTransit.routes.reduce((acc, route) => {
      acc[route.type] = (acc[route.type] || 0) + 1;
      return acc;
    }, {}),
    averageCrowding: latestTransit.routes.length > 0
      ? latestTransit.routes.reduce((sum, r) => {
          const crowdMap = { low: 1, medium: 2, high: 3, full: 4 };
          return sum + (crowdMap[r.crowdLevel] || 2);
        }, 0) / latestTransit.routes.length
      : 0,
    averageDelay: latestTransit.routes.length > 0
      ? latestTransit.routes.reduce((sum, r) => sum + r.averageDelay, 0) /
        latestTransit.routes.length
      : 0
  };

  res.status(200).json({
    success: true,
    data: stats
  });
});

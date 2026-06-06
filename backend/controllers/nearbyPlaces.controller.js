import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import {
  fetchNearbyEmergencyPlaces,
  fetchNearbyTransitStops,
  fetchNearbyRoutes,
} from "../services/nearbyPlaces.service.js";

// GET /api/v1/nearby/emergency?lat=xx&lon=xx&type=hospitals
export const getNearbyEmergency = catchAsync(async (req, res, next) => {
  const { lat, lon, type = "all" } = req.query;

  if (!lat || !lon) {
    return next(new AppError("lat and lon are required", 400));
  }

  const places = await fetchNearbyEmergencyPlaces(
    parseFloat(lat),
    parseFloat(lon),
    type
  );

  res.status(200).json({
    success: true,
    count: places.length,
    data: places
  });
});

// GET /api/v1/nearby/transit?lat=xx&lon=xx
export const getNearbyTransit = catchAsync(async (req, res, next) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return next(new AppError("lat and lon are required", 400));
  }

  const stops = await fetchNearbyTransitStops(
    parseFloat(lat),
    parseFloat(lon)
  );

  res.status(200).json({
    success: true,
    count: stops.length,
    data: stops
  });
});

// GET /api/v1/nearby/routes?lat=xx&lon=xx
export const getNearbyRoutes = catchAsync(async (req, res, next) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return next(new AppError("lat and lon are required", 400));
  }

  const routes = await fetchNearbyRoutes(
    parseFloat(lat),
    parseFloat(lon)
  );

  res.status(200).json({
    success: true,
    count: routes.length,
    data: routes
  });
});
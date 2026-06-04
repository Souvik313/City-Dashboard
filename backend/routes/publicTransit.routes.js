import { Router } from "express";
import {
  fetchAndStoreTransit,
  getLatestTransit,
  getTransitHistoryController,
  getRoutesByCity,
  getNearbyStops,
  getTransitAlerts,
  getRouteDetails,
  getTransitStats
} from "../controllers/publicTransit.controller.js";

const transitRouter = Router();

// Fetch and store transit data for a city
transitRouter.post("/fetch", fetchAndStoreTransit);

// Get latest transit data
transitRouter.get("/latest", getLatestTransit);

// Get transit history
transitRouter.get("/history", getTransitHistoryController);

// Get all routes
transitRouter.get("/routes", getRoutesByCity);

// Get nearby stops
transitRouter.get("/nearby-stops", getNearbyStops);

// Get active alerts
transitRouter.get("/alerts", getTransitAlerts);

// Get specific route details
transitRouter.get("/route-details", getRouteDetails);

// Get transit statistics
transitRouter.get("/stats", getTransitStats);

export default transitRouter;

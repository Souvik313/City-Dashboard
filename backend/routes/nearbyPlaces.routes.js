import express from "express";

const nearbyPlacesRouter = express.Router();

import {
  getNearbyEmergency,
  getNearbyTransit,
  getNearbyRoutes       // ← add this
} from "../controllers/nearbyPlaces.controller.js";

nearbyPlacesRouter.get("/emergency", getNearbyEmergency);
nearbyPlacesRouter.get("/transit",   getNearbyTransit);
nearbyPlacesRouter.get("/routes",    getNearbyRoutes);    // ← add this

export default nearbyPlacesRouter;
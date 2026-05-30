import { Router } from "express";
import { fetchAndStoreAQI, getLatestAQIByCity, getAQIHistory, getAQITrends, getAqiPrediction } from "../controllers/aqi.controller.js";

const aqiRouter = Router();
aqiRouter.post("/fetch", fetchAndStoreAQI);
aqiRouter.get("/latest", getLatestAQIByCity);
aqiRouter.get("/history", getAQIHistory);
aqiRouter.get("/trends", getAQITrends);
aqiRouter.get("/predict", getAqiPrediction);

export default aqiRouter;
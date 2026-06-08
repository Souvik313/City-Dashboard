import express from "express";
import { searchTravel } from "../controllers/travelSearch.controller.js";

const router = express.Router();
router.get("/search", searchTravel);
export default router;
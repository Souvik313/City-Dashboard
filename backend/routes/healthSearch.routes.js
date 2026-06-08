import express from "express";
import { searchHealth } from "../controllers/healthSearch.controller.js";

const healthSearchRouter = express.Router();

healthSearchRouter.get("/search", searchHealth);

export default healthSearchRouter;
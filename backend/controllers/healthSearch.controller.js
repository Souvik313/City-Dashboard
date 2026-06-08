import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import getCityByName from "../utils/getCityByName.js";
import { searchHospitalsByCondition } from "../services/healthSearch.service.js";

// GET /api/v1/health/search?city=Delhi&condition=cancer&radius=10000
export const searchHealth = catchAsync(async (req, res, next) => {
  const { city, condition, radius = 10000 } = req.query;

  if (!city)      return next(new AppError("city is required", 400));
  if (!condition) return next(new AppError("condition is required", 400));

  const cityDoc = await getCityByName(city);
  if (!cityDoc)   return next(new AppError(`City "${city}" not found`, 404));

  const result = await searchHospitalsByCondition(
    cityDoc.latitude,
    cityDoc.longitude,
    condition,
    parseInt(radius),
    cityDoc.name,
  );

  res.status(200).json({
    success: true,
    city:    cityDoc.name,
    ...result,
  });
});
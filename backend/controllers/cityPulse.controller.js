import { generateCityPulse } from "../services/citypulse.service.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";

export const getCityPulse = catchAsync(async (req, res, next) => {
  const { city } = req.query;

  if (!city) {
    return next(
      new AppError("City query parameter is required", 400)
    );
  }

  const pulse = await generateCityPulse(city);

  if (!pulse) {
    return next(
      new AppError("City not found or city pulse data is unavailable", 404)
    );
  }

  res.status(200).json({
    status: "success",
    data: pulse
  });
});

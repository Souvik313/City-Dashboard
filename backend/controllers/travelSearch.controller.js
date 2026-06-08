import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";
import getCityByName from "../utils/getCityByName.js";
import { fetchTravelPlaces } from "../services/travelSearch.service.js";

// GET /api/v1/travel/search?city=Mumbai&category=hotels&radius=5000
export const searchTravel = catchAsync(async (req, res, next) => {
  const { city, category = "all", radius = 5000 } = req.query;

  if (!city) return next(new AppError("city is required", 400));

  const cityDoc = await getCityByName(city);
  if (!cityDoc) return next(new AppError(`City "${city}" not found`, 404));

  const places = await fetchTravelPlaces(
    cityDoc.latitude,
    cityDoc.longitude,
    category,
    parseInt(radius)
  );

  res.status(200).json({
    success:  true,
    city:     cityDoc.name,
    category,
    count:    places.length,
    data:     places
  });
});
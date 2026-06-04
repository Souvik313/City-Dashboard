import City from "../models/city.model.js";
import AppError from "./AppError.js";

const getCityByName = async (cityName) => {
  const city = await City.findOne({
    name: { $regex: new RegExp(`^${cityName}$`, "i") }
  });

  if (!city) {
    throw new AppError(
      `City "${cityName}" not found`,
      404
    );
  }

  return city;
};

export default getCityByName;
import City from "../models/city.model.js";
import axios from "axios";
export const getAllCities = async(req , res , next) => {
    try{
        const cities = await City.find();
        if(!cities) {
            return res.status(404).json({
                success: false,
                message: "No cities found"
            })
        }
        res.status(200).json({
            success: true,
            message: "All cities fetched successfully!",
            cities: cities
        })
    } catch(error) {
        console.log(error.message);
        next(error);
    }
};

export const getCityByName = async(req , res , next) => {
    try{
        const {city} = req.query;
        if(!city){
            return res.status(400).json({
                success: false,
                message: "City name must be provided"
            })
        }

        const cityFound = await City.findOne({ name: new RegExp(`^${city.trim()}$`, 'i') });
        if(!cityFound){
            return res.status(404).json({
                success: false,
                message: "No such city found"
            })
        }
        res.status(200).json({
            success: true,
            message: "City fetched successfully",
            city: cityFound
        })
    } catch(error) {
        console.log(error.message);
        next(error);
    }
};

export const deleteCity = async(req , res , next) => {
    try{
        const {id} = req.params;
        if(!id){
            return res.status(404).json({
                success: false,
                message: "City id not provided"
            })
        }

        const city = await City.findByIdAndDelete(id);
        if(!city){
            return res.status(404).json({
                success: false,
                message: "No such city found"
            })
        }

        res.status(200).json({
            success: true,
            message: "City deleted successfully",
            deletedCity: city
        })
    } catch(error){
        console.log(error.message);
        next(error);
    }
};

export const deleteAllCities = async(req , res , next) => {
    try{
        const deleteCities = await City.deleteMany();
        res.status(200).json({
            success: true,
            message: "Cities deleted",
            deletedCities: deleteCities
        })
    } catch(error) {
        console.log(error.message);
        next(error);
    }
};

export const createNewCity = async (req, res, next) => {
  try {
    const { city } = req.body;

    // 1️⃣ Validate input
    if (!city || typeof city !== "string") {
      return res.status(400).json({
        success: false,
        message: "City name is required",
      });
    }

    const cityName = city.trim();

    // 2️⃣ Check if city already exists
    const existingCity = await City.findOne({
      name: new RegExp(`^${cityName}$`, "i"),
    });

    if (existingCity) {
      return res.status(409).json({
        success: false,
        message: "City already exists",
        city: existingCity,
      });
    }

    // Defaults
    let latitude = 0;
    let longitude = 0;
    let state = "Unknown";
    let country = "Unknown";

    // 3️⃣ Fetch geo data
    try {
      const geoRes = await axios.get(
        "https://api.openweathermap.org/geo/1.0/direct",
        {
          params: {
            q: cityName,
            limit: 1,
            appid: process.env.OPENWEATHER_API_KEY,
          },
        }
      );

      if (geoRes.data?.length) {
        const geoData = geoRes.data[0];
        latitude = geoData.lat ?? 0;
        longitude = geoData.lon ?? 0;
        state = geoData.state || "Unknown";
        country = geoData.country || "Unknown";
      }
    } catch (geoError) {
      console.warn('City geolocation lookup failed:', geoError?.message || geoError);
    }

    // 4️⃣ Create city
    const cityDoc = await City.create({
      name: cityName,
      state,
      country,
      latitude,
      longitude,
      timezone: "UTC", // TODO: derive later
    });

    // 5️⃣ Send response
    res.status(201).json({
      success: true,
      message: "City added successfully",
      city: cityDoc,
    });
  } catch (error) {
    console.error("Create city error:", error.message);
    next(error);
  }
};
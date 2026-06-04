import mongoose from "mongoose";

const dataSourceSchema = new mongoose.Schema({
    name: {
<<<<<<< HEAD
        enum: ["WAQI API", "OpenWeatherMap api", "TOMTOM api", "Chatbot"],
=======
        enum: ["WAQI API", "OpenWeatherMap api", "TOMTOM api", "Chatbot" , "OpenTripPlanner API" , "transitland" , "mock"],
>>>>>>> abc483a (public transport component full implementation)
        type: String,
        required: true,
        trim: true
    },
    type: {
        enum: ["api", "sentiment analysis", "user chatbot"],
        type: String,
        required: true,
        trim: true
    },
    reliabilityScore: {
        type: Number,
        min: 0,
        max: 10
    },
    lastFetchedAt: {
        type: Date,
        default: null
    }
}, {timestamps: true});

const DataSource = new mongoose.model("DataSource", dataSourceSchema);
export default DataSource;
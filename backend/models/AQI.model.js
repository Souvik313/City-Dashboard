import mongoose from 'mongoose';

const aqiSchema = new mongoose.Schema({
    city:  {
        type: mongoose.Schema.Types.ObjectId,
        ref: "City",
        required: true,
        index: true
    },
    source: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DataSource",
        required: true
    },
    pollutants: {
        pm25: {
            type: Number,
            min: 0
        },
        pm10: {
            type: Number,
            min: 0
        },
        no2: {
            type: Number,
            min: 0
        },
        so2: {
            type: Number,
            min: 0
        },
        co2: {
            type: Number,
            min: 0
        },
        o3: {
            type: Number,
            min: 0
        }
    },
    dominantPollutant: {
        type: String,
        trim: true,
        default: null
    },
    aqiValue: {
        type: Number,
        required: true,
        min: 0,
        max: 500
    },
    category: {
        enum: ["Good", "Moderate", "Unhealthy for Sensitive Groups", "Unhealthy", "Very Unhealthy", "Hazardous"],
        type: String,
        required: true,
        trim: true,
        default: ""
    },
    healthImpact: {
        type: String,
    },
    recordedAt: {
        type: Date,
        required: true,
        index: true
    },
    ingestionMeta: {
      fetchedAt: Date,
      apiLatencyMs: Number,
      confidence: Number
    }
}, {timestamps: false});

aqiSchema.index({city: 1, recordedAt: -1});

const AQIData = new mongoose.model("AQIData", aqiSchema , "aqidata");
export default AQIData;
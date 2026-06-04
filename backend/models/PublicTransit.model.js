import mongoose from "mongoose";

const publicTransitSchema = new mongoose.Schema(
  {
    city: {
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
    routes: [
      {
        routeId: String,
        routeName: String,
        type: {
          type: String,
          enum: ["bus", "metro", "tram", "train", "light_rail"],
          default: "bus"
        },
        direction: String,
        operator: String,
        stops: [
          {
            stopId: String,
            stopName: String,
            lat: {
                type: Number,
                required: true,
                min: -90,
                max: 90
            },
            lon: {
                type: Number,
                required: true,
                min: -180,
                max: 180,
            },
            arrivalTime: Date,
            departureTime: Date,
            delayMinutes: {
              type: Number,
              default: 0
            },
            isNextStop: Boolean,
            wheelchairAccessible: Boolean
          }
        ],
        vehicleCount: {
          type: Number,
          default: 0
        },
        vehiclesOnRoute: [
          {
            vehicleId: String,
            currentLat: Number,
            currentLon: Number,
            nextStopName: String,
            crowdLevel: {
              type: String,
              enum: ["low", "medium", "high", "full"],
              default: "medium"
            },
            capacity: { type: Number, min: 0 },
            occupancy: { type: Number , min: 0},
          }
        ],
        averageDelay: {
          type: Number,
          default: 0
        },
        crowdLevel: {
          type: String,
          enum: ["low", "medium", "high", "full"],
          default: "medium"
        },
        frequency: {
          type: Number,
          default: 0,
        },
        status: {
          type: String,
          enum: ["operational", "delayed", "suspended", "diverted"],
          default: "operational"
        }
      }
    ],
    alerts: [
      {
        alertId: String,
        type: {
          type: String,
          enum: ["delay", "disruption", "diversion", "service_change", "incident"],
          default: "delay"
        },
        message: String,
        affectedRoutes: [String],
        severity: {
          type: String,
          enum: ["low", "medium", "high", "critical"],
          default: "medium"
        },
        startTime: Date,
        endTime: Date,
        affectedStops: [String]
      }
    ],
    nearbyStops: [
      {
        stopId: String,
        stopName: String,
        lat: Number,
        lon: Number,
        distance: Number,
        routes: [String],
        accessibility: {
          wheelchair: Boolean,
          elevator: Boolean,
          parking: Boolean
        }
      }
    ],
    peakHours: {
      morning: {
        startTime: String,
        endTime: String,
        avgCrowding: String
      },
      evening: {
        startTime: String,
        endTime: String,
        avgCrowding: String
      }
    },
    recordedAt: {
      type: Date,
      required: true,
      index: true
    },
    ingestionMeta: {
      fetchedAt: Date,
      apiLatencyMs: Number,
      dataAge: Number,
      confidence: { type: Number, min: 0, max: 1 }
    }
  },
  { timestamps: true }
);

publicTransitSchema.index({ city: 1, recordedAt: -1 });

const PublicTransit = mongoose.model(
  "PublicTransit",
  publicTransitSchema,
  "publictransit"
);

export default PublicTransit;

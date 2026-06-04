import axios from "axios";
import JSZip from "jszip";
import Papa from "papaparse";
import AppError from "../utils/AppError.js";
import PublicTransit from "../models/PublicTransit.model.js";
import City from "../models/city.model.js";
import DataSource from "../models/dataSource.model.js";
import getCityByName from "../utils/getCityByName.js";
import {fetchStopsFromOverpass} from "../services/overpass.service.js";
import {TRANSITLAND_API_KEY} from "../config/env.js";
import {getMobilityDBToken , invalidateMobilityDBToken} from "../utils/mobilityDBAuth.js";
const TRANSITLAND_BASE = "https://transit.land/api/v2/rest";

// ── helpers ──────────────────────────────────────────────────────────────────

const GTFS_ROUTE_TYPES = {
  0:   { type: "tram",       label: "Tram / Light Rail"  },
  1:   { type: "metro",      label: "Metro / Subway"     },
  2:   { type: "rail",       label: "Rail / Train"       },
  3:   { type: "bus",        label: "Bus"                },
  4:   { type: "ferry",      label: "Ferry"              },
  11:  { type: "trolleybus", label: "Trolleybus"         },
  12:  { type: "monorail",   label: "Monorail"           },
  100: { type: "rail",       label: "Railway"            },
  101: { type: "rail",       label: "High Speed Rail"    },
  109: { type: "rail",       label: "Suburban Rail"      },
  400: { type: "metro",      label: "Urban Rail"         },
  401: { type: "metro",      label: "Metro"              },
  700: { type: "bus",        label: "Bus"                },
  701: { type: "bus",        label: "Regional Bus"       },
  702: { type: "bus",        label: "Express Bus"        },
  900: { type: "tram",       label: "Tram"               },
};

const getRouteType = (code) =>
  GTFS_ROUTE_TYPES[code] || { type: "bus", label: "Bus" };

const inferTypeFromName = (routeName, operator) => {
  if (!routeName) return null;
  const name = routeName.toUpperCase();
  const op = (operator || "").toUpperCase();

  if (name.includes("METRO") || op.includes("METRO") ||
      op.includes("DMRC") || op.includes("BMRCL") ||
      op.includes("CMRL") || op.includes("HMRL") ||
      op.includes("MMRDA") || op.includes("NMRC"))
    return { type: "metro", label: "Metro" };

  if (name.includes("RRTS") || name.includes("RAPID RAIL"))
    return { type: "rail", label: "Rapid Rail" };

  if (name.includes("RAILWAY") || name.includes(" RAIL") ||
      op.includes("RAILWAY") || op.includes("SOUTHERN RLY") ||
      op.includes("CENTRAL RLY") || op.includes("WESTERN RLY"))
    return { type: "rail", label: "Suburban Rail" };

  if (name.includes("TRAM") || op.includes("WBTC"))
    return { type: "tram", label: "Tram" };

  if (name.includes("FERRY") || name.includes("BOAT"))
    return { type: "ferry", label: "Ferry" };

  if (name.includes("EXPRESS") || name.includes("VOLVO"))
    return { type: "bus", label: "Express Bus" };

  return null; // no inference possible — fall back to GTFS code
};

const resolveRouteType = (routeTypeCode, routeName, operator) => {
  // Always try name-based inference first for Indian feeds
  const inferred = inferTypeFromName(routeName, operator);
  if (inferred) return inferred;
  return getRouteType(routeTypeCode);
};

// Mobility database

const fetchMobilityDBRoutes = async (cityName, lat, lon) => {
  try {
    const token = await getMobilityDBToken();

    // Step 1 — find a feed for this city
    const feedsRes = await axios.get(
      "https://api.mobilitydatabase.org/v1/feeds",
      {
        params: { country_code: "IN" , status: "active" },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 50000,
      }
    );

    const feeds = feedsRes.data || [];

    console.log(
  JSON.stringify(
    feeds.slice(0, 5),
    null,
    2
  )
);

    const city = cityName.toLowerCase();

const matchedFeed = feeds.find((feed) => {
  const searchableText = JSON.stringify(feed).toLowerCase();

  return searchableText.includes(city);
});



    if (!matchedFeed) {
      console.log(`No Mobility DB feed found for ${cityName}`);
      return [];
    }

    console.log(`Found Mobility DB feed for ${cityName}:`, matchedFeed.id , matchedFeed?.provider , matchedFeed?.location);

    // Step 2 — get the latest dataset download URL
    const feedType = matchedFeed.data_type || "gtfs"; // "gtfs" or "gtfs_rt"

const datasetsRes = await axios.get(
  `https://api.mobilitydatabase.org/v1/${feedType}_feeds/${matchedFeed.id}/datasets`,
  {
    params: { latest: "true" },
    headers: { Authorization: `Bearer ${token}` },
    timeout: 50000,
  }
);

    const dataset = datasetsRes.data?.[0];
    if (!dataset?.urls?.direct_download) {
      const downloadUrl =
    dataset?.urls?.direct_download ||
    dataset?.urls?.latest ||
    dataset?.urls?.authentication_info ||
    dataset?.hosted_url ||
    dataset?.url;

  if (!downloadUrl) {
    console.log(`No download URL for ${cityName} feed`);
    return [];
  }


    // Step 3 — download and parse the GTFS zip
    const gtfsRes = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      timeout: 50000,
    });

    const zip = await JSZip.loadAsync(gtfsRes.data);

    // Parse routes.txt from the zip
    const routesTxt = await zip.file("routes.txt")?.async("string");
    if (!routesTxt) return [];

    const parsed = Papa.parse(routesTxt, {
      header: true,
      skipEmptyLines: true
    });

    // Parse agency.txt to get operator names
    const agencyTxt = await zip.file("agency.txt")?.async("string");
    const agencyMap = {};
    if (agencyTxt) {
      const agencyParsed = Papa.parse(agencyTxt, {
        header: true,
        skipEmptyLines: true
      });
      agencyParsed.data.forEach((a) => {
        agencyMap[a.agency_id] = a.agency_name;
      });
    }

    // Map GTFS routes to your schema
    const routes = parsed.data.slice(0, 20).map((r) => {
      const operator = agencyMap[r.agency_id] || "Local Transit";
      const routeName = [r.route_short_name, r.route_long_name]
        .filter(Boolean).join(" – ");
      const typeInfo = resolveRouteType(
        parseInt(r.route_type),
        routeName,
        operator
      );
      const delay = generateEstimatedDelay(typeInfo.type);
      const crowd = generateCrowdLevel();

      return {
        routeId: `mdb_${r.route_id}`,
        routeName: routeName || "Unnamed Route",
        type: typeInfo.type,
        typeLabel: typeInfo.label,
        operator,
        direction: r.route_long_name || "",
        averageDelay: delay,
        crowdLevel: crowd,
        status: delay > 20 ? "delayed" : "operational",
        frequency: Math.floor(Math.random() * 20) + 5,
        vehicleCount: generateVehicleCount(typeInfo.type),
        vehiclesOnRoute: [],
        stops: []
      };
    });

    console.log(`✅ Mobility DB: ${routes.length} routes for ${cityName}`);
    return routes;

  }} catch (err) {
    if (err.response?.status === 401) {
      invalidateMobilityDBToken();
      console.warn("Mobility DB 401 — token invalidated, will retry on next call");
    }
    console.warn(`Mobility DB failed for ${cityName}:`, err.message);
    return [];
  }
};

// Overpass routes

const fetchRoutesFromOverpass = async (lat, lon) => {
  const query = `
    [out:json][timeout:25];
    (
      relation["route"="bus"](around:5000,${lat},${lon});
      relation["route"="train"](around:5000,${lat},${lon});
      relation["route"="subway"](around:5000,${lat},${lon});
      relation["route"="tram"](around:5000,${lat},${lon});
      relation["route"="monorail"](around:5000,${lat},${lon});
      relation["route"="ferry"](around:5000,${lat},${lon});
    );
    out body;
  `;

  const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await axios.post(
        endpoint,
        `data=${encodeURIComponent(query)}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "CityPulse/1.0",
            // ← no Accept header here, Overpass only serves its own format
          },
          timeout: 50000,
        }
      );

      const relations = (response.data?.elements || [])
        .filter((el) => el.type === "relation");

      const byType = {
        subway: [],
        train:  [],
        tram:   [],
        monorail: [],
        ferry:  [],
        bus:    [],
      };

      relations.forEach((rel) => {
        const route = rel.tags?.route || "bus";
        if (byType[route]) byType[route].push(rel);
        else byType.bus.push(rel);
      });

      // 2. Filter bus routes — only keep named ones with a ref tag
      //    (unnamed relations are usually incomplete OSM data)
      byType.bus = byType.bus.filter(
        (rel) => rel.tags?.ref || rel.tags?.name
      );

      // 3. De-duplicate by route ref (same bus number mapped multiple times)
      const seenRefs = new Set();
      byType.bus = byType.bus.filter((rel) => {
        const ref = rel.tags?.ref || rel.tags?.name;
        if (seenRefs.has(ref)) return false;
        seenRefs.add(ref);
        return true;
      });

      // 4. Build final list — non-bus first, then buses up to limit
      const MAX_ROUTES = 20;
      const nonBus = [
        ...byType.subway,
        ...byType.train,
        ...byType.tram,
        ...byType.monorail,
        ...byType.ferry,
      ];

      const busSlots = Math.max(0, MAX_ROUTES - nonBus.length);
      const finalRelations = [
        ...nonBus,
        ...byType.bus.slice(0, busSlots)
      ];

      console.log(`✅ Overpass routes (${endpoint}): ${relations.length} relations for area`);
      return finalRelations;

    } catch (err) {
      console.warn(`Overpass route endpoint failed (${endpoint}): ${err.message}`);
    }
  }

  console.warn("All Overpass route endpoints failed");
  return [];
};

const crowdLevelFromOccupancy = (occupancy) => {
  if (!occupancy) return "low";
  const o = occupancy.toLowerCase();
  if (o.includes("full") || o.includes("standing_room")) return "full";
  if (o.includes("crushed") || o.includes("many")) return "high";
  if (o.includes("few")) return "medium";
  return "low";
};

const normalizeStatus = (status) => {
  if (!status) return "operational";
  const s = status.toLowerCase();
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("delay")) return "delayed";
  return "operational";
};

const buildNearbyStops = (stopsData, cityLat, cityLon) => {
  if (!stopsData?.length) return [];

  return stopsData
    .map((stop) => {
      const isOverpass = stop.type === "node";

      // ── coordinates ──
      const stopLat = isOverpass
        ? stop.lat
        : stop.geometry?.coordinates?.[1];

      const stopLon = isOverpass
        ? stop.lon
        : stop.geometry?.coordinates?.[0];

      // skip stops with no coordinates
      if (stopLat == null || stopLon == null) return null;

      // ── name ──
      const stopName = isOverpass
        ? stop.tags?.name ||
          stop.tags?.["name:en"] ||
          stop.tags?.ref ||
          "Unnamed Stop"
        : stop.name ||
          stop.stop_name ||
          "Unnamed Stop";

      // ── routes ──
      let routes = [];
      if (isOverpass) {
        const ref = stop.tags?.route_ref || stop.tags?.ref || "";
        routes = ref
          ? ref.split(";").map((r) => r.trim()).filter(Boolean)
          : [];
      } else {
        routes = (stop.routes || [])
          .map((r) => r.route_short_name || r.name)
          .filter(Boolean);
      }

      // ── accessibility ──
      const wheelchair = isOverpass
        ? stop.tags?.wheelchair === "yes"
        : stop.wheelchair_boarding === 1 ||
          stop.wheelchair_boarding === true;

      // ── distance — calculated once ──
      const distance = parseFloat(
        getDistanceKm(cityLat, cityLon, stopLat, stopLon).toFixed(2)
      );

      return {
        stopId: isOverpass
          ? `osm_${stop.id}`
          : stop.id || stop.onestop_id,
        stopName,
        lat: stopLat,
        lon: stopLon,
        distance,
        routes,
        accessibility: { wheelchair }
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 15);                         
};

const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const generateEstimatedDelay = (routeType) => {
  const ranges = {
    bus: [2, 12],
    tram: [1, 8],
    metro: [0, 5],
    rail: [3, 15],
    train: [3, 15],
    light_rail: [1, 10]
  };

  const [min, max] = ranges[routeType] || [1, 10];

  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const generateCrowdLevel = () => {
  const random = Math.random();

  if (random < 0.2) return "low";
  if (random < 0.6) return "medium";
  if (random < 0.9) return "high";
  return "full";
};

const generateVehicleCount = (routeType) => {
  switch (routeType) {
    case "metro":
      return Math.floor(Math.random() * 8) + 4;

    case "bus":
      return Math.floor(Math.random() * 15) + 5;

    case "rail":
    case "train":
      return Math.floor(Math.random() * 6) + 2;

    default:
      return Math.floor(Math.random() * 5) + 1;
  }
};

const generateTransitAlerts = (routes) => {
  const alerts = [];

  routes.forEach((route, index) => {
    if (route.averageDelay > 10) {
      alerts.push({
        alertId: `delay_${index}_${Date.now()}`,
        type: "delay",
        message: `${route.routeName} is delayed by ${route.averageDelay} minutes`,
        affectedRoutes: [route.routeId],
        severity:
          route.averageDelay > 20 ? "high" : "medium",
        startTime: new Date(),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        affectedStops: []
      });
    }

    if (route.crowdLevel === "full") {
      alerts.push({
        alertId: `crowd_${index}_${Date.now()}`,
        type: "service_change",
        message: `${route.routeName} is operating at full capacity`,
        affectedRoutes: [route.routeId],
        severity: "high",
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60 * 1000),
        affectedStops: []
      });
    }

    if (route.crowdLevel === "high") {
      alerts.push({
        alertId: `busy_${index}_${Date.now()}`,
        type: "service_change",
        message: `${route.routeName} is experiencing heavy passenger load`,
        affectedRoutes: [route.routeId],
        severity: "medium",
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60 * 1000),
        affectedStops: []
      });
    }
  });

  return alerts;
};

/**
 * Fetch live transit data from OpenTripPlanner
 * @param {Object} params
 * @param {number} params.lat - latitude
 * @param {number} params.lon - longitude
 * @param {string} params.destination - destination address or "city_center"
 */
export const fetchLiveTransitDirections = async ({
  lat,
  lon,
  destination
}) => {
  try {
    const latitude = Number(lat);
    const longitude = Number(lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new AppError(
        `Invalid coordinates for transit: lat=${lat}, lon=${lon}`,
        400
      );
    }

    // Default destination to city center if not provided
    const destLat = latitude + 0.02;
    const destLon = longitude + 0.02;

    const response = await axios.get(
      `${OTP_BASE_URL}/otp/routers/default/plan`,
      {
        params: {
          fromPlace: `${latitude},${longitude}`,
          toPlace: `${destLat},${destLon}`,
          mode: "TRANSIT,WALK",
          time: new Date().getHours() + ":" + String(new Date().getMinutes()).padStart(2, '0'),
          date: new Date().toISOString().split('T')[0],
          numItineraries: 3
        },
        timeout: 8000
      }
    );

    const data = response.data;

    if (!data.plan || !data.plan.itineraries) {
      console.warn("OTP response missing itineraries");
      return {
        routes: [],
        alerts: [],
        source: "opentripplanner"
      };
    }

    // Parse OTP itineraries into routes
    const routes = data.plan.itineraries.map((itinerary, idx) => {
      const legs = itinerary.legs || [];
      const modeMap = {
        BUS: "bus",
        SUBWAY: "metro",
        RAIL: "train",
        TRAM: "tram",
        LIGHT_RAIL: "light_rail"
      };
      const transitLegs = legs.filter((leg) => leg.mode && ['BUS', 'SUBWAY', 'TRAM', 'RAIL', 'LIGHT_RAIL'].includes(leg.mode));

      return {
        routeId: `route_${idx}`,
        routeName: transitLegs.map((l) => l.routeShortName || l.mode).join(" → ") || `Route ${idx + 1}`,
        type: modeMap[transitLegs[0]?.mode] || "bus",
        direction: data.plan.to?.name || "Destination",
        operator: transitLegs[0]?.agencyName || "City Transit",
        stops: legs
          .filter((leg) => leg.stop)
          .map((leg) => ({
            stopId: leg.stop?.id || `stop_${Math.random()}`,
            stopName: leg.stop?.name || leg.name,
            lat: leg.stop?.lat || leg.from?.lat,
            lon: leg.stop?.lon || leg.from?.lon,
            arrivalTime: new Date(leg.arrivalTime).toISOString(),
            departureTime: new Date(leg.departureTime).toISOString(),
            delayMinutes: 0,
            wheelchairAccessible: leg.stop?.wheelchairBoarding !== false
          })),
        vehicleCount: transitLegs.length,
        vehiclesOnRoute: [],
        averageDelay: 0,
        crowdLevel: "medium",
        frequency: Math.round((itinerary.duration || 1800) / 60),
        status: "operational"
      };
    });

    return {
      routes,
      alerts: [],
      source: "opentripplanner"
    };
  } catch (error) {

    if (error instanceof AppError) {
      throw error;
    }
    if (process.env.NODE_ENV === "development") {
      console.warn("Using generated transit data");
    }
    return generateMockTransitData(lat, lon);
  }
};

/**
 * Fetch nearby stops from OpenTripPlanner or generate common stops
 */
export const fetchNearbyTransitStops = async ({
  lat,
  lon,
  radiusKm = 1
}) => {
  try {
    const latitude = Number(lat);
    const longitude = Number(lon);

    // Try to fetch from OTP nearby stops endpoint (if available)
    try {
      const response = await axios.get(
        `${OTP_BASE_URL}/otp/routers/default/stops`,
        {
          timeout: 5000
        }
      );

      if (response.data && Array.isArray(response.data)) {
        // Filter stops within radius
        const nearbyStops = response.data
          .filter((stop) => {
            if (!stop.lat || !stop.lon) return false;
            const dist = Math.sqrt(
              Math.pow(stop.lat - latitude, 2) +
              Math.pow(stop.lon - longitude, 2)
            );
            return dist < radiusKm * 0.01; // Rough conversion
          })
          .slice(0, 10)
          .map((stop) => ({
            stopId: stop.id,
            stopName: stop.name,
            lat: stop.lat,
            lon: stop.lon,
            distance: 0,
            routes: stop.routes?.map((r) => r.shortName) || [],
            accessibility: {
              wheelchair: stop.wheelchairBoarding !== false,
              elevator: false,
              parking: false
            }
          }));

        if (nearbyStops.length > 0) {
          return { stops: nearbyStops, source: "opentripplanner" };
        }
      }
    } catch (err) {
      console.warn("OTP stops endpoint unavailable, using generated stops");
    }

    // Fallback: Generate common transit stops around the city
    const stops = generateCommonStops(latitude, longitude);
    return { stops, source: "opentripplanner_generated" };
  } catch (error) {
    console.error("NEARBY STOPS FETCH ERROR →", error.message);
    // Return generated stops as fallback
    return { stops: generateCommonStops(lat, lon), source: "generated" };
  }
};

/**
 * Generate common transit stops around a location
 */
const generateCommonStops = (baseLat, baseLon) => {
  return [
    {
      stopId: "stop_central_station",
      stopName: "Central Station",
      lat: baseLat,
      lon: baseLon,
      distance: 0,
      routes: ["Bus 101", "Metro Line 1"],
      accessibility: { wheelchair: true, elevator: true, parking: true }
    },
    {
      stopId: "stop_city_center",
      stopName: "City Center",
      lat: baseLat + 0.005,
      lon: baseLon + 0.005,
      distance: 0.5,
      routes: ["Bus 201", "Bus 202", "Tram 5"],
      accessibility: { wheelchair: true, elevator: true, parking: true }
    },
    {
      stopId: "stop_metro_north",
      stopName: "Metro North Terminal",
      lat: baseLat + 0.01,
      lon: baseLon + 0.008,
      distance: 1.0,
      routes: ["Metro Line 1", "Metro Line 2"],
      accessibility: { wheelchair: true, elevator: true, parking: true }
    },
    {
      stopId: "stop_bus_depot",
      stopName: "Main Bus Depot",
      lat: baseLat - 0.008,
      lon: baseLon + 0.01,
      distance: 1.2,
      routes: ["Bus 101", "Bus 103", "Bus 105"],
      accessibility: { wheelchair: true, elevator: false, parking: true }
    },
    {
      stopId: "stop_railway_stn",
      stopName: "Railway Station",
      lat: baseLat + 0.012,
      lon: baseLon - 0.008,
      distance: 1.5,
      routes: ["Bus 50", "Tram 1", "Taxi"],
      accessibility: { wheelchair: true, elevator: true, parking: true }
    },
    {
      stopId: "stop_airport_link",
      stopName: "Airport Link Stop",
      lat: baseLat - 0.01,
      lon: baseLon - 0.012,
      distance: 1.8,
      routes: ["Express Bus 9", "Shuttle"],
      accessibility: { wheelchair: true, elevator: false, parking: false }
    }
  ];
};

/**
 * Generate mock transit data for testing/fallback
 */
const generateMockTransitData = (lat, lon) => {
  return {
    routes: [
      {
        routeId: "route_101",
        routeName: "Bus 101 - City Express",
        type: "bus",
        direction: "Central Station",
        operator: "City Transit",
        stops: [
          {
            stopId: "s1",
            stopName: "Current Location",
            lat,
            lon,
            arrivalTime: new Date().toISOString(),
            departureTime: new Date(Date.now() + 2 * 60000).toISOString(),
            delayMinutes: 0,
            wheelchairAccessible: true
          },
          {
            stopId: "s2",
            stopName: "Metro Station",
            lat: lat + 0.01,
            lon: lon + 0.01,
            arrivalTime: new Date(Date.now() + 15 * 60000).toISOString(),
            departureTime: new Date(Date.now() + 17 * 60000).toISOString(),
            delayMinutes: 2,
            wheelchairAccessible: true
          },
          {
            stopId: "s3",
            stopName: "City Center",
            lat: lat + 0.02,
            lon: lon + 0.02,
            arrivalTime: new Date(Date.now() + 35 * 60000).toISOString(),
            departureTime: new Date(Date.now() + 37 * 60000).toISOString(),
            delayMinutes: 0,
            wheelchairAccessible: true
          }
        ],
        vehicleCount: 3,
        vehiclesOnRoute: [],
        averageDelay: 2,
        crowdLevel: "medium",
        frequency: 15,
        status: "operational"
      },
      {
        routeId: "route_204",
        routeName: "Metro Line 2",
        type: "metro",
        direction: "North Terminal",
        operator: "Metro Authority",
        stops: [
          {
            stopId: "m1",
            stopName: "Current Station",
            lat,
            lon,
            arrivalTime: new Date().toISOString(),
            departureTime: new Date(Date.now() + 1 * 60000).toISOString(),
            delayMinutes: 0,
            wheelchairAccessible: true
          },
          {
            stopId: "m2",
            stopName: "Downtown Station",
            lat: lat - 0.01,
            lon: lon + 0.015,
            arrivalTime: new Date(Date.now() + 10 * 60000).toISOString(),
            departureTime: new Date(Date.now() + 11 * 60000).toISOString(),
            delayMinutes: 0,
            wheelchairAccessible: true
          },
          {
            stopId: "m3",
            stopName: "North Terminal",
            lat: lat - 0.02,
            lon: lon + 0.03,
            arrivalTime: new Date(Date.now() + 25 * 60000).toISOString(),
            departureTime: null,
            delayMinutes: 1,
            wheelchairAccessible: true
          }
        ],
        vehicleCount: 2,
        vehiclesOnRoute: [],
        averageDelay: 1,
        crowdLevel: "high",
        frequency: 8,
        status: "operational"
      }
    ],
    alerts: [
      {
        type: "delay",
        message: "Bus 101 running 5 minutes late due to heavy traffic",
        affectedRoutes: ["route_101"],
        severity: "medium"
      }
    ],
    nearbyStops: [
      {
        stopId: "stop_1",
        stopName: "Central Station",
        lat,
        lon,
        distance: 0,
        routes: ["Bus 101", "Metro Line 1"],
        accessibility: { wheelchair: true }
      },
      {
        stopId: "stop_2",
        stopName: "City Center",
        lat: lat + 0.005,
        lon: lon + 0.005,
        distance: 0.5,
        routes: ["Bus 201", "Bus 202"],
        accessibility: { wheelchair: false }
      }
    ],
  };
};

/**
 * Fetch and store transit data for a city
 */
export const fetchAndStoreTransitForCity = async (cityName) => {
  const cityDoc = await getCityByName(cityName);
  if (!cityDoc) throw new AppError(`City "${cityName}" not found`, 404);

  const { latitude: lat, longitude: lon } = cityDoc;

  let routes = [];
  let nearbyStops = [];
  let alerts = [];
  let sourceName = "mock";

  // ── find or create DataSource doc ──
  let dataSource = await DataSource.findOne({ name: "transitland" });
  if (!dataSource) {
    dataSource = await DataSource.create({
      name: "transitland",
      type: "api",
      reliabilityScore: 8,
      lastFetchedAt: new Date()
    });
  }

  // ══ LAYER 1 — Transitland ══════════════════════════════════════════════════
  try {
    const [routesRes, stopsRes] = await Promise.allSettled([
      axios.get(`${TRANSITLAND_BASE}/routes`, {
        params: { lat, lon, radius: 8000, per_page: 20,
                  apikey: TRANSITLAND_API_KEY },
        timeout: 10000
      }),
      axios.get(`${TRANSITLAND_BASE}/stops`, {
        params: { lat, lon, radius: 10000, per_page: 15,
                  served_by_route_types: "0,1,2,3",
                  apikey: TRANSITLAND_API_KEY },
        timeout: 10000
      })
    ]);

    const rawRoutes = routesRes.status === "fulfilled"
      ? routesRes.value.data?.routes || []
      : [];

    const rawStops = stopsRes.status === "fulfilled"
      ? stopsRes.value.data?.stops || []
      : [];

    if (rawRoutes.length > 0) {
      routes = rawRoutes.map((r) => {
        const operator = r.agency?.agency_name || "Unknown operator";
        const routeName = [r.route_short_name, r.route_long_name]
          .filter(Boolean).join(" – ");
        const typeInfo = resolveRouteType(r.route_type, routeName, operator);
        const delay = generateEstimatedDelay(typeInfo.type);

        return {
          routeId: r.id || r.onestop_id,
          routeName: routeName || "Unnamed Route",
          type: typeInfo.type,
          typeLabel: typeInfo.label,
          operator,
          direction: r.route_long_name || "",
          averageDelay: delay,
          crowdLevel: generateCrowdLevel(),
          status: delay > 20 ? "delayed" : "operational",
          frequency: Math.floor(Math.random() * 20) + 5,
          vehicleCount: generateVehicleCount(typeInfo.type),
          vehiclesOnRoute: [],
          stops: []
        };
      });
      sourceName = "transitland";
      console.log(`✅ Transitland: ${routes.length} routes for ${cityName}`);
    }

    if (rawStops.length > 0) {
      nearbyStops = buildNearbyStops(rawStops, lat, lon);
      console.log(`✅ Transitland: ${nearbyStops.length} stops for ${cityName}`);
    }

  } catch (err) {
    console.warn(`Transitland failed for ${cityName}:`, err.message);
  }

  // ══ LAYER 2 — Mobility Database (if Transitland returned no routes) ════════
  if (routes.length === 0) {
    console.log(`Trying Mobility Database for ${cityName}...`);
    const mdbRoutes = await fetchMobilityDBRoutes(cityName, lat, lon);
    if (mdbRoutes.length > 0) {
      routes = mdbRoutes;
      sourceName = "mobilitydatabase";
    }
  }

  // ══ LAYER 3 — Overpass (routes + stops fallback) ══════════════════════════
  if (routes.length === 0) {
    console.log(`Trying Overpass routes for ${cityName}...`);
    const overpassRoutes = await fetchRoutesFromOverpass(lat, lon);
    if (overpassRoutes.length > 0) {

  routes = overpassRoutes.map((r, index) => {

    const routeType = r.tags?.route || "bus";

    const delay = generateEstimatedDelay(routeType);

    return {
      routeId: `osm_${r.id}`,

      routeName:
        r.tags?.name ||
        r.tags?.ref ||
        `${cityName} Route ${index + 1}`,

      type: routeType,

      operator:
        r.tags?.operator ||
        "Local Transit",

      direction:
        r.tags?.from && r.tags?.to
          ? `${r.tags.from} → ${r.tags.to}`
          : "",

      averageDelay: delay,

      crowdLevel: generateCrowdLevel(),

      status:
        delay > 20
          ? "delayed"
          : "operational",

      frequency:
        Math.floor(Math.random() * 20) + 5,

      vehicleCount:
        generateVehicleCount(routeType),

      vehiclesOnRoute: [],

      stops: []
    };
  });

  sourceName = nearbyStops.length > 0
    ? "overpass+transitland"
    : "overpass";
}
  }

  if (nearbyStops.length === 0) {
    console.log(`Trying Overpass stops for ${cityName}...`);
    const overpassStops = await fetchStopsFromOverpass(lat, lon);
    nearbyStops = buildNearbyStops(overpassStops, lat, lon);
    if (nearbyStops.length > 0) {
      sourceName = routes.length > 0
        ? `${sourceName}+overpass`
        : "overpass";
    }
  }

  // ══ LAYER 4 — enriched mock as absolute last resort ═══════════════════════
  if (routes.length === 0) {
    console.warn(`All sources failed for ${cityName}, using enriched mock`);
    const mock = generateMockTransitData(lat, lon);
    routes = mock.routes;
    nearbyStops = nearbyStops.length > 0 ? nearbyStops : mock.nearbyStops || [];
    sourceName = "mock";
  }

  // ── generate alerts from final routes ──
  alerts = generateTransitAlerts(routes);

  // ── save to DB ──
  const transitDoc = await PublicTransit.findOneAndUpdate(
    { city: cityDoc._id },
    {
      city: cityDoc._id,
      routes,
      nearbyStops,
      alerts,
      source: dataSource._id,
      fetchedAt: new Date()
    },
    { upsert: true, new: true }
  );

  console.log(`💾 Saved transit for ${cityName} — source: ${sourceName}, routes: ${routes.length}, stops: ${nearbyStops.length}`);

  return {
    data: transitDoc,
    message: `Transit data saved from ${sourceName}`
  };
};

/**
 * Get latest transit data for a city
 */
export const getLatestTransitByCity = async (cityId) => {
  try {
    const latestTransit = await PublicTransit.findOne({
      city: cityId
    })
      .sort({ recordedAt: -1 })
      .populate("city", "name latitude longitude")
      .populate("source", "name type");

    if (!latestTransit) {
      throw new AppError("No transit data found for this city", 404);
    }

    return latestTransit;
  } catch (error) {
    console.error("GET LATEST TRANSIT ERROR →", error.message);
    if (error instanceof AppError) throw error;
    throw new AppError("Failed to fetch latest transit data", 500);
  }
};

/**
 * Get transit history for a city within a time range
 */
export const getTransitHistory = async (
  cityId,
  startDate,
  endDate,
  limit = 100
) => {
  try {
    const history = await PublicTransit.find({
      city: cityId,
      recordedAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
      .sort({ recordedAt: -1 })
      .limit(limit)
      .populate("city", "name")
      .populate("source", "name");

    return history;
  } catch (error) {
    console.error("GET TRANSIT HISTORY ERROR →", error.message);
    throw new AppError("Failed to fetch transit history", 500);
  }
};

/**
 * Calculate transit alerts based on delays and disruptions
 */
export const analyzeTransitAlerts = (transitData) => {
  const alerts = [];

  if (!transitData.routes) return alerts;

  for (const route of transitData.routes) {
    // High delay alert
    if (route.averageDelay > 15) {
      alerts.push({
        type: "delay",
        message: `${route.routeName} is delayed by ${route.averageDelay} minutes`,
        affectedRoutes: [route.routeId],
        severity: route.averageDelay > 30 ? "high" : "medium"
      });
    }

    // High crowding alert
    if (route.crowdLevel === "full") {
      alerts.push({
        type: "disruption",
        message: `${route.routeName} is at full capacity`,
        affectedRoutes: [route.routeId],
        severity: "high"
      });
    }
  }

  return alerts;
};

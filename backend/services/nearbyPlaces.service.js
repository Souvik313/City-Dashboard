import axios from "axios";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

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

  return null;
};

const resolveRouteType = (routeTypeCode, routeName, operator) => {
  // Always try name-based inference first for Indian feeds
  const inferred = inferTypeFromName(routeName, operator);
  if (inferred) return inferred;
  return getRouteType(routeTypeCode);
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

const EMERGENCY_QUERIES = {
  hospitals: `node["amenity"="hospital"](around:3000,LAT,LON);
              node["amenity"="clinic"](around:3000,LAT,LON);
              node["amenity"="doctors"](around:3000,LAT,LON);`,

  police:    `node["amenity"="police"](around:3000,LAT,LON);`,

  fire:      `node["amenity"="fire_station"](around:3000,LAT,LON);`,

  pharmacy:  `node["amenity"="pharmacy"](around:3000,LAT,LON);`,

  all:       `node["amenity"="hospital"](around:3000,LAT,LON);
              node["amenity"="clinic"](around:3000,LAT,LON);
              node["amenity"="police"](around:3000,LAT,LON);
              node["amenity"="fire_station"](around:3000,LAT,LON);
              node["amenity"="pharmacy"](around:3000,LAT,LON);`
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

const formatAmenityName = (amenity) => {
  if (!amenity) return null;
  const nameMap = {
    hospital:      "Hospital",
    clinic:        "Clinic",
    doctors:       "Medical Clinic",
    police:        "Police Station",
    fire_station:  "Fire Station",
    pharmacy:      "Pharmacy",
  };
  return nameMap[amenity] || null;
};

export const fetchNearbyEmergencyPlaces = async (lat, lon, type = "all") => {

  const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  const queryBody = EMERGENCY_QUERIES[type] || EMERGENCY_QUERIES.all;

  const query = `
    [out:json][timeout:15];
    (
      ${queryBody.replaceAll("LAT", lat).replaceAll("LON", lon)}
    );
    out body;
  `;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await axios.post(
        endpoint,
        `data=${encodeURIComponent(query)}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "CityPulse/1.0"
          },
          timeout: 50000,
        }
      );

      const elements = res.data?.elements || [];
      console.log(`✅ Emergency places (${endpoint}): ${elements.length}`);

      return elements
  .filter((el) => {
    // keep named places AND unnamed ones that have a clear amenity type
    // only skip if we have absolutely no identifying information
    return el.tags?.name ||
           el.tags?.amenity ||
           el.tags?.["name:en"];
  })
  .map((el) => ({
    id:       `osm_${el.id}`,
    name:     el.tags?.name ||
              el.tags?.["name:en"] ||
              el.tags?.["name:hi"] ||     // Hindi name
              formatAmenityName(el.tags?.amenity) ||
              "Unnamed facility",
    type:     el.tags.amenity,
    lat:      el.lat,
    lon:      el.lon,
    distance: parseFloat(
      getDistanceKm(lat, lon, el.lat, el.lon).toFixed(2)
    ),
    phone:    el.tags?.phone ||
              el.tags?.["contact:phone"] ||
              el.tags?.["contact:mobile"] || null,
    address:  [
      el.tags?.["addr:housenumber"],
      el.tags?.["addr:street"],
      el.tags?.["addr:suburb"],
      el.tags?.["addr:city"]
    ].filter(Boolean).join(", ") || null,
    openingHours: el.tags?.opening_hours || null,
  }))
  .sort((a, b) => a.distance - b.distance)
  .slice(0, 25);

    } catch (err) {
      console.warn(`Emergency Overpass failed (${endpoint}): ${err.message}`);
    }
  }

  console.error("All Overpass endpoints failed for emergency places");
  return [];
};

export const fetchNearbyTransitStops = async (lat, lon) => {
  const query = `
    [out:json][timeout:15];
    (
      node["highway"="bus_stop"](around:2000,${lat},${lon});
      node["railway"="station"](around:2000,${lat},${lon});
      node["railway"="halt"](around:2000,${lat},${lon});
      node["station"="subway"](around:2000,${lat},${lon});
      node["railway"="tram_stop"](around:2000,${lat},${lon});
    );
    out body;
  `;

  try {
    const res = await axios.post(
      OVERPASS_URL,
      `data=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "CityPulse/1.0"
        },
        timeout: 50000,
      }
    );

    const elements = res.data?.elements || [];

    return elements
      .map((el) => ({
        stopId:   `osm_${el.id}`,
        stopName: el.tags?.name || el.tags?.["name:en"] || "Unnamed Stop",
        type:     el.tags?.railway || el.tags?.highway || "stop",
        lat:      el.lat,
        lon:      el.lon,
        distance: parseFloat(
          getDistanceKm(lat, lon, el.lat, el.lon).toFixed(2)
        ),
        routes: (el.tags?.route_ref || el.tags?.ref || "")
          .split(";").map((r) => r.trim()).filter(Boolean),
        accessibility: {
          wheelchair: el.tags?.wheelchair === "yes"
        }
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);

  } catch (err) {
    console.error("Nearby transit Overpass error:", err.message);
    return [];
  }
};

export const fetchNearbyRoutes = async (lat, lon) => {
  const query = `
    [out:json][timeout:15];
    (
      relation["route"="bus"](around:3000,${lat},${lon});
      relation["route"="train"](around:3000,${lat},${lon});
      relation["route"="subway"](around:3000,${lat},${lon});
      relation["route"="tram"](around:3000,${lat},${lon});
      relation["route"="monorail"](around:3000,${lat},${lon});
      relation["route"="ferry"](around:3000,${lat},${lon});
    );
    out body;
  `;

  const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await axios.post(
        endpoint,
        `data=${encodeURIComponent(query)}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "CityPulse/1.0"
          },
          timeout: 100000,
        }
      );

      const relations = (res.data?.elements || [])
        .filter((el) => el.type === "relation");

      // de-duplicate by ref and filter unnamed
      const seenRefs = new Set();
      const filtered = relations
        .filter((rel) => rel.tags?.ref || rel.tags?.name)
        .filter((rel) => {
          const ref = rel.tags?.ref || rel.tags?.name;
          if (seenRefs.has(ref)) return false;
          seenRefs.add(ref);
          return true;
        });

      // prioritise non-bus routes, cap buses
      const byType = { subway: [], train: [], tram: [],
                       monorail: [], ferry: [], bus: [] };

      filtered.forEach((rel) => {
        const route = rel.tags?.route || "bus";
        if (byType[route]) byType[route].push(rel);
        else byType.bus.push(rel);
      });

      const MAX_ROUTES = 20;
      const nonBus = [
        ...byType.subway, ...byType.train, ...byType.tram,
        ...byType.monorail, ...byType.ferry
      ];
      const busSlots = Math.max(0, MAX_ROUTES - nonBus.length);
      const finalRelations = [...nonBus, ...byType.bus.slice(0, busSlots)];

      // map to your route schema
      return finalRelations.map((rel) => {
        const routeTag  = rel.tags?.route || "bus";
        const operator  = rel.tags?.operator || rel.tags?.network || "Local Transit";
        const routeName = rel.tags?.name || rel.tags?.ref || `Route ${rel.id}`;
        const typeInfo  = resolveRouteType(null, routeName, operator) || {
          type: routeTag === "train"  ? "rail"
              : routeTag === "subway" ? "metro"
              : routeTag,
          label: routeTag
        };

        return {
          routeId:   `osm_${rel.id}`,
          routeName,
          type:      typeInfo.type,
          typeLabel: typeInfo.label,
          operator,
          direction: rel.tags?.to || rel.tags?.direction || "",
          averageDelay:    generateEstimatedDelay(typeInfo.type),
          crowdLevel:      generateCrowdLevel(),
          status:          "operational",
          frequency:       rel.tags?.interval
            ? Math.round(parseInt(rel.tags.interval) / 60)
            : Math.floor(Math.random() * 20) + 5,
          vehicleCount:    generateVehicleCount(typeInfo.type),
          vehiclesOnRoute: [],
          stops:           []
        };
      });

    } catch (err) {
      console.warn(`Overpass nearby routes failed (${endpoint}):`, err.message);
    }
  }

  console.warn("All Overpass endpoints failed for nearby routes");
  return [];
};
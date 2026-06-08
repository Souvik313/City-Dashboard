import axios from "axios";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
];

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

// category → OSM tags mapping
const TRAVEL_CATEGORIES = {
  hotels: {
    label: "Hotels",
    icon:  "🏨",
    tags: [
      `node["tourism"="hotel"]`,
      `node["tourism"="motel"]`,
      `node["tourism"="resort"]`,
    ]
  },
  budget: {
    label: "Budget Stay / Hostels",
    icon:  "🛏️",
    tags: [
      `node["tourism"="hostel"]`,
      `node["tourism"="guest_house"]`,
      `node["tourism"="bed_and_breakfast"]`,
    ]
  },
  restaurants: {
    label: "Restaurants",
    icon:  "🍽️",
    tags: [
      `node["amenity"="restaurant"]`,
      `node["amenity"="food_court"]`,
    ]
  },
  fastfood: {
    label: "Fast Food",
    icon:  "🍔",
    tags: [
      `node["amenity"="fast_food"]`,
      `node["amenity"="cafe"]`,
    ]
  },
  attractions: {
    label: "Tourist Attractions",
    icon:  "🗺️",
    tags: [
      `node["tourism"="attraction"]`,
      `node["tourism"="museum"]`,
      `node["tourism"="viewpoint"]`,
      `node["historic"="monument"]`,
    ]
  },
  all: {
    label: "All",
    icon:  "✨",
    tags: [
      `node["tourism"="hotel"]`,
      `node["tourism"="hostel"]`,
      `node["tourism"="guest_house"]`,
      `node["tourism"="motel"]`,
      `node["amenity"="restaurant"]`,
      `node["amenity"="cafe"]`,
      `node["tourism"="attraction"]`,
      `node["tourism"="museum"]`,
    ]
  }
};

export const fetchTravelPlaces = async (
  lat, lon, category = "all", radiusMeters = 5000
) => {
  const catConfig = TRAVEL_CATEGORIES[category]
    || TRAVEL_CATEGORIES.all;

  const tagQueries = catConfig.tags
    .map((tag) => `${tag}(around:${radiusMeters},${lat},${lon});`)
    .join("\n      ");

  const query = `
    [out:json][timeout:20];
    (
      ${tagQueries}
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
          timeout: 25000,
        }
      );

      const elements = res.data?.elements || [];

      // group by category — take top 5 per type
      const byType = elements.reduce((acc, el) => {
        const type = el.tags?.tourism ||
                     el.tags?.amenity ||
                     "place";
        if (!acc[type]) acc[type] = [];
        acc[type].push(el);
        return acc;
      }, {});

      const MAX_PER_TYPE = 5;
      const results = Object.entries(byType).flatMap(([type, items]) =>
        items
          .filter((el) => el.tags?.name)
          .map((el) => ({
            id:       `osm_${el.id}`,
            name:     el.tags.name,
            type,
            category: category === "all"
              ? detectCategory(type)
              : category,
            lat:      el.lat,
            lon:      el.lon,
            distance: parseFloat(
              getDistanceKm(lat, lon, el.lat, el.lon).toFixed(2)
            ),
            phone:    el.tags?.phone ||
                      el.tags?.["contact:phone"] || null,
            website:  el.tags?.website ||
                      el.tags?.["contact:website"] || null,
            address: [
              el.tags?.["addr:housenumber"],
              el.tags?.["addr:street"],
              el.tags?.["addr:suburb"],
            ].filter(Boolean).join(", ") || null,
            openingHours: el.tags?.opening_hours || null,
            stars:    el.tags?.stars || null,
            cuisine:  el.tags?.cuisine || null,
            wheelchair: el.tags?.wheelchair === "yes",
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, MAX_PER_TYPE)
      );

      const sorted = results.sort((a, b) => a.distance - b.distance);
      console.log(
        `✅ Travel search: ${sorted.length} places` +
        ` for "${category}" in area`
      );
      return sorted;

    } catch (err) {
      console.warn(
        `Travel Overpass failed (${endpoint}): ${err.message}`
      );
    }
  }

  return [];
};

const detectCategory = (osmType) => {
  if (["hotel","motel","resort"].includes(osmType)) return "hotels";
  if (["hostel","guest_house","bed_and_breakfast"]
    .includes(osmType)) return "budget";
  if (["restaurant","food_court"].includes(osmType)) return "restaurants";
  if (["fast_food","cafe"].includes(osmType)) return "fastfood";
  if (["attraction","museum","viewpoint","monument"]
    .includes(osmType)) return "attractions";
  return "other";
};
import axios from "axios";

export const fetchStopsFromOverpass = async (lat, lon) => {
  const query = `
    [out:json][timeout:25];
    (
      node["highway"="bus_stop"](around:10000,${lat},${lon});
      node["railway"="station"](around:10000,${lat},${lon});
      node["railway"="halt"](around:10000,${lat},${lon});
      node["railway"="tram_stop"](around:10000,${lat},${lon});
      node["station"="subway"](around:10000,${lat},${lon});
      node["amenity"="bus_station"](around:10000,${lat},${lon});
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
            "Accept": "application/json"
          },
          timeout: 50000,
        }
      );

      const elements = response.data?.elements || [];
      console.log(`✅ Overpass (${endpoint}): ${elements.length} stops`);
      return elements;

    } catch (err) {
      console.warn(`Overpass endpoint failed (${endpoint}):`, err.message);
      // try next endpoint
    }
  }
  console.error("All Overpass endpoints failed");
  return [];
};
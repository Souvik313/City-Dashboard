import axios from "axios";
import Groq from "groq-sdk";
import { mapConditionToSpecialty } from "../utils/specialtyMapper.js";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const SPECIALTY_EXCLUSIONS = {
  gastro:        ["eye", "dental", "ortho", "skin", "derma",
                  "ophthal", "vision", "bone", "cancer", "onco"],
  diarrhoea:     ["eye", "dental", "ortho", "skin", "derma",
                  "ophthal", "vision", "bone", "cancer", "onco"],
  stomach:       ["eye", "dental", "ortho", "skin", "derma",
                  "ophthal", "vision", "bone"],
  liver:         ["eye", "dental", "ortho", "skin", "derma",
                  "ophthal", "bone"],
  kidney:        ["eye", "dental", "ortho", "skin", "derma",
                  "ophthal", "bone"],
  eye:           ["dental", "ortho", "gastro", "cancer",
                  "kidney", "liver", "bone", "skin"],
  dental:        ["eye", "ortho", "gastro", "cancer",
                  "kidney", "liver", "skin", "ophthal"],
  skin:          ["eye", "dental", "ortho", "gastro",
                  "ophthal", "bone", "cancer"],
  bone:          ["eye", "dental", "gastro", "skin",
                  "derma", "ophthal", "cancer"],
  cancer:        ["eye", "dental", "ortho", "skin",
                  "derma", "ophthal"],
  heart:         ["eye", "dental", "ortho", "skin",
                  "derma", "ophthal", "bone"],
  mental:        ["eye", "dental", "ortho", "skin",
                  "derma", "ophthal", "bone", "cancer"],
};

const getExclusionKeywords = (condition) => {
  const input = condition.toLowerCase();
  for (const [key, exclusions] of Object.entries(SPECIALTY_EXCLUSIONS)) {
    if (input.includes(key)) return exclusions;
  }
  return [];
};

const isRelevantHospital = (hospitalName, condition) => {
  const name = hospitalName.toLowerCase();
  const exclusions = getExclusionKeywords(condition);

  // if hospital name contains an excluded specialty word — filter it out
  return !exclusions.some((word) => name.includes(word));
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

// ── Overpass fetch ────────────────────────────────────────────────────────────

const fetchFromOverpass = async (lat, lon, condition, radiusMeters) => {
  const specialtyInfo = mapConditionToSpecialty(condition);

  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
      way["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
      node["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
      node["amenity"="doctors"](around:${radiusMeters},${lat},${lon});
      node["healthcare"="doctor"](around:${radiusMeters},${lat},${lon});
      node["healthcare"="hospital"](around:${radiusMeters},${lat},${lon});
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
          timeout: 25000
        }
      );

      const elements = res.data?.elements || [];

      const seen = new Set();
      const results = elements
        .filter((el) => {
          if (!el.tags?.name) return false;
          if (seen.has(el.id)) return false;
          seen.add(el.id);
          return true;
        })
        .map((el) => {
          const elLat = el.lat ?? el.center?.lat;
          const elLon = el.lon ?? el.center?.lon;
          if (!elLat || !elLon) return null;

          const name = (el.tags?.name || "").toLowerCase();
          const osmSpecialty = (
            el.tags?.["healthcare:speciality"] ||
            el.tags?.["speciality"] || ""
          ).toLowerCase();

          const specialtyMatch =
            specialtyInfo?.specialties?.some(
              (s) =>
                name.includes(s.toLowerCase()) ||
                osmSpecialty.includes(s.toLowerCase())
            ) || false;

          return {
            id:            `osm_${el.id}`,
            name:          el.tags.name,
            type:          el.tags.amenity ||
                           el.tags.healthcare || "hospital",
            specialtyMatch,
            source:        "overpass",
            lat:           elLat,
            lon:           elLon,
            distance:      parseFloat(
              getDistanceKm(lat, lon, elLat, elLon).toFixed(2)
            ),
            phone:         el.tags?.phone ||
                           el.tags?.["contact:phone"] || null,
            address: [
              el.tags?.["addr:housenumber"],
              el.tags?.["addr:street"],
              el.tags?.["addr:suburb"],
              el.tags?.["addr:city"]
            ].filter(Boolean).join(", ") || null,
            website:       el.tags?.website ||
                           el.tags?.["contact:website"] || null,
            openingHours:  el.tags?.opening_hours || null,
            emergency:     el.tags?.emergency === "yes",
          };
        })
        .filter(Boolean)
        .filter((r) => isRelevantHospital(r.name, condition))
        .sort((a, b) => {
          if (b.specialtyMatch !== a.specialtyMatch)
            return b.specialtyMatch - a.specialtyMatch;
          return a.distance - b.distance;
        })
        .slice(0, 15);

      console.log(
        `✅ Overpass health: ${results.length} hospitals for "${condition}"`
      );
      return results;

    } catch (err) {
      console.warn(`Overpass health failed (${endpoint}): ${err.message}`);
    }
  }

  return [];
};

// ── Groq complete fallback ────────────────────────────────────────────────────
// Called when Overpass returns 0 results.
// Groq generates hospital suggestions + full medical advice from its own knowledge.

const fetchFromGroq = async (condition, cityName, lat, lon) => {
  try {
    console.log(
      `Overpass returned 0 results — trying Groq for "${condition}" in ${cityName}`
    );

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: `You are a medical information advisor specializing in Indian healthcare.

A user in ${cityName}, India is searching for medical help for: "${condition}"

Using your knowledge of Indian hospitals and healthcare, provide:
1. Well-known hospitals in ${cityName} that treat this condition
   (use real hospital names you know — Apollo, Fortis, AIIMS, PGI, etc.)
2. Which specialist/department to visit
3. Common medications used for this condition in India
   (generic names, not brand names)
4. Practical health advice specific to this condition
5. Questions to ask the doctor before treatment

Respond ONLY with a valid JSON object, no markdown, no extra text:
{
  "hospitals": [
    {
      "name": "Real hospital name in ${cityName}",
      "type": "hospital or clinic",
      "specialtyMatch": true,
      "department": "Which department to visit",
      "address": "Area/locality in ${cityName} if known",
      "phone": null,
      "website": null,
      "emergency": false,
      "source": "groq",
      "note": "Why this hospital is good for this condition"
    }
  ],
  "specialtyAdvice": "Which type of specialist to consult and why",
  "medications": [
    {
      "name": "Generic medication name",
      "purpose": "What it treats",
      "note": "Important usage note"
    }
  ],
  "healthAdvice": [
    "Practical advice point 1",
    "Practical advice point 2",
    "Practical advice point 3"
  ],
  "questionsToAsk": [
    "Question to ask the doctor 1",
    "Question to ask the doctor 2",
    "Question to ask the doctor 3"
  ],
  "alternativeCities": [
    {
      "city": "Nearby city name",
      "reason": "Why this city has better facilities for this condition"
    }
  ],
  "urgencyLevel": "low / medium / high / emergency",
  "urgencyNote": "How urgently should this condition be addressed"
}

Important rules:
- Only suggest hospitals you are confident exist in ${cityName}
- If you are not sure of hospitals in ${cityName} specifically,
  suggest the nearest major city with known facilities
- Generic medication names only, no brand names
- Keep all advice India-specific and practical
- If the condition is a mental health condition,
  be especially sensitive and include helpline numbers in healthAdvice`
      }]
    });

    const text = response.choices[0].message.content.trim();
    const parsed = JSON.parse(text);

    // map Groq hospital objects to the same shape as Overpass results
    // so the frontend doesn't need to handle two different formats
    const hospitals = (parsed.hospitals || []).map((h, i) => ({
      id:            `groq_${i}`,
      name:          h.name,
      type:          h.type || "hospital",
      specialtyMatch: h.specialtyMatch ?? true,
      source:        "groq",
      lat:           null,   // Groq doesn't know exact coords
      lon:           null,
      distance:      null,   // can't calculate without coords
      phone:         h.phone || null,
      address:       h.address || null,
      website:       h.website || null,
      openingHours:  null,
      emergency:     h.emergency || false,
      department:    h.department || null,
      note:          h.note || null,
    }));

    console.log(
      `✅ Groq health fallback: ${hospitals.length} hospitals,` +
      ` ${parsed.medications?.length || 0} medications for "${condition}"`
    );

    return {
      hospitals,
      specialtyAdvice:  parsed.specialtyAdvice  || null,
      medications:      parsed.medications       || [],
      healthAdvice:     parsed.healthAdvice      || [],
      questionsToAsk:   parsed.questionsToAsk    || [],
      alternativeCities:parsed.alternativeCities || [],
      urgencyLevel:     parsed.urgencyLevel      || "medium",
      urgencyNote:      parsed.urgencyNote       || null,
    };

  } catch (err) {
    console.warn("Groq health fallback failed:", err.message);
    return null;
  }
};

// ── Groq advice enrichment ────────────────────────────────────────────────────
// Called when Overpass DID return results.
// Groq adds advice, medications, questions on top of real hospital data.

const enrichWithGroqAdvice = async (condition, cityName, hospitals) => {
  try {
    const hospitalList = hospitals
      .slice(0, 8)
      .map((h) => `- ${h.name} (${h.distance}km)`)
      .join("\n");

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 700,
      messages: [{
        role: "user",
        content: `You are a medical information advisor for India.

A user in ${cityName} is searching for specialists for: "${condition}"

These nearby hospitals were found:
${hospitalList}

Respond ONLY with a valid JSON object, no markdown:
{
  "specialtyAdvice": "Which specialist/department to ask for",
  "medications": [
    {
      "name": "Generic medication name",
      "purpose": "What it treats",
      "note": "Important usage note"
    }
  ],
  "healthAdvice": [
    "Practical advice point 1",
    "Practical advice point 2"
  ],
  "questionsToAsk": [
    "Question to ask the doctor 1",
    "Question to ask the doctor 2"
  ],
  "alternativeCities": [
    {
      "city": "City name",
      "reason": "Why it has better facilities"
    }
  ],
  "urgencyLevel": "low / medium / high / emergency",
  "urgencyNote": "How urgent is this condition"
}

Generic medication names only. Keep advice India-specific and practical.`
      }]
    });

    const text = response.choices[0].message.content.trim();
    return JSON.parse(text);

  } catch (err) {
    console.warn("Groq enrichment failed:", err.message);
    return null;
  }
};

// ── main exported function ────────────────────────────────────────────────────

export const searchHospitalsByCondition = async (
  lat, lon, condition, radiusMeters = 15000, cityName = ""
) => {
  const specialtyInfo = mapConditionToSpecialty(condition);

  // ── Layer 1: Overpass ──────────────────────────────────────────────────────
  const overpassResults = await fetchFromOverpass(
    lat, lon, condition, radiusMeters
  );

  // ── Layer 2: Groq complete fallback (Overpass returned nothing) ────────────
  if (overpassResults.length === 0) {
    const groqFallback = await fetchFromGroq(condition, cityName, lat, lon);

    if (groqFallback) {
      return {
        results:          groqFallback.hospitals,
        specialtyLabel:   specialtyInfo?.label || "General Hospital",
        condition,
        specialties:      specialtyInfo?.specialties || [],
        source:           "groq",
        // full AI-generated content
        aiAdvice: {
          specialtyAdvice:   groqFallback.specialtyAdvice,
          medications:       groqFallback.medications,
          healthAdvice:      groqFallback.healthAdvice,
          questionsToAsk:    groqFallback.questionsToAsk,
          alternativeCities: groqFallback.alternativeCities,
          urgencyLevel:      groqFallback.urgencyLevel,
          urgencyNote:       groqFallback.urgencyNote,
        },
        note: "Hospital suggestions are AI-generated based on known facilities." +
              " Please verify before visiting.",
      };
    }

    // both Overpass and Groq failed
    return {
      results:        [],
      specialtyLabel: specialtyInfo?.label || "General Hospital",
      condition,
      specialties:    specialtyInfo?.specialties || [],
      source:         "none",
      aiAdvice:       null,
      note:           "Unable to fetch results. Please try again.",
    };
  }

  // ── Layer 3: Overpass succeeded — enrich with Groq advice ─────────────────
  const groqAdvice = await enrichWithGroqAdvice(
    condition, cityName, overpassResults
  );

  return {
    results:        overpassResults,
    specialtyLabel: specialtyInfo?.label || "General Hospital",
    condition,
    specialties:    specialtyInfo?.specialties || [],
    source:         "overpass",
    aiAdvice:       groqAdvice
      ? {
          specialtyAdvice:   groqAdvice.specialtyAdvice,
          medications:       groqAdvice.medications,
          healthAdvice:      groqAdvice.healthAdvice,
          questionsToAsk:    groqAdvice.questionsToAsk,
          alternativeCities: groqAdvice.alternativeCities,
          urgencyLevel:      groqAdvice.urgencyLevel,
          urgencyNote:       groqAdvice.urgencyNote,
        }
      : null,
    note: overpassResults.some(r => r.specialtyMatch)
      ? null
      : "No specialist-named hospitals found nearby. " +
        "Showing nearest hospitals — call ahead to confirm specialty.",
  };
};
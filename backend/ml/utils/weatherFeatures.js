/**
 * Extract ML features from a weather record.
 * Mirrors the structure of extractFeatures() in aqiFeatures.js.
 *
 * @param {Object} record        - Current weather record (lean mongoose doc)
 * @param {Array}  allRecords    - Full sorted array of records for rolling stats
 * @param {number} currentIndex  - Index of current record in allRecords
 * @param {Date}   currentTime   - Timestamp of current record
 * @returns {Object} Flat feature object ready for ML training
 */
export function extractWeatherFeatures(record, allRecords, currentIndex, currentTime) {
  const hour      = currentTime.getHours();
  const dayOfWeek = currentTime.getDay();   // 0=Sun, 6=Sat
  const month     = currentTime.getMonth(); // 0=Jan, 11=Dec
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;

  // ── cyclic time encodings ─────────────────────────────────────────────────
  // Cyclic encoding preserves the circular nature of time
  // (hour 23 is close to hour 0, not far from it)
  const hourSin   = Math.sin((2 * Math.PI * hour)      / 24);
  const hourCos   = Math.cos((2 * Math.PI * hour)      / 24);
  const monthSin  = Math.sin((2 * Math.PI * month)     / 12);
  const monthCos  = Math.cos((2 * Math.PI * month)     / 12);
  const dowSin    = Math.sin((2 * Math.PI * dayOfWeek) / 7);
  const dowCos    = Math.cos((2 * Math.PI * dayOfWeek) / 7);

  // ── current meteorological values ─────────────────────────────────────────
  const temperature  = record.temperature  ?? null;
  const feelsLike    = record.feelsLike    ?? null;
  const humidity     = record.humidity     ?? null;
  const pressure     = record.pressure     ?? null;
  const windSpeed    = record.wind?.speed  ?? null;
  const windDeg      = record.wind?.direction ?? null;
  const cloudCover   = record.cloudCover   ?? null;
  const visibility   = record.visibility   ?? null;
  const conditionCode = encodeConditionLocal(record.condition?.main);

  // ── wind direction cyclic encoding ───────────────────────────────────────
  const windSin = windDeg != null
    ? Math.sin((windDeg * Math.PI) / 180)
    : null;
  const windCos = windDeg != null
    ? Math.cos((windDeg * Math.PI) / 180)
    : null;

  // ── derived features ──────────────────────────────────────────────────────

  // heat index approximation (only meaningful above 27°C)
  const heatIndex = temperature != null && humidity != null
    ? computeHeatIndex(temperature, humidity)
    : null;

  // dew point — key for predicting fog/mist
  const dewPoint = temperature != null && humidity != null
    ? temperature - ((100 - humidity) / 5)
    : null;

  // temperature-humidity discomfort index
  const discomfortIndex = temperature != null && humidity != null
    ? temperature - 0.55 * (1 - humidity / 100) * (temperature - 14.5)
    : null;

  // feels-like deviation from actual temp
  const feelsLikeDelta = temperature != null && feelsLike != null
    ? feelsLike - temperature
    : null;

  // ── rolling window stats (last 3 and 6 records) ──────────────────────────
  const window3 = allRecords.slice(
    Math.max(0, currentIndex - 3), currentIndex + 1
  );
  const window6 = allRecords.slice(
    Math.max(0, currentIndex - 6), currentIndex + 1
  );

  const rolling3Temp  = rollingMean(window3, r => r.temperature);
  const rolling6Temp  = rollingMean(window6, r => r.temperature);
  const rolling3Humid = rollingMean(window3, r => r.humidity);
  const rolling6Humid = rollingMean(window6, r => r.humidity);
  const rolling3Wind  = rollingMean(window3, r => r.wind?.speed);
  const rolling3Press = rollingMean(window3, r => r.pressure);

  // ── trend features (rate of change) ──────────────────────────────────────
  const prevRecord = currentIndex > 0
    ? allRecords[currentIndex - 1]
    : null;

  const tempTrend = prevRecord?.temperature != null && temperature != null
    ? temperature - prevRecord.temperature
    : 0;

  const humidTrend = prevRecord?.humidity != null && humidity != null
    ? humidity - prevRecord.humidity
    : 0;

  const pressureTrend = prevRecord?.pressure != null && pressure != null
    ? pressure - prevRecord.pressure
    : 0;

  const windTrend = prevRecord?.wind?.speed != null && windSpeed != null
    ? windSpeed - prevRecord.wind.speed
    : 0;

  // ── pressure tendency (3-hour change — important for forecasting) ─────────
  const record3hAgo = currentIndex >= 3
    ? allRecords[currentIndex - 3]
    : null;

  const pressureTendency3h =
    record3hAgo?.pressure != null && pressure != null
      ? pressure - record3hAgo.pressure
      : 0;

  // ── condition flags (binary) ──────────────────────────────────────────────
  const conditionMain = (record.condition?.main || "").toLowerCase();
  const isRaining     = /rain|drizzle|shower/.test(conditionMain) ? 1 : 0;
  const isStormy      = /thunder|storm|tornado|squall/.test(conditionMain) ? 1 : 0;
  const isClear       = conditionMain === "clear" ? 1 : 0;
  const isCloudy      = conditionMain.includes("cloud") ? 1 : 0;
  const isFoggy       = /mist|fog|haze|smoke|dust/.test(conditionMain) ? 1 : 0;
  const isSnowing     = conditionMain === "snow" ? 1 : 0;

  return {
    // ── time features ──
    hour,
    dayOfWeek,
    month,
    isWeekend,
    hourSin,
    hourCos,
    monthSin,
    monthCos,
    dowSin,
    dowCos,

    // ── current values ──
    temperature,
    feelsLike,
    humidity,
    pressure,
    windSpeed,
    windDeg,
    windSin,
    windCos,
    cloudCover,
    visibility,
    conditionCode,

    // ── derived features ──
    heatIndex,
    dewPoint,
    discomfortIndex,
    feelsLikeDelta,

    // ── rolling averages ──
    rolling3Temp,
    rolling6Temp,
    rolling3Humid,
    rolling6Humid,
    rolling3Wind,
    rolling3Press,

    // ── trend / rate of change ──
    tempTrend,
    humidTrend,
    pressureTrend,
    windTrend,
    pressureTendency3h,

    // ── condition flags ──
    isRaining,
    isStormy,
    isClear,
    isCloudy,
    isFoggy,
    isSnowing,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

const rollingMean = (records, accessor) => {
  const values = records.map(accessor).filter(v => v != null);
  if (!values.length) return null;
  return parseFloat(
    (values.reduce((a, b) => a + b, 0) / values.length).toFixed(4)
  );
};

// Rothfusz heat index equation — valid for temp > 27°C and humidity > 40%
const computeHeatIndex = (tempC, humidity) => {
  const T = tempC * 9 / 5 + 32; // convert to Fahrenheit for standard formula
  const R = humidity;
  const HI =
    -42.379 +
     2.04901523  * T +
    10.14333127  * R +
    -0.22475541  * T * R +
    -0.00683783  * T * T +
    -0.05481717  * R * R +
     0.00122874  * T * T * R +
     0.00085282  * T * R * R +
    -0.00000199  * T * T * R * R;

  const hiC = (HI - 32) * 5 / 9; // back to Celsius
  // only return if actually warmer than ambient
  return hiC > tempC ? parseFloat(hiC.toFixed(2)) : tempC;
};

// local condition encoder — same map as buildWeatherDataset.js
const CONDITION_MAP = {
  Clear: 0, Clouds: 1, Drizzle: 2, Rain: 3,
  Thunderstorm: 4, Snow: 5, Mist: 6, Smoke: 6,
  Haze: 6, Dust: 6, Fog: 6, Sand: 6, Ash: 6,
  Squall: 6, Tornado: 7,
};

const encodeConditionLocal = (conditionMain) => {
  if (!conditionMain) return -1;
  return CONDITION_MAP[conditionMain.trim()] ?? 8;
};
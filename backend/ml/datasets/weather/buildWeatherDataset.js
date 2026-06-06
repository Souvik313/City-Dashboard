import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import path from 'path';
import fs from 'fs';
import WeatherData from '../../../models/WeatherData.model.js';
import { extractWeatherFeatures } from '../../utils/weatherFeatures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Loading .env from:', path.join(__dirname, '..', '..', '..', '.env.development.local'));
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env.development.local') });
console.log('DB_URI loaded:', process.env.DB_URI ? 'YES' : 'NO');

const { DB_URI } = process.env;

if (!DB_URI) {
  console.error('DB_URI is not defined in environment variables');
  process.exit(1);
}

const MAX_HOUR_GAP = 3;

/**
 * Build Weather dataset for next-hour prediction
 * Targets: temperature, feelsLike, humidity, condition (encoded)
 * @param {string} cityId - MongoDB ObjectId of the city
 * @param {number} daysBack - Number of days to look back (default: 14)
 * @param {string} outputFormat - 'json' or 'csv' (default: 'json')
 * @returns {Promise<Array>} Array of training samples
 */
async function buildWeatherDataset(cityId, daysBack = 14, outputFormat = 'json') {
  try {
    await mongoose.connect(DB_URI);
    console.log('Connected to database');

    const endDate   = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - daysBack);

    console.log(`Fetching weather data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const weatherRecords = await WeatherData.find({
      city: cityId,
      recordedAt: {
        $gte: startDate,
        $lte: endDate
      }
    })
    .sort({ recordedAt: 1 })
    .lean();

    console.log(`Found ${weatherRecords.length} weather records`);

    if (weatherRecords.length < 50) {
      throw new Error(
        `Insufficient data: Need at least 50 records, got ${weatherRecords.length}`
      );
    }

    const dataset = [];

    for (let i = 0; i < weatherRecords.length - 1; i++) {
      const currentRecord = weatherRecords[i];
      const nextRecord    = weatherRecords[i + 1];

      // validate time gap
      const timeDiff =
        (nextRecord.recordedAt - currentRecord.recordedAt) / (1000 * 60 * 60);

      if (timeDiff < 0.5 || timeDiff > MAX_HOUR_GAP) continue;

      const currentTime = currentRecord.recordedAt;
      const features    = extractWeatherFeatures(
        currentRecord,
        weatherRecords,
        i,
        currentTime
      );

      // ── multi-output targets ──────────────────────────────────────────────

      // temperature — primary regression target
      const target_temperature = nextRecord.temperature ?? null;

      // feelsLike — secondary regression target
      const target_feelsLike = nextRecord.feelsLike ?? null;

      // humidity — regression target
      const target_humidity = nextRecord.humidity ?? null;

      // wind speed — regression target
      const target_windSpeed = nextRecord.wind?.speed ?? null;

      // pressure — regression target
      const target_pressure = nextRecord.pressure ?? null;

      // condition encoded as integer — classification target
      // maps weather condition main string to a numeric code
      const target_conditionCode = encodeCondition(
        nextRecord.condition?.main
      );

      // skip sample if primary target is missing
      if (target_temperature == null) continue;

      dataset.push({
        ...features,
        target_temperature,
        target_feelsLike,
        target_humidity,
        target_windSpeed,
        target_pressure,
        target_conditionCode,
        target_conditionLabel: nextRecord.condition?.main || "Unknown",
        timestamp: currentTime.toISOString()
      });
    }

    if (dataset.length === 0) {
      console.warn(
        'No valid training samples created. Check time gaps between records.'
      );
      return dataset;
    }

    console.log(`Created ${dataset.length} training samples`);

    // ── save to file ──────────────────────────────────────────────────────────
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const cityStr   = cityId.toString().slice(-6);
    const filename  = `weather_dataset_${cityStr}_${timestamp}.${outputFormat}`;
    const outputPath = resolve(__dirname, filename);

    if (outputFormat === 'csv') {
      await saveAsCSV(dataset, outputPath);
    } else {
      await saveAsJSON(dataset, outputPath);
    }

    console.log(`Dataset saved to: ${outputPath}`);
    console.log('\nDataset Statistics:');
    console.log(`- Total samples:        ${dataset.length}`);
    console.log(`- Features per sample:  ${Object.keys(dataset[0]).length - 8}`); // exclude targets + timestamp
    console.log(`- Temp range:           ${Math.min(...dataset.map(d => d.target_temperature)).toFixed(1)}°C` +
                ` – ${Math.max(...dataset.map(d => d.target_temperature)).toFixed(1)}°C`);
    console.log(`- Humidity range:       ${Math.min(...dataset.map(d => d.target_humidity ?? 0))}%` +
                ` – ${Math.max(...dataset.map(d => d.target_humidity ?? 0))}%`);

    const conditionCounts = dataset.reduce((acc, d) => {
      acc[d.target_conditionLabel] = (acc[d.target_conditionLabel] || 0) + 1;
      return acc;
    }, {});
    console.log('- Condition distribution:');
    Object.entries(conditionCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([label, count]) => {
        console.log(`    ${label}: ${count} samples`);
      });

    return dataset;

  } catch (error) {
    console.error('Error building dataset:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

// ── condition encoder ─────────────────────────────────────────────────────────
// Maps OpenWeatherMap condition strings to numeric codes for ML classification.
// Grouped by weather family so similar conditions share adjacent codes.

const CONDITION_MAP = {
  // Clear
  Clear:        0,

  // Clouds
  Clouds:       1,
  Few_clouds:   1,

  // Drizzle family
  Drizzle:      2,

  // Rain family
  Rain:         3,
  Shower_rain:  3,

  // Thunderstorm family
  Thunderstorm: 4,

  // Snow family
  Snow:         5,

  // Atmosphere family (mist, fog, haze, smoke, dust etc.)
  Mist:         6,
  Smoke:        6,
  Haze:         6,
  Dust:         6,
  Fog:          6,
  Sand:         6,
  Ash:          6,
  Squall:       6,
  Tornado:      7,
};

const encodeCondition = (conditionMain) => {
  if (!conditionMain) return -1; // unknown
  const key = conditionMain.trim();
  return CONDITION_MAP[key] ?? 8; // 8 = "other"
};

// ── file savers (identical to AQI version) ────────────────────────────────────

async function saveAsJSON(dataset, filepath) {
  const jsonContent = JSON.stringify(dataset, null, 2);
  fs.writeFileSync(filepath, jsonContent, 'utf8');
}

async function saveAsCSV(dataset, filepath) {
  if (dataset.length === 0) {
    throw new Error('Dataset is empty');
  }

  const headers = Object.keys(dataset[0]);
  const csvRows = [headers.join(',')];

  dataset.forEach((row) => {
    const values = headers.map((header) => {
      const value = row[header];
      if (typeof value === 'string') {
        const escaped = value.replace(/"/g, '""');
        return `"${escaped}"`;
      }
      return value ?? '';  // empty string for null/undefined
    });
    csvRows.push(values.join(','));
  });

  fs.writeFileSync(filepath, csvRows.join('\n'), 'utf8');
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node buildWeatherDataset.js <cityId> [daysBack] [format]');
  console.log('  cityId:  MongoDB ObjectId of the city (required)');
  console.log('  daysBack: Number of days to look back (default: 14)');
  console.log('  format:  Output format - "json" or "csv" (default: "json")');
  console.log('\nExample: node buildWeatherDataset.js 507f1f77bcf86cd799439011 14 csv');
  process.exit(1);
}

const cityId  = args[0];
const daysBack = args[1] ? parseInt(args[1]) : 14;
const format   = args[2] || 'json';

if (!mongoose.Types.ObjectId.isValid(cityId)) {
  console.error('Invalid city ID format. Must be a valid MongoDB ObjectId.');
  process.exit(1);
}

buildWeatherDataset(cityId, daysBack, format)
  .then(() => {
    console.log('\nDataset building completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to build dataset:', error);
    process.exit(1);
  });
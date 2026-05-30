import fs from 'fs';
import { readdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import AQIData from '../models/AQI.model.js';
import AppError from '../utils/AppError.js';
import { extractFeatures } from '../ml/utils/aqiFeatures.js';
import { loadModelFromDir } from '../ml/utils/tfModelIO.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = resolve(__dirname, '../ml/models');
const HISTORY_DAYS = 14;

let tf = null;
let cachedBundle = { dir: null, model: null, params: null };

function getAQICategory(aqi) {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

async function getTf() {
  if (!tf) {
    tf = await import('@tensorflow/tfjs');
  }
  return tf;
}

async function findLatestModelDir() {
  const entries = await readdir(MODELS_DIR, { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('aqi_model_'))
    .map((entry) => entry.name)
    .sort()
    .reverse();

  return dirs.length ? resolve(MODELS_DIR, dirs[0]) : null;
}

async function loadModelBundle(modelDir) {
  if (cachedBundle.dir === modelDir && cachedBundle.model) {
    return cachedBundle;
  }

  const paramsPath = resolve(modelDir, 'normalization_params.json');
  if (!fs.existsSync(paramsPath)) {
    throw new Error(`Normalization params not found at ${paramsPath}`);
  }

  const params = JSON.parse(fs.readFileSync(paramsPath, 'utf8'));
  const modelJsonPath = resolve(modelDir, 'model.json');

  let model;
  if (fs.existsSync(modelJsonPath)) {
    try {
      const tfModule = await getTf();
      if (tfModule.loadLayersModel && fs.existsSync(resolve(modelDir, 'weights.bin'))) {
        model = await loadModelFromDir(modelDir);
      } else {
        model = await tfModule.loadLayersModel(`file://${modelJsonPath}`);
      }
    } catch {
      model = await loadModelFromDir(modelDir);
    }
  } else {
    throw new Error(`Model not found in ${modelDir}`);
  }

  cachedBundle = { dir: modelDir, model, params };
  return cachedBundle;
}

function normalizeFeatureVector(features, params) {
  const { featureMin, featureMax, featureNames } = params;

  return featureNames.map((name, index) => {
    const value = features[name] ?? 0;
    const min = featureMin[index];
    const max = featureMax[index];
    const range = max - min + 1e-8;
    return (value - min) / range;
  });
}

function denormalizePrediction(normalizedValue, params) {
  const { targetMin, targetMax } = params;
  const range = targetMax - targetMin + 1e-8;
  return normalizedValue * range + targetMin;
}

function fallbackPredict(features, currentAqi) {
  const slope = features.aqi_slope_6h || 0;
  const delta = features.delta_aqi_1h || 0;
  const raw = Math.max(0, currentAqi + slope + delta * 0.3);
  const prediction = Math.round(raw);
  const uncertainty = Math.round(Math.max(5, features.std_aqi_6h || 10));

  return { raw, prediction, uncertainty, fallback: true };
}

function buildFallbackResponse(features, currentAqi, targetTime, message) {
  const result = fallbackPredict(features, currentAqi);

  return {
    ...result,
    unit: 'AQI',
    timestamp: targetTime.toISOString(),
    currentAqi,
    category: getAQICategory(result.prediction),
    message,
  };
}

async function predictNextHour(cityId, modelPath = null) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - HISTORY_DAYS);

  const records = await AQIData.find({
    city: cityId,
    recordedAt: { $gte: startDate },
  })
    .sort({ recordedAt: 1 })
    .lean();

  if (records.length < 2) {
    throw new AppError('Insufficient AQI history for prediction (need at least 2 records)', 400);
  }

  const currentIndex = records.length - 1;
  const currentRecord = records[currentIndex];
  const currentTime = new Date(currentRecord.recordedAt);
  const currentAqi = currentRecord.aqiValue ?? 0;
  const features = extractFeatures(currentRecord, records, currentIndex, currentTime);
  const targetTime = new Date(currentTime.getTime() + 60 * 60 * 1000);

  const modelDir = modelPath || process.env.PREDICT_AQI_MODEL_PATH || await findLatestModelDir();
  if (!modelDir) {
    return buildFallbackResponse(
      features,
      currentAqi,
      targetTime,
      'Fallback predictor used because no trained model was found. Train one with npm run ml:train-aqi.'
    );
  }

  try {
    const { model, params } = await loadModelBundle(modelDir);
    const tfModule = await getTf();
    const normalized = normalizeFeatureVector(features, params);
    const input = tfModule.tensor2d([normalized]);
    const output = model.predict(input);
    const normalizedPrediction = (await output.data())[0];

    input.dispose();
    output.dispose();

    const raw = denormalizePrediction(normalizedPrediction, params);
    const prediction = Math.max(0, Math.round(raw));
    const uncertainty = Math.round(Math.max(5, (params.targetMax - params.targetMin) * 0.08));

    return {
      prediction,
      raw,
      unit: 'AQI',
      timestamp: targetTime.toISOString(),
      currentAqi,
      uncertainty,
      fallback: false,
      category: getAQICategory(prediction),
      modelPath: modelDir,
    };
  } catch (error) {
    console.warn('Model prediction failed, using fallback:', error.message);
    return buildFallbackResponse(
      features,
      currentAqi,
      targetTime,
      'Fallback predictor used because the model could not be loaded. Train a model with npm run ml:train-aqi.'
    );
  }
}

export default {
  predictNextHour,
};

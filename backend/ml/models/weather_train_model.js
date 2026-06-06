import * as tf from '@tensorflow/tfjs';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { saveModelToDir } from '../utils/tfModelIO.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
  epochs:          120,
  batchSize:       32,
  validationSplit: 0.2,
  learningRate:    0.001,
  earlyStopping: {
    patience: 12,
    monitor:  'val_loss'
  }
};

// ── target definitions ────────────────────────────────────────────────────────
// Weather is multi-output — we predict several values simultaneously.
// conditionCode is excluded from the regression head and handled separately.
const REGRESSION_TARGETS = [
  'target_temperature',
  'target_feelsLike',
  'target_humidity',
  'target_windSpeed',
  'target_pressure',
];

const CONDITION_CLASSES = 9; // 0–7 + 8 (other) — matches weatherFeatures.js

// ── dataset loader ────────────────────────────────────────────────────────────

async function loadDataset(datasetPath) {
  if (!datasetPath) throw new Error('Dataset path is required.');
  if (!fs.existsSync(datasetPath))
    throw new Error(`Dataset file not found: ${datasetPath}`);

  console.log(`Loading dataset from: ${datasetPath}`);
  const data = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  console.log(`Loaded ${data.length} samples`);

  if (!Array.isArray(data) || data.length === 0)
    throw new Error('Dataset file is empty or invalid format');

  return data;
}

// ── feature / target extraction ───────────────────────────────────────────────

function extractFeaturesAndTargets(dataset) {
  const sample = dataset[0];

  // everything that isn't a target or timestamp is a feature
  const featureNames = Object.keys(sample).filter(
    (key) =>
      !key.startsWith('target_') &&
      key !== 'timestamp'
  );

  console.log(`\nFeatures (${featureNames.length}):`, featureNames.join(', '));
  console.log(`Regression targets: ${REGRESSION_TARGETS.join(', ')}`);
  console.log(`Classification target: target_conditionCode (${CONDITION_CLASSES} classes)`);

  const featureRows   = [];
  const regrTargetRows = [];
  const condTargetRows = [];

  dataset.forEach((row) => {
    // features — replace non-finite with 0
    featureRows.push(
      featureNames.map((name) => {
        const v = row[name];
        return isFinite(v) ? v : 0;
      })
    );

    // regression targets — replace null/undefined with 0
    regrTargetRows.push(
      REGRESSION_TARGETS.map((name) => {
        const v = row[name];
        return isFinite(v) ? v : 0;
      })
    );

    // classification target — integer condition code
    condTargetRows.push(row.target_conditionCode ?? 0);
  });

  return {
    features:      tf.tensor2d(featureRows),
    regrTargets:   tf.tensor2d(regrTargetRows),                          // [N, 5]
    condTargets:   tf.tensor1d(condTargetRows, 'int32'),                 // [N]
    featureNames,
  };
}

// ── normalisation ─────────────────────────────────────────────────────────────

function normalizeFeatures(features) {
  const min   = features.min(0);
  const max   = features.max(0);
  const range = max.sub(min).add(1e-8);
  return { normalized: features.sub(min).div(range), min, max };
}

function normalizeTargets(regrTargets) {
  const min   = regrTargets.min(0);    // per-column min  [5]
  const max   = regrTargets.max(0);    // per-column max  [5]
  const range = max.sub(min).add(1e-8);
  return { normalized: regrTargets.sub(min).div(range), min, max, range };
}

// ── metrics ───────────────────────────────────────────────────────────────────

function calculateRegressionMetrics(predictions, targets) {
  const mse  = tf.losses.meanSquaredError(targets, predictions);
  const mae  = tf.losses.absoluteDifference(targets, predictions).mean();
  const rmse = tf.sqrt(mse);

  const mean  = targets.mean();
  const ssRes = tf.sum(tf.square(targets.sub(predictions)));
  const ssTot = tf.sum(tf.square(targets.sub(mean)));
  const r2    = tf.scalar(1).sub(ssRes.div(ssTot.add(1e-8)));

  return { mse, mae, rmse, r2 };
}

// ── model architecture ────────────────────────────────────────────────────────
// Shared backbone → two heads:
//   • regression head  → 5 continuous outputs (temp, feelsLike, humidity, wind, pressure)
//   • classification head → 9-class softmax  (weather condition)

function createModel(inputSize) {
  const input = tf.input({ shape: [inputSize] });

  // ── shared backbone ──
  let x = tf.layers.dense({
    units: 128,
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
  }).apply(input);

  x = tf.layers.dropout({ rate: 0.3 }).apply(x);

  x = tf.layers.dense({
    units: 64,
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
  }).apply(x);

  x = tf.layers.dropout({ rate: 0.2 }).apply(x);

  const shared = tf.layers.dense({
    units: 32,
    activation: 'relu'
  }).apply(x);

  // ── regression head ──
  // predicts temperature, feelsLike, humidity, windSpeed, pressure
  let regrHead = tf.layers.dense({
    units: 16,
    activation: 'relu'
  }).apply(shared);

  regrHead = tf.layers.dropout({ rate: 0.1 }).apply(regrHead);

  const regrOutput = tf.layers.dense({
    units: REGRESSION_TARGETS.length,  // 5
    activation: 'linear',
    name: 'regression_output'
  }).apply(regrHead);

  // ── classification head ──
  // predicts weather condition as one of 9 classes
  let condHead = tf.layers.dense({
    units: 16,
    activation: 'relu'
  }).apply(shared);

  condHead = tf.layers.dropout({ rate: 0.1 }).apply(condHead);

  const condOutput = tf.layers.dense({
    units: CONDITION_CLASSES,
    activation: 'softmax',
    name: 'condition_output'
  }).apply(condHead);

  const model = tf.model({
    inputs:  input,
    outputs: [regrOutput, condOutput]
  });

  model.compile({
    optimizer: tf.train.adam(CONFIG.learningRate),
    loss: {
      regression_output: 'meanSquaredError',
      condition_output:  'sparseCategoricalCrossentropy'
    },
    // weight regression loss more heavily since it's the primary goal
    lossWeights: {
      regression_output: 1.0,
      condition_output:  0.3
    },
    metrics: {
      regression_output: ['mae'],
      condition_output:  ['accuracy']
    }
  });

  return model;
}

// ── training ──────────────────────────────────────────────────────────────────

async function trainModel(datasetPath, modelSavePath = null) {
  try {
    console.log('🚀 Starting Weather Model Training\n');

    const dataset = await loadDataset(datasetPath);

    if (dataset.length < 100) {
      throw new Error(
        `Insufficient data: Need at least 100 samples, got ${dataset.length}`
      );
    }

    // ── dataset stats ──
    const temps = dataset.map((d) => d.target_temperature).filter(Boolean);
    const humids = dataset.map((d) => d.target_humidity).filter(Boolean);

    console.log('\n📊 Dataset Statistics:');
    console.log(`- Total samples:     ${dataset.length}`);
    console.log(`- Temp range:        ${Math.min(...temps).toFixed(1)}°C – ${Math.max(...temps).toFixed(1)}°C`);
    console.log(`- Avg temperature:   ${(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(2)}°C`);
    console.log(`- Humidity range:    ${Math.min(...humids)}% – ${Math.max(...humids)}%`);

    // condition distribution
    const condDist = dataset.reduce((acc, d) => {
      const label = d.target_conditionLabel || 'Unknown';
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
    console.log('- Condition distribution:');
    Object.entries(condDist)
      .sort((a, b) => b[1] - a[1])
      .forEach(([label, count]) => {
        console.log(`    ${label}: ${count} samples`);
      });

    // ── extract ──
    const { features, regrTargets, condTargets, featureNames }
      = extractFeaturesAndTargets(dataset);

    // ── normalise ──
    console.log('\n🔄 Normalizing features and targets...');
    const {
      normalized: normalizedFeatures,
      min: featureMin,
      max: featureMax
    } = normalizeFeatures(features);

    const {
      normalized: normalizedRegrTargets,
      min: targetMin,
      max: targetMax,
      range: targetRange
    } = normalizeTargets(regrTargets);

    // condition targets need one-hot for sparseCategoricalCrossentropy
    // sparseCategoricalCrossentropy accepts integer labels directly — no one-hot needed

    // ── train/val split ──
    const splitIndex       = Math.floor(dataset.length * (1 - CONFIG.validationSplit));
    const effectiveBatchSize = Math.min(CONFIG.batchSize, Math.floor(splitIndex / 2));

    const trainFeatures      = normalizedFeatures.slice([0, 0], [splitIndex, -1]);
    const trainRegrTargets   = normalizedRegrTargets.slice([0, 0], [splitIndex, -1]);
    const trainCondTargets   = condTargets.slice([0], [splitIndex]);

    const valFeatures        = normalizedFeatures.slice([splitIndex, 0], [-1, -1]);
    const valRegrTargets     = normalizedRegrTargets.slice([splitIndex, 0], [-1, -1]);
    const valCondTargets     = condTargets.slice([splitIndex], [-1]);

    console.log('\n📦 Train/Validation Split:');
    console.log(`- Training samples:    ${splitIndex}`);
    console.log(`- Validation samples:  ${dataset.length - splitIndex}`);
    console.log(`- Effective batch size: ${effectiveBatchSize}`);

    // ── create model ──
    console.log('\n🏗️  Creating model...');
    const model = createModel(featureNames.length);
    model.summary();

    // ── epoch logging ──
    const epochLogCallback = {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 10 === 0) {
          const regrLoss = (logs.regression_output_loss ?? 0).toFixed(4);
          const condLoss = (logs.condition_output_loss   ?? 0).toFixed(4);
          const valRegrLoss = (logs.val_regression_output_loss ?? 0).toFixed(4);
          const valCondLoss = (logs.val_condition_output_loss  ?? 0).toFixed(4);
          const condAcc = (
            logs.condition_output_accuracy ??
            logs.condition_output_acc ?? 0
          ).toFixed(4);

          console.log(
            `Epoch ${epoch + 1}/${CONFIG.epochs} — ` +
            `regr_loss: ${regrLoss}, cond_loss: ${condLoss}, ` +
            `val_regr_loss: ${valRegrLoss}, val_cond_loss: ${valCondLoss}, ` +
            `cond_acc: ${condAcc}`
          );
        }
      }
    };

    // ── train ──
    console.log('\n🎓 Training model...');
    await model.fit(
      trainFeatures,
      { regression_output: trainRegrTargets, condition_output: trainCondTargets },
      {
        epochs:    CONFIG.epochs,
        batchSize: effectiveBatchSize,
        validationData: [
          valFeatures,
          { regression_output: valRegrTargets, condition_output: valCondTargets }
        ],
        callbacks: [epochLogCallback],
        verbose: 0
      }
    );

    // ── evaluate ──
    console.log('\n📈 Evaluating model...');

    const [trainRegrPredNorm, trainCondPred] = model.predict(trainFeatures);
    const [valRegrPredNorm,   valCondPred  ] = model.predict(valFeatures);

    // denormalise regression predictions
    const trainRegrPred = trainRegrPredNorm.mul(targetRange).add(targetMin);
    const valRegrPred   = valRegrPredNorm.mul(targetRange).add(targetMin);
    const trainRegrActual = trainRegrTargets.mul(targetRange).add(targetMin);
    const valRegrActual   = valRegrTargets.mul(targetRange).add(targetMin);

    const trainRegrMetrics = calculateRegressionMetrics(trainRegrPred, trainRegrActual);
    const valRegrMetrics   = calculateRegressionMetrics(valRegrPred,   valRegrActual);

    // await metric values
    const trainMSE  = (await trainRegrMetrics.mse.data())[0];
    const trainRMSE = (await trainRegrMetrics.rmse.data())[0];
    const trainMAE  = (await trainRegrMetrics.mae.data())[0];
    const trainR2   = (await trainRegrMetrics.r2.data())[0];

    const valMSE    = (await valRegrMetrics.mse.data())[0];
    const valRMSE   = (await valRegrMetrics.rmse.data())[0];
    const valMAE    = (await valRegrMetrics.mae.data())[0];
    const valR2     = (await valRegrMetrics.r2.data())[0];

    // condition accuracy
    const valCondArgmax = valCondPred.argMax(-1);
    const correctPreds  = valCondArgmax.equal(valCondTargets.cast('int32'));
    const condAccuracy  = (await correctPreds.mean().data())[0];

    console.log('\n📊 Regression Metrics — Training:');
    console.log(`- MSE:  ${trainMSE.toFixed(4)}`);
    console.log(`- RMSE: ${trainRMSE.toFixed(4)}`);
    console.log(`- MAE:  ${trainMAE.toFixed(4)}`);
    console.log(`- R²:   ${trainR2.toFixed(4)}`);

    console.log('\n📊 Regression Metrics — Validation:');
    console.log(`- MSE:  ${valMSE.toFixed(4)}`);
    console.log(`- RMSE: ${valRMSE.toFixed(4)}`);
    console.log(`- MAE:  ${valMAE.toFixed(4)}`);
    console.log(`- R²:   ${valR2.toFixed(4)}`);

    console.log('\n📊 Condition Classification — Validation:');
    console.log(`- Accuracy: ${(condAccuracy * 100).toFixed(2)}%`);

    // ── per-target MAE breakdown ──
    // helpful to see which weather variable is hardest to predict
    const valRegrPredData   = await valRegrPred.array();
    const valRegrActualData = await valRegrActual.array();

    console.log('\n📊 Per-target MAE (validation):');
    REGRESSION_TARGETS.forEach((name, i) => {
      const maes = valRegrPredData.map(
        (pred, j) => Math.abs(pred[i] - valRegrActualData[j][i])
      );
      const avgMae = maes.reduce((a, b) => a + b, 0) / maes.length;
      console.log(`- ${name.replace('target_', '').padEnd(12)} MAE: ${avgMae.toFixed(4)}`);
    });

    // ── save model ──
    if (!modelSavePath) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      modelSavePath = resolve(__dirname, `weather_model_${timestamp}`);
    }

    console.log(`\n💾 Saving model to: ${modelSavePath}`);
    await saveModelToDir(model, modelSavePath);

    // save normalisation params
    const normalizationParams = {
      featureMin:     Array.from(await featureMin.data()),
      featureMax:     Array.from(await featureMax.data()),
      targetMin:      Array.from(await targetMin.data()),
      targetMax:      Array.from(await targetMax.data()),
      featureNames,
      regressionTargets: REGRESSION_TARGETS,
      conditionClasses:  CONDITION_CLASSES,
      conditionMap: {
        0: 'Clear',
        1: 'Clouds',
        2: 'Drizzle',
        3: 'Rain',
        4: 'Thunderstorm',
        5: 'Snow',
        6: 'Atmosphere',
        7: 'Tornado',
        8: 'Other'
      }
    };

    const paramsPath = resolve(modelSavePath, 'normalization_params.json');
    fs.writeFileSync(paramsPath, JSON.stringify(normalizationParams, null, 2));
    console.log(`💾 Saved normalization parameters to: ${paramsPath}`);

    // ── dispose all tensors ──
    features.dispose();
    regrTargets.dispose();
    condTargets.dispose();
    normalizedFeatures.dispose();
    normalizedRegrTargets.dispose();
    trainFeatures.dispose();
    trainRegrTargets.dispose();
    trainCondTargets.dispose();
    valFeatures.dispose();
    valRegrTargets.dispose();
    valCondTargets.dispose();
    trainRegrPredNorm.dispose();
    trainCondPred.dispose();
    valRegrPredNorm.dispose();
    valCondPred.dispose();
    trainRegrPred.dispose();
    valRegrPred.dispose();
    trainRegrActual.dispose();
    valRegrActual.dispose();
    featureMin.dispose();
    featureMax.dispose();
    targetMin.dispose();
    targetMax.dispose();
    targetRange.dispose();
    valCondArgmax.dispose();
    correctPreds.dispose();
    Object.values(trainRegrMetrics).forEach((t) => t.dispose());
    Object.values(valRegrMetrics).forEach((t) => t.dispose());

    console.log('\n✅ Weather model training completed successfully!');

    return {
      model,
      modelPath: modelSavePath,
      trainMetrics: { mse: trainMSE, rmse: trainRMSE, mae: trainMAE, r2: trainR2 },
      valMetrics:   { mse: valMSE,   rmse: valRMSE,   mae: valMAE,   r2: valR2   },
      condAccuracy,
      normalizationParams
    };

  } catch (error) {
    console.error('❌ Training failed:', error);
    throw error;
  }
}

// ── CLI entrypoint ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node weather_train_model.js <datasetPath> [modelSavePath]');
  console.log('  datasetPath:    Path to JSON dataset file (required)');
  console.log('  modelSavePath:  Path to save the trained model (optional)');
  console.log('\nExamples:');
  console.log('  node weather_train_model.js ../datasets/weather_dataset_abc123.json');
  console.log('  node weather_train_model.js ../datasets/weather_dataset.json ./models/weather_model');
  console.log('\nNote: First generate dataset using: node ../datasets/buildWeatherDataset.js <cityId>');
  process.exit(1);
}

const datasetPath  = args[0];
const modelSavePath = args[1] || null;

trainModel(datasetPath, modelSavePath)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
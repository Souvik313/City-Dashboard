import * as tf from '@tensorflow/tfjs';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { saveModelToDir } from '../utils/tfModelIO.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
    epochs: 100,
    batchSize: 32,
    validationSplit: 0.2,
    learningRate: 0.001,
    earlyStopping: {
        patience: 10,
        monitor: 'val_loss'
    }
};

async function loadDataset(datasetPath) {
    if (!datasetPath) throw new Error('Dataset path is required.');
    if (!fs.existsSync(datasetPath)) throw new Error(`Dataset file not found: ${datasetPath}`);

    console.log(`Loading dataset from: ${datasetPath}`);
    const data = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
    console.log(`Loaded ${data.length} samples from file`);

    if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Dataset file is empty or invalid format');
    }

    return data;
}

function extractFeaturesAndTargets(dataset) {
    const sample = dataset[0];
    const featureNames = Object.keys(sample).filter(
        key => key !== 'target_aqi' && key !== 'timestamp'
    );

    console.log(`\nFeatures (${featureNames.length}):`, featureNames.join(', '));

    const features = [];
    const targets = [];

    dataset.forEach(row => {
        const featureRow = featureNames.map(name => {
            const value = row[name];
            return isFinite(value) ? value : 0;
        });
        features.push(featureRow);
        targets.push(row.target_aqi);
    });

    return {
        features: tf.tensor2d(features),
        targets: tf.tensor2d(targets, [targets.length, 1]),
        featureNames
    };
}

function normalizeFeatures(features) {
    const min = features.min(0);
    const max = features.max(0);
    const range = max.sub(min).add(1e-8);
    const normalized = features.sub(min).div(range);
    return { normalized, min, max };
}

function calculateMetrics(predictions, targets) {
    const mse = tf.losses.meanSquaredError(targets, predictions);
    const mae = tf.losses.absoluteDifference(targets, predictions).mean(); // Fix: .mean()
    const rmse = tf.sqrt(mse);

    const targetsMean = targets.mean();
    const ssRes = tf.sum(tf.square(targets.sub(predictions)));
    const ssTot = tf.sum(tf.square(targets.sub(targetsMean)));
    const r2 = tf.scalar(1).sub(ssRes.div(ssTot.add(1e-8))); // Fix: tf.scalar(1)

    return { mse, mae, rmse, r2 };
}

function createModel(inputSize) {
    const model = tf.sequential();

    model.add(tf.layers.dense({
        inputShape: [inputSize],
        units: 128,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
    }));
    model.add(tf.layers.dropout({ rate: 0.3 }));

    model.add(tf.layers.dense({
        units: 64,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));

    model.add(tf.layers.dense({
        units: 32,
        activation: 'relu'
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));

    model.add(tf.layers.dense({
        units: 1,
        activation: 'linear'
    }));

    model.compile({
        optimizer: tf.train.adam(CONFIG.learningRate),
        loss: 'meanSquaredError',
        metrics: ['mae']
    });

    return model;
}

async function trainModel(datasetPath, modelSavePath = null) {
    try {
        console.log('🚀 Starting AQI Model Training\n');

        const dataset = await loadDataset(datasetPath);

        // Consistent minimum with buildAqiDataset.js
        if (dataset.length < 100) {
            throw new Error(`Insufficient data: Need at least 100 samples, got ${dataset.length}`);
        }

        console.log(`\n📊 Dataset Statistics:`);
        console.log(`- Total samples: ${dataset.length}`);
        console.log(`- Target AQI range: ${Math.min(...dataset.map(d => d.target_aqi))} - ${Math.max(...dataset.map(d => d.target_aqi))}`);
        console.log(`- Average AQI: ${(dataset.reduce((sum, d) => sum + d.target_aqi, 0) / dataset.length).toFixed(2)}`);

        const { features, targets, featureNames } = extractFeaturesAndTargets(dataset);

        console.log('\n🔄 Normalizing features...');
        const { normalized: normalizedFeatures, min: featureMin, max: featureMax } = normalizeFeatures(features);

        const targetMin = targets.min();
        const targetMax = targets.max();
        const targetRange = targetMax.sub(targetMin).add(1e-8);
        const normalizedTargets = targets.sub(targetMin).div(targetRange);

        const splitIndex = Math.floor(dataset.length * (1 - CONFIG.validationSplit));

        // Fix: dynamic batch size for small datasets
        const effectiveBatchSize = Math.min(CONFIG.batchSize, Math.floor(splitIndex / 2));

        const trainFeatures = normalizedFeatures.slice([0, 0], [splitIndex, -1]);
        const trainTargets = normalizedTargets.slice([0, 0], [splitIndex, -1]);
        const valFeatures = normalizedFeatures.slice([splitIndex, 0], [-1, -1]);
        const valTargets = normalizedTargets.slice([splitIndex, 0], [-1, -1]);

        console.log(`\n📦 Train/Validation Split:`);
        console.log(`- Training samples: ${splitIndex}`);
        console.log(`- Validation samples: ${dataset.length - splitIndex}`);
        console.log(`- Effective batch size: ${effectiveBatchSize}`);

        console.log('\n🏗️  Creating model...');
        const model = createModel(featureNames.length);
        model.summary();

        const epochLogCallback = {
            onEpochEnd: (epoch, logs) => {
                if ((epoch + 1) % 10 === 0) {
                    console.log(
                        `Epoch ${epoch + 1}/${CONFIG.epochs} - ` +
                        `loss: ${logs.loss.toFixed(4)}, ` +
                        `val_loss: ${logs.val_loss.toFixed(4)}, ` +
                        `mae: ${(logs.mae ?? logs.meanAbsoluteError ?? 0).toFixed(4)}, ` +
                        `val_mae: ${(logs.val_mae ?? logs.val_meanAbsoluteError ?? 0).toFixed(4)}`
                    );
                }
            }
        };

        console.log('\n🎓 Training model...');
        await model.fit(trainFeatures, trainTargets, {
            epochs: CONFIG.epochs,
            batchSize: effectiveBatchSize,
            validationData: [valFeatures, valTargets],
            callbacks: [epochLogCallback],
            verbose: 0
        });

        console.log('\n📈 Evaluating model...');
        const trainPredictionsNorm = model.predict(trainFeatures);
        const valPredictionsNorm = model.predict(valFeatures);

        const trainPredictions = trainPredictionsNorm.mul(targetRange).add(targetMin);
        const valPredictions = valPredictionsNorm.mul(targetRange).add(targetMin);
        const trainTargetsActual = trainTargets.mul(targetRange).add(targetMin);
        const valTargetsActual = valTargets.mul(targetRange).add(targetMin);

        const trainMetrics = calculateMetrics(trainPredictions, trainTargetsActual);
        const valMetrics = calculateMetrics(valPredictions, valTargetsActual);

        // Await all metric values before disposal
        const trainMSE = (await trainMetrics.mse.data())[0];
        const trainRMSE = (await trainMetrics.rmse.data())[0];
        const trainMAE = (await trainMetrics.mae.data())[0];
        const trainR2 = (await trainMetrics.r2.data())[0];

        const valMSE = (await valMetrics.mse.data())[0];
        const valRMSE = (await valMetrics.rmse.data())[0];
        const valMAE = (await valMetrics.mae.data())[0];
        const valR2 = (await valMetrics.r2.data())[0];

        console.log('\n📊 Training Metrics:');
        console.log(`- MSE:  ${trainMSE.toFixed(4)}`);
        console.log(`- RMSE: ${trainRMSE.toFixed(4)}`);
        console.log(`- MAE:  ${trainMAE.toFixed(4)}`);
        console.log(`- R²:   ${trainR2.toFixed(4)}`);

        console.log('\n📊 Validation Metrics:');
        console.log(`- MSE:  ${valMSE.toFixed(4)}`);
        console.log(`- RMSE: ${valRMSE.toFixed(4)}`);
        console.log(`- MAE:  ${valMAE.toFixed(4)}`);
        console.log(`- R²:   ${valR2.toFixed(4)}`);

        if (!modelSavePath) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            modelSavePath = resolve(__dirname, `aqi_model_${timestamp}`);
        }

        // Fix: save model first, then write params
        console.log(`\n💾 Saving model to: ${modelSavePath}`);
        await saveModelToDir(model, modelSavePath);

        const normalizationParams = {
            featureMin: Array.from(await featureMin.data()),
            featureMax: Array.from(await featureMax.data()),
            targetMin: (await targetMin.data())[0],
            targetMax: (await targetMax.data())[0],
            featureNames
        };

        const paramsPath = resolve(modelSavePath, 'normalization_params.json');
        fs.writeFileSync(paramsPath, JSON.stringify(normalizationParams, null, 2));
        console.log(`💾 Saved normalization parameters to: ${paramsPath}`);

        // Fix: dispose all tensors including metric tensors
        features.dispose();
        targets.dispose();
        normalizedFeatures.dispose();
        normalizedTargets.dispose();
        trainFeatures.dispose();
        trainTargets.dispose();
        valFeatures.dispose();
        valTargets.dispose();
        trainPredictionsNorm.dispose();
        valPredictionsNorm.dispose();
        trainPredictions.dispose();
        valPredictions.dispose();
        trainTargetsActual.dispose();
        valTargetsActual.dispose();
        featureMin.dispose();
        featureMax.dispose();
        targetMin.dispose();
        targetMax.dispose();
        Object.values(trainMetrics).forEach(t => t.dispose());
        Object.values(valMetrics).forEach(t => t.dispose());

        console.log('\n✅ Model training completed successfully!');

        // Fix: return plain scalar values, not disposed tensors
        return {
            model,
            modelPath: modelSavePath,
            trainMetrics: { mse: trainMSE, rmse: trainRMSE, mae: trainMAE, r2: trainR2 },
            valMetrics: { mse: valMSE, rmse: valRMSE, mae: valMAE, r2: valR2 },
            normalizationParams
        };

    } catch (error) {
        console.error('❌ Training failed:', error);
        throw error;
    }
}

const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('Usage: node aqi_train.model.js <datasetPath> [modelSavePath]');
    console.log('  datasetPath: Path to JSON dataset file (required)');
    console.log('  modelSavePath: Path to save the trained model (optional)');
    console.log('\nExamples:');
    console.log('  node aqi_train.model.js ../datasets/aqi_dataset_abc123_2024-01-01.json');
    console.log('  node aqi_train.model.js ../datasets/aqi_dataset.json ./models/my_model');
    console.log('\nNote: First generate dataset using: node ../datasets/buildAqiDataset.js <cityId>');
    process.exit(1);
}

const datasetPath = args[0];
const modelSavePath = args[1] || null;

trainModel(datasetPath, modelSavePath)
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
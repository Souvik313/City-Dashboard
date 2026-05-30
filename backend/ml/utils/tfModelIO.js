import fs from 'fs';
import { resolve } from 'path';

async function getTf() {
  const mod = await import('@tensorflow/tfjs');
  return mod.default ?? mod;
}

/**
 * Save a TF.js layers model to a directory (works without tfjs-node).
 */
export async function saveModelToDir(model, dir) {
  const tf = await getTf();
  fs.mkdirSync(dir, { recursive: true });

  await model.save(
    tf.io.withSaveHandler(async (artifacts) => {
      const weightsManifest = [
        {
          paths: ['weights.bin'],
          weights: artifacts.weightSpecs,
        },
      ];

      const modelJSON = {
        modelTopology: artifacts.modelTopology,
        weightsManifest,
        format: 'layers-model',
        generatedBy: 'CityPulse-AQI',
      };

      fs.writeFileSync(resolve(dir, 'model.json'), JSON.stringify(modelJSON));

      const weightData = artifacts.weightData;
      let buffer;
      if (Array.isArray(weightData)) {
        const total = weightData.reduce((s, b) => s + b.byteLength, 0);
        buffer = new Uint8Array(total);
        let offset = 0;
        for (const chunk of weightData) {
          buffer.set(new Uint8Array(chunk), offset);
          offset += chunk.byteLength;
        }
      } else {
        buffer = new Uint8Array(weightData);
      }

      fs.writeFileSync(resolve(dir, 'weights.bin'), Buffer.from(buffer));

      return {
        modelArtifactsInfo: {
          dateSaved: new Date(),
          modelTopologyType: 'JSON',
        },
      };
    })
  );
}

/**
 * Load a TF.js layers model from a directory saved by saveModelToDir or tfjs-node.
 */
export async function loadModelFromDir(dir) {
  const tf = await getTf();

  const modelJsonPath = resolve(dir, 'model.json');
  const weightsBinPath = resolve(dir, 'weights.bin');

  if (!fs.existsSync(modelJsonPath)) {
    throw new Error(`Model JSON not found at ${modelJsonPath}`);
  }

  const modelJSON = JSON.parse(fs.readFileSync(modelJsonPath, 'utf8'));

  if (fs.existsSync(weightsBinPath)) {
    const weightsBuffer = fs.readFileSync(weightsBinPath);
    const weightSpecs = modelJSON.weightsManifest[0].weights;
    const weightData = weightsBuffer.buffer.slice(
      weightsBuffer.byteOffset,
      weightsBuffer.byteOffset + weightsBuffer.byteLength
    );

    return tf.loadLayersModel(
      tf.io.fromMemory({
        modelTopology: modelJSON.modelTopology,
        weightSpecs,
        weightData,
      })
    );
  }

  return tf.loadLayersModel(`file://${modelJsonPath}`);
}

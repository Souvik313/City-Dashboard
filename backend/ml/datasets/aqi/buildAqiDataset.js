import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import path from 'path';
import fs from 'fs';
import AQIData from '../../../models/AQI.model.js';
import { extractFeatures } from '../../utils/aqiFeatures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
console.log('Loading .env from:', path.join(__dirname, '..', '..', '..', '.env.development.local'));
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env.development.local') });
console.log('DB_URI loaded:', process.env.DB_URI ? 'YES' : 'NO');

const { DB_URI } = process.env;

if (!DB_URI) {
    console.error('DB_URI is not defined in environment variables');
    process.exit(1);
}

const MAX_HOUR_GAP = 3; // Maximum hours between consecutive records to form a training sample

/**
 * Build AQI dataset for next-hour prediction
 * @param {string} cityId - MongoDB ObjectId of the city
 * @param {number} daysBack - Number of days to look back (default: 14)
 * @param {string} outputFormat - 'json' or 'csv' (default: 'json')
 * @returns {Promise<Array>} Array of training samples
 */
async function buildAqiDataset(cityId, daysBack = 30, outputFormat = 'json') {
    try {
        // Connect to database
        await mongoose.connect(DB_URI);
        console.log('Connected to database');

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - daysBack);

        console.log(`Fetching AQI data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

        // Fetch all AQI records for the city in the date range, sorted by time
        const aqiRecords = await AQIData.find({
            city: cityId,
            recordedAt: {
                $gte: startDate,
                $lte: endDate
            }
        })
        .sort({ recordedAt: 1 })
        .lean();

        console.log(`Found ${aqiRecords.length} AQI records`);

        if (aqiRecords.length < 50) {
            throw new Error(`Insufficient data: Need at least 50 records, got ${aqiRecords.length}`);
        }

        // Build dataset with features and targets
        const dataset = [];

        // Process each record as a potential training sample
        // Skip the last record since we need next-hour target
        for (let i = 0; i < aqiRecords.length - 1; i++) {
            const currentRecord = aqiRecords[i];
            const nextRecord = aqiRecords[i + 1];

            // Only create sample if next record is approximately 1 hour ahead
            const timeDiff = (nextRecord.recordedAt - currentRecord.recordedAt) / (1000 * 60 * 60); // hours

            // Accept records within 0.5 to MAX_HOUR_GAP hours (handles data gaps)
            if (timeDiff < 0.5 || timeDiff > MAX_HOUR_GAP) {
                continue;
            }

            const currentTime = currentRecord.recordedAt;
            const features = extractFeatures(currentRecord, aqiRecords, i, currentTime);

            // Target: next hour's AQI value
            const target = nextRecord.aqiValue;

            dataset.push({
                ...features,
                target_aqi: target,
                timestamp: currentTime.toISOString()
            });
        }

        // Guard: check dataset is not empty before accessing dataset[0]
        if (dataset.length === 0) {
            console.warn('No valid training samples could be created. Check time gaps between records.');
            return dataset;
        }

        console.log(`Created ${dataset.length} training samples`);

        // Save dataset to file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const cityStr = cityId.toString().slice(-6); // Last 6 chars of city ID for filename
        const filename = `aqi_dataset_${cityStr}_${timestamp}.${outputFormat}`;
        const outputPath = resolve(__dirname, filename);

        if (outputFormat === 'csv') {
            await saveAsCSV(dataset, outputPath);
        } else {
            await saveAsJSON(dataset, outputPath);
        }

        console.log(`Dataset saved to: ${outputPath}`);
        console.log(`\nDataset Statistics:`);
        console.log(`- Total samples: ${dataset.length}`);
        console.log(`- Features per sample: ${Object.keys(dataset[0]).length - 2}`); // Exclude target and timestamp
        console.log(`- Target range: ${Math.min(...dataset.map(d => d.target_aqi))} - ${Math.max(...dataset.map(d => d.target_aqi))}`);

        return dataset;

    } catch (error) {
        console.error('Error building dataset:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from database');
    }
}

/**
 * Save dataset as JSON
 */
async function saveAsJSON(dataset, filepath) {
    const jsonContent = JSON.stringify(dataset, null, 2);
    fs.writeFileSync(filepath, jsonContent, 'utf8');
}

/**
 * Save dataset as CSV
 * Properly escapes quotes inside string values
 */
async function saveAsCSV(dataset, filepath) {
    if (dataset.length === 0) {
        throw new Error('Dataset is empty');
    }

    const headers = Object.keys(dataset[0]);
    const csvRows = [headers.join(',')];

    dataset.forEach(row => {
        const values = headers.map(header => {
            const value = row[header];
            // Properly escape all strings — double up any internal quotes
            if (typeof value === 'string') {
                const escaped = value.replace(/"/g, '""');
                return `"${escaped}"`;
            }
            return value;
        });
        csvRows.push(values.join(','));
    });

    fs.writeFileSync(filepath, csvRows.join('\n'), 'utf8');
}

// Main execution
// Usage: node buildAqiDataset.js <cityId> [daysBack] [format]
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('Usage: node buildAqiDataset.js <cityId> [daysBack] [format]');
    console.log('  cityId: MongoDB ObjectId of the city (required)');
    console.log('  daysBack: Number of days to look back (default: 14)');
    console.log('  format: Output format - "json" or "csv" (default: "json")');
    console.log('\nExample: node buildAqiDataset.js 507f1f77bcf86cd799439011 14 json');
    process.exit(1);
}

const cityId = args[0];
const daysBack = args[1] ? parseInt(args[1]) : 14;
const format = args[2] || 'json';

if (!mongoose.Types.ObjectId.isValid(cityId)) {
    console.error('Invalid city ID format. Must be a valid MongoDB ObjectId.');
    process.exit(1);
}

buildAqiDataset(cityId, daysBack, format)
    .then(() => {
        console.log('\nDataset building completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Failed to build dataset:', error);
        process.exit(1);
    });
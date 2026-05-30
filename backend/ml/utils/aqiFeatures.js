/**
 * Shared AQI feature extraction for dataset building and inference.
 * Must stay in sync with buildAqiDataset.js training samples.
 */

function getRecordsInRange(allRecords, currentIndex, startTime, endTime) {
  const records = [];
  for (let i = currentIndex; i >= 0; i--) {
    const record = allRecords[i];
    if (record.recordedAt < startTime) break;
    if (record.recordedAt >= startTime && record.recordedAt <= endTime) {
      records.unshift(record);
    }
  }
  return records;
}

function findClosestRecord(allRecords, currentIndex, targetTime, maxHoursDiff = 2) {
  let closestRecord = null;
  let minDiff = Infinity;
  const maxDiff = maxHoursDiff * 60 * 60 * 1000;

  const estimatedIndex = currentIndex - Math.floor(
    (allRecords[currentIndex].recordedAt - targetTime) / (60 * 60 * 1000)
  );
  const searchStart = Math.max(0, estimatedIndex - 24);
  const searchEnd = Math.min(allRecords.length - 1, estimatedIndex + 24);

  for (let i = searchStart; i <= searchEnd && i <= currentIndex; i++) {
    const diff = Math.abs(allRecords[i].recordedAt - targetTime);
    if (diff < minDiff && diff <= maxDiff) {
      minDiff = diff;
      closestRecord = allRecords[i];
    }
  }

  return closestRecord;
}

function calculateMean(values) {
  if (!values || values.length === 0) return 0;
  const filtered = values.filter((v) => v != null && isFinite(v));
  if (filtered.length === 0) return 0;
  return filtered.reduce((sum, val) => sum + val, 0) / filtered.length;
}

function calculateStd(values) {
  if (!values || values.length === 0) return 0;
  const filtered = values.filter((v) => v != null && isFinite(v));
  if (filtered.length === 0) return 0;
  const mean = calculateMean(filtered);
  const variance = filtered.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / filtered.length;
  return Math.sqrt(variance);
}

function calculateMax(values) {
  if (!values || values.length === 0) return 0;
  const filtered = values.filter((v) => v != null && isFinite(v));
  if (filtered.length === 0) return 0;
  return Math.max(...filtered);
}

function calculateMin(values) {
  if (!values || values.length === 0) return 0;
  const filtered = values.filter((v) => v != null && isFinite(v));
  if (filtered.length === 0) return 0;
  return Math.min(...filtered);
}

function calculateSlope(times, values) {
  if (!times || !values || times.length < 2 || values.length < 2) return 0;

  const paired = times
    .slice(0, Math.min(times.length, values.length))
    .map((t, i) => ({ t, v: values[i] }))
    .filter((p) => p.v != null && isFinite(p.v));

  if (paired.length < 2) return 0;

  const tMin = Math.min(...paired.map((p) => p.t));
  const xNorm = paired.map((p) => (p.t - tMin) / (1000 * 60 * 60));
  const y = paired.map((p) => p.v);

  const xMean = calculateMean(xNorm);
  const yMean = calculateMean(y);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < xNorm.length; i++) {
    numerator += (xNorm[i] - xMean) * (y[i] - yMean);
    denominator += Math.pow(xNorm[i] - xMean, 2);
  }

  return denominator !== 0 ? numerator / denominator : 0;
}

export function extractFeatures(currentRecord, allRecords, currentIndex, currentTime) {
  const features = {};
  const time = currentTime instanceof Date ? currentTime : new Date(currentTime);

  features.current_aqi = currentRecord.aqiValue || 0;
  features.current_pm25 = currentRecord.pollutants?.pm25 || 0;
  features.current_pm10 = currentRecord.pollutants?.pm10 || 0;
  features.current_no2 = currentRecord.pollutants?.no2 || 0;
  features.current_so2 = currentRecord.pollutants?.so2 || 0;
  features.current_o3 = currentRecord.pollutants?.o3 || 0;
  features.current_co2 = currentRecord.pollutants?.co2 || 0;

  const hour = time.getHours();
  const dayOfWeek = time.getDay();
  const dayOfMonth = time.getDate();

  features.hour_of_day = hour;
  features.day_of_week = dayOfWeek;
  features.day_of_month = dayOfMonth;
  features.is_weekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;

  const oneHourAgo = new Date(time.getTime() - 60 * 60 * 1000);
  const sixHoursAgo = new Date(time.getTime() - 6 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(time.getTime() - 24 * 60 * 60 * 1000);

  const recent1h = getRecordsInRange(allRecords, currentIndex, oneHourAgo, time);
  const recent6h = getRecordsInRange(allRecords, currentIndex, sixHoursAgo, time);
  const recent24h = getRecordsInRange(allRecords, currentIndex, twentyFourHoursAgo, time);

  features.avg_aqi_1h = calculateMean(recent1h.map((r) => r.aqiValue));
  features.avg_aqi_6h = calculateMean(recent6h.map((r) => r.aqiValue));
  features.avg_aqi_24h = calculateMean(recent24h.map((r) => r.aqiValue));

  features.max_aqi_1h = calculateMax(recent1h.map((r) => r.aqiValue));
  features.max_aqi_6h = calculateMax(recent6h.map((r) => r.aqiValue));
  features.max_aqi_24h = calculateMax(recent24h.map((r) => r.aqiValue));

  features.min_aqi_1h = calculateMin(recent1h.map((r) => r.aqiValue));
  features.min_aqi_6h = calculateMin(recent6h.map((r) => r.aqiValue));
  features.min_aqi_24h = calculateMin(recent24h.map((r) => r.aqiValue));

  features.std_aqi_1h = calculateStd(recent1h.map((r) => r.aqiValue));
  features.std_aqi_6h = calculateStd(recent6h.map((r) => r.aqiValue));
  features.std_aqi_24h = calculateStd(recent24h.map((r) => r.aqiValue));

  features.delta_aqi_1h = features.avg_aqi_1h - features.current_aqi;
  features.delta_aqi_6h = features.avg_aqi_6h - features.current_aqi;
  features.delta_aqi_24h = features.avg_aqi_24h - features.current_aqi;

  const pollutants = ['pm25', 'pm10', 'no2', 'so2', 'o3', 'co2'];
  pollutants.forEach((pollutant) => {
    const values6h = recent6h.map((r) => r.pollutants?.[pollutant]).filter((v) => v != null);
    const values24h = recent24h.map((r) => r.pollutants?.[pollutant]).filter((v) => v != null);

    features[`avg_${pollutant}_6h`] = calculateMean(values6h);
    features[`avg_${pollutant}_24h`] = calculateMean(values24h);
  });

  const yesterday = new Date(time);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(hour, 0, 0, 0);

  const lastWeek = new Date(time);
  lastWeek.setDate(lastWeek.getDate() - 7);
  lastWeek.setHours(hour, 0, 0, 0);

  const yesterdayRecord = findClosestRecord(allRecords, currentIndex, yesterday, 2);
  const lastWeekRecord = findClosestRecord(allRecords, currentIndex, lastWeek, 2);

  features.aqi_same_hour_yesterday = yesterdayRecord?.aqiValue || features.current_aqi;
  features.aqi_same_hour_last_week = lastWeekRecord?.aqiValue || features.current_aqi;

  const sevenDaysAgo = new Date(time.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(time.getTime() - 14 * 24 * 60 * 60 * 1000);

  const recent7d = getRecordsInRange(allRecords, currentIndex, sevenDaysAgo, time);
  const recent14d = getRecordsInRange(allRecords, currentIndex, fourteenDaysAgo, time);

  features.avg_aqi_7d = calculateMean(recent7d.map((r) => r.aqiValue));
  features.avg_aqi_14d = calculateMean(recent14d.map((r) => r.aqiValue));

  if (recent6h.length >= 2) {
    const times6h = recent6h.map((r) => new Date(r.recordedAt).getTime());
    const aqis6h = recent6h.map((r) => r.aqiValue);
    features.aqi_slope_6h = calculateSlope(times6h, aqis6h);
  } else {
    features.aqi_slope_6h = 0;
  }

  if (recent24h.length >= 2) {
    const times24h = recent24h.map((r) => new Date(r.recordedAt).getTime());
    const aqis24h = recent24h.map((r) => r.aqiValue);
    features.aqi_slope_24h = calculateSlope(times24h, aqis24h);
  } else {
    features.aqi_slope_24h = 0;
  }

  Object.keys(features).forEach((key) => {
    if (!isFinite(features[key])) {
      features[key] = 0;
    }
  });

  return features;
}

import cron from 'node-cron';
import City from '../models/city.model.js';
import { fetchAndStoreAQIForCity } from '../services/aqi.service.js'; // your existing fetch logic
import { createCityAlert } from '../services/alert.service.js';

const getAQIAlertDetails = (aqiValue, category) => {
  if (aqiValue >= 301) {
    return {
      title: 'Hazardous air quality detected',
      message: `AQI is ${aqiValue} (${category}). Avoid all outdoor activity and seek shelter.`,
      priority: 'critical'
    };
  }

  if (aqiValue >= 201) {
    return {
      title: 'Very unhealthy air quality warning',
      message: `AQI is ${aqiValue} (${category}). Everyone should limit outdoor exposure.`,
      priority: 'high'
    };
  }

  if (aqiValue >= 151) {
    return {
      title: 'Unhealthy air quality alert',
      message: `AQI is ${aqiValue} (${category}). Sensitive groups should reduce outdoor time.`,
      priority: 'high'
    };
  }

  return null;
};

// Runs every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  console.log('[AQI Poller] Running at', new Date().toISOString());
  
  try {
    const cities = await City.find({});
    
    for (const city of cities) {
      try {
        const result = await fetchAndStoreAQIForCity(city.name);
        if (result?.aqi?.aqiValue != null) {
          const { aqiValue, category } = result.aqi;
          const alertDetails = getAQIAlertDetails(aqiValue, category);
          if (alertDetails) {
            await createCityAlert({
              cityId: city._id,
              title: alertDetails.title,
              message: alertDetails.message,
              type: 'air-quality',
              priority: alertDetails.priority,
              meta: { aqi: aqiValue, category }
            });
          }
        }
        console.log(`[AQI Poller] Updated AQI for ${city.name}`);
      } catch (err) {
        console.error(`[AQI Poller] Failed for ${city.name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[AQI Poller] DB error:', err.message);
  }
});
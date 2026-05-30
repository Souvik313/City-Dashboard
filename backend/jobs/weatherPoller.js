import cron from 'node-cron';
import City from '../models/city.model.js';
import WeatherData from '../models/WeatherData.model.js';
import { fetchAndStoreWeatherForCity } from '../services/weather.service.js'; // your existing fetch logic
import { createCityAlert } from '../services/alert.service.js';

const getHeatAlertDetails = (temperature) => {
  if (temperature >= 40) {
    return {
      title: 'Extreme heat warning',
      message: `Temperature is ${temperature.toFixed(1)}°C. Extreme hot conditions are present. Stay hydrated and avoid outdoor activity if possible.`,
      priority: 'critical'
    };
  }

  if (temperature >= 35) {
    return {
      title: 'Severe heat alert',
      message: `Temperature is ${temperature.toFixed(1)}°C. Heat stress risk is high. Limit outdoor exposure.`,
      priority: 'high'
    };
  }

  return null;
};

const getTempSpikeAlertDetails = (currentTemp, previousTemp) => {
  const diff = currentTemp - previousTemp;
  if (diff >= 5) {
    return {
      title: 'Rapid temperature rise detected',
      message: `Temperature rose ${diff.toFixed(1)}°C since the last reading. Sudden warming may increase heat risk.`,
      priority: 'high'
    };
  }
  return null;
};

//Runs every 30 minutes
cron.schedule('*/30 * * * *', async () => {
    console.log('[Weather Poller] Running at', new Date().toISOString());

    try {
        const cities = await City.find({});
        
        for (const city of cities) {
            try {
                const previousWeather = await WeatherData.findOne({ city: city._id }).sort({ recordedAt: -1 }).lean();
                const result = await fetchAndStoreWeatherForCity(city.name);
                const currentTemp = result?.weather?.temperature;
                if (typeof currentTemp === 'number') {
                  const heatAlert = getHeatAlertDetails(currentTemp);
                  if (heatAlert) {
                    await createCityAlert({
                      cityId: city._id,
                      title: heatAlert.title,
                      message: heatAlert.message,
                      type: 'weather',
                      priority: heatAlert.priority,
                      meta: { temperature: currentTemp }
                    });
                  }

                  if (previousWeather?.temperature != null) {
                    const spikeAlert = getTempSpikeAlertDetails(currentTemp, previousWeather.temperature);
                    if (spikeAlert) {
                      await createCityAlert({
                        cityId: city._id,
                        title: spikeAlert.title,
                        message: spikeAlert.message,
                        type: 'temperature-spike',
                        priority: spikeAlert.priority,
                        meta: { currentTemp, previousTemp: previousWeather.temperature }
                      });
                    }
                  }
                }

                console.log(`[Weather Poller] Updated weather for ${city.name}`);
            } catch (err) {
                console.error(`[Weather Poller] Failed for ${city.name}:`, err.message);
            }
        }
    } catch (error) {
        console.error('[Weather Poller] DB error:', error.message);    
    }});
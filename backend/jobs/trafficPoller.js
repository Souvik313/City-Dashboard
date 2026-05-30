import cron from 'node-cron';
import City from '../models/city.model.js';
import { fetchAndStoreTrafficForCity } from '../services/traffic.service.js'; // your existing fetch logic

// Runs every 30 minutes
cron.schedule('0 */2 * * *', async () => {
    console.log('[Traffic Poller] Running at', new Date().toISOString());

    try {
        const cities = await City.find({
            latitude: { $exists: true, $ne: null, $ne: 0 },
            longitude: { $exists: true, $ne: null, $ne: 0 }
        });
        
        for (const city of cities) {
            try {
                await fetchAndStoreTrafficForCity(city.name);
                console.log(`[Traffic Poller] Updated traffic for ${city.name}`);
            } catch (err) {
                console.error(`[Traffic Poller] Failed for ${city.name}:`, err.message);
            }
        }
    } catch (error) {
        console.error('[Traffic Poller] DB error:', error.message);
    }
});
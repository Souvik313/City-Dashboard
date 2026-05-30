import Alert from '../models/alert.model.js';
import { getIO } from '../utils/socket.js';

export const createAlert = async (req, res, next) => {
  try {
    const { title, message, city, type, priority, meta } = req.body;
    if (!title || !message || !city) return res.status(400).json({ success: false, message: 'Missing fields' });

    const alert = await Alert.create({ title, message, city, type, priority, meta });

    // emit via socket.io to room for the city
    try {
      const io = getIO();
      io.to(String(city)).emit('alert', alert);
    } catch (err) {
      // socket may not be initialized in some environments
      console.warn('Socket emit failed', err?.message || err);
    }

    res.status(201).json({ success: true, alert });
  } catch (error) {
    next(error);
  }
};

export const listAlerts = async (req, res, next) => {
  try {
    const { cityId } = req.query;
    const query = {};
    if (cityId) query.city = cityId;
    const alerts = await Alert.find(query).sort({ createdAt: -1 }).limit(200);
    res.status(200).json({ success: true, alerts });
  } catch (error) {
    next(error);
  }
};

export const acknowledgeAlert = async (req, res, next) => {
  try {
    const id = req.params.id;
    const alert = await Alert.findByIdAndUpdate(id, { acknowledged: true }, { new: true });
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    res.status(200).json({ success: true, alert });
  } catch (error) {
    next(error);
  }
};

import Alert from '../models/alert.model.js';
import { getIO } from '../utils/socket.js';

const SUPPRESSION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const createCityAlert = async ({ cityId, title, message, type = 'general', priority = 'medium', meta = {} }) => {
  const recentAlert = await Alert.findOne({
    city: cityId,
    type,
    priority,
    createdAt: { $gte: new Date(Date.now() - SUPPRESSION_WINDOW_MS) }
  }).sort({ createdAt: -1 });

  if (recentAlert) {
    return recentAlert;
  }

  const alert = await Alert.create({
    title,
    message,
    city: cityId,
    type,
    priority,
    meta
  });

  try {
    const io = getIO();
    io.to(String(cityId)).emit('alert', alert);
  } catch (err) {
    console.warn('Alert emit failed', err?.message || err);
  }

  return alert;
};

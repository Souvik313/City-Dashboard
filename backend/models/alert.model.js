import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  city: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true },
  type: { type: String, default: 'general' },
  priority: { type: String, enum: ['low','medium','high','critical'], default: 'medium' },
  acknowledged: { type: Boolean, default: false },
  meta: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

const Alert = mongoose.model('Alert', alertSchema);
export default Alert;

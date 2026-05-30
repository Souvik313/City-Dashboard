import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Pothole',
      'Broken streetlight',
      'Waste issue',
      'Flooding',
      'Public Safety',
      'Fire Hazard',
      'Other',
    ],
  },
  address: {
    type: String,
    trim: true,
  },
  latitude: {
    type: Number,
    min: -90,
    max: 90,
  },
  longitude: {
    type: Number,
    min: -180,
    max: 180,
  },
  city: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'City',
    required: true,
  },
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  status: {
    type: String,
    enum: ['Reported', 'In Progress', 'Resolved'],
    default: 'Reported',
  },
  photo: {
    type: String,
  },
}, { timestamps: true });

const Incident = mongoose.model('Incident', incidentSchema);
export default Incident;

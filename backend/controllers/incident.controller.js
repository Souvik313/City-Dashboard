import jwt from 'jsonwebtoken';
import Incident from '../models/incident.model.js';
import City from '../models/city.model.js';
import Alert from '../models/alert.model.js';
import { getIncidentAnalytics } from '../services/incidentAnalytics.service.js';
import { getIO } from '../utils/socket.js';
import { JWT_SECRET } from '../config/env.js';

const incidentCategories = [
  'Pothole',
  'Broken streetlight',
  'Waste issue',
  'Flooding',
  'Public Safety',
  'Fire Hazard',
  'Other',
];

export const createIncident = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      address,
      cityId,
      latitude,
      longitude,
      photoData,
    } = req.body;

    if (!title || !description || !category || !cityId) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, category and city are required.',
      });
    }

    const normalizedCategory = incidentCategories.find(
      (option) => option.toLowerCase() === String(category).trim().toLowerCase()
    );

    if (!normalizedCategory) {
      return res.status(400).json({
        success: false,
        message: `Category must be one of: ${incidentCategories.join(', ')}`,
      });
    }

    const city = await City.findById(cityId);
    if (!city) {
      return res.status(404).json({
        success: false,
        message: 'City not found for this incident.',
      });
    }

    let reporterId;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        reporterId = decoded.userId;
      } catch (error) {
        // ignore invalid token and allow anonymous report
      }
    }

    const issue = await Incident.create({
      title: title.trim(),
      description: description.trim(),
      category: normalizedCategory,
      address: address?.trim() || '',
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      photo: photoData?.startsWith('data:') ? photoData : photoData ? `data:image/jpeg;base64,${photoData}` : undefined,
      city: city._id,
      reporter: reporterId,
    });

    const alert = await Alert.create({
      title: `New incident reported: ${issue.title}`,
      message: issue.description,
      city: city._id,
      type: 'incident',
      priority: 'high',
      meta: {
        incidentId: issue._id,
        category: issue.category,
        address: issue.address,
      }
    });

    try {
      const io = getIO();
      io.to(String(city._id)).emit('alert', alert);
    } catch (err) {
      console.warn('Alerts socket emit failed:', err?.message || err);
    }

    res.status(201).json({
      success: true,
      message: 'Incident reported successfully.',
      incident: issue,
    });
  } catch (error) {
    console.error(error.message);
    next(error);
  }
};

export const getIncidentsByCity = async (req, res, next) => {
  try {
    const { cityId } = req.query;
    if (!cityId) {
      return res.status(400).json({
        success: false,
        message: 'City id is required to fetch incident reports.',
      });
    }

    const incidents = await Incident.find({ city: cityId })
      .sort({ createdAt: -1 })
      .populate({
        path: 'reporter',
        select: 'name email',
      });

    res.status(200).json({
      success: true,
      count: incidents.length,
      incidents,
    });
  } catch (error) {
    console.error(error.message);
    next(error);
  }
};

export const getIncidentAnalyticsByCity = async (req, res, next) => {
  try {
    const { cityId, period = '24h' } = req.query;

    if (!cityId) {
      return res.status(400).json({
        success: false,
        message: 'City id is required to fetch incident analytics.',
      });
    }

    const data = await getIncidentAnalytics(cityId, {
      period: period === '7d' ? '7d' : '24h',
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error.message);
    next(error);
  }
};

export const updateIncidentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required to update incident.',
      });
    }

    const validStatuses = ['Reported', 'In Progress', 'Resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const updatedIncident = await Incident.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedIncident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Incident status updated.',
      incident: updatedIncident,
    });
  } catch (error) {
    console.error(error.message);
    next(error);
  }
};

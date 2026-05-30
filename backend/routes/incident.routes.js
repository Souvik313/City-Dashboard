import { Router } from 'express';
import {
  createIncident,
  getIncidentsByCity,
  getIncidentAnalyticsByCity,
  updateIncidentStatus,
} from '../controllers/incident.controller.js';

const router = Router();

router.post('/', createIncident);
router.get('/analytics', getIncidentAnalyticsByCity);
router.get('/', getIncidentsByCity);
router.patch('/:id', updateIncidentStatus);

export default router;

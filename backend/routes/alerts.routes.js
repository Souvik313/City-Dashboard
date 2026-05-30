import { Router } from 'express';
import { createAlert, listAlerts, acknowledgeAlert } from '../controllers/alert.controller.js';

const router = Router();

router.post('/', createAlert);
router.get('/', listAlerts);
router.patch('/:id/ack', acknowledgeAlert);

export default router;

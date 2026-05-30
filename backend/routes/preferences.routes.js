import { Router } from 'express';
import User from '../models/user.model.js';

const router = Router();

router.get('/:userId', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select('preferences');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, preferences: user.preferences });
  } catch (err) { next(err); }
});

router.patch('/:userId', async (req, res, next) => {
  try {
    const updates = req.body.preferences || {};
    const user = await User.findByIdAndUpdate(req.params.userId, { preferences: updates }, { new: true }).select('preferences');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, preferences: user.preferences });
  } catch (err) { next(err); }
});

export default router;

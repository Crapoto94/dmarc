import { Router } from 'express';
import { getAlerts, getAllAlerts, acknowledgeAlert, generateAlerts } from '../services/analyzer.js';

const router = Router();

router.get('/', (req, res) => {
  const all = req.query.all === 'true';
  const alerts = all ? getAllAlerts() : getAlerts(0);
  res.json(alerts);
});

router.get('/generate', (req, res) => {
  const newAlerts = generateAlerts();
  res.json({ count: newAlerts.length, alerts: newAlerts });
});

router.post('/:id/acknowledge', (req, res) => {
  acknowledgeAlert(req.params.id);
  res.json({ success: true });
});

export default router;

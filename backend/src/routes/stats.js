import { Router } from 'express';
import {
  getGlobalStats, getTimeline, getTopSources,
  getDispositionBreakdown, getUnauthorizedActivity,
  getEmailDetails, generateRecommendations,
  getMonthlyComparison, getNewSenders, getOverview,
  getRecommendationsList, updateRecommendationStatus,
  generateAndStoreRecommendations,
} from '../services/analyzer.js';
import { lookupIP } from '../services/ipinfo.js';

const router = Router();

router.get('/global', (req, res) => {
  res.json(getGlobalStats());
});

router.get('/email-details', (req, res) => {
  res.json(getEmailDetails());
});

router.get('/recommendations', (req, res) => {
  const status = req.query.status || 'active';
  res.json(getRecommendationsList(status));
});

router.post('/recommendations/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['active', 'dismissed', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }
  updateRecommendationStatus(req.params.id, status);
  res.json({ success: true });
});

router.post('/recommendations/refresh', (req, res) => {
  generateAndStoreRecommendations();
  res.json({ success: true, message: 'Recommandations mises à jour' });
});

router.get('/timeline', (req, res) => {
  const days = parseInt(req.query.days) || 90;
  res.json(getTimeline(days));
});

router.get('/sources', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json(getTopSources(limit));
});

router.get('/dispositions', (req, res) => {
  res.json(getDispositionBreakdown());
});

router.get('/unauthorized', (req, res) => {
  res.json(getUnauthorizedActivity());
});

router.get('/monthly', (req, res) => {
  res.json(getMonthlyComparison());
});

router.get('/new-senders', (req, res) => {
  const days = parseInt(req.query.days) || 90;
  res.json(getNewSenders(days));
});

router.get('/overview', (req, res) => {
  res.json(getOverview());
});

router.get('/ip-lookup', async (req, res) => {
  const { ip } = req.query;
  if (!ip) return res.status(400).json({ error: 'ip required' });
  const info = await lookupIP(ip);
  res.json(info);
});

export default router;

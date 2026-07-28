import { Router } from 'express';
import {
  getGlobalStats, getTimeline, getTopSources,
  getDispositionBreakdown, getUnauthorizedActivity,
  getEmailDetails, generateRecommendations,
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
  res.json(generateRecommendations());
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

router.get('/ip-lookup', async (req, res) => {
  const { ip } = req.query;
  if (!ip) return res.status(400).json({ error: 'ip required' });
  const info = await lookupIP(ip);
  res.json(info);
});

export default router;

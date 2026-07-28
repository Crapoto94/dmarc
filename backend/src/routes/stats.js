import { Router } from 'express';
import {
  getGlobalStats, getTimeline, getTopSources,
  getDispositionBreakdown, getUnauthorizedActivity,
  getServiceIdentification
} from '../services/analyzer.js';

const router = Router();

router.get('/global', (req, res) => {
  res.json(getGlobalStats());
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

router.get('/services', (req, res) => {
  res.json(getServiceIdentification());
});

export default router;

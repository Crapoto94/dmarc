import jwt from 'jsonwebtoken';
import { getSecret, maybeRenewToken } from './auth-utils.js';

export function authenticate(req, res, next) {
  const token = req.cookies?.dmarc_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentification requise' });
  try {
    req.user = jwt.verify(token, getSecret());
    maybeRenewToken(req, res);
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
}

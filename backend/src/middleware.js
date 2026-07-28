import jwt from 'jsonwebtoken';
import { get } from './db.js';

function getSecret() {
  const row = get("SELECT value FROM config WHERE key = 'jwt_secret'");
  return row ? row.value : 'fallback_dev_secret';
}

export function authenticate(req, res, next) {
  const token = req.cookies?.dmarc_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentification requise' });
  try {
    req.user = jwt.verify(token, getSecret());
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

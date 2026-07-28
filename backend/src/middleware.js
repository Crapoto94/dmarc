import jwt from 'jsonwebtoken';
import { get } from './db.js';

function getSecret() {
  const row = get("SELECT value FROM config WHERE key = 'jwt_secret'");
  return row ? row.value : 'fallback_dev_secret';
}

export function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Authentification requise' });
  try {
    const decoded = jwt.verify(auth.replace('Bearer ', ''), getSecret());
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
}

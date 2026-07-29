import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { get, run } from './db.js';

// Durée de vie du token, plus courte qu'avant (était 7j) pour réduire la fenêtre
// d'exploitation d'un cookie volé. Le token est renouvelé automatiquement (voir
// maybeRenewToken) tant que la session reste active, donc un usage régulier n'est
// pas interrompu ; seule une session vraiment inactive expire.
export const TOKEN_EXPIRY_SECONDS = 24 * 60 * 60;
const RENEW_THRESHOLD_SECONDS = 12 * 60 * 60;

export function getSecret() {
  let row = get("SELECT value FROM config WHERE key = 'jwt_secret'");
  if (!row) {
    const secret = randomBytes(32).toString('hex');
    run("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)", ['jwt_secret', secret]);
    row = { value: secret };
  }
  return row.value;
}

export function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: TOKEN_EXPIRY_SECONDS });
}

export function setTokenCookie(res, token) {
  res.cookie('dmarc_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_EXPIRY_SECONDS * 1000,
    path: '/',
  });
}

export function maybeRenewToken(req, res) {
  if (!req.user?.exp) return;
  const remaining = req.user.exp - Math.floor(Date.now() / 1000);
  if (remaining < RENEW_THRESHOLD_SECONDS) {
    const fresh = signToken({ id: req.user.id, username: req.user.username, role: req.user.role });
    setTokenCookie(res, fresh);
  }
}

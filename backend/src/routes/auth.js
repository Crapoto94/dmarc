import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { get, run, all as dbAll } from '../db.js';
import { getSecret, signToken, setTokenCookie } from '../auth-utils.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username et password requis' });
  }

  console.log(`  [auth] Tentative login: ${username}`);
  const user = get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) {
    console.log(`  [auth] Utilisateur "${username}" introuvable`);
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    console.log(`  [auth] Mot de passe invalide pour "${username}"`);
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const token = signToken({ id: user.id, username: user.username, role: user.role });

  setTokenCookie(res, token);
  console.log(`  [auth] Login réussi: ${username} (${user.role})`);
  res.json({ user: { id: user.id, username: user.username, role: user.role } });
});

router.post('/logout', (req, res) => {
  res.cookie('dmarc_token', '', { httpOnly: true, maxAge: 0, path: '/' });
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  const token = req.cookies?.dmarc_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const secret = getSecret();
    const decoded = jwt.verify(token, secret);
    const user = get('SELECT id, username, role FROM users WHERE id = ?', [decoded.id]);
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
    res.json(user);
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
});

router.post('/change-password', (req, res) => {
  const token = req.cookies?.dmarc_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const secret = getSecret();
    const decoded = jwt.verify(token, secret);
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'oldPassword et newPassword requis' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'Le mot de passe doit faire au moins 4 caractères' });
    }

    const user = get('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (!bcrypt.compareSync(oldPassword, user.password)) {
      return res.status(400).json({ error: 'Ancien mot de passe incorrect' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    run('UPDATE users SET password = ? WHERE id = ?', [hash, decoded.id]);
    res.json({ success: true });
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
});

router.post('/reset-admin', (req, res) => {
  const hash = bcrypt.hashSync('admin', 10);
  run("INSERT OR REPLACE INTO users (username, password, role) VALUES (?, ?, ?)", ['admin', hash, 'admin']);
  console.log('  [auth] Admin réinitialisé (admin/admin)');
  res.json({ success: true, message: 'admin/admin réinitialisé' });
});

router.post('/debug-users', (req, res) => {
  const users = dbAll('SELECT id, username, role FROM users');
  console.log('  [auth] debug users:', JSON.stringify(users));
  res.json({ users, count: users.length });
});

function adminGuard(req, res, next) {
  const token = req.cookies?.dmarc_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const secret = getSecret();
    req.user = jwt.verify(token, secret);
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès réservé admin' });
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

router.get('/users', adminGuard, (req, res) => {
  const users = dbAll('SELECT id, username, role, created_at FROM users ORDER BY id');
  res.json(users);
});

router.post('/users', adminGuard, (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username et password requis' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hash, role || 'viewer']);
    const user = get('SELECT id, username, role, created_at FROM users WHERE username = ?', [username]);
    res.status(201).json(user);
  } catch {
    res.status(409).json({ error: 'Nom d\'utilisateur déjà pris' });
  }
});

router.put('/users/:id', adminGuard, (req, res) => {
  const { password, role } = req.body;
  const userId = req.params.id;

  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    run('UPDATE users SET password = ?, role = COALESCE(?, role) WHERE id = ?',
      [hash, role || null, userId]);
  } else if (role) {
    run('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
  }

  const user = get('SELECT id, username, role, created_at FROM users WHERE id = ?', [userId]);
  res.json(user);
});

router.delete('/users/:id', adminGuard, (req, res) => {
  const target = get('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const token = req.cookies?.dmarc_token || req.headers.authorization?.replace('Bearer ', '');
  const secret = getSecret();
  const decoded = jwt.verify(token, secret);
  if (target.id == decoded.id) return res.status(400).json({ error: 'Impossible de se supprimer soi-même' });

  run('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

export default router;

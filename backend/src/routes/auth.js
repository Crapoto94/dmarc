import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { get, run, all as dbAll } from '../db.js';

const router = Router();

function getSecret() {
  let row = get("SELECT value FROM config WHERE key = 'jwt_secret'");
  if (!row) {
    const secret = randomBytes(32).toString('hex');
    run("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)", ['jwt_secret', secret]);
    row = { value: secret };
  }
  return row.value;
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username et password requis' });
  }

  const user = get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const secret = getSecret();
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    secret,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role },
  });
});

router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const secret = getSecret();
    const decoded = jwt.verify(auth.replace('Bearer ', ''), secret);
    const user = get('SELECT id, username, role FROM users WHERE id = ?', [decoded.id]);
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
    res.json(user);
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
});

router.post('/change-password', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const secret = getSecret();
    const decoded = jwt.verify(auth.replace('Bearer ', ''), secret);
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

// Admin: user management
router.get('/users', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const secret = getSecret();
    const decoded = jwt.verify(auth.replace('Bearer ', ''), secret);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Accès réservé admin' });

    const users = dbAll('SELECT id, username, role, created_at FROM users ORDER BY id');
    res.json(users);
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
});

router.post('/users', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const secret = getSecret();
    const decoded = jwt.verify(auth.replace('Bearer ', ''), secret);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Accès réservé admin' });

    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username et password requis' });
    }

    const hash = bcrypt.hashSync(password, 10);
    run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hash, role || 'viewer']);
    const user = get('SELECT id, username, role, created_at FROM users WHERE username = ?', [username]);
    res.status(201).json(user);
  } catch (err) {
    res.status(409).json({ error: 'Nom d\'utilisateur déjà pris' });
  }
});

router.put('/users/:id', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const secret = getSecret();
    const decoded = jwt.verify(auth.replace('Bearer ', ''), secret);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Accès réservé admin' });

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
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
});

router.delete('/users/:id', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const secret = getSecret();
    const decoded = jwt.verify(auth.replace('Bearer ', ''), secret);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Accès réservé admin' });

    const target = get('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (target.id == decoded.id) return res.status(400).json({ error: 'Impossible de se supprimer soi-même' });

    run('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
});

export default router;

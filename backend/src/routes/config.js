import { Router } from 'express';
import { get, run, all as dbAll } from '../db.js';
import { ImapFlow } from 'imapflow';
import { markAllRead } from '../imap.js';

const router = Router();

const CONFIG_KEYS = [
  'gmail_user', 'gmail_pass', 'gmail_search', 'gmail_senders',
  'smtp_host', 'smtp_user', 'smtp_pass', 'alert_email', 'last_fetch_date',
];

router.get('/', (req, res) => {
  const config = {};
  for (const key of CONFIG_KEYS) {
    const row = get('SELECT value FROM config WHERE key = ?', [key]);
    config[key] = row ? row.value : '';
  }
  res.json(config);
});

router.post('/', (req, res) => {
  const updates = req.body;
  const allowedKeys = CONFIG_KEYS.filter(k => k !== 'last_fetch_date');

  for (const [key, value] of Object.entries(updates)) {
    if (allowedKeys.includes(key)) {
      run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, String(value)]);
    }
  }
  res.json({ success: true });
});

router.post('/mark-all-read', async (req, res) => {
  const user = get("SELECT value FROM config WHERE key = 'gmail_user'");
  const pass = get("SELECT value FROM config WHERE key = 'gmail_pass'");
  if (!user?.value || !pass?.value) {
    return res.json({ success: false, error: 'Gmail non configuré' });
  }
  const result = await markAllRead({ gmail_user: user.value, gmail_pass: pass.value });
  res.json({ success: true, count: result.count });
});

router.post('/test-imap', async (req, res) => {
  const user = get("SELECT value FROM config WHERE key = 'gmail_user'");
  const pass = get("SELECT value FROM config WHERE key = 'gmail_pass'");

  if (!user || !pass || !user.value || !pass.value) {
    return res.json({ success: false, error: 'Gmail non configuré' });
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: user.value, pass: pass.value },
    logger: false,
  });

  try {
    await client.connect();
    await client.logout();
    res.json({ success: true, message: 'Connexion IMAP réussie ✅' });
  } catch (err) {
    res.json({ success: false, error: `Échec connexion IMAP: ${err.message}` });
  }
});

router.get('/import-log', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const logs = dbAll('SELECT * FROM import_log ORDER BY created_at DESC LIMIT ?', [limit]);
  res.json(logs);
});

router.post('/fetch-now', async (req, res) => {
  const user = get("SELECT value FROM config WHERE key = 'gmail_user'");
  const pass = get("SELECT value FROM config WHERE key = 'gmail_pass'");

  if (!user || !pass || !user.value || !pass.value) {
    return res.json({ success: false, error: 'Gmail non configuré' });
  }

  try {
    const { fetchReportsFromGmail } = await import('../imap.js');
    const { generateAlerts } = await import('../services/analyzer.js');
    const { sendNewAlerts } = await import('../services/notifier.js');

    const config = {
      gmail_user: user.value,
      gmail_pass: pass.value,
      last_fetch_date: get("SELECT value FROM config WHERE key = 'last_fetch_date'")?.value,
      gmail_search: get("SELECT value FROM config WHERE key = 'gmail_search'")?.value,
    };

    const imported = await fetchReportsFromGmail(null, config);
    const newAlerts = generateAlerts();
    if (newAlerts.length > 0) sendNewAlerts();

    res.json({
      success: true,
      imported: imported.length,
      alerts: newAlerts.length,
      message: `${imported.length} rapport(s) importé(s), ${newAlerts.length} alerte(s)`
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

export default router;

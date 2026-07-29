import { Router } from 'express';
import { get, all } from '../db.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);
const __dirname = join(fileURLToPath(import.meta.url), '..');
const router = Router();

router.get('/health', (req, res) => {
  try {
    const stats = get('SELECT COUNT(*) as report_count FROM reports');
    const config = get("SELECT value FROM config WHERE key = 'last_fetch_date'");
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      reports: stats?.report_count || 0,
      lastFetch: config?.value || null,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/backup', async (req, res) => {
  const backupDir = join(__dirname, '..', 'backups');
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(backupDir, `dmarc-backup-${timestamp}.sqlite`);
  const dbPath = join(__dirname, '..', 'data', 'dmarc.db');
  try {
    await execAsync(`copy "${dbPath}" "${backupPath}"`);
    res.json({ success: true, path: backupPath });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/webhook', (req, res) => {
  const { url, events } = req.body;
  if (!url) return res.status(400).json({ error: 'URL requise' });
  run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', ['webhook_url', url]);
  run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', ['webhook_events', (events || ['import', 'suspicious']).join(',')]);
  res.json({ success: true });
});

router.get('/webhook', (req, res) => {
  const url = get("SELECT value FROM config WHERE key = 'webhook_url'");
  const events = get("SELECT value FROM config WHERE key = 'webhook_events'");
  res.json({
    url: url?.value || '',
    events: events?.value ? events.value.split(',') : ['import', 'suspicious'],
  });
});

export default router;

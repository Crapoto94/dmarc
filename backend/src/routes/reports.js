import { Router } from 'express';
import { all, get, run } from '../db.js';
import { importReportToDB } from '../parser.js';
import { generateAlerts } from '../services/analyzer.js';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const router = Router();

router.get('/', (req, res) => {
  const reports = all(`
    SELECT r.*, d.domain as domain_name,
      (SELECT COUNT(*) FROM records WHERE report_id = r.id) as record_count,
      (SELECT COALESCE(SUM(count), 0) FROM records WHERE report_id = r.id) as total_emails
    FROM reports r
    LEFT JOIN domains d ON r.domain_id = d.id
    ORDER BY r.begin_ts DESC
  `);
  res.json(reports);
});

router.get('/:id', (req, res) => {
  const report = get(`
    SELECT r.*, d.domain as domain_name
    FROM reports r
    LEFT JOIN domains d ON r.domain_id = d.id
    WHERE r.id = ?
  `, [req.params.id]);
  if (!report) return res.status(404).json({ error: 'Report not found' });

  const records = all('SELECT * FROM records WHERE report_id = ? ORDER BY count DESC', [report.id]);
  for (const rec of records) {
    rec.dkim_results = all('SELECT * FROM dkim_results WHERE record_id = ?', [rec.id]);
    rec.spf_results = all('SELECT * FROM spf_results WHERE record_id = ?', [rec.id]);
  }

  res.json({ ...report, records });
});

router.post('/import', async (req, res) => {
  const { filepath, filename } = req.body;
  if (!filepath || !filename) {
    return res.status(400).json({ error: 'filepath and filename required' });
  }
  if (!existsSync(filepath)) {
    return res.status(400).json({ error: 'File not found' });
  }
  const id = await importReportToDB(filepath, filename);
  if (id) {
    const newAlerts = generateAlerts();
    res.json({ success: true, report_id: id, alerts: newAlerts.length });
  } else {
    res.json({ success: false, error: 'Import failed or duplicate' });
  }
});

router.post('/scan-folder', async (req, res) => {
  const { folder } = req.body;
  if (!folder) return res.status(400).json({ error: 'folder required' });

  if (!existsSync(folder)) {
    return res.status(400).json({ error: 'Folder not found' });
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const f of readdirSync(folder)) {
    const ext = f.toLowerCase().split('.').pop();
    if (!['zip', 'gz', 'xml'].includes(ext)) continue;
    const fp = join(folder, f);
    try {
      const id = await importReportToDB(fp, f);
      if (id) imported++;
      else skipped++;
    } catch {
      errors++;
    }
  }

  const newAlerts = generateAlerts();
  res.json({ imported, skipped, errors, new_alerts: newAlerts.length });
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM reports WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

export default router;

import { Router } from 'express';
import { all, get, run } from '../db.js';
import { getDomainDetail } from '../services/analyzer.js';
import { existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reportsDir = join(__dirname, '..', 'reports');

const router = Router();

router.get('/', (req, res) => {
  const domains = all(`
    SELECT d.*,
      (SELECT COUNT(*) FROM reports WHERE domain_id = d.id) as report_count,
      (SELECT COALESCE(SUM(r.count), 0) FROM records r JOIN reports rp ON r.report_id = rp.id WHERE rp.domain_id = d.id) as total_emails,
      (SELECT COALESCE(SUM(CASE WHEN r.dkim_eval = 'pass' AND r.spf_eval = 'pass' THEN r.count ELSE 0 END), 0)
       FROM records r JOIN reports rp ON r.report_id = rp.id WHERE rp.domain_id = d.id) as pass_emails
    FROM domains d ORDER BY d.domain
  `);
  res.json(domains);
});

router.get('/:id', (req, res) => {
  const detail = getDomainDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: 'Domain not found' });
  res.json(detail);
});

router.post('/', (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'domain required' });
  try {
    run('INSERT INTO domains (domain) VALUES (?)', [domain]);
    const d = get('SELECT * FROM domains WHERE domain = ?', [domain]);
    res.status(201).json(d);
  } catch (err) {
    res.status(409).json({ error: 'Domain already exists' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const domain = get('SELECT * FROM domains WHERE id = ?', [req.params.id]);
    if (!domain) return res.status(404).json({ error: 'Domain not found' });

    const reportFiles = all(
      "SELECT filename FROM reports WHERE domain_id = ? AND filename IS NOT NULL AND filename != ''",
      [req.params.id]
    );

    let deletedFiles = 0;
    for (const rf of reportFiles) {
      const fp = join(reportsDir, rf.filename);
      try {
        if (existsSync(fp)) {
          unlinkSync(fp);
          deletedFiles++;
        }
      } catch (err) {
        console.error(`  [!!] Impossible de supprimer ${rf.filename}: ${err.message}`);
      }
    }

    run('DELETE FROM reports WHERE domain_id = ?', [req.params.id]);
    run('DELETE FROM domains WHERE id = ?', [req.params.id]);

    res.json({ success: true, deleted_reports: reportFiles.length, deleted_files: deletedFiles });
  } catch (err) {
    console.error(`  [!!] Erreur suppression domaine ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;

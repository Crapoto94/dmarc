import express from 'express';
import cors from 'cors';
import { initDB, run, get } from './db.js';
import { importReportToDB } from './parser.js';
import { generateAlerts } from './services/analyzer.js';
import { startScheduler } from './scheduler.js';
import reportsRouter from './routes/reports.js';
import domainsRouter from './routes/domains.js';
import alertsRouter from './routes/alerts.js';
import configRouter from './routes/config.js';
import statsRouter from './routes/stats.js';
import authRouter from './routes/auth.js';
import { authenticate } from './middleware.js';

import { readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3201;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/auth', authRouter);

app.use('/api/reports', authenticate, reportsRouter);
app.use('/api/domains', authenticate, domainsRouter);
app.use('/api/alerts', authenticate, alertsRouter);
app.use('/api/config', authenticate, configRouter);
app.use('/api/stats', authenticate, statsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function main() {
  await initDB();

  const dataDir = join(__dirname, '..', 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const reportsDir = join(__dirname, '..', 'reports');
  if (existsSync(reportsDir)) {
    console.log('[*] Import des rapports existants...');
    for (const f of readdirSync(reportsDir)) {
      const ext = f.toLowerCase().split('.').pop();
      if (!['zip', 'gz', 'xml'].includes(ext)) continue;
      const fp = join(reportsDir, f);
      try {
        await importReportToDB(fp, f);
      } catch (err) {
        console.error(`  [!!] Erreur ${f}: ${err.message}`);
      }
    }
  }

  generateAlerts();
  startScheduler();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[*] Serveur DMARC Analyzer démarré sur http://0.0.0.0:${PORT}`);
  });
}

main().catch(err => {
  console.error('[!!] Erreur fatale:', err);
  process.exit(1);
});

export default app;

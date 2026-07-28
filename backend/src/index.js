import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
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
import infraRouter from './routes/infra.js';
import { authenticate } from './middleware.js';

import { readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3201;

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3200',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);

app.use('/api/auth', authRouter);
app.use('/api/reports', authenticate, reportsRouter);
app.use('/api/domains', authenticate, domainsRouter);
app.use('/api/alerts', authenticate, alertsRouter);
app.use('/api/config', authenticate, configRouter);
app.use('/api/stats', authenticate, statsRouter);
app.use('/api/infra', authenticate, infraRouter);

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

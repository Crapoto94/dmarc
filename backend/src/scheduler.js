import cron from 'node-cron';
import db from './db.js';
import { fetchReportsFromGmail } from './imap.js';
import { generateAlerts } from './services/analyzer.js';
import { sendNewAlerts } from './services/notifier.js';

export function startScheduler() {
  console.log('  [*] Planificateur démarré - moissonnage toutes les heures');

  cron.schedule('0 * * * *', async () => {
    console.log(`\n[*] Moissonnage Gmail automatique à ${new Date().toLocaleString()}`);
    try {
      const user = db.prepare("SELECT value FROM config WHERE key = 'gmail_user'").get();
      const pass = db.prepare("SELECT value FROM config WHERE key = 'gmail_pass'").get();

      if (user && pass) {
        const config = {
          gmail_user: user.value,
          gmail_pass: pass.value,
          last_fetch_date: db.prepare("SELECT value FROM config WHERE key = 'last_fetch_date'").get()?.value,
          gmail_search: db.prepare("SELECT value FROM config WHERE key = 'gmail_search'").get()?.value,
        };
        await fetchReportsFromGmail(db, config);
      }

      const newAlerts = generateAlerts();
      if (newAlerts.length > 0) {
        console.log(`  [*] ${newAlerts.length} nouvelle(s) alerte(s) générée(s)`);
        await sendNewAlerts();
      }
    } catch (err) {
      console.error(`  [!!] Erreur scheduler: ${err.message}`);
    }
  });
}

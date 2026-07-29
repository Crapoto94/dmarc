import cron from 'node-cron';
import { get, all } from './db.js';
import { fetchReportsFromGmail } from './imap.js';
import { generateAlerts } from './services/analyzer.js';
import { sendBatchAlertEmail } from './services/notifier.js';

export function startScheduler() {
  const schedule = get("SELECT value FROM config WHERE key = 'cron_schedule'");
  const expr = schedule?.value || '0 * * * *';
  console.log(`  [*] Planificateur démarré (${expr})`);

  cron.schedule(expr, async () => {
    console.log(`\n[*] Moissonnage Gmail automatique à ${new Date().toLocaleString()}`);
    try {
      const user = get("SELECT value FROM config WHERE key = 'gmail_user'");
      const pass = get("SELECT value FROM config WHERE key = 'gmail_pass'");

      if (user?.value && pass?.value) {
        const config = {
          gmail_user: user.value,
          gmail_pass: pass.value,
          last_fetch_date: get("SELECT value FROM config WHERE key = 'last_fetch_date'")?.value,
          gmail_search: get("SELECT value FROM config WHERE key = 'gmail_search'")?.value,
          gmail_senders: get("SELECT value FROM config WHERE key = 'gmail_senders'")?.value,
        };
        await fetchReportsFromGmail(null, config);
      }

      await generateAlerts();
      await sendBatchAlertEmail();
    } catch (err) {
      console.error(`  [!!] Erreur scheduler: ${err.message}`);
    }
  });
}

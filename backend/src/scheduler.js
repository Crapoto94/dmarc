import cron from 'node-cron';
import { get, run } from './db.js';
import { fetchReportsFromGmail } from './imap.js';
import { generateAlerts } from './services/analyzer.js';
import { sendBatchAlertEmail } from './services/notifier.js';
import { sweepRecentIPs, recordRBLAlerts } from './services/rbl.js';

export function startScheduler() {
  const schedule = get("SELECT value FROM config WHERE key = 'cron_schedule'");
  const expr = schedule?.value || '0 * * * *';
  console.log(`  [*] Planificateur démarré (${expr})`);

  cron.schedule(expr, async () => {
    const ts = new Date().toISOString();
    console.log(`\n[*] Moissonnage Gmail automatique à ${ts}`);
    try {
      const user = get("SELECT value FROM config WHERE key = 'gmail_user'");
      const pass = get("SELECT value FROM config WHERE key = 'gmail_pass'");

      let imported = 0;
      if (user?.value && pass?.value) {
        const config = {
          gmail_user: user.value,
          gmail_pass: pass.value,
          last_fetch_date: get("SELECT value FROM config WHERE key = 'last_fetch_date'")?.value,
          gmail_search: get("SELECT value FROM config WHERE key = 'gmail_search'")?.value,
          gmail_senders: get("SELECT value FROM config WHERE key = 'gmail_senders'")?.value,
        };
        const result = await fetchReportsFromGmail(null, config);
        imported = result.length;
      }

      const newAlerts = generateAlerts();
      await sendBatchAlertEmail();

      run(
        "INSERT INTO import_log (source, filename, report_id, status, message) VALUES (?, ?, ?, ?, ?)",
        ['scheduler', '', '', 'success', `Cron exécuté : ${imported} rapport(s), ${newAlerts.length} alerte(s)`]
      );
    } catch (err) {
      console.error(`  [!!] Erreur scheduler: ${err.message}`);
      run(
        "INSERT INTO import_log (source, filename, report_id, status, message) VALUES (?, ?, ?, ?, ?)",
        ['scheduler', '', '', 'error', `Erreur cron : ${err.message}`]
      );
    }
  });

  // Balayage RBL quotidien : les IPs sources actives des 7 derniers jours sont revérifiées
  // (le cache de 24h dans lookupRBL évite de re-solliciter les DNSBL publiques plus d'une
  // fois par jour et par IP). Une alerte est créée pour toute IP qui vient d'apparaître
  // sur liste noire depuis le dernier contrôle.
  cron.schedule('30 3 * * *', async () => {
    console.log('\n[*] Balayage RBL quotidien');
    try {
      const newlyListed = await sweepRecentIPs({ days: 7 });
      const alertMsgs = recordRBLAlerts(newlyListed);
      if (alertMsgs.length > 0) await sendBatchAlertEmail();
      run(
        "INSERT INTO import_log (source, filename, report_id, status, message) VALUES (?, ?, ?, ?, ?)",
        ['rbl_sweep', '', '', 'success', `Balayage RBL : ${alertMsgs.length} nouvelle(s) IP blacklistée(s)`]
      );
    } catch (err) {
      console.error(`  [!!] Erreur balayage RBL: ${err.message}`);
      run(
        "INSERT INTO import_log (source, filename, report_id, status, message) VALUES (?, ?, ?, ?, ?)",
        ['rbl_sweep', '', '', 'error', `Erreur balayage RBL : ${err.message}`]
      );
    }
  });
}

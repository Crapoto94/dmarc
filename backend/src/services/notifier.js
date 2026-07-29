import nodemailer from 'nodemailer';
import { get, all } from '../db.js';

let transporter = null;

function getTransporter() {
  const host = get("SELECT value FROM config WHERE key = 'smtp_host'");
  const user = get("SELECT value FROM config WHERE key = 'smtp_user'");
  const pass = get("SELECT value FROM config WHERE key = 'smtp_pass'");
  const to = get("SELECT value FROM config WHERE key = 'alert_email'");

  if (!host?.value || !user?.value || !pass?.value || !to?.value) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: host.value,
      port: 587,
      secure: false,
      auth: { user: user.value, pass: pass.value },
    });
  }
  return { transporter, to: to.value };
}

export async function sendBatchAlertEmail() {
  const cfg = getTransporter();
  if (!cfg) return;

  const recentAlerts = all(
    "SELECT * FROM alerts WHERE acknowledged = 0 AND created_at > datetime('now', '-1 hour') ORDER BY severity DESC, created_at ASC"
  );
  if (recentAlerts.length === 0) return;

  const bySeverity = { high: [], medium: [], low: [] };
  for (const a of recentAlerts) {
    bySeverity[a.severity]?.push(a);
  }

  const lines = [];
  lines.push(`Rapport DMARC - ${recentAlerts.length} alerte(s) détectée(s)`);
  lines.push(`Période : ${recentAlerts[0].created_at?.slice(0, 19)} → ${recentAlerts[recentAlerts.length - 1].created_at?.slice(0, 19)}`);
  lines.push('');

  for (const sev of ['high', 'medium', 'low']) {
    const alerts = bySeverity[sev];
    if (!alerts?.length) continue;
    lines.push(`[${sev.toUpperCase()}] ${alerts.length} alerte(s)`);
    for (const a of alerts) {
      lines.push(`  • ${a.message}`);
    }
    lines.push('');
  }

  try {
    await cfg.transporter.sendMail({
      from: cfg.to,
      to: cfg.to,
      subject: `[DMARC] ${recentAlerts.length} alerte(s) - ${new Date().toLocaleDateString()}`,
      text: lines.join('\n'),
    });
    console.log(`  [*] Email récapitulatif envoyé (${recentAlerts.length} alertes)`);
  } catch (err) {
    console.error(`  [!] Erreur envoi email récap: ${err.message}`);
  }
}

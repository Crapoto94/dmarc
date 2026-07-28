import nodemailer from 'nodemailer';
import { get } from '../db.js';

let transporter = null;

function getTransporter() {
  const host = get("SELECT value FROM config WHERE key = 'smtp_host'");
  const user = get("SELECT value FROM config WHERE key = 'smtp_user'");
  const pass = get("SELECT value FROM config WHERE key = 'smtp_pass'");
  const to = get("SELECT value FROM config WHERE key = 'alert_email'");

  if (!host || !user || !pass || !to) return null;

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

export async function sendAlertNotification(alert) {
  const cfg = getTransporter();
  if (!cfg) return;

  try {
    await cfg.transporter.sendMail({
      from: cfg.to,
      to: cfg.to,
      subject: `[DMARC Alert] ${alert.severity.toUpperCase()}: ${alert.message.slice(0, 80)}`,
      text: `Type: ${alert.type}\nSévérité: ${alert.severity}\nMessage: ${alert.message}\nDétails: ${alert.details}\nDate: ${alert.created_at}`,
    });
    console.log(`  [*] Notification email envoyée pour alert #${alert.id}`);
  } catch (err) {
    console.error(`  [!] Erreur envoi email: ${err.message}`);
  }
}

export async function sendNewAlerts() {
  const { all } = await import('../db.js');
  const newAlerts = all("SELECT * FROM alerts WHERE acknowledged = 0 AND created_at > datetime('now', '-1 hour')");
  for (const alert of newAlerts) {
    await sendAlertNotification(alert);
  }
}

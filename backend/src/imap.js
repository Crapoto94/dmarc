import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { importReportToDB } from './parser.js';
import { get, run } from './db.js';

const reportsDir = join(import.meta.dirname, '..', 'reports');

export async function fetchReportsFromGmail(_db, config) {
  const user = config.gmail_user;
  const pass = config.gmail_pass;

  if (!user || !pass) {
    console.log('  [!] Gmail non configuré (gmail_user / gmail_pass)');
    return [];
  }

  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const imported = [];

  try {
    await client.connect();
    console.log('  [*] Connecté à Gmail IMAP');
    const lock = await client.getMailboxLock('INBOX');
    try {
      const sinceStr = config.last_fetch_date;
      const since = sinceStr
        ? new Date(sinceStr)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const messages = [];
      for await (const msg of client.fetch({ since }, { envelope: true, source: true })) {
        messages.push(msg);
      }
      console.log(`  [*] ${messages.length} messages trouvés dans INBOX`);

      for (const msg of messages) {
        try {
          const parsed = await simpleParser(msg.source.toString());
          for (const attachment of parsed.attachments || []) {
            const ext = extname(attachment.filename || '').toLowerCase();
            if (['.xml', '.gz', '.zip'].includes(ext)) {
              const filePath = join(reportsDir, attachment.filename);
              writeFileSync(filePath, attachment.content);
              console.log(`  [*] Pièce jointe sauvegardée: ${attachment.filename}`);

              const id = await importReportToDB(filePath, attachment.filename);
              if (id) imported.push(id);
            }
          }
        } catch (parseErr) {
          console.log(`  [!] Erreur parsing message: ${parseErr.message}`);
        }
      }

      run('UPDATE config SET value = ? WHERE key = ?', [new Date().toISOString(), 'last_fetch_date']);
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    console.error(`  [!!] Erreur IMAP: ${err.message}`);
  }

  return imported;
}

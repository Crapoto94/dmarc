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
      for await (const msg of client.fetch(
        { since, seen: false },
        { envelope: true, source: true, uid: true, flags: true }
      )) {
        messages.push(msg);
      }
      console.log(`  [*] ${messages.length} messages non lus trouvés dans INBOX`);

      let processedCount = 0;

      for (const msg of messages) {
        try {
          const parsed = await simpleParser(msg.source.toString());
          let foundAttachment = false;

          for (const attachment of parsed.attachments || []) {
            const ext = extname(attachment.filename || '').toLowerCase();
            if (['.xml', '.gz', '.zip'].includes(ext)) {
              foundAttachment = true;
              const filePath = join(reportsDir, attachment.filename);
              writeFileSync(filePath, attachment.content);
              console.log(`  [*] Pièce jointe trouvée: ${attachment.filename}`);

              const id = await importReportToDB(filePath, attachment.filename);
              if (id) {
                imported.push(id);
                run(
                  "INSERT INTO import_log (source, filename, report_id, status, message) VALUES (?, ?, ?, ?, ?)",
                  ['gmail', attachment.filename, String(id), 'success', 'Importé depuis Gmail']
                );
              }
            }
          }

          if (foundAttachment) {
            processedCount++;
            try {
              await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen']);

              const folderPath = 'DMARC Traités';
              try {
                const mailboxes = await client.list();
                const hasFolder = mailboxes.some(m => m.path === folderPath);
                if (!hasFolder) {
                  await client.mailboxCreate(folderPath);
                }
                await client.messageMove({ uid: msg.uid }, folderPath);
                console.log(`  [→] Message déplacé vers "${folderPath}"`);
              } catch (moveErr) {
                console.log(`  [~] Message marqué comme lu (déplacement impossible: ${moveErr.message})`);
              }
            } catch (flagErr) {
              console.log(`  [!] Impossible de marquer le message: ${flagErr.message}`);
            }
          }
        } catch (parseErr) {
          console.log(`  [!] Erreur parsing message: ${parseErr.message}`);
        }
      }

      console.log(`  [*] ${processedCount} message(s) contenant des rapports traités`);
    } finally {
      lock.release();
    }

    run('UPDATE config SET value = ? WHERE key = ?', [new Date().toISOString(), 'last_fetch_date']);
    await client.logout();
  } catch (err) {
    console.error(`  [!!] Erreur IMAP: ${err.message}`);
    run(
      "INSERT INTO import_log (source, filename, report_id, status, message) VALUES (?, ?, ?, ?, ?)",
      ['gmail', '', '', 'error', `Erreur IMAP: ${err.message}`]
    );
  }

  return imported;
}

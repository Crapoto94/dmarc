import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { importReportToDB } from './parser.js';
import { get, run } from './db.js';

const reportsDir = join(import.meta.dirname, '..', 'reports');

function buildSearchQuery(config) {
  const query = { seen: false };
  const custom = [];

  if (config.last_fetch_date) {
    query.since = new Date(config.last_fetch_date);
  } else {
    query.since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  if (config.gmail_search) {
    custom.push(config.gmail_search);
  }

  if (config.gmail_senders) {
    const senders = config.gmail_senders.split(',').map(s => s.trim()).filter(Boolean);
    for (const s of senders) {
      custom.push(`from:${s}`);
    }
  }

  if (custom.length > 0) {
    query.custom = custom.join(' ');
  }

  return query;
}

export async function fetchReportsFromGmail(_db, config) {
  const user = config.gmail_user;
  const pass = config.gmail_pass;

  if (!user || !pass) {
    console.log('  [!] Gmail non configuré');
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
      const searchQuery = buildSearchQuery(config);
      console.log(`  [*] Recherche: ${JSON.stringify(searchQuery)}`);

      const messages = [];
      for await (const msg of client.fetch(searchQuery, { envelope: true, source: true, uid: true, flags: true })) {
        messages.push(msg);
      }
      console.log(`  [*] ${messages.length} messages non lus avec rapports trouvés`);

      let processedCount = 0;

      for (const msg of messages) {
        try {
          const parsed = await simpleParser(msg.source.toString());
          let foundAttachment = false;

          for (const attachment of parsed.attachments || []) {
            const ext = extname(attachment.filename || '').toLowerCase();
            if (['.xml', '.gz', '.zip'].includes(ext)) {
              foundAttachment = true;
              const safeName = attachment.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
              const filePath = join(reportsDir, safeName);
              writeFileSync(filePath, attachment.content);
              console.log(`  [*] Rapport trouvé: ${safeName}`);

              const id = await importReportToDB(filePath, safeName);
              if (id) {
                imported.push(id);
                run(
                  "INSERT INTO import_log (source, filename, report_id, status, message) VALUES (?, ?, ?, ?, ?)",
                  ['gmail', safeName, String(id), 'success', `Importé depuis Gmail: ${parsed.subject || ''}`]
                );
              }
            }
          }

          if (foundAttachment) {
            processedCount++;
            try {
              await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen']);
              const folderPath = 'DMARC Traités';
              const mailboxes = await client.list();
              if (!mailboxes.some(m => m.path === folderPath)) {
                await client.mailboxCreate(folderPath);
              }
              await client.messageMove({ uid: msg.uid }, folderPath);
              console.log(`  [→] Message déplacé vers "${folderPath}"`);
            } catch (moveErr) {
              console.log(`  [~] Marqué lu (déplacement: ${moveErr.message})`);
            }
          }
        } catch (parseErr) {
          console.log(`  [!] Erreur parsing: ${parseErr.message}`);
        }
      }

      console.log(`  [*] ${processedCount} rapport(s) traités`);
    } finally {
      lock.release();
    }

    run('UPDATE config SET value = ? WHERE key = ?', [new Date().toISOString(), 'last_fetch_date']);
    await client.logout();
  } catch (err) {
    console.error(`  [!!] Erreur IMAP: ${err.message}`);
    run("INSERT INTO import_log (source, filename, report_id, status, message) VALUES (?, ?, ?, ?, ?)",
      ['gmail', '', '', 'error', `Erreur IMAP: ${err.message}`]);
  }

  return imported;
}

export async function markAllRead(config) {
  const user = config.gmail_user;
  const pass = config.gmail_pass;
  if (!user || !pass) return { count: 0 };

  const client = new ImapFlow({
    host: 'imap.gmail.com', port: 993, secure: true,
    auth: { user, pass }, logger: false,
  });

  let count = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const messages = [];
      for await (const msg of client.fetch({ seen: false }, { uid: true })) {
        messages.push(msg);
      }
      for (const msg of messages) {
        await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen']);
        count++;
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    console.error(`[!!] Erreur markAllRead: ${err.message}`);
  }
  return { count };
}

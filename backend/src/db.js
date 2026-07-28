import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'dmarc.db');

if (!existsSync(dirname(dbPath))) {
  mkdirSync(dirname(dbPath), { recursive: true });
}

let db = null;

export async function initDB() {
  const SQL = await initSqlJs();

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys=ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      org_name TEXT,
      email TEXT,
      report_id TEXT UNIQUE,
      domain_id INTEGER,
      policy TEXT,
      sp_policy TEXT,
      pct INTEGER DEFAULT 100,
      begin_ts INTEGER,
      end_ts INTEGER,
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (domain_id) REFERENCES domains(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER,
      source_ip TEXT,
      count INTEGER DEFAULT 0,
      disposition TEXT,
      dkim_eval TEXT,
      spf_eval TEXT,
      header_from TEXT,
      envelope_from TEXT,
      envelope_to TEXT,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS dkim_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER,
      domain TEXT,
      selector TEXT,
      result TEXT,
      FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS spf_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER,
      domain TEXT,
      scope TEXT,
      result TEXT,
      FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      severity TEXT DEFAULT 'info',
      message TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      acknowledged INTEGER DEFAULT 0
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  const count = db.exec("SELECT COUNT(*) as c FROM domains");
  const row = count.length > 0 ? count[0].values[0] : [0];
  if (row[0] === 0) {
    db.run("INSERT OR IGNORE INTO domains (domain) VALUES ('fbc.fr')");
    db.run("INSERT OR IGNORE INTO domains (domain) VALUES ('partyplay.fr')");
  }

  saveDB();
  console.log('  [*] Base de données initialisée');
}

// Only save if not in a transaction (sql.js doesn't support WAL properly)
let inTransaction = false;

export function saveDB() {
  if (db && !inTransaction) {
    const data = db.export();
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    try {
      writeFileSync(dbPath, Buffer.from(data));
    } catch (err) {
      console.error('  [!] Erreur sauvegarde DB:', err.message);
    }
  }
}

function prepare(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  return stmt;
}

export function all(sql, params = []) {
  const stmt = prepare(sql, params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function get(sql, params = []) {
  const rows = all(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function run(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  const lastId = db.exec("SELECT last_insert_rowid() as id");
  const changes = db.getRowsModified();
  if (!inTransaction) saveDB();
  return {
    lastInsertRowid: lastId.length > 0 ? lastId[0].values[0][0] : null,
    changes,
  };
}

export function exec(sql) {
  if (!db) throw new Error('Database not initialized');
  const result = db.exec(sql);
  if (!inTransaction) saveDB();
  return result;
}

export function transaction(fn) {
  if (!db) throw new Error('Database not initialized');
  const wasInTransaction = inTransaction;
  if (!wasInTransaction) {
    inTransaction = true;
    db.run('BEGIN');
  }
  try {
    fn();
    if (!wasInTransaction) {
      db.run('COMMIT');
      inTransaction = false;
      saveDB();
    }
  } catch (err) {
    if (!wasInTransaction) {
      try { db.run('ROLLBACK'); } catch {}
      inTransaction = false;
    }
    throw err;
  }
}

export default { initDB, all, get, run, exec, transaction, saveDB };

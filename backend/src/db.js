import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Résolu à l'appel d'initDB() (pas au chargement du module) pour que les tests
// puissent basculer sur DB_PATH=':memory:' avant d'initialiser la base.
let dbPath = null;

let db = null;

export async function initDB() {
  dbPath = process.env.DB_PATH || join(__dirname, '..', 'data', 'dmarc.db');

  if (dbPath !== ':memory:' && !existsSync(dirname(dbPath))) {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
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
      FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
    )
  `);
  db.exec(`
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS dkim_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER,
      domain TEXT,
      selector TEXT,
      result TEXT,
      FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS spf_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER,
      domain TEXT,
      scope TEXT,
      result TEXT,
      FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
    )
  `);
  db.exec(`
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS ip_cache (
      ip TEXT PRIMARY KEY,
      org TEXT,
      country TEXT,
      isp TEXT,
      asn TEXT,
      looked_up_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS rbl_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      listed INTEGER DEFAULT 0,
      lists TEXT,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_rbl_history_ip ON rbl_history(ip)');
  db.exec(`
    CREATE TABLE IF NOT EXISTS import_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT,
      filename TEXT,
      report_id TEXT,
      status TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT,
      action TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'active',
      source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const userCount = get('SELECT COUNT(*) as c FROM users');
  const adminExists = get("SELECT id FROM users WHERE username = 'admin'");
  if (userCount.c === 0 || !adminExists) {
    const bcrypt = await import('bcryptjs');
    const hash = bcrypt.hashSync('admin', 10);
    run("INSERT OR REPLACE INTO users (username, password, role) VALUES (?, ?, ?)", ['admin', hash, 'admin']);
    console.log('  [*] Utilisateur admin créé par défaut (admin/admin)');
  }

  console.log('  [*] Base de données initialisée');
}

// Conservée pour compatibilité d'API : better-sqlite3 écrit sur disque de façon
// synchrone à chaque requête, il n'y a donc plus d'étape de sauvegarde explicite à faire.
export function saveDB() {}

function prepare(sql) {
  if (!db) throw new Error('Database not initialized');
  return db.prepare(sql);
}

export function all(sql, params = []) {
  return prepare(sql).all(params);
}

export function get(sql, params = []) {
  const row = prepare(sql).get(params);
  return row === undefined ? null : row;
}

export function run(sql, params = []) {
  const info = prepare(sql).run(params);
  return {
    lastInsertRowid: info.lastInsertRowid,
    changes: info.changes,
  };
}

export function exec(sql) {
  if (!db) throw new Error('Database not initialized');
  return db.exec(sql);
}

export function transaction(fn) {
  if (!db) throw new Error('Database not initialized');
  db.transaction(fn)();
}

export function closeDB() {
  if (db) {
    db.close();
    db = null;
  }
}

export default { initDB, all, get, run, exec, transaction, saveDB, closeDB };

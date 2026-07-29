import dns from 'dns';
import { get, all, run } from '../db.js';

const resolve4 = dns.promises.resolve4;

// Listes DNSBL publiques interrogées. zen.spamhaus.org agrège SBL (spam connu),
// XBL (proxies/malwares) et PBL (IP résidentielles ne devant pas envoyer de mail direct).
const ZONES_V4 = ['zen.spamhaus.org', 'b.barracudacentral.org', 'bl.spamcop.net', 'dnsbl.sorbs.net'];
const ZONES_V6 = ['zen.spamhaus.org'];

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const QUERY_TIMEOUT_MS = 4000;

function reverseIPv4(ip) {
  return ip.split('.').reverse().join('.');
}

function expandIPv6(ip) {
  const clean = ip.split('%')[0];
  let headParts, tailParts;
  if (clean.includes('::')) {
    const [head, tail] = clean.split('::');
    headParts = head ? head.split(':') : [];
    tailParts = tail ? tail.split(':') : [];
  } else {
    headParts = clean.split(':');
    tailParts = [];
  }
  const missing = 8 - headParts.length - tailParts.length;
  if (missing < 0) return null;
  const zeros = new Array(missing).fill('0');
  const full = [...headParts, ...zeros, ...tailParts].map(p => p.padStart(4, '0'));
  return full.join('');
}

function reverseIPv6(ip) {
  const hex = expandIPv6(ip);
  if (!hex || hex.length !== 32) return null;
  return hex.split('').reverse().join('.');
}

function queryZone(query) {
  return Promise.race([
    resolve4(query)
      .then(addrs => ({ listed: true, response: addrs[0] }))
      .catch(err => {
        if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') return { listed: false };
        return { listed: false, error: err.code || 'ERR' };
      }),
    new Promise(resolve => setTimeout(() => resolve({ listed: false, timeout: true }), QUERY_TIMEOUT_MS)),
  ]);
}

export async function checkRBL(ip) {
  const isV6 = ip.includes(':');
  const zones = isV6 ? ZONES_V6 : ZONES_V4;
  const reversed = isV6 ? reverseIPv6(ip) : reverseIPv4(ip);

  if (!reversed) {
    const result = { ip, listed: false, lists: [], checked_at: new Date().toISOString(), error: 'invalid_ip' };
    return result;
  }

  const results = await Promise.all(zones.map(async zone => {
    const r = await queryZone(`${reversed}.${zone}`);
    return { zone, ...r };
  }));

  const lists = results.filter(r => r.listed).map(r => r.zone);
  const listed = lists.length > 0;
  const checkedAt = new Date().toISOString();

  run(
    'INSERT INTO rbl_history (ip, listed, lists, checked_at) VALUES (?, ?, ?, ?)',
    [ip, listed ? 1 : 0, JSON.stringify(lists), checkedAt]
  );

  return { ip, listed, lists, checked_at: checkedAt };
}

export function getLatestRBL(ip) {
  const row = get('SELECT * FROM rbl_history WHERE ip = ? ORDER BY id DESC LIMIT 1', [ip]);
  if (!row) return null;
  return {
    ip: row.ip,
    listed: !!row.listed,
    lists: row.lists ? JSON.parse(row.lists) : [],
    checked_at: row.checked_at,
  };
}

export function getRBLHistory(ip, limit = 20) {
  const rows = all('SELECT * FROM rbl_history WHERE ip = ? ORDER BY id DESC LIMIT ?', [ip, limit]);
  return rows.map(row => ({
    listed: !!row.listed,
    lists: row.lists ? JSON.parse(row.lists) : [],
    checked_at: row.checked_at,
  }));
}

// IPs sources actives sur les `days` derniers jours, pour la vérification RBL planifiée.
export function getRecentSourceIPs(days = 7) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const rows = all(`
    SELECT DISTINCT r.source_ip
    FROM records r
    JOIN reports rp ON r.report_id = rp.id
    WHERE rp.begin_ts >= ? AND r.source_ip IS NOT NULL AND r.source_ip != ''
  `, [since]);
  return rows.map(r => r.source_ip);
}

export async function lookupRBL(ip, { maxAgeMs = CACHE_MAX_AGE_MS } = {}) {
  const cached = getLatestRBL(ip);
  if (cached && cached.checked_at) {
    const age = Date.now() - new Date(cached.checked_at).getTime();
    if (age < maxAgeMs) return cached;
  }
  try {
    return await checkRBL(ip);
  } catch {
    return { ip, listed: false, lists: [], checked_at: new Date().toISOString(), error: 'lookup_failed' };
  }
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Balayage planifié : revérifie les IPs sources actives récemment (via le cache 24h de
// lookupRBL, donc chaque IP n'est réellement re-testée qu'une fois par jour), et renvoie
// celles qui viennent de passer en liste noire (n'y étaient pas lors du dernier contrôle).
export async function sweepRecentIPs({ days = 7, concurrency = 5 } = {}) {
  const ips = getRecentSourceIPs(days);
  const newlyListed = [];
  await mapWithConcurrency(ips, concurrency, async (ip) => {
    const before = getLatestRBL(ip);
    const wasListed = before?.listed || false;
    const result = await lookupRBL(ip);
    if (result.listed && !wasListed) newlyListed.push(result);
  });
  return newlyListed;
}

export function recordRBLAlerts(newlyListed) {
  const created = [];
  for (const r of newlyListed) {
    const msg = `IP ${r.ip} détectée sur liste(s) noire(s) : ${r.lists.join(', ')}`;
    const exists = get(
      "SELECT id FROM alerts WHERE type = 'rbl_listed' AND message = ? AND created_at > datetime('now', '-1 day')",
      [msg]
    );
    if (!exists) {
      run(
        "INSERT INTO alerts (type, severity, message, details) VALUES (?, ?, ?, ?)",
        ['rbl_listed', 'high', msg, JSON.stringify(r)]
      );
      created.push(msg);
    }
  }
  return created;
}

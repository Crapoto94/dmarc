import dns from 'dns';
import { get, run } from '../db.js';

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
    'INSERT OR REPLACE INTO rbl_cache (ip, listed, lists, checked_at) VALUES (?, ?, ?, ?)',
    [ip, listed ? 1 : 0, JSON.stringify(lists), checkedAt]
  );

  return { ip, listed, lists, checked_at: checkedAt };
}

export function getRBLCache(ip) {
  const cached = get('SELECT * FROM rbl_cache WHERE ip = ?', [ip]);
  if (!cached) return null;
  return {
    ip: cached.ip,
    listed: !!cached.listed,
    lists: cached.lists ? JSON.parse(cached.lists) : [],
    checked_at: cached.checked_at,
  };
}

export async function lookupRBL(ip, { maxAgeMs = CACHE_MAX_AGE_MS } = {}) {
  const cached = getRBLCache(ip);
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

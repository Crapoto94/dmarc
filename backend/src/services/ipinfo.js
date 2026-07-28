import { get, run } from '../db.js';

export async function lookupIP(ip) {
  const cached = get('SELECT * FROM ip_cache WHERE ip = ?', [ip]);
  if (cached && cached.org) return cached;

  const controllers = [];
  const signals = [];

  try {
    const ac = new AbortController();
    controllers.push(ac);
    const timeout = setTimeout(() => ac.abort(), 5000);

    const res = await fetch(`https://rdap.org/ip/${ip}`, { signal: ac.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const org = extractOrgRDAP(data);
      const country = extractCountryRDAP(data);
      const asn = extractASNRDAP(data);
      run(
        'INSERT OR REPLACE INTO ip_cache (ip, org, country, isp, asn) VALUES (?, ?, ?, ?, ?)',
        [ip, org || 'Inconnu', country || '', org || 'Inconnu', asn || '']
      );
      return { ip, org: org || 'Inconnu', country: country || '', isp: org || 'Inconnu', asn: asn || '' };
    }
  } catch {}

  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 5000);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=org,country,isp,as,query`, { signal: ac.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const org = data.org || '';
      run(
        'INSERT OR REPLACE INTO ip_cache (ip, org, country, isp, asn) VALUES (?, ?, ?, ?, ?)',
        [ip, org || 'Inconnu', data.country || '', data.isp || '', data.as || '']
      );
      return { ip, org: org || 'Inconnu', country: data.country || '', isp: data.isp || '', asn: data.as || '' };
    }
  } catch {}

  const fallback = { ip, org: 'Inconnu', country: '', isp: '', asn: '' };
  run('INSERT OR REPLACE INTO ip_cache (ip, org, country, isp, asn) VALUES (?, ?, ?, ?, ?)',
    [ip, 'Inconnu', '', '', '']);
  return fallback;
}

function extractOrgRDAP(data) {
  if (data?.entities) {
    for (const e of data.entities) {
      if (e?.vcardArray?.[1]) {
        for (const v of e.vcardArray[1]) {
          if (v[0] === 'fn') return v[3];
        }
      }
    }
  }
  return '';
}

function extractCountryRDAP(data) {
  return data?.country || '';
}

function extractASNRDAP(data) {
  if (data?.entities) {
    for (const e of data.entities) {
      if (e?.handle?.startsWith('AS')) return e.handle;
    }
  }
  return '';
}

export function getIPInfo(ip) {
  const cached = get('SELECT * FROM ip_cache WHERE ip = ?', [ip]);
  if (cached) return cached;
  return { ip, org: 'Inconnu', country: '', isp: '', asn: '' };
}

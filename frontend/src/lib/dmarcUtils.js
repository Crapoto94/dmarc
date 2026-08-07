export function orgDomain(domain) {
  if (!domain) return '';
  const d = String(domain).toLowerCase().replace(/\.$/, '');
  const parts = d.split('.');
  if (parts.length <= 2) return d;
  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  const ccTLD = ['uk', 'au', 'br', 'co', 'jp', 'nz', 'za', 'fr', 'ca', 'mx', 'in', 'id', 'kr', 'ar', 'cl', 'pe', 'ua', 'th', 'my', 'sg', 'hk', 'tw', 'cn', 'ie', 'nl', 'de'];
  if (ccTLD.includes(tld) && ['co', 'com', 'net', 'org', 'gov', 'edu', 'gouv', 'ac', 'ne', 'school', 'parl', 'nom', 'gob'].includes(sld)) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

export function isAligned(authDomain, headerFrom) {
  if (!authDomain || !headerFrom) return false;
  const a = orgDomain(authDomain);
  const h = orgDomain(headerFrom);
  return a !== '' && a === h;
}

export function analyzeRecord(rec = {}) {
  const headerFrom = rec.header_from || '';
  const spfList = rec.spf_results || [];
  const spfEntry = spfList.find(s => s.scope === 'mfrom') || spfList[0];
  const spfDomain = spfEntry?.domain || '';
  const spfResult = spfEntry?.result || rec.spf_eval || '';
  const spfAligned = spfResult === 'pass' && isAligned(spfDomain, headerFrom);

  const dkimList = rec.dkim_results || [];
  const dkimEntry = dkimList.find(d => d.result === 'pass') || dkimList[0];
  const dkimDomain = dkimEntry?.domain || '';
  const dkimSelector = dkimEntry?.selector || '';
  const dkimResult = dkimEntry?.result || rec.dkim_eval || '';
  const dkimAligned = dkimResult === 'pass' && isAligned(dkimDomain, headerFrom);

  return {
    source_ip: rec.source_ip || '',
    headerFrom,
    count: rec.count ?? 0,
    begin_ts: rec.begin_ts,
    org_name: rec.org_name || '',
    ip_org: rec.ip_org || rec.ip_isp || '',
    ip_country: rec.ip_country || '',
    disposition: rec.disposition || '',
    spfDomain, spfResult, spfAligned,
    dkimDomain, dkimSelector, dkimResult, dkimAligned,
    dmarcResult: spfAligned || dkimAligned ? 'pass' : 'fail',
  };
}

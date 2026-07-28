import { all, get, run, transaction } from '../db.js';

export function getGlobalStats() {
  const totalEmails = get('SELECT COALESCE(SUM(count), 0) as total FROM records');
  const passEmails = get("SELECT COALESCE(SUM(count), 0) as total FROM records WHERE dkim_eval = 'pass' AND spf_eval = 'pass'");
  const failEmails = get("SELECT COALESCE(SUM(count), 0) as total FROM records WHERE dkim_eval != 'pass' OR spf_eval != 'pass'");
  const reportCount = get('SELECT COUNT(*) as c FROM reports');
  const domainCount = get('SELECT COUNT(*) as c FROM domains');
  const uniqueSourceIPs = get('SELECT COUNT(DISTINCT source_ip) as c FROM records');

  return {
    total_emails: totalEmails.total,
    pass_emails: passEmails.total,
    fail_emails: failEmails.total,
    pass_pct: totalEmails.total > 0 ? Math.round((passEmails.total / totalEmails.total) * 100) : 0,
    report_count: reportCount.c,
    domain_count: domainCount.c,
    unique_source_ips: uniqueSourceIPs.c,
  };
}

export function getDomains() {
  return all(`
    SELECT d.*,
      (SELECT COUNT(*) FROM reports WHERE domain_id = d.id) as report_count,
      (SELECT COALESCE(SUM(r.count), 0) FROM records r JOIN reports rp ON r.report_id = rp.id WHERE rp.domain_id = d.id) as total_emails
    FROM domains d ORDER BY d.domain
  `);
}

export function getDomainDetail(domainId) {
  const domain = get('SELECT * FROM domains WHERE id = ?', [domainId]);
  if (!domain) return null;

  const reports = all('SELECT * FROM reports WHERE domain_id = ? ORDER BY begin_ts DESC', [domainId]);

  const stats = get(`
    SELECT
      COALESCE(SUM(r.count), 0) as total,
      COALESCE(SUM(CASE WHEN r.dkim_eval = 'pass' AND r.spf_eval = 'pass' THEN r.count ELSE 0 END), 0) as pass,
      COALESCE(SUM(CASE WHEN r.dkim_eval != 'pass' OR r.spf_eval != 'pass' THEN r.count ELSE 0 END), 0) as fail
    FROM records r JOIN reports rp ON r.report_id = rp.id
    WHERE rp.domain_id = ?
  `, [domainId]);

  return { ...domain, reports, stats };
}

export function getTimeline(days = 90) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  return all(`
    SELECT
      rp.begin_ts, rp.end_ts, rp.org_name, rp.domain,
      r.disposition, SUM(r.count) as total,
      SUM(CASE WHEN r.dkim_eval = 'pass' AND r.spf_eval = 'pass' THEN r.count ELSE 0 END) as pass,
      SUM(CASE WHEN r.dkim_eval != 'pass' OR r.spf_eval != 'pass' THEN r.count ELSE 0 END) as fail
    FROM records r
    JOIN reports rp ON r.report_id = rp.id
    WHERE rp.begin_ts >= ?
    GROUP BY rp.id, r.disposition
    ORDER BY rp.begin_ts ASC
  `, [since]);
}

export function getTopSources(limit = 20) {
  return all(`
    SELECT source_ip,
      SUM(count) as total,
      SUM(CASE WHEN dkim_eval = 'pass' AND spf_eval = 'pass' THEN count ELSE 0 END) as pass,
      SUM(CASE WHEN dkim_eval != 'pass' OR spf_eval != 'pass' THEN count ELSE 0 END) as fail,
      COUNT(DISTINCT header_from) as domains_used,
      GROUP_CONCAT(DISTINCT header_from) as domain_list
    FROM records
    GROUP BY source_ip
    ORDER BY total DESC
    LIMIT ?
  `, [limit]);
}

export function getUnauthorizedActivity() {
  return all(`
    SELECT r.source_ip, r.count, r.header_from, r.dkim_eval, r.spf_eval,
      r.envelope_from, r.disposition, rp.org_name, COALESCE(d.domain, '?') as report_domain
    FROM records r
    JOIN reports rp ON r.report_id = rp.id
    LEFT JOIN domains d ON rp.domain_id = d.id
    WHERE r.dkim_eval != 'pass' OR r.spf_eval != 'pass'
    ORDER BY r.count DESC
  `);
}

export function getDispositionBreakdown() {
  return all(`
    SELECT disposition, SUM(count) as total
    FROM records
    GROUP BY disposition
  `);
}

export function getServiceIdentification() {
  return all(`
    SELECT DISTINCT d.domain as dkim_domain, d.selector, d.result
    FROM dkim_results d WHERE d.result = 'pass'
  `);
}

export function getAlerts(acknowledged = 0) {
  return all('SELECT * FROM alerts WHERE acknowledged = ? ORDER BY created_at DESC', [acknowledged]);
}

export function getAllAlerts() {
  return all('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 100');
}

export function acknowledgeAlert(id) {
  run('UPDATE alerts SET acknowledged = 1 WHERE id = ?', [id]);
}

export function generateAlerts() {
  const unauthorized = getUnauthorizedActivity();
  const newAlerts = [];

  for (const u of unauthorized) {
    if (u.dkim_eval !== 'pass' && u.spf_eval !== 'pass') {
      const msg = `Échec DKIM et SPF: ${u.header_from} depuis ${u.source_ip} (${u.count} emails)`;
      const exists = get('SELECT id FROM alerts WHERE message = ?', [msg]);
      if (!exists) {
        run("INSERT INTO alerts (type, severity, message, details) VALUES (?, ?, ?, ?)", [
          'auth_failure', 'high', msg, JSON.stringify(u)
        ]);
        newAlerts.push(msg);
      }
    } else if (u.dkim_eval !== 'pass' || u.spf_eval !== 'pass') {
      const which = u.dkim_eval !== 'pass' ? 'DKIM' : 'SPF';
      const msg = `Échec ${which}: ${u.header_from} depuis ${u.source_ip} (${u.count} emails)`;
      const exists = get('SELECT id FROM alerts WHERE message = ?', [msg]);
      if (!exists) {
        run("INSERT INTO alerts (type, severity, message, details) VALUES (?, ?, ?, ?)", [
          'partial_auth_failure', 'medium', msg, JSON.stringify(u)
        ]);
        newAlerts.push(msg);
      }
    }
  }

  const policies = all('SELECT DISTINCT policy FROM reports');
  const hasNone = policies.some(p => p.policy === 'none');
  if (hasNone) {
    const msg = 'Politique DMARC en "none" - pensez à passer à "quarantine" puis "reject"';
    const exists = get('SELECT id FROM alerts WHERE type = ?', ['policy_recommendation']);
    if (!exists) {
      run("INSERT INTO alerts (type, severity, message, details) VALUES (?, ?, ?, ?)", [
        'policy_recommendation', 'info', msg, 'Recommandation: renforcez votre politique DMARC'
      ]);
      newAlerts.push(msg);
    }
  }

  return newAlerts;
}

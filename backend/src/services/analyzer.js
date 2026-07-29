import { all, get, run } from '../db.js';

export function getGlobalStats() {
  const totalEmails = get('SELECT COALESCE(SUM(count), 0) as total FROM records');
  const passEmails = get("SELECT COALESCE(SUM(count), 0) as total FROM records WHERE dkim_eval = 'pass' AND spf_eval = 'pass'");
  const dkimOnlyPass = get("SELECT COALESCE(SUM(count), 0) as total FROM records WHERE dkim_eval = 'pass' AND spf_eval != 'pass'");
  const spfOnlyPass = get("SELECT COALESCE(SUM(count), 0) as total FROM records WHERE dkim_eval != 'pass' AND spf_eval = 'pass'");
  const bothFail = get("SELECT COALESCE(SUM(count), 0) as total FROM records WHERE dkim_eval != 'pass' AND spf_eval != 'pass'");
  const reportCount = get('SELECT COUNT(*) as c FROM reports');
  const domainCount = get('SELECT COUNT(*) as c FROM domains');
  const uniqueSourceIPs = get('SELECT COUNT(DISTINCT source_ip) as c FROM records');
  const period = get('SELECT MIN(begin_ts) as min_ts, MAX(end_ts) as max_ts FROM reports');
  const dispositionStats = all('SELECT disposition, COALESCE(SUM(count), 0) as total FROM records GROUP BY disposition');
  const topHeaderFrom = all('SELECT header_from, COALESCE(SUM(count), 0) as total FROM records GROUP BY header_from ORDER BY total DESC LIMIT 10');
  const dkimFailReasons = all("SELECT result, COUNT(*) as cnt, COALESCE(SUM(r.count), 0) as total FROM dkim_results d JOIN records r ON d.record_id = r.id WHERE d.result != 'pass' GROUP BY d.result");

  return {
    total_emails: totalEmails.total,
    pass_emails: passEmails.total,
    dkim_only_pass: dkimOnlyPass.total,
    spf_only_pass: spfOnlyPass.total,
    both_fail: bothFail.total,
    pass_pct: totalEmails.total > 0 ? Math.round((passEmails.total / totalEmails.total) * 100) : 0,
    fail_pct: totalEmails.total > 0 ? Math.round(((totalEmails.total - passEmails.total) / totalEmails.total) * 100) : 0,
    report_count: reportCount.c,
    domain_count: domainCount.c,
    unique_source_ips: uniqueSourceIPs.c,
    period_begin: period?.min_ts ? new Date(period.min_ts * 1000).toISOString() : null,
    period_end: period?.max_ts ? new Date(period.max_ts * 1000).toISOString() : null,
    dispositions: dispositionStats,
    top_header_from: topHeaderFrom,
    dkim_fail_reasons: dkimFailReasons,
  };
}

export function getEmailDetails() {
  const byDomain = all(`
    SELECT header_from as domain,
      COALESCE(SUM(count), 0) as total,
      COALESCE(SUM(CASE WHEN dkim_eval = 'pass' AND spf_eval = 'pass' THEN count ELSE 0 END), 0) as full_pass,
      COALESCE(SUM(CASE WHEN dkim_eval = 'pass' AND spf_eval != 'pass' THEN count ELSE 0 END), 0) as dkim_only,
      COALESCE(SUM(CASE WHEN dkim_eval != 'pass' AND spf_eval = 'pass' THEN count ELSE 0 END), 0) as spf_only,
      COALESCE(SUM(CASE WHEN dkim_eval != 'pass' AND spf_eval != 'pass' THEN count ELSE 0 END), 0) as both_fail,
      COUNT(DISTINCT source_ip) as sources_count
    FROM records
    GROUP BY header_from
    ORDER BY total DESC
  `);

  const byIP = all(`
    SELECT source_ip, header_from,
      COALESCE(SUM(count), 0) as total,
      COALESCE(SUM(CASE WHEN dkim_eval = 'pass' AND spf_eval = 'pass' THEN count ELSE 0 END), 0) as pass,
      COALESCE(SUM(CASE WHEN dkim_eval != 'pass' OR spf_eval != 'pass' THEN count ELSE 0 END), 0) as fail,
      dkim_eval, spf_eval, disposition
    FROM records
    GROUP BY source_ip
    ORDER BY total DESC
  `);

  return { byDomain, byIP };
}

export function getDomains() {
  return all(`
    SELECT d.*,
      (SELECT COUNT(*) FROM reports WHERE domain_id = d.id) as report_count,
      (SELECT COALESCE(SUM(r.count), 0) FROM records r JOIN reports rp ON r.report_id = rp.id WHERE rp.domain_id = d.id) as total_emails,
      (SELECT COALESCE(SUM(CASE WHEN r.dkim_eval = 'pass' AND r.spf_eval = 'pass' THEN r.count ELSE 0 END), 0)
       FROM records r JOIN reports rp ON r.report_id = rp.id WHERE rp.domain_id = d.id) as pass_emails,
      (SELECT COALESCE(SUM(CASE WHEN r.dkim_eval != 'pass' OR r.spf_eval != 'pass' THEN r.count ELSE 0 END), 0)
       FROM records r JOIN reports rp ON r.report_id = rp.id WHERE rp.domain_id = d.id) as fail_emails
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
      COALESCE(SUM(CASE WHEN r.dkim_eval != 'pass' OR r.spf_eval != 'pass' THEN r.count ELSE 0 END), 0) as fail,
      COALESCE(SUM(CASE WHEN r.dkim_eval = 'pass' AND r.spf_eval != 'pass' THEN r.count ELSE 0 END), 0) as dkim_only,
      COALESCE(SUM(CASE WHEN r.dkim_eval != 'pass' AND r.spf_eval = 'pass' THEN r.count ELSE 0 END), 0) as spf_only,
      COALESCE(SUM(CASE WHEN r.dkim_eval != 'pass' AND r.spf_eval != 'pass' THEN r.count ELSE 0 END), 0) as both_fail
    FROM records r JOIN reports rp ON r.report_id = rp.id
    WHERE rp.domain_id = ?
  `, [domainId]);

  const senders = all(`
    SELECT header_from, source_ip, SUM(count) as total,
      GROUP_CONCAT(DISTINCT dkim_eval) as dkim_evals,
      GROUP_CONCAT(DISTINCT spf_eval) as spf_evals
    FROM records r JOIN reports rp ON r.report_id = rp.id
    WHERE rp.domain_id = ?
    GROUP BY header_from, source_ip
    ORDER BY total DESC
  `, [domainId]);

  return { ...domain, reports, stats, senders };
}

export function getTimeline(days = 90) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  return all(`
    SELECT
      rp.begin_ts, rp.end_ts, rp.org_name, rp.filename,
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
  return all('SELECT disposition, SUM(count) as total FROM records GROUP BY disposition');
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
        run("INSERT INTO alerts (type, severity, message, details) VALUES (?, ?, ?, ?)",
          ['auth_failure', 'high', msg, JSON.stringify(u)]);
        newAlerts.push(msg);
      }
    } else if (u.dkim_eval !== 'pass' || u.spf_eval !== 'pass') {
      const which = u.dkim_eval !== 'pass' ? 'DKIM' : 'SPF';
      const msg = `Échec ${which}: ${u.header_from} depuis ${u.source_ip} (${u.count} emails)`;
      const exists = get('SELECT id FROM alerts WHERE message = ?', [msg]);
      if (!exists) {
        run("INSERT INTO alerts (type, severity, message, details) VALUES (?, ?, ?, ?)",
          ['partial_auth_failure', 'medium', msg, JSON.stringify(u)]);
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
      run("INSERT INTO alerts (type, severity, message, details) VALUES (?, ?, ?, ?)",
        ['policy_recommendation', 'info', msg, 'Recommandation: renforcez votre politique DMARC']);
      newAlerts.push(msg);
    }
  }

  return newAlerts;
}

export function generateRecommendations() {
  const recs = [];
  const stats = getGlobalStats();
  const emailDetails = getEmailDetails();
  const policies = all('SELECT DISTINCT policy, domain FROM reports r JOIN domains d ON r.domain_id = d.id');

  const hasQuarantine = policies.some(p => p.policy === 'quarantine');
  const hasReject = policies.some(p => p.policy === 'reject');
  const hasNone = policies.some(p => p.policy === 'none');

  if (hasNone) {
    recs.push({
      priority: 'high',
      category: 'Politique DMARC',
      title: 'Passer de p=none à p=quarantine',
      detail: 'Votre politique DMARC est en "none" (aucune action). Les emails non authentifiés sont délivrés normalement. Passez d\'abord en "quarantine" pour mettre les suspend puis en "reject" après validation.',
      action: 'Mettez à jour votre enregistrement DNS DMARC : v=DMARC1; p=quarantine; sp=quarantine; pct=100; rua=mailto:dmarc@votre-domaine.fr',
    });
  }

  for (const d of emailDetails.byDomain) {
    if (d.dkim_only > 0) {
      recs.push({
        priority: d.dkim_only > 100 ? 'high' : 'medium',
        category: 'SPF',
        title: `SPF manquant pour ${d.domain}`,
        detail: `${d.dkim_only} emails de ${d.domain} ont échoué SPF mais réussi DKIM. Ajoutez l'IP source dans votre politique SPF.`,
        action: `Ajoutez les IPs émettrices dans l'enregistrement SPF de ${d.domain}`,
      });
    }
    if (d.spf_only > 0) {
      recs.push({
        priority: d.spf_only > 100 ? 'high' : 'medium',
        category: 'DKIM',
        title: `DKIM manquant pour ${d.domain}`,
        detail: `${d.spf_only} emails de ${d.domain} ont échoué DKIM mais réussi SPF. Vérifiez la signature DKIM.`,
        action: `Configurez DKIM pour ${d.domain} et vérifiez les sélecteurs`,
      });
    }
    if (d.both_fail > 0) {
      recs.push({
        priority: 'high',
        category: 'Authentification',
        title: `Aucune authentification pour ${d.domain}`,
        detail: `${d.both_fail} emails de ${d.domain} ont échoué DKIM ET SPF. Cela peut indiquer une usurpation ou une mauvaise configuration.`,
        action: `Analysez les sources IP pour ${d.domain} et configurez DKIM/SPF ou bloquez ces expéditeurs`,
      });
    }
  }

  if (stats.dkim_fail_reasons?.length > 0) {
    for (const r of stats.dkim_fail_reasons) {
      if (r.result === 'fail' && r.total > 0) {
        recs.push({
          priority: 'medium',
          category: 'DKIM',
          title: `Échecs DKIM (${r.result}: ${r.total} emails)`,
          detail: `${r.cnt} signatures DKIM en échec pour ${r.total} emails. Vérifiez vos sélecteurs DKIM.`,
          action: 'Vérifiez que vos enregistrements DNS DKIM sont corrects et que les clés sont valides',
        });
      }
    }
  }

  if (stats.pass_pct < 95) {
    recs.push({
      priority: 'info',
      category: 'Général',
      title: `Taux d'authentification: ${stats.pass_pct}%`,
      detail: `${stats.fail_emails} emails sur ${stats.total_emails} ne sont pas authentifiés. Objectif: > 95%.`,
      action: 'Identifiez et corrigez les sources non authentifiées',
    });
  }

  if (!hasReject && (hasQuarantine || hasNone)) {
    recs.push({
      priority: 'low',
      category: 'Politique DMARC',
      title: 'Passer à p=reject',
      detail: 'La politique "reject" est la plus sécurisée. Les emails non authentifiés sont rejetés par le serveur destinataire.',
      action: 'v=DMARC1; p=reject; sp=reject; pct=100; rua=mailto:dmarc@votre-domaine.fr',
    });
  }

  return recs;
}

export function getImportLog(limit = 50) {
  return all('SELECT * FROM import_log ORDER BY created_at DESC LIMIT ?', [limit]);
}

export function getMonthlyComparison() {
  return all(`
    SELECT
      strftime('%Y-%m', datetime(rp.begin_ts, 'unixepoch')) as month,
      COALESCE(SUM(r.count), 0) as total,
      COALESCE(SUM(CASE WHEN r.dkim_eval = 'pass' AND r.spf_eval = 'pass' THEN r.count ELSE 0 END), 0) as pass,
      COALESCE(SUM(CASE WHEN r.dkim_eval != 'pass' OR r.spf_eval != 'pass' THEN r.count ELSE 0 END), 0) as fail
    FROM records r
    JOIN reports rp ON r.report_id = rp.id
    GROUP BY month
    ORDER BY month ASC
  `);
}

export function getNewSenders(days = 90) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const firstSeen = Math.floor(Date.now() / 1000) - 7 * 86400;

  const allSenders = all(`
    SELECT source_ip, header_from, MIN(rp.begin_ts) as first_seen,
      COALESCE(SUM(r.count), 0) as total,
      COALESCE(SUM(CASE WHEN r.dkim_eval = 'pass' AND r.spf_eval = 'pass' THEN r.count ELSE 0 END), 0) as pass
    FROM records r
    JOIN reports rp ON r.report_id = rp.id
    WHERE rp.begin_ts >= ?
    GROUP BY source_ip, header_from
    HAVING first_seen >= ?
    ORDER BY total DESC
  `, [since, firstSeen]);

  return allSenders;
}

export function getOverview() {
  const stats = getGlobalStats();
  const monthly = getMonthlyComparison();
  const newSenders = getNewSenders();
  const topDomains = all(`
    SELECT header_from, SUM(count) as total,
      SUM(CASE WHEN dkim_eval = 'pass' AND spf_eval = 'pass' THEN count ELSE 0 END) as pass
    FROM records
    GROUP BY header_from
    ORDER BY total DESC
    LIMIT 15
  `);
  return { stats, monthly, newSenders, topDomains };
}

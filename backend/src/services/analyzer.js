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

  newAlerts.push(...detectNonConformSources());

  return newAlerts;
}

// Alerte (une seule fois par source, indépendamment du volume) dès qu'une plateforme
// d'envoi (cf. SOURCE_EXPR, "Par source" dans Délivrabilité) échoue DKIM ET SPF.
export function detectNonConformSources() {
  const rows = all(`
    SELECT ${SOURCE_EXPR} as source, r.header_from, COALESCE(SUM(r.count), 0) as total
    FROM records r
    JOIN reports rp ON r.report_id = rp.id
    WHERE ${DELIVERABILITY_CATEGORIES.nonconforme}
    GROUP BY ${SOURCE_EXPR}, r.header_from
    HAVING total > 0
    ORDER BY total DESC
  `);

  const newAlerts = [];
  for (const row of rows) {
    const msg = `Nouvelle source non conforme détectée : ${row.source} (domaine ${row.header_from})`;
    const exists = get("SELECT id FROM alerts WHERE type = 'nonconforming_source' AND message = ?", [msg]);
    if (!exists) {
      run(
        "INSERT INTO alerts (type, severity, message, details) VALUES (?, ?, ?, ?)",
        ['nonconforming_source', 'high', msg, JSON.stringify(row)]
      );
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

  recs.push(...detectDkimSelectorIssues());

  return recs;
}

// Analyse les sélecteurs DKIM (partie "s=" de la signature, ex: selector1._domainkey.exemple.fr) :
// - sélecteurs en échec récurrent sur les 30 derniers jours (clé DNS absente/incorrecte)
// - sélecteurs qui validaient des emails il y a 30-60 jours mais ont disparu des rapports
//   récents (rotation en cours ou mal terminée)
export function detectDkimSelectorIssues() {
  const recs = [];
  const now = Math.floor(Date.now() / 1000);
  const recentSince = now - 30 * 86400;
  const priorSince = now - 60 * 86400;

  const recent = all(`
    SELECT dk.domain, dk.selector,
      COALESCE(SUM(CASE WHEN dk.result = 'pass' THEN r.count ELSE 0 END), 0) as pass_total,
      COALESCE(SUM(CASE WHEN dk.result != 'pass' THEN r.count ELSE 0 END), 0) as fail_total
    FROM dkim_results dk
    JOIN records r ON dk.record_id = r.id
    JOIN reports rp ON r.report_id = rp.id
    WHERE dk.selector IS NOT NULL AND dk.selector != '' AND rp.begin_ts >= ?
    GROUP BY dk.domain, dk.selector
  `, [recentSince]);

  for (const s of recent) {
    const total = s.pass_total + s.fail_total;
    if (total < 5) continue;
    const failRatio = s.fail_total / total;
    if (failRatio >= 0.5) {
      recs.push({
        priority: failRatio >= 0.9 ? 'high' : 'medium',
        category: 'DKIM',
        title: `Sélecteur DKIM "${s.selector}" en échec récurrent pour ${s.domain}`,
        detail: `${s.fail_total} emails sur ${total} échouent la validation DKIM avec le sélecteur "${s.selector}" (${Math.round(failRatio * 100)}% d'échec sur les 30 derniers jours).`,
        action: `Vérifiez que l'enregistrement DNS ${s.selector}._domainkey.${s.domain} publie bien la clé publique correspondant à la clé privée utilisée pour signer. Si la clé a été régénérée, une rotation est probablement nécessaire.`,
      });
    }
  }

  const priorSelectors = all(`
    SELECT DISTINCT dk.domain, dk.selector
    FROM dkim_results dk
    JOIN records r ON dk.record_id = r.id
    JOIN reports rp ON r.report_id = rp.id
    WHERE dk.selector IS NOT NULL AND dk.selector != '' AND dk.result = 'pass'
      AND rp.begin_ts >= ? AND rp.begin_ts < ?
  `, [priorSince, recentSince]);

  const recentSelectorSet = new Set(recent.map(s => `${s.domain}::${s.selector}`));
  for (const p of priorSelectors) {
    if (!recentSelectorSet.has(`${p.domain}::${p.selector}`)) {
      recs.push({
        priority: 'low',
        category: 'DKIM',
        title: `Sélecteur DKIM "${p.selector}" disparu pour ${p.domain}`,
        detail: `Le sélecteur "${p.selector}" validait des emails de ${p.domain} il y a 30 à 60 jours mais n'apparaît plus dans les rapports récents. Cela peut être une rotation normale, ou un souci de configuration si ce n'est pas planifié.`,
        action: `Confirmez que la rotation du sélecteur DKIM "${p.selector}" pour ${p.domain} est intentionnelle, et que le nouveau sélecteur est bien publié en DNS et utilisé pour signer.`,
      });
    }
  }

  return recs;
}

export function generateAndStoreRecommendations() {
  const recs = generateRecommendations();

  run("UPDATE recommendations SET status = 'obsolete' WHERE status = 'active'");

  for (const r of recs) {
    const existing = get("SELECT id FROM recommendations WHERE title = ? AND status != 'obsolete'", [r.title]);
    if (!existing) {
      run(
        "INSERT INTO recommendations (category, title, detail, action, priority, status, source) VALUES (?, ?, ?, ?, ?, 'active', 'auto')",
        [r.category, r.title, r.detail, r.action, r.priority]
      );
    } else {
      run("UPDATE recommendations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [existing.id]);
    }
  }

  run("DELETE FROM recommendations WHERE status = 'obsolete'");
}

export function getRecommendationsList(status = 'active') {
  let recs;
  if (status === 'all') {
    recs = all("SELECT * FROM recommendations ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC");
  } else {
    recs = all("SELECT * FROM recommendations WHERE status = ? ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC", [status]);
  }
  return recs.map(r => ({
    ...r,
    priority: r.priority || 'medium',
    status: r.status || 'active',
  }));
}

export function updateRecommendationStatus(id, status) {
  run("UPDATE recommendations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, id]);
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

const DELIVERABILITY_CATEGORIES = {
  perfect: "r.dkim_eval='pass' AND r.spf_eval='pass'",
  dkim: "r.dkim_eval='pass' AND r.spf_eval!='pass'",
  spf: "r.dkim_eval!='pass' AND r.spf_eval='pass'",
  nonconforme: "r.dkim_eval!='pass' AND r.spf_eval!='pass'",
};

export function getDeliverabilityByDomain({ domain = '', category = 'perfect', page = 1, pageSize = 10, search = '' } = {}) {
  const baseParams = [];
  let baseWhere = '1=1';
  if (domain) {
    baseWhere += ' AND d.domain = ?';
    baseParams.push(domain);
  }
  if (search) {
    baseWhere += ' AND (r.header_from LIKE ? OR r.source_ip LIKE ? OR rp.org_name LIKE ?)';
    baseParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const counts = {};
  for (const [key, cond] of Object.entries(DELIVERABILITY_CATEGORIES)) {
    const row = get(`
      SELECT COALESCE(SUM(r.count), 0) as total
      FROM records r JOIN reports rp ON r.report_id = rp.id LEFT JOIN domains d ON rp.domain_id = d.id
      WHERE ${baseWhere} AND ${cond}
    `, baseParams);
    counts[key] = row.total;
  }

  const activeCond = DELIVERABILITY_CATEGORIES[category] || DELIVERABILITY_CATEGORIES.perfect;

  const timeline = all(`
    SELECT strftime('%Y-%m-%d', datetime(rp.begin_ts, 'unixepoch')) as day,
      COALESCE(SUM(r.count), 0) as total
    FROM records r JOIN reports rp ON r.report_id = rp.id LEFT JOIN domains d ON rp.domain_id = d.id
    WHERE ${baseWhere} AND ${activeCond}
    GROUP BY day ORDER BY day ASC
  `, baseParams);

  const totalRow = get(`
    SELECT COUNT(*) as c
    FROM records r JOIN reports rp ON r.report_id = rp.id LEFT JOIN domains d ON rp.domain_id = d.id
    WHERE ${baseWhere} AND ${activeCond}
  `, baseParams);

  const offset = (Math.max(page, 1) - 1) * pageSize;
  const records = all(`
    SELECT r.id, r.source_ip, r.count, r.disposition, r.dkim_eval, r.spf_eval, r.header_from, r.envelope_from,
      rp.org_name, rp.begin_ts, rp.policy,
      ic.org as ip_org, ic.country as ip_country, ic.isp as ip_isp, ic.asn as ip_asn
    FROM records r
    JOIN reports rp ON r.report_id = rp.id
    LEFT JOIN domains d ON rp.domain_id = d.id
    LEFT JOIN ip_cache ic ON ic.ip = r.source_ip
    WHERE ${baseWhere} AND ${activeCond}
    ORDER BY rp.begin_ts DESC
    LIMIT ? OFFSET ?
  `, [...baseParams, pageSize, offset]);

  for (const rec of records) {
    rec.dkim_results = all('SELECT domain, selector, result FROM dkim_results WHERE record_id = ?', [rec.id]);
    rec.spf_results = all('SELECT domain, scope, result FROM spf_results WHERE record_id = ?', [rec.id]);
  }

  return { counts, timeline, records, total: totalRow.c, page, pageSize };
}

// Identifie la plateforme d'envoi (ESP) réelle d'un enregistrement. Le domaine SPF
// (ex: sender-sib.com pour Brevo, mailjet.com...) est le signal le plus fiable car le
// domaine DKIM correspond souvent simplement au domaine du client (auto-signature),
// ce qui n'apprend rien sur l'expéditeur technique. On retombe sur DKIM, puis sur le
// domaine de l'enveloppe, puis enfin sur header_from (envoi "en direct", sans ESP tiers
// identifiable) pour éviter de classer trop d'enregistrements en "inconnu".
const SOURCE_EXPR = `COALESCE(
  NULLIF((SELECT sp.domain FROM spf_results sp WHERE sp.record_id = r.id ORDER BY CASE sp.scope WHEN 'mfrom' THEN 0 ELSE 1 END, sp.id LIMIT 1), ''),
  NULLIF((SELECT dk.domain FROM dkim_results dk WHERE dk.record_id = r.id ORDER BY dk.id LIMIT 1), ''),
  NULLIF(CASE WHEN instr(r.envelope_from, '@') > 0 THEN substr(r.envelope_from, instr(r.envelope_from, '@') + 1) ELSE r.envelope_from END, ''),
  NULLIF(r.header_from, '')
)`;

export function getDeliverabilitySources({ domain = '', subdomain = '', from, to } = {}) {
  const params = [];
  let where = '1=1';
  if (domain) { where += ' AND d.domain = ?'; params.push(domain); }
  if (subdomain) { where += ' AND r.header_from = ?'; params.push(subdomain); }
  if (from) { where += ' AND rp.begin_ts >= ?'; params.push(from); }
  if (to) { where += ' AND rp.end_ts <= ?'; params.push(to); }

  const rows = all(`
    SELECT
      ${SOURCE_EXPR} as source,
      COALESCE(SUM(r.count), 0) as volume,
      COALESCE(SUM(CASE WHEN r.dkim_eval='pass' AND r.spf_eval='pass' THEN r.count ELSE 0 END), 0) as dmarc_pass,
      COALESCE(SUM(CASE WHEN r.dkim_eval!='pass' OR r.spf_eval!='pass' THEN r.count ELSE 0 END), 0) as dmarc_fail,
      COALESCE(SUM(CASE WHEN r.spf_eval='pass' THEN r.count ELSE 0 END), 0) as spf_pass,
      COALESCE(SUM(CASE WHEN r.dkim_eval='pass' THEN r.count ELSE 0 END), 0) as dkim_pass
    FROM records r
    JOIN reports rp ON r.report_id = rp.id
    LEFT JOIN domains d ON rp.domain_id = d.id
    WHERE ${where}
    GROUP BY ${SOURCE_EXPR}
    ORDER BY volume DESC
  `, params);

  return rows.map(r => ({
    ...r,
    source: r.source || 'inconnu',
    dmarc_pct: r.volume > 0 ? Math.round((r.dmarc_pass / r.volume) * 100) : 0,
  }));
}

export function getDeliverabilitySourceRecords({ source, domain = '', subdomain = '', from, to, page = 1, pageSize = 20 } = {}) {
  const params = [];
  let where = '1=1';
  if (domain) { where += ' AND d.domain = ?'; params.push(domain); }
  if (subdomain) { where += ' AND r.header_from = ?'; params.push(subdomain); }
  if (from) { where += ' AND rp.begin_ts >= ?'; params.push(from); }
  if (to) { where += ' AND rp.end_ts <= ?'; params.push(to); }
  where += ` AND ${SOURCE_EXPR} = ?`;
  params.push(source);

  const totalRow = get(`
    SELECT COUNT(*) as c FROM records r
    JOIN reports rp ON r.report_id = rp.id
    LEFT JOIN domains d ON rp.domain_id = d.id
    WHERE ${where}
  `, params);

  const offset = (Math.max(page, 1) - 1) * pageSize;
  const records = all(`
    SELECT r.source_ip, r.count, r.disposition, r.dkim_eval, r.spf_eval, r.header_from, r.envelope_from,
      rp.org_name, rp.begin_ts,
      ic.org as ip_org, ic.country as ip_country
    FROM records r
    JOIN reports rp ON r.report_id = rp.id
    LEFT JOIN domains d ON rp.domain_id = d.id
    LEFT JOIN ip_cache ic ON ic.ip = r.source_ip
    WHERE ${where}
    ORDER BY rp.begin_ts DESC
    LIMIT ? OFFSET ?
  `, [...params, pageSize, offset]);

  return { records, total: totalRow.c, page, pageSize };
}

export function getOverview() {
  const stats = getGlobalStats();
  const monthly = getMonthlyComparison();
  const newSenders = getNewSenders();
  const topDomains = all(`
    SELECT header_from, SUM(count) as total,
      SUM(CASE WHEN dkim_eval = 'pass' AND spf_eval = 'pass' THEN count ELSE 0 END) as pass,
      SUM(CASE WHEN dkim_eval = 'pass' AND spf_eval != 'pass' THEN count ELSE 0 END) as dkim_only,
      SUM(CASE WHEN dkim_eval != 'pass' AND spf_eval = 'pass' THEN count ELSE 0 END) as spf_only,
      SUM(CASE WHEN dkim_eval != 'pass' AND spf_eval != 'pass' THEN count ELSE 0 END) as both_fail
    FROM records
    GROUP BY header_from
    ORDER BY total DESC
    LIMIT 15
  `);
  const authTimeline = all(`
    SELECT
      strftime('%Y-%m-%d', datetime(rp.begin_ts, 'unixepoch')) as day,
      COALESCE(SUM(CASE WHEN r.dkim_eval = 'pass' THEN r.count ELSE 0 END), 0) as dkim_pass,
      COALESCE(SUM(CASE WHEN r.spf_eval = 'pass' THEN r.count ELSE 0 END), 0) as spf_pass,
      COALESCE(SUM(r.count), 0) as total
    FROM records r
    JOIN reports rp ON r.report_id = rp.id
    GROUP BY day
    ORDER BY day ASC
    LIMIT 90
  `);
  const weeklyHeatmap = all(`
    SELECT
      CAST(strftime('%w', datetime(rp.begin_ts, 'unixepoch')) AS INTEGER) as dow,
      COALESCE(SUM(r.count), 0) as total,
      COALESCE(SUM(CASE WHEN r.dkim_eval = 'pass' AND r.spf_eval = 'pass' THEN r.count ELSE 0 END), 0) as pass
    FROM records r
    JOIN reports rp ON r.report_id = rp.id
    GROUP BY dow
    ORDER BY dow
  `);
  return { stats, monthly, newSenders, topDomains, authTimeline, weeklyHeatmap };
}

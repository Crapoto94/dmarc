import { readFileSync, existsSync } from 'fs';
import { createGunzip } from 'zlib';
import { PassThrough } from 'stream';
import AdmZip from 'adm-zip';
import { parseStringPromise } from 'xml2js';
import { run, get, transaction } from './db.js';

export async function parseDMARCReport(filePath) {
  const data = await readFileContent(filePath);
  return parseDMARCXml(data);
}

async function readFileContent(filePath) {
  if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  if (filePath.endsWith('.gz')) {
    const buffer = readFileSync(filePath);
    const gunzip = createGunzip();
    const chunks = [];
    const stream = new PassThrough();
    stream.end(buffer);
    for await (const chunk of stream.pipe(gunzip)) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
  }

  if (filePath.endsWith('.zip')) {
    const zip = new AdmZip(filePath);
    for (const entry of zip.getEntries()) {
      if (entry.entryName.endsWith('.xml') || entry.entryName.endsWith('.xml.gz')) {
        const data = entry.getData();
        if (entry.entryName.endsWith('.gz')) {
          const gunzip = createGunzip();
          const chunks = [];
          const stream = new PassThrough();
          stream.end(data);
          for await (const chunk of stream.pipe(gunzip)) {
            chunks.push(chunk);
          }
          return Buffer.concat(chunks).toString('utf-8');
        }
        return data.toString('utf-8');
      }
    }
    throw new Error('No XML found in zip');
  }

  if (filePath.endsWith('.xml')) {
    return readFileSync(filePath, 'utf-8');
  }

  throw new Error(`Unsupported file format: ${filePath}`);
}

export async function parseDMARCXml(xmlContent) {
  const result = await parseStringPromise(xmlContent, {
    explicitArray: false,
    ignoreAttrs: true,
    mergeAttrs: true,
    tagNameProcessors: [stripNamespace],
  });

  const root = result.feedback || result.feed || result;
  if (root.entry) {
    return parseAtomFormat(root);
  }

  return parseFeedbackFormat(root);
}

function stripNamespace(name) {
  const idx = name.indexOf('}');
  return idx >= 0 ? name.slice(idx + 1) : name;
}

function parseFeedbackFormat(root) {
  const rm = root.report_metadata || {};
  const pp = root.policy_published || {};
  const dr = rm.date_range || {};

  const records = [];
  const rawRecords = root.record;
  const recordsList = Array.isArray(rawRecords) ? rawRecords : (rawRecords ? [rawRecords] : []);

  for (const rec of recordsList) {
    const row = rec.row || {};
    const identifiers = rec.identifiers || {};
    const authResults = rec.auth_results || {};
    const pe = row.policy_evaluated || {};

    const dkimList = [];
    const rawDkim = authResults.dkim;
    const dkimArr = Array.isArray(rawDkim) ? rawDkim : (rawDkim ? [rawDkim] : []);
    for (const d of dkimArr) {
      dkimList.push({
        domain: d.domain || '',
        selector: d.selector || '',
        result: d.result || '',
      });
    }

    const spfList = [];
    const rawSpf = authResults.spf;
    const spfArr = Array.isArray(rawSpf) ? rawSpf : (rawSpf ? [rawSpf] : []);
    for (const s of spfArr) {
      spfList.push({
        domain: s.domain || '',
        scope: s.scope || '',
        result: s.result || '',
      });
    }

    records.push({
      source_ip: row.source_ip || '',
      count: parseInt(row.count || '0', 10),
      disposition: pe.disposition || '',
      dkim_eval: pe.dkim || '',
      spf_eval: pe.spf || '',
      header_from: identifiers.header_from || '',
      envelope_from: identifiers.envelope_from || '',
      envelope_to: identifiers.envelope_to || '',
      dkim_results: dkimList,
      spf_results: spfList,
    });
  }

  return {
    org_name: rm.org_name || '',
    email: rm.email || '',
    report_id: rm.report_id || '',
    begin_ts: parseInt(dr.begin || '0', 10),
    end_ts: parseInt(dr.end || '0', 10),
    domain: pp.domain || '',
    policy: pp.p || '',
    sp_policy: pp.sp || '',
    pct: parseInt(pp.pct || '100', 10),
    records,
  };
}

function parseAtomFormat(root) {
  const entries = Array.isArray(root.entry) ? root.entry : [root.entry];
  const first = entries[0] || {};

  return {
    org_name: first.org_name || '',
    email: first.email || '',
    report_id: first.report_id || '',
    begin_ts: 0,
    end_ts: 0,
    domain: '',
    policy: '',
    sp_policy: '',
    pct: 100,
    records: [],
  };
}

export async function importReportToDB(filePath, filename) {
  try {
    const report = await parseDMARCReport(filePath);
    if (!report.report_id) {
      console.log(`  [!] Pas de report_id dans ${filename}, ignoré`);
      return null;
    }

    const existing = get('SELECT id FROM reports WHERE report_id = ?', [report.report_id]);
    if (existing) {
      console.log(`  [=] Rapport déjà importé: ${filename} (${report.report_id.slice(0,12)})`);
      return existing.id;
    }

    let domainId = null;
    if (report.domain) {
      run('INSERT OR IGNORE INTO domains (domain) VALUES (?)', [report.domain]);
      const d = get('SELECT id FROM domains WHERE domain = ?', [report.domain]);
      domainId = d ? d.id : null;
    }

    const r = run(`
      INSERT INTO reports (filename, org_name, email, report_id, domain_id, policy, sp_policy, pct, begin_ts, end_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      filename, report.org_name, report.email, report.report_id,
      domainId, report.policy, report.sp_policy, report.pct,
      report.begin_ts, report.end_ts
    ]);
    const reportId = r.lastInsertRowid;

    transaction(() => {
      for (const rec of report.records) {
        const rr = run(`
          INSERT INTO records (report_id, source_ip, count, disposition, dkim_eval, spf_eval, header_from, envelope_from, envelope_to)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          reportId, rec.source_ip, rec.count, rec.disposition,
          rec.dkim_eval, rec.spf_eval, rec.header_from,
          rec.envelope_from, rec.envelope_to
        ]);
        const recordId = rr.lastInsertRowid;

        for (const d of rec.dkim_results) {
          run('INSERT INTO dkim_results (record_id, domain, selector, result) VALUES (?, ?, ?, ?)',
            [recordId, d.domain, d.selector, d.result]);
        }
        for (const s of rec.spf_results) {
          run('INSERT INTO spf_results (record_id, domain, scope, result) VALUES (?, ?, ?, ?)',
            [recordId, s.domain, s.scope, s.result]);
        }
      }
    });

    console.log(`  [+] Importé: ${filename} (${report.records.length} enregistrements)`);
    return reportId;
  } catch (err) {
    console.error(`  [!!] Erreur import ${filename}: ${err.message}`);
    return null;
  }
}

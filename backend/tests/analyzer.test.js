import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDB, run, get, all, closeDB } from '../src/db.js';

describe('Database', () => {
  beforeAll(async () => {
    process.env.DB_PATH = ':memory:';
    await initDB();
  });

  afterAll(() => {
    closeDB();
  });

  it('should create tables', () => {
    const tables = all("SELECT name FROM sqlite_master WHERE type='table'");
    const names = tables.map(t => t.name);
    expect(names).toContain('reports');
    expect(names).toContain('records');
    expect(names).toContain('domains');
    expect(names).toContain('config');
    expect(names).toContain('users');
  });

  it('should insert and retrieve config', () => {
    run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', ['test_key', 'test_value']);
    const row = get('SELECT value FROM config WHERE key = ?', ['test_key']);
    expect(row.value).toBe('test_value');
  });

  it('should insert and retrieve reports', () => {
    run('INSERT INTO domains (name) VALUES (?)', ['example.com']);
    const d = get('SELECT id FROM domains WHERE name = ?', ['example.com']);
    run(
      'INSERT INTO reports (domain_id, org_name, email, report_id, begin_ts, end_ts, policy_domain, policy_adkim, policy_aspf, policy_p, policy_sp, policy_pct) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [d.id, 'google.com', 'noreply@google.com', 'r1', 1000000, 1001000, 'example.com', 'r', 's', 'reject', 'reject', 100]
    );
    const report = get('SELECT * FROM reports WHERE report_id = ?', ['r1']);
    expect(report.org_name).toBe('google.com');
  });

  it('should have default admin user', () => {
    const user = get('SELECT * FROM users WHERE username = ?', ['admin']);
    expect(user).toBeTruthy();
    expect(user.role).toBe('admin');
  });
});

describe('Parser', () => {
  it('should parse a simple DMARC XML', async () => {
    const { importReportToDB } = await import('../src/parser.js');
    const xml = `<?xml version="1.0"?>
<feedback>
  <report_metadata>
    <org_name>TestOrg</org_name>
    <email>test@test.org</email>
    <report_id>test-report-001</report_id>
    <date_range>
      <begin>1000000</begin>
      <end>1001000</end>
    </date_range>
  </report_metadata>
  <policy_published>
    <domain>example.com</domain>
    <adkim>r</adkim>
    <aspf>s</aspf>
    <p>none</p>
    <sp>none</sp>
    <pct>100</pct>
  </policy_published>
  <record>
    <row>
      <source_ip>1.2.3.4</source_ip>
      <count>5</count>
      <policy_evaluated>
        <disposition>none</disposition>
        <dkim>pass</dkim>
        <spf>pass</spf>
      </policy_evaluated>
    </row>
    <identifiers>
      <header_from>example.com</header_from>
    </identifiers>
    <auth_results>
      <dkim><domain>example.com</domain><result>pass</result></dkim>
      <spf><domain>example.com</domain><result>pass</result></spf>
    </auth_results>
  </record>
</feedback>`;
    const { writeFileSync, mkdirSync, existsSync } = await import('fs');
    const { join } = await import('path');
    const tmpDir = join(import.meta.dirname, '..', 'tmp-test');
    if (!existsSync(tmpDir)) mkdirSync(tmpDir);
    const fPath = join(tmpDir, 'test-report.xml');
    writeFileSync(fPath, xml);
    const id = await importReportToDB(fPath, 'test-report.xml');
    expect(id).toBeTruthy();
    const report = get('SELECT * FROM reports WHERE report_id = ?', ['test-report-001']);
    expect(report).toBeTruthy();
    expect(report.org_name).toBe('TestOrg');
    const records = all('SELECT * FROM records WHERE report_id = ?', [report.id]);
    expect(records.length).toBeGreaterThan(0);
    expect(records[0].source_ip).toBe('1.2.3.4');
  });
});

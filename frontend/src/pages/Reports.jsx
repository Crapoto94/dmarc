import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

const PAGE_SIZE = 15;

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const loadReports = () => {
    api.getReports().then(setReports).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(loadReports, []);

  const filtered = reports.filter(r =>
    !search || (r.org_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.domain_name || r.domain || '').toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const selectReport = async (id) => {
    setSelected(id);
    const r = await api.getReport(id);
    setDetail(r);
  };

  const scanFolder = async () => {
    const folder = prompt('Chemin du dossier à scanner :', '/app/reports');
    if (!folder) return;
    setScanning(true);
    try {
      const result = await api.scanFolder(folder);
      alert(`Importé: ${result.imported}, Ignorés: ${result.skipped}, Erreurs: ${result.errors}`);
      loadReports();
    } catch (err) {
      alert(err.message);
    }
    setScanning(false);
  };

  if (loading) return <div style={s.loading}>Chargement...</div>;

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Rapports DMARC</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={s.searchInput} placeholder="Rechercher..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
          <button style={s.btn} onClick={scanFolder} disabled={scanning}>
            {scanning ? 'Scan...' : 'Scanner un dossier'}
          </button>
        </div>
      </div>

      <div style={s.grid}>
        <div style={s.listPanel}>
          {paged.map(r => (
            <div
              key={r.id}
              onClick={() => selectReport(r.id)}
              style={{
                ...s.reportItem,
                ...(selected === r.id ? s.reportItemActive : {}),
              }}
            >
              <div style={s.reportOrg}>{r.org_name || 'Inconnu'}</div>
              <div style={s.reportDomain}>{r.domain_name || r.domain}</div>
              <div style={s.reportMeta}>
                {new Date(r.begin_ts * 1000).toLocaleDateString()} · {r.total_emails} emails
              </div>
              <div style={s.reportPolicy}>p={r.policy || '?'}</div>
            </div>
          ))}
          {paged.length === 0 && <div style={s.empty}>Aucun rapport trouvé</div>}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 12 }}>
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={s.pageBtn}>◀</button>
              <span style={{ padding: '4px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{page + 1}/{totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} style={s.pageBtn}>▶</button>
            </div>
          )}
        </div>

        <div style={s.detailPanel}>
          {detail ? (
            <div>
              <h2 style={s.detailTitle}>{detail.org_name}</h2>
              <div style={s.metaGrid}>
                <Meta label="Domaine" value={detail.domain_name || detail.domain} />
                <Meta label="Politique" value={`p=${detail.policy} sp=${detail.sp_policy} pct=${detail.pct}%`} />
                <Meta label="Période" value={`${new Date(detail.begin_ts * 1000).toLocaleDateString()} → ${new Date(detail.end_ts * 1000).toLocaleDateString()}`} />
                <Meta label="Fichier" value={detail.filename} />
                <Meta label="Email rapport" value={detail.email} />
                <Meta label="Report ID" value={detail.report_id?.slice(0, 20) + '...'} />
              </div>

              <h3 style={{ marginTop: '20px', fontSize: '0.9rem', color: '#555' }}>
                Enregistrements ({detail.records?.length})
              </h3>
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th>IP Source</th><th>Titulaire</th><th>Count</th><th>Header From</th><th>DKIM</th><th>SPF</th><th>Disposition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.records?.map((rec, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--bg)' }}>
                        <td style={s.td}>{rec.source_ip}</td>
                        <td style={{ ...s.td, fontSize: '0.75rem', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rec.ip_org || ''}>
                          {rec.ip_org || rec.ip_isp || '...'}
                        </td>
                        <td style={s.td}>{rec.count}</td>
                        <td style={s.td}>{rec.header_from}</td>
                        <td style={{ ...s.td, color: rec.dkim_eval === 'pass' ? '#27ae60' : '#c0392b' }}>{rec.dkim_eval}</td>
                        <td style={{ ...s.td, color: rec.spf_eval === 'pass' ? '#27ae60' : '#c0392b' }}>{rec.spf_eval}</td>
                        <td style={s.td}>{rec.disposition}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={s.empty}>Sélectionnez un rapport</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div style={s.meta}>
      <span style={s.metaLabel}>{label}</span>
      <span style={s.metaValue}>{value || '—'}</span>
    </div>
  );
}

const s = {
  title: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: 8 },
  btn: {
    padding: '10px 20px', background: '#0f3460', color: '#fff', border: 'none',
    borderRadius: '8px', cursor: 'pointer', fontWeight: 600,
  },
  searchInput: {
    padding: '8px 14px', border: '1px solid var(--border)', borderRadius: '8px',
    background: 'var(--card-bg)', color: 'var(--text)', outline: 'none',
    fontSize: '0.85rem', width: '200px',
  },
  pageBtn: {
    padding: '4px 12px', border: '1px solid var(--border)', borderRadius: '6px',
    background: 'var(--card-bg)', color: 'var(--text)', cursor: 'pointer',
  },
  loading: { textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' },
  listPanel: {
    background: 'var(--card-bg)', borderRadius: '12px', padding: '16px',
    boxShadow: '0 2px 8px var(--shadow)', maxHeight: 'calc(100vh - 160px)', overflowY: 'auto',
  },
  reportItem: {
    padding: '12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '8px',
    position: 'relative', border: '1px solid transparent', transition: 'all 0.2s',
  },
  reportItemActive: { background: 'var(--bg)', border: '1px solid #0f3460' },
  reportOrg: { fontWeight: 600, color: 'var(--text)' },
  reportDomain: { fontSize: '0.8rem', color: '#0f3460', marginTop: '2px' },
  reportMeta: { fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' },
  reportPolicy: {
    position: 'absolute', top: '8px', right: '8px', fontSize: '0.7rem',
    background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)',
  },
  detailPanel: { background: 'var(--card-bg)', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px var(--shadow)' },
  detailTitle: { fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' },
  metaGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' },
  meta: { padding: '8px 12px', background: 'var(--bg)', borderRadius: '6px' },
  metaLabel: { display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' },
  metaValue: { fontSize: '0.85rem', color: 'var(--text)', fontWeight: 500 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' },
  td: { padding: '6px 10px', borderBottom: '1px solid var(--border)' },
  empty: { textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' },
};

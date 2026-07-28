import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const loadReports = () => {
    api.getReports().then(setReports).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(loadReports, []);

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
        <button style={s.btn} onClick={scanFolder} disabled={scanning}>
          {scanning ? 'Scan...' : 'Scanner un dossier'}
        </button>
      </div>

      <div style={s.grid}>
        <div style={s.listPanel}>
          {reports.map(r => (
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
          {reports.length === 0 && <div style={s.empty}>Aucun rapport importé</div>}
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
                      <th>IP Source</th><th>Count</th><th>Header From</th><th>DKIM</th><th>SPF</th><th>Disposition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.records?.map((rec, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                        <td style={s.td}>{rec.source_ip}</td>
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
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  btn: {
    padding: '10px 20px', background: '#0f3460', color: '#fff', border: 'none',
    borderRadius: '8px', cursor: 'pointer', fontWeight: 600,
  },
  loading: { textAlign: 'center', padding: '60px', color: '#888' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' },
  listPanel: {
    background: '#fff', borderRadius: '12px', padding: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', maxHeight: 'calc(100vh - 160px)', overflowY: 'auto',
  },
  reportItem: {
    padding: '12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '8px',
    position: 'relative', border: '1px solid transparent', transition: 'all 0.2s',
  },
  reportItemActive: { background: '#f0f2f5', border: '1px solid #0f3460' },
  reportOrg: { fontWeight: 600, color: '#1a1a2e' },
  reportDomain: { fontSize: '0.8rem', color: '#0f3460', marginTop: '2px' },
  reportMeta: { fontSize: '0.75rem', color: '#888', marginTop: '4px' },
  reportPolicy: {
    position: 'absolute', top: '8px', right: '8px', fontSize: '0.7rem',
    background: '#e0e0e0', padding: '2px 6px', borderRadius: '4px',
  },
  detailPanel: { background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  detailTitle: { fontSize: '1.3rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '16px' },
  metaGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' },
  meta: { padding: '8px 12px', background: '#f8f9fa', borderRadius: '6px' },
  metaLabel: { display: 'block', fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' },
  metaValue: { fontSize: '0.85rem', color: '#1a1a2e', fontWeight: 500 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' },
  td: { padding: '6px 10px', borderBottom: '1px solid #eee' },
  empty: { textAlign: 'center', padding: '60px', color: '#888' },
};

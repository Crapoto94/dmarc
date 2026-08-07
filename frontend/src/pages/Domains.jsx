import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function Domains() {
  const [domains, setDomains] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(true);

  const loadDomains = () => {
    api.getDomains().then(setDomains).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(loadDomains, []);

  const selectDomain = async (id) => {
    setSelected(id);
    const d = await api.getDomain(id);
    setDetail(d);
  };

  const addDomain = async () => {
    if (!newDomain.trim()) return;
    try {
      await api.addDomain(newDomain.trim());
      setNewDomain('');
      loadDomains();
    } catch (err) {
      alert(err.message);
    }
  };

  const removeDomain = async (id) => {
    if (!confirm('Supprimer ce domaine et tous ses rapports ?')) return;
    try {
      await api.deleteDomain(id);
      if (selected === id) { setSelected(null); setDetail(null); }
      loadDomains();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div style={s.loading}>Chargement...</div>;

  return (
    <div>
      <h1 style={s.title}>Domaines surveillés</h1>

      <div style={s.addBar}>
        <input
          style={s.input}
          placeholder="ajouter un domaine (ex: exemple.com)"
          value={newDomain}
          onChange={e => setNewDomain(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addDomain()}
        />
        <button style={s.btn} onClick={addDomain}>Ajouter</button>
      </div>

      <div style={s.grid}>
        <div style={s.listPanel}>
          {domains.map(d => (
            <div
              key={d.id}
              onClick={() => selectDomain(d.id)}
              style={{
                ...s.domainItem,
                ...(selected === d.id ? s.domainItemActive : {}),
              }}
            >
              <div style={s.domainName}>{d.domain}</div>
              <div style={s.domainStats}>
                {d.total_emails?.toLocaleString()} emails · {d.report_count} rapports
              </div>
              <div style={s.miniBar}>
                <div style={{
                  ...s.miniBarFill,
                  width: d.total_emails > 0 ? `${Math.round((d.pass_emails / d.total_emails) * 100)}%` : '0%',
                }} />
              </div>
              <button
                style={s.deleteBtn}
                onClick={e => { e.stopPropagation(); removeDomain(d.id); }}
                title="Supprimer"
              >×</button>
            </div>
          ))}
          {domains.length === 0 && <div style={s.empty}>Aucun domaine configuré</div>}
        </div>

        <div style={s.detailPanel}>
          {detail ? (
            <div>
              <h2 style={s.detailTitle}>{detail.domain}</h2>
              <div style={s.statCards}>
                <div style={s.stat}><strong>{detail.stats?.total || 0}</strong> emails</div>
                <div style={s.stat}><strong style={{color:'#27ae60'}}>{detail.stats?.pass || 0}</strong> OK</div>
                <div style={s.stat}><strong style={{color:'#c0392b'}}>{detail.stats?.fail || 0}</strong> échecs</div>
              </div>
              {detail.stats?.total > 0 && (
                <div style={s.bigBar}>
                  <div style={{
                    ...s.bigBarPass,
                    width: `${Math.round((detail.stats.pass / detail.stats.total) * 100)}%`,
                  }} />
                  <div style={{
                    ...s.bigBarFail,
                    width: `${Math.round((detail.stats.fail / detail.stats.total) * 100)}%`,
                  }} />
                </div>
              )}
              <h3 style={{ marginTop: '20px', fontSize: '0.9rem', color: '#555' }}>Rapports</h3>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {detail.reports?.map(r => (
                  <div key={r.id} style={s.reportItem}>
                    <div><strong>{r.org_name}</strong></div>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>
                      {new Date(r.begin_ts * 1000).toLocaleDateString()} → {new Date(r.end_ts * 1000).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: '0.8rem' }}>p={r.policy} · {r.filename}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={s.empty}>Sélectionnez un domaine</div>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '24px' },
  loading: { textAlign: 'center', padding: '60px', color: '#888' },
  addBar: { display: 'flex', gap: '8px', marginBottom: '20px' },
  input: {
    flex: 1, padding: '10px 14px', border: '2px solid #e0e0e0', borderRadius: '8px',
    fontSize: '0.9rem', outline: 'none', maxWidth: '360px',
  },
  btn: {
    padding: '10px 20px', background: '#0f3460', color: '#fff', border: 'none',
    borderRadius: '8px', cursor: 'pointer', fontWeight: 600,
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' },
  listPanel: { background: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  domainItem: {
    padding: '12px', borderRadius: '8px', cursor: 'pointer',
    marginBottom: '8px', position: 'relative', transition: 'all 0.2s',
    border: '1px solid transparent',
  },
  domainItemActive: { background: '#f0f2f5', border: '1px solid #0f3460' },
  domainName: { fontWeight: 600, color: '#1a1a2e' },
  domainStats: { fontSize: '0.75rem', color: '#888', marginTop: '2px' },
  miniBar: { height: '4px', background: '#eee', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' },
  miniBarFill: { height: '100%', background: '#27ae60', borderRadius: '2px', transition: 'width 0.3s' },
  deleteBtn: {
    position: 'absolute', top: '8px', right: '8px', border: 'none', background: 'transparent',
    color: '#c0392b', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.4,
  },
  detailPanel: { background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  detailTitle: { fontSize: '1.3rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '12px' },
  statCards: { display: 'flex', gap: '12px', marginBottom: '16px' },
  stat: {
    padding: '12px 16px', background: '#f8f9fa', borderRadius: '8px',
    fontSize: '0.85rem', flex: 1, textAlign: 'center',
  },
  bigBar: { height: '24px', borderRadius: '12px', overflow: 'hidden', display: 'flex', marginBottom: '16px' },
  bigBarPass: { height: '100%', background: '#27ae60', transition: 'width 0.3s' },
  bigBarFail: { height: '100%', background: '#e74c3c', transition: 'width 0.3s' },
  reportItem: {
    padding: '10px', borderBottom: '1px solid #eee', fontSize: '0.85rem',
  },
  empty: { textAlign: 'center', padding: '40px', color: '#888' },
};

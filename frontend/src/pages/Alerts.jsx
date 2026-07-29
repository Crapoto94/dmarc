import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

const severityColors = {
  high: { bg: '#fde8e8', color: '#c0392b', label: 'Haut' },
  medium: { bg: '#fef3cd', color: '#856404', label: 'Moyen' },
  info: { bg: '#e8f4fd', color: '#0f3460', label: 'Info' },
};

const typeLabels = {
  auth_failure: 'Échec authentification',
  partial_auth_failure: 'Échec partiel',
  policy_recommendation: 'Recommandation',
};

export default function Alerts({ onCountChange }) {
  const [tab, setTab] = useState('alerts');
  const [alerts, setAlerts] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [recFilter, setRecFilter] = useState('active');
  const [loading, setLoading] = useState(true);

  const loadAlerts = () => {
    api.getAlerts(showAll).then(data => {
      setAlerts(data);
      if (onCountChange) api.getAlerts(false).then(a => onCountChange(a.length));
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tab === 'alerts') loadAlerts();
    if (tab === 'recommendations') {
      api.getRecommendations(recFilter).then(setRecommendations).catch(() => {});
    }
  }, [tab, showAll, recFilter]);

  const acknowledge = async (id) => {
    await api.acknowledgeAlert(id);
    loadAlerts();
  };

  const acknowledgeAll = async () => {
    const unack = alerts.filter(a => !a.acknowledged);
    for (const a of unack) await api.acknowledgeAlert(a.id);
    loadAlerts();
  };

  const regenerate = async () => {
    await api.generateAlerts();
    loadAlerts();
  };

  if (loading && tab === 'alerts') return <div style={s.loading}>Chargement...</div>;

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Alertes & Recommandations</h1>
        <div style={s.actions}>
          <button style={{ ...s.tabBtn, ...(tab === 'alerts' ? s.tabBtnActive : {}) }} onClick={() => setTab('alerts')}>🔔 Alertes</button>
          <button style={{ ...s.tabBtn, ...(tab === 'recommendations' ? s.tabBtnActive : {}) }} onClick={() => setTab('recommendations')}>💡 Recommandations</button>
        </div>
      </div>

      {tab === 'alerts' && (
        <>
          <div style={{ ...s.header, marginTop: -8 }}>
            <div />
            <div style={s.actions}>
              <button style={s.btn} onClick={regenerate}>Analyser</button>
              {alerts.filter(a => !a.acknowledged).length > 0 && (
                <button style={{ ...s.btn, background: '#e94560' }} onClick={acknowledgeAll}>
                  Tout acquitter ({alerts.filter(a => !a.acknowledged).length})
                </button>
              )}
              <label style={s.toggle}>
                <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
                Archivées
              </label>
            </div>
          </div>

          {alerts.length === 0 ? (
            <div style={s.empty}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✅</div>
              <div>Aucune alerte{!showAll ? ' active' : ''}</div>
            </div>
          ) : (
            <div style={s.list}>
              {alerts.map(a => {
                const sc = severityColors[a.severity] || severityColors.info;
                return (
                  <div key={a.id} style={{ ...s.alert, borderLeft: `4px solid ${sc.color}`, opacity: a.acknowledged ? 0.6 : 1 }}>
                    <div style={s.alertHeader}>
                      <span style={{ ...s.badge, background: sc.bg, color: sc.color }}>{sc.label}</span>
                      <span style={s.alertType}>{typeLabels[a.type] || a.type}</span>
                      <span style={s.alertDate}>{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                    <div style={s.alertMsg}>{a.message}</div>
                    {!a.acknowledged && <button style={s.ackBtn} onClick={() => acknowledge(a.id)}>Acquitter</button>}
                    {a.acknowledged && <span style={s.ackLabel}>✓ Acquittée</span>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'recommendations' && (
        <>
          <div style={{ ...s.header, marginTop: -8 }}>
            <div />
            <div style={s.actions}>
              {['active', 'completed', 'dismissed', 'all'].map(st => (
                <button key={st} style={{ ...s.filterBtn, ...(recFilter === st ? s.filterBtnActive : {}) }} onClick={() => setRecFilter(st)}>
                  {{ active: 'Actives', completed: 'Faites', dismissed: 'Ignorées', all: 'Toutes' }[st]}
                </button>
              ))}
              <button style={s.btn} onClick={async () => { await api.refreshRecommendations(); setRecommendations(await api.getRecommendations(recFilter)); }}>
                🔄
              </button>
            </div>
          </div>

          {recommendations.length === 0 ? (
            <div style={s.empty}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>💡</div>
              <div>Aucune recommandation</div>
            </div>
          ) : (
            <div style={s.list}>
              {recommendations.map(r => (
                <div key={r.id} style={{
                  ...s.alert, borderLeft: `4px solid ${r.priority === 'high' ? '#c0392b' : r.priority === 'medium' ? '#f39c12' : '#3498db'}`,
                }}>
                  <div style={s.alertHeader}>
                    <span style={{ ...s.badge, background: '#e8f4fd', color: '#0f3460' }}>{r.category}</span>
                    <span style={{ ...s.badge, background: r.priority === 'high' ? '#fde8e8' : r.priority === 'medium' ? '#fef3cd' : '#e8f4fd' }}>{r.priority}</span>
                    <span style={s.alertDate}>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <div style={s.alertMsg}>{r.title}</div>
                  {r.detail && <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 4 }}>{r.detail}</div>}
                  {r.action && <div style={{ fontSize: '0.8rem', color: '#0f3460', marginBottom: 8 }}>👉 {r.action}</div>}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {r.status === 'active' && (
                      <>
                        <button style={s.smallBtn} onClick={async () => { await api.updateRecommendationStatus(r.id, 'completed'); setRecommendations(await api.getRecommendations(recFilter)); }}>✅ Fait</button>
                        <button style={s.smallBtn} onClick={async () => { await api.updateRecommendationStatus(r.id, 'dismissed'); setRecommendations(await api.getRecommendations(recFilter)); }}>✕ Ignorer</button>
                      </>
                    )}
                    {r.status !== 'active' && (
                      <button style={s.smallBtn} onClick={async () => { await api.updateRecommendationStatus(r.id, 'active'); setRecommendations(await api.getRecommendations(recFilter)); }}>↩ Réactiver</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const s = {
  title: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' },
  actions: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' },
  tabBtn: {
    padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '8px',
    background: 'var(--card-bg)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
  },
  tabBtnActive: { background: '#0f3460', color: '#fff', borderColor: '#0f3460' },
  btn: {
    padding: '8px 16px', background: '#0f3460', color: '#fff', border: 'none',
    borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
  },
  filterBtn: {
    padding: '4px 10px', border: '1px solid var(--border)', borderRadius: '6px',
    background: 'var(--card-bg)', color: 'var(--text)', cursor: 'pointer', fontSize: '0.8rem',
  },
  filterBtnActive: { background: '#0f3460', color: '#fff', borderColor: '#0f3460' },
  smallBtn: {
    padding: '4px 10px', border: '1px solid var(--border)', borderRadius: '4px',
    background: 'var(--card-bg)', color: 'var(--text)', cursor: 'pointer', fontSize: '0.78rem',
  },
  toggle: { fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' },
  loading: { textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' },
  empty: { textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  alert: {
    background: 'var(--card-bg)', borderRadius: '8px', padding: '14px',
    boxShadow: '0 1px 4px var(--shadow)', transition: 'all 0.2s',
  },
  alertHeader: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' },
  badge: { padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' },
  alertType: { fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 },
  alertDate: { fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 'auto' },
  alertMsg: { fontSize: '0.9rem', color: 'var(--text)', marginBottom: '6px' },
  ackBtn: {
    padding: '4px 12px', border: '1px solid #0f3460', borderRadius: '4px',
    background: 'transparent', color: '#0f3460', cursor: 'pointer', fontSize: '0.8rem',
  },
  ackLabel: { fontSize: '0.8rem', color: '#27ae60' },
};

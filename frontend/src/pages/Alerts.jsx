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
  const [alerts, setAlerts] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAlerts = () => {
    api.getAlerts(showAll).then(data => {
      setAlerts(data);
      if (onCountChange) {
        api.getAlerts(false).then(a => onCountChange(a.length));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(loadAlerts, [showAll]);

  const acknowledge = async (id) => {
    await api.acknowledgeAlert(id);
    loadAlerts();
  };

  const acknowledgeAll = async () => {
    const unack = alerts.filter(a => !a.acknowledged);
    for (const a of unack) {
      await api.acknowledgeAlert(a.id);
    }
    loadAlerts();
  };

  const regenerate = async () => {
    await api.generateAlerts();
    loadAlerts();
  };

  if (loading) return <div style={s.loading}>Chargement...</div>;

  const unackCount = alerts.filter(a => !a.acknowledged).length;

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Alertes</h1>
        <div style={s.actions}>
          <button style={s.btn} onClick={regenerate}>Analyser</button>
          {unackCount > 0 && (
            <button style={{ ...s.btn, background: '#e94560' }} onClick={acknowledgeAll}>
              Tout acquitter ({unackCount})
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
                  <span style={{ ...s.badge, background: sc.bg, color: sc.color }}>
                    {sc.label}
                  </span>
                  <span style={s.alertType}>{typeLabels[a.type] || a.type}</span>
                  <span style={s.alertDate}>{new Date(a.created_at).toLocaleString()}</span>
                </div>
                <div style={s.alertMsg}>{a.message}</div>
                {!a.acknowledged && (
                  <button style={s.ackBtn} onClick={() => acknowledge(a.id)}>
                    Acquitter
                  </button>
                )}
                {a.acknowledged && <span style={s.ackLabel}>✓ Acquittée</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s = {
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' },
  actions: { display: 'flex', gap: '8px', alignItems: 'center' },
  btn: {
    padding: '8px 16px', background: '#0f3460', color: '#fff', border: 'none',
    borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
  },
  toggle: { fontSize: '0.85rem', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' },
  loading: { textAlign: 'center', padding: '60px', color: '#888' },
  empty: { textAlign: 'center', padding: '60px', color: '#888' },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  alert: {
    background: '#fff', borderRadius: '8px', padding: '16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', transition: 'all 0.2s',
  },
  alertHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  badge: { padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' },
  alertType: { fontSize: '0.8rem', color: '#888', fontWeight: 500 },
  alertDate: { fontSize: '0.75rem', color: '#aaa', marginLeft: 'auto' },
  alertMsg: { fontSize: '0.9rem', color: '#333', marginBottom: '8px' },
  ackBtn: {
    padding: '4px 12px', border: '1px solid #0f3460', borderRadius: '4px',
    background: 'transparent', color: '#0f3460', cursor: 'pointer', fontSize: '0.8rem',
  },
  ackLabel: { fontSize: '0.8rem', color: '#27ae60' },
};

import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import AuthPieChart from '../components/Charts/AuthPieChart.jsx';
import TimelineChart from '../components/Charts/TimelineChart.jsx';
import SourcesBarChart from '../components/Charts/SourcesBarChart.jsx';
import DispositionChart from '../components/Charts/DispositionChart.jsx';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [sources, setSources] = useState([]);
  const [dispositions, setDispositions] = useState([]);
  const [unauthorized, setUnauthorized] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.getGlobalStats(),
      api.getTimeline(90),
      api.getTopSources(10),
      api.getDispositions(),
      api.getUnauthorized(),
    ])
      .then(([s, t, src, disp, unauth]) => {
        setStats(s);
        setTimeline(t);
        setSources(src);
        setDispositions(disp);
        setUnauthorized(unauth);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={s.loading}>Chargement...</div>;
  if (error) return <div style={s.error}>Erreur : {error}</div>;

  return (
    <div>
      <h1 style={s.title}>Tableau de bord DMARC</h1>

      {stats && (
        <div style={s.cards}>
          <Card label="Emails analysés" value={stats.total_emails.toLocaleString()} color="#e94560" />
          <Card label="Taux d'authentification" value={`${stats.pass_pct}%`} color="#0f3460" />
          <Card label="Rapports importés" value={stats.report_count} color="#16213e" />
          <Card label="Domaines surveillés" value={stats.domain_count} color="#533483" />
          <Card label="IPs sources uniques" value={stats.unique_source_ips} color="#e94560" />
          <Card label="Non authentifiés" value={stats.fail_emails.toLocaleString()} color="#c0392b" />
        </div>
      )}

      <div style={s.chartsRow}>
        <div style={s.chartCard}>
          <h3 style={s.chartTitle}>Authentification</h3>
          <AuthPieChart pass={stats?.pass_emails || 0} fail={stats?.fail_emails || 0} />
        </div>
        <div style={s.chartCard}>
          <h3 style={s.chartTitle}>Dispositions</h3>
          <DispositionChart data={dispositions} />
        </div>
      </div>

      <div style={s.chartCardFull}>
        <h3 style={s.chartTitle}>Évolution temporelle (authentification)</h3>
        <TimelineChart data={timeline} />
      </div>

      <div style={s.chartCardFull}>
        <h3 style={s.chartTitle}>Top 10 sources IP</h3>
        <SourcesBarChart data={sources} />
      </div>

      {unauthorized.length > 0 && (
        <div style={{ ...s.chartCardFull, borderLeft: '4px solid #c0392b' }}>
          <h3 style={{ ...s.chartTitle, color: '#c0392b' }}>
            Activité non authentifiée ({unauthorized.length} lignes)
          </h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th>IP Source</th><th>Header From</th><th>DKIM</th><th>SPF</th><th>Count</th><th>Disposition</th>
                </tr>
              </thead>
              <tbody>
                {unauthorized.slice(0, 50).map((u, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                    <td style={s.td}>{u.source_ip}</td>
                    <td style={s.td}>{u.header_from}</td>
                    <td style={{ ...s.td, color: u.dkim_eval === 'pass' ? '#27ae60' : '#c0392b' }}>{u.dkim_eval}</td>
                    <td style={{ ...s.td, color: u.spf_eval === 'pass' ? '#27ae60' : '#c0392b' }}>{u.spf_eval}</td>
                    <td style={s.td}>{u.count}</td>
                    <td style={s.td}>{u.disposition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats && stats.pass_pct < 80 && (
        <div style={s.tip}>
          💡 Moins de 80% d'authentification. Vérifiez les sources non authentifiées et
          configurez DKIM/SPF pour tous vos services expéditeurs.
        </div>
      )}
    </div>
  );
}

function Card({ label, value, color }) {
  return (
    <div style={{ ...s.card, borderTop: `3px solid ${color}` }}>
      <div style={s.cardValue}>{value}</div>
      <div style={s.cardLabel}>{label}</div>
    </div>
  );
}

const s = {
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '24px' },
  loading: { textAlign: 'center', padding: '60px', color: '#888' },
  error: { textAlign: 'center', padding: '60px', color: '#c0392b' },
  cards: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '16px', marginBottom: '24px',
  },
  card: {
    background: '#fff', borderRadius: '12px', padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center',
  },
  cardValue: { fontSize: '1.8rem', fontWeight: 800, color: '#1a1a2e' },
  cardLabel: { fontSize: '0.8rem', color: '#888', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '1px' },
  chartsRow: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: '16px', marginBottom: '24px',
  },
  chartCard: {
    background: '#fff', borderRadius: '12px', padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  chartCardFull: {
    background: '#fff', borderRadius: '12px', padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '24px',
  },
  chartTitle: { fontSize: '0.9rem', fontWeight: 600, color: '#555', marginBottom: '16px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  td: { padding: '8px 12px', borderBottom: '1px solid #eee' },
  tip: {
    background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px',
    padding: '16px', color: '#856404', marginTop: '16px',
  },
};

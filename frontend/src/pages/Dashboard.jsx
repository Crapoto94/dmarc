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
  const [emailDetails, setEmailDetails] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.getGlobalStats(),
      api.getTimeline(90),
      api.getTopSources(10),
      api.getDispositions(),
      api.getUnauthorized(),
      api.getEmailDetails(),
      api.getRecommendations(),
    ])
      .then(([s, t, src, disp, unauth, ed, recs]) => {
        setStats(s);
        setTimeline(t);
        setSources(src);
        setDispositions(disp);
        setUnauthorized(unauth);
        setEmailDetails(ed);
        setRecommendations(recs);
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
        <>
          <div style={s.cards}>
            <Card label="Emails analysés" value={stats.total_emails.toLocaleString()} color="#e94560" />
            <Card label="Taux OK" value={`${stats.pass_pct}%`} color="#27ae60" />
            <Card label="Taux échec" value={`${stats.fail_pct}%`} color="#c0392b" />
            <Card label="Rapports" value={stats.report_count} color="#16213e" />
            <Card label="Domaines" value={stats.domain_count} color="#533483" />
            <Card label="IPs uniques" value={stats.unique_source_ips} color="#0f3460" />
          </div>

          {stats.period_begin && (
            <div style={s.period}>
              Période : {new Date(stats.period_begin).toLocaleDateString()} → {new Date(stats.period_end).toLocaleDateString()}
            </div>
          )}

          <div style={s.detailCards}>
            <DetailCard label="DKIM + SPF OK" value={stats.pass_emails.toLocaleString()} color="#27ae60" />
            <DetailCard label="DKIM OK seul" value={stats.dkim_only_pass.toLocaleString()} color="#f39c12" />
            <DetailCard label="SPF OK seul" value={stats.spf_only_pass.toLocaleString()} color="#3498db" />
            <DetailCard label="Aucun OK" value={stats.both_fail.toLocaleString()} color="#c0392b" />
          </div>
        </>
      )}

      <div style={s.chartsRow}>
        <div style={s.chartCard}>
          <h3 style={s.chartTitle}>Authentification</h3>
          <AuthPieChart pass={stats?.pass_emails || 0} fail={(stats?.total_emails - stats?.pass_emails) || 0} />
        </div>
        <div style={s.chartCard}>
          <h3 style={s.chartTitle}>Dispositions</h3>
          <DispositionChart data={dispositions} />
        </div>
      </div>

      <div style={s.chartCardFull}>
        <h3 style={s.chartTitle}>Évolution temporelle</h3>
        <TimelineChart data={timeline} />
      </div>

      <div style={s.chartCardFull}>
        <h3 style={s.chartTitle}>Top 10 sources IP</h3>
        <SourcesBarChart data={sources} />
      </div>

      {emailDetails?.byDomain?.length > 0 && (
        <div style={s.chartCardFull}>
          <h3 style={s.chartTitle}>Détail par domaine expéditeur (header_from)</h3>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th>Domaine</th><th>Total</th><th>✅ DKIM+SPF</th><th>🔶 DKIM seul</th><th>🔷 SPF seul</th><th>❌ Aucun</th><th>Sources IP</th>
                </tr>
              </thead>
              <tbody>
                {emailDetails.byDomain.map((d, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                    <td style={s.td}><strong>{d.domain}</strong></td>
                    <td style={s.td}>{d.total}</td>
                    <td style={{ ...s.td, color: '#27ae60' }}>{d.full_pass}</td>
                    <td style={{ ...s.td, color: '#f39c12' }}>{d.dkim_only}</td>
                    <td style={{ ...s.td, color: '#3498db' }}>{d.spf_only}</td>
                    <td style={{ ...s.td, color: '#c0392b' }}>{d.both_fail}</td>
                    <td style={s.td}>{d.sources_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div style={s.chartCardFull}>
          <h3 style={{ ...s.chartTitle, color: '#e94560' }}>💡 Recommandations</h3>
          {recommendations.map((r, i) => (
            <div key={i} style={{
              ...s.rec, borderLeft: `4px solid ${
                r.priority === 'high' ? '#c0392b' : r.priority === 'medium' ? '#f39c12' : '#3498db'
              }`,
              background: r.priority === 'high' ? '#fff5f5' : r.priority === 'medium' ? '#fffdf5' : '#f5f8ff',
            }}>
              <div style={s.recHeader}>
                <span style={s.recCat}>{r.category}</span>
                <span style={s.recPrio(r.priority)}>{r.priority}</span>
              </div>
              <div style={s.recTitle}>{r.title}</div>
              <div style={s.recDetail}>{r.detail}</div>
              {r.action && <div style={s.recAction}>👉 {r.action}</div>}
            </div>
          ))}
        </div>
      )}

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

function DetailCard({ label, value, color }) {
  return (
    <div style={{ ...s.card, borderTop: `3px solid ${color}`, textAlign: 'left' }}>
      <div style={{ ...s.cardValue, fontSize: '1.2rem' }}>{value}</div>
      <div style={s.cardLabel}>{label}</div>
    </div>
  );
}

const s = {
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '20px' },
  loading: { textAlign: 'center', padding: '60px', color: '#888' },
  error: { textAlign: 'center', padding: '60px', color: '#c0392b' },
  period: { fontSize: '0.85rem', color: '#888', marginBottom: '16px' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '12px' },
  detailCards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' },
  card: { background: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' },
  cardValue: { fontSize: '1.6rem', fontWeight: 800, color: '#1a1a2e' },
  cardLabel: { fontSize: '0.72rem', color: '#888', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '1px' },
  chartsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' },
  chartCard: { background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  chartCardFull: { background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '24px' },
  chartTitle: { fontSize: '0.9rem', fontWeight: 600, color: '#555', marginBottom: '16px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' },
  td: { padding: '6px 10px', borderBottom: '1px solid #eee' },
  rec: { padding: '14px', borderRadius: '8px', marginBottom: '10px', fontSize: '0.85rem' },
  recHeader: { display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' },
  recCat: { fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#888' },
  recPrio: (p) => ({
    fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
    padding: '2px 8px', borderRadius: '4px',
    background: p === 'high' ? '#fde8e8' : p === 'medium' ? '#fef3cd' : '#e8f4fd',
    color: p === 'high' ? '#c0392b' : p === 'medium' ? '#856404' : '#0f3460',
  }),
  recTitle: { fontWeight: 600, color: '#1a1a2e', marginBottom: '4px' },
  recDetail: { color: '#555', marginBottom: '4px' },
  recAction: { color: '#0f3460', fontWeight: 500, marginTop: '4px', fontSize: '0.82rem' },
};

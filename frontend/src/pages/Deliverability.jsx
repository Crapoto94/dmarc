import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api.js';
import DeliverabilityTimelineChart from '../components/Charts/DeliverabilityTimelineChart.jsx';

const CATEGORIES = [
  { key: 'perfect', label: 'Conformité parfaite', color: '#27ae60' },
  { key: 'dkim', label: 'Conformité DKIM', color: '#3498db' },
  { key: 'spf', label: 'Conformité SPF', color: '#f39c12' },
  { key: 'nonconforme', label: 'Non-Conforme/Menace', color: '#c0392b' },
];

function fmtDate(ts) {
  return ts ? new Date(ts * 1000).toLocaleDateString() : '—';
}

// Vérifie les IPs sur plusieurs listes noires publiques (Spamhaus, Barracuda, SpamCop, SORBS)
// via /stats/rbl-check ; résultats mis en cache côté backend (24h) et ici en mémoire pour la session.
function useRBLStatuses(ips) {
  const [map, setMap] = useState({});
  const fetchedRef = useRef(new Set());
  const key = ips.join(',');

  useEffect(() => {
    const toFetch = ips.filter(ip => ip && !fetchedRef.current.has(ip));
    if (toFetch.length === 0) return;
    toFetch.forEach(ip => fetchedRef.current.add(ip));
    api.checkRBLBulk(toFetch).then(res => setMap(m => ({ ...m, ...res }))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return map;
}

function mxToolboxUrl(ip) {
  return `https://mxtoolbox.com/SuperTool.aspx?action=blacklist%3a${encodeURIComponent(ip)}&run=toolpage`;
}

function RBLHistory({ ip }) {
  const [history, setHistory] = useState(null);
  const [open, setOpen] = useState(false);

  const onToggle = (e) => {
    const isOpen = e.target.open;
    setOpen(isOpen);
    if (isOpen && !history) {
      api.getRBLHistory(ip).then(setHistory).catch(() => setHistory([]));
    }
  };

  return (
    <details onToggle={onToggle} style={{ display: 'inline-block' }}>
      <summary style={{ fontSize: '0.68rem', color: '#0f3460', cursor: 'pointer', listStyle: 'none' }}>
        historique
      </summary>
      {open && (
        <div style={{
          fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 4,
          maxHeight: 120, overflowY: 'auto', minWidth: 180,
        }}>
          {!history ? 'Chargement…' : history.length === 0 ? 'Aucun historique' : (
            <ul style={{ margin: 0, paddingLeft: 14 }}>
              {history.map((h, i) => (
                <li key={i} style={{ color: h.listed ? '#c0392b' : '#27ae60' }}>
                  {new Date(h.checked_at).toLocaleString()} — {h.listed ? `Listée (${h.lists.join(', ')})` : 'Propre'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </details>
  );
}

function RBLBadge({ ip, statuses }) {
  if (!ip) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
  const status = statuses[ip];
  if (!status) return <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>en attente…</span>;
  if (status.listed) {
    return (
      <span title={status.lists.join(', ')} style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#c0392b', fontWeight: 700, fontSize: '0.72rem' }}>
            🚫 Listée ({status.lists.length})
          </span>
          <a
            href={mxToolboxUrl(ip)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.68rem', color: '#0f3460', textDecoration: 'underline' }}
            onClick={e => e.stopPropagation()}
          >
            détails ↗
          </a>
        </span>
        <RBLHistory ip={ip} />
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ color: '#27ae60', fontWeight: 600, fontSize: '0.72rem' }}>✅ Propre</span>
      <RBLHistory ip={ip} />
    </span>
  );
}

export default function Deliverability() {
  const [view, setView] = useState('domain');
  const [domains, setDomains] = useState([]);

  useEffect(() => {
    api.getDomains().then(setDomains).catch(() => {});
  }, []);

  return (
    <div>
      <h1 style={s.title}>Délivrabilité</h1>

      <div style={s.viewTabs}>
        <button style={{ ...s.viewTab, ...(view === 'domain' ? s.viewTabActive : {}) }} onClick={() => setView('domain')}>
          Par domaine
        </button>
        <button style={{ ...s.viewTab, ...(view === 'source' ? s.viewTabActive : {}) }} onClick={() => setView('source')}>
          Par source
        </button>
      </div>

      {view === 'domain' ? <ByDomain domains={domains} /> : <BySource domains={domains} />}
    </div>
  );
}

function ByDomain({ domains }) {
  const [domain, setDomain] = useState('');
  const [category, setCategory] = useState('perfect');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.getDeliverabilityByDomain({ domain, category, page, pageSize, search })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [domain, category, page, pageSize, search]);

  useEffect(load, [load]);
  useEffect(() => { setPage(1); }, [domain, category, search]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const visibleIPs = [...new Set((data?.records || []).map(r => r.source_ip).filter(Boolean))];
  const rblStatuses = useRBLStatuses(visibleIPs);

  return (
    <div>
      <div style={s.filterBar}>
        <select style={s.select} value={domain} onChange={e => setDomain(e.target.value)}>
          <option value="">Tous les domaines</option>
          {domains.map(d => <option key={d.id} value={d.domain}>{d.domain}</option>)}
        </select>
        <input
          style={s.searchInput}
          placeholder="Rechercher (IP, expéditeur, rapporteur)..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div style={s.categoryTabs}>
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            style={{
              ...s.categoryTab,
              color: category === c.key ? c.color : 'var(--text-secondary)',
              borderBottom: category === c.key ? `3px solid ${c.color}` : '3px solid transparent',
              fontWeight: category === c.key ? 700 : 500,
            }}
          >
            {c.label} {data ? `[${(data.counts?.[c.key] ?? 0).toLocaleString()}]` : ''}
          </button>
        ))}
      </div>

      <div style={s.chartCard}>
        {loading ? <div style={s.loading}>Chargement...</div> : (
          <DeliverabilityTimelineChart data={data?.timeline || []} category={category} />
        )}
      </div>

      <div style={s.tableCard}>
        <div style={s.tableHeader}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            Volume total : <strong style={{ color: 'var(--text)' }}>{(data?.total ?? 0).toLocaleString()}</strong> lignes
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Date</th>
                <th style={s.th}>Rapporteur</th>
                <th style={s.th}>Header From</th>
                <th style={s.th}>Volume</th>
                <th style={s.th}>Action</th>
                <th style={s.th}>DKIM</th>
                <th style={s.th}>SPF</th>
                <th style={s.th}>IP Source</th>
                <th style={s.th}>IP blacklistée</th>
                <th style={s.th}>Org / Pays IP</th>
                <th style={s.th}>DKIM domaine/sélecteur</th>
                <th style={s.th}>SPF domaine</th>
              </tr>
            </thead>
            <tbody>
              {(data?.records || []).map((rec, i) => (
                <tr key={rec.id} style={{ background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--bg)' }}>
                  <td style={s.td}>{fmtDate(rec.begin_ts)}</td>
                  <td style={s.td}>{rec.org_name}</td>
                  <td style={s.td}>{rec.header_from}</td>
                  <td style={s.td}>{rec.count}</td>
                  <td style={s.td}>{rec.disposition}</td>
                  <td style={{ ...s.td, color: rec.dkim_eval === 'pass' ? '#27ae60' : '#c0392b', fontWeight: 600 }}>{rec.dkim_eval}</td>
                  <td style={{ ...s.td, color: rec.spf_eval === 'pass' ? '#27ae60' : '#c0392b', fontWeight: 600 }}>{rec.spf_eval}</td>
                  <td style={s.td}>{rec.source_ip}</td>
                  <td style={s.td}><RBLBadge ip={rec.source_ip} statuses={rblStatuses} /></td>
                  <td style={{ ...s.td, fontSize: '0.75rem' }} title={rec.ip_org || ''}>
                    {(rec.ip_org || rec.ip_isp || '—')} {rec.ip_country ? `(${rec.ip_country})` : ''}
                  </td>
                  <td style={{ ...s.td, fontSize: '0.75rem' }}>
                    {rec.dkim_results?.map(d => `${d.domain}/${d.selector}=${d.result}`).join(', ') || '—'}
                  </td>
                  <td style={{ ...s.td, fontSize: '0.75rem' }}>
                    {rec.spf_results?.map(d => `${d.domain}=${d.result}`).join(', ') || '—'}
                  </td>
                </tr>
              ))}
              {!loading && (data?.records || []).length === 0 && (
                <tr><td style={s.td} colSpan={12}>Aucune donnée pour ce filtre</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div style={s.pagination}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={s.pageBtn}>◀</button>
            <span style={s.pageInfo}>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={s.pageBtn}>▶</button>
          </div>
        )}
      </div>
    </div>
  );
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function BySource({ domains }) {
  const [domain, setDomain] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [range, setRange] = useState(defaultRange);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [drill, setDrill] = useState(null);
  const [drillLoading, setDrillLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getDeliverabilitySources({ domain, subdomain, from: range.from, to: range.to })
      .then(setSources)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [domain, subdomain, range]);

  useEffect(load, [load]);

  const shiftPeriod = (dir) => {
    const from = new Date(range.from);
    const to = new Date(range.to);
    const days = Math.round((to - from) / 86400000) + 1;
    from.setDate(from.getDate() + dir * days);
    to.setDate(to.getDate() + dir * days);
    setRange({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
  };

  const toggleExpand = async (source) => {
    if (expanded === source) { setExpanded(null); setDrill(null); return; }
    setExpanded(source);
    setDrillLoading(true);
    try {
      const d = await api.getDeliverabilitySourceRecords({ source, domain, subdomain, from: range.from, to: range.to, pageSize: 50 });
      setDrill(d);
    } catch { setDrill(null); }
    setDrillLoading(false);
  };

  const drillIPs = [...new Set((drill?.records || []).map(r => r.source_ip).filter(Boolean))];
  const rblStatuses = useRBLStatuses(drillIPs);

  const exportCSV = () => {
    const header = ['Source', 'Volume', 'DMARC OK', 'DMARC KO', 'DMARC %', 'SPF OK', 'DKIM OK'];
    const rows = sources.map(s => [s.source, s.volume, s.dmarc_pass, s.dmarc_fail, s.dmarc_pct, s.spf_pass, s.dkim_pass]);
    const csv = [header, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delivrabilite-par-source_${range.from}_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <p style={s.hint}>
        La <strong>source</strong> est la plateforme d'envoi technique (ESP) détectée via le domaine SPF/DKIM
        de chaque email (ex: Brevo, Mailjet, envoi direct...). Ce n'est <strong>pas</strong> le "Rapporteur"
        (Google, Microsoft/Outlook, Yahoo...), qui est l'organisme qui vous envoie le rapport DMARC agrégé —
        celui-ci reste visible dans le détail via "Voir plus", et sur la page Rapports.
      </p>
      <div style={s.filterBar}>
        <select style={s.select} value={domain} onChange={e => { setDomain(e.target.value); setSubdomain(''); }}>
          <option value="">Filtre par domaine</option>
          {domains.map(d => <option key={d.id} value={d.domain}>{d.domain}</option>)}
        </select>
        <input
          style={s.searchInput}
          placeholder="Filtre par sous-domaine (header from)"
          value={subdomain}
          onChange={e => setSubdomain(e.target.value)}
        />
        <button style={s.exportBtn} onClick={exportCSV} disabled={sources.length === 0}>Exporter (.csv)</button>
      </div>

      <div style={s.periodBar}>
        <button style={s.pageBtn} onClick={() => shiftPeriod(-1)}>← Période précédente</button>
        <input style={{ ...s.searchInput, width: 140 }} type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} />
        <span style={{ color: 'var(--text-secondary)' }}>→</span>
        <input style={{ ...s.searchInput, width: 140 }} type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} />
        <button style={s.pageBtn} onClick={() => shiftPeriod(1)}>Période suivante →</button>
      </div>

      <div style={s.tableCard}>
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Source (plateforme d'envoi)</th>
                <th style={s.th}>Volume</th>
                <th style={s.th}>DMARC ✓</th>
                <th style={s.th}>DMARC ✗</th>
                <th style={s.th}>DMARC %</th>
                <th style={s.th}>SPF OK</th>
                <th style={s.th}>DKIM OK</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {sources.map((src, i) => (
                <React.Fragment key={src.source}>
                  <tr style={{ background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--bg)' }}>
                    <td style={s.td}><strong>{src.source}</strong></td>
                    <td style={s.td}>{src.volume.toLocaleString()}</td>
                    <td style={{ ...s.td, color: '#27ae60' }}>{src.dmarc_pass.toLocaleString()}</td>
                    <td style={{ ...s.td, color: '#c0392b' }}>{src.dmarc_fail.toLocaleString()}</td>
                    <td style={s.td}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: '0.75rem',
                        color: src.dmarc_pct >= 95 ? '#27ae60' : src.dmarc_pct >= 50 ? '#f39c12' : '#c0392b',
                      }}>{src.dmarc_pct}%</span>
                    </td>
                    <td style={s.td}>{src.spf_pass.toLocaleString()}</td>
                    <td style={s.td}>{src.dkim_pass.toLocaleString()}</td>
                    <td style={s.td}>
                      <button style={s.voirPlusBtn} onClick={() => toggleExpand(src.source)}>
                        {expanded === src.source ? 'Réduire' : 'Voir plus'}
                      </button>
                    </td>
                  </tr>
                  {expanded === src.source && (
                    <tr>
                      <td colSpan={8} style={{ ...s.td, background: 'var(--bg)' }}>
                        {drillLoading ? (
                          <div style={{ padding: 12, color: 'var(--text-secondary)' }}>Chargement...</div>
                        ) : (
                          <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
                            <table style={s.table}>
                              <thead>
                                <tr>
                                  <th style={s.th}>Date</th>
                                  <th style={s.th}>Rapporteur</th>
                                  <th style={s.th}>Header From</th>
                                  <th style={s.th}>IP Source</th>
                                  <th style={s.th}>IP blacklistée</th>
                                  <th style={s.th}>Org IP</th>
                                  <th style={s.th}>Volume</th>
                                  <th style={s.th}>DKIM</th>
                                  <th style={s.th}>SPF</th>
                                  <th style={s.th}>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(drill?.records || []).map((r, j) => (
                                  <tr key={j}>
                                    <td style={s.td}>{fmtDate(r.begin_ts)}</td>
                                    <td style={s.td}>{r.org_name}</td>
                                    <td style={s.td}>{r.header_from}</td>
                                    <td style={s.td}>{r.source_ip}</td>
                                    <td style={s.td}><RBLBadge ip={r.source_ip} statuses={rblStatuses} /></td>
                                    <td style={s.td}>{r.ip_org || '—'}</td>
                                    <td style={s.td}>{r.count}</td>
                                    <td style={{ ...s.td, color: r.dkim_eval === 'pass' ? '#27ae60' : '#c0392b' }}>{r.dkim_eval}</td>
                                    <td style={{ ...s.td, color: r.spf_eval === 'pass' ? '#27ae60' : '#c0392b' }}>{r.spf_eval}</td>
                                    <td style={s.td}>{r.disposition}</td>
                                  </tr>
                                ))}
                                {(drill?.records || []).length === 0 && (
                                  <tr><td style={s.td} colSpan={10}>Aucun enregistrement</td></tr>
                                )}
                              </tbody>
                            </table>
                            {drill && drill.total > (drill.records?.length || 0) && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 6 }}>
                                Affichage de {drill.records.length} sur {drill.total} lignes
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {!loading && sources.length === 0 && (
                <tr><td style={s.td} colSpan={8}>Aucune source pour cette période</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const s = {
  title: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' },
  viewTabs: { display: 'flex', gap: 8, marginBottom: '20px' },
  viewTab: {
    padding: '8px 18px', borderRadius: '8px', border: '1px solid var(--border)',
    background: 'var(--card-bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
  },
  viewTabActive: { background: '#0f3460', color: '#fff', borderColor: '#0f3460' },
  filterBar: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' },
  select: {
    padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px',
    background: 'var(--card-bg)', color: 'var(--text)', outline: 'none', fontSize: '0.85rem', minWidth: 180,
  },
  searchInput: {
    padding: '8px 14px', border: '1px solid var(--border)', borderRadius: '8px',
    background: 'var(--card-bg)', color: 'var(--text)', outline: 'none', fontSize: '0.85rem', minWidth: 220,
  },
  exportBtn: {
    padding: '8px 16px', background: '#0f3460', color: '#fff', border: 'none',
    borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', marginLeft: 'auto',
  },
  periodBar: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' },
  categoryTabs: {
    display: 'flex', gap: 4, marginBottom: '16px', flexWrap: 'wrap',
    borderBottom: '1px solid var(--border)',
  },
  categoryTab: {
    padding: '10px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
    fontSize: '0.82rem',
  },
  chartCard: {
    background: 'var(--card-bg)', borderRadius: '12px', padding: '16px',
    boxShadow: '0 2px 8px var(--shadow)', marginBottom: '20px',
  },
  loading: { textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' },
  tableCard: {
    background: 'var(--card-bg)', borderRadius: '12px', padding: '16px',
    boxShadow: '0 2px 8px var(--shadow)',
  },
  tableHeader: { marginBottom: 10 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },
  th: {
    textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)',
    color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
  },
  td: { padding: '7px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text)', whiteSpace: 'nowrap' },
  pagination: { display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center', marginTop: 14 },
  pageBtn: {
    padding: '6px 14px', border: '1px solid var(--border)', borderRadius: '6px',
    background: 'var(--card-bg)', color: 'var(--text)', cursor: 'pointer', fontSize: '0.8rem',
  },
  pageInfo: { fontSize: '0.8rem', color: 'var(--text-secondary)' },
  voirPlusBtn: {
    padding: '4px 10px', border: '1px solid #0f3460', borderRadius: '6px',
    background: 'transparent', color: '#0f3460', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
  },
  hint: {
    fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--card-bg)',
    border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
    lineHeight: 1.5,
  },
};

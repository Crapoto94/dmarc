import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard.jsx';
import Domains from './pages/Domains.jsx';
import Deliverability from './pages/Deliverability.jsx';
import Reports from './pages/Reports.jsx';
import Alerts from './pages/Alerts.jsx';
import Admin from './pages/Admin.jsx';
import Login from './pages/Login.jsx';
import UserManagement from './pages/UserManagement.jsx';
import { api } from './api.js';

const navItems = [
  { id: 'dashboard', label: '📊', title: 'Dashboard' },
  { id: 'domains', label: '🌐', title: 'Domaines' },
  { id: 'deliverability', label: '📈', title: 'Délivrabilité' },
  { id: 'reports', label: '📄', title: 'Rapports' },
  { id: 'alerts', label: '🔔', title: 'Alertes' },
  { id: 'admin', label: '⚙️', title: 'Admin' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(() => localStorage.getItem('dmarc-dark') === 'true');

  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('dmarc-dark', dark); }, [dark]);

  useEffect(() => {
    api.getMe().then(u => {
      setUser(u);
    }).catch(() => {
      setUser(null);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    api.getAlerts().then(data => setAlertCount(data.length)).catch(() => {});
    const iv = setInterval(() => {
      api.getAlerts().then(data => setAlertCount(data.length)).catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, [user]);

  const logout = async () => {
    try { await api.logout(); } catch {}
    setUser(null);
  };

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#888' }}>Chargement...</div>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.logo}>DMARC</div>
        {navItems.filter(item => item.id !== 'admin' || user.role === 'admin').map(item => (
          <button key={item.id} onClick={() => setPage(item.id)}
            style={{ ...s.navBtn, ...(page === item.id ? s.navBtnActive : {}) }} title={item.title}>
            <span style={{ fontSize: '1.3rem' }}>{item.label}</span>
            {item.id === 'alerts' && alertCount > 0 && (
              <span style={s.badge}>{alertCount}</span>
            )}
          </button>
        ))}
        <div style={s.spacer} />
        <button onClick={() => setDark(d => !d)} style={s.navBtn} title={dark ? 'Mode clair' : 'Mode sombre'}>{dark ? '☀️' : '🌙'}</button>
        <div style={{ fontSize: '0.6rem', color: '#888', textAlign: 'center', marginBottom: '4px' }}>
          {user?.role === 'admin' ? 'Admin' : 'View'}
        </div>
        <button onClick={logout} style={s.navBtn} title="Déconnexion">🚪</button>
      </nav>
      <main style={s.main}>
        {page === 'dashboard' && <Dashboard />}
        {page === 'domains' && <Domains />}
        {page === 'deliverability' && <Deliverability />}
        {page === 'reports' && <Reports />}
        {page === 'alerts' && <Alerts onCountChange={setAlertCount} />}
        {page === 'admin' && (user.role === 'admin' ? <Admin user={user} /> : <UserManagement user={user} />)}
      </main>
    </div>
  );
}

const s = {
  layout: { display: 'flex', minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" },
  sidebar: { width: '72px', background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: '8px', boxShadow: '2px 0 12px rgba(0,0,0,0.1)' },
  logo: { color: '#e94560', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '2px', marginBottom: '24px', writingMode: 'vertical-lr', textOrientation: 'mixed' },
  navBtn: { width: '48px', height: '48px', border: 'none', borderRadius: '12px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', transition: 'all 0.2s', color: '#fff' },
  navBtnActive: { background: 'rgba(233,69,96,0.2)', boxShadow: 'inset 0 0 0 2px #e94560' },
  badge: { position: 'absolute', top: '4px', right: '4px', background: '#e94560', color: '#fff', fontSize: '10px', fontWeight: 700, borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  spacer: { flex: 1 },
  main: { flex: 1, padding: '32px', overflowY: 'auto', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' },
};

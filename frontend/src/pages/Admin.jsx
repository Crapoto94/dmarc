import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import UserManagement from './UserManagement.jsx';

export default function Admin({ user }) {
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});
  const [fetching, setFetching] = useState(false);
  const [tab, setTab] = useState('config');
  const [importLog, setImportLog] = useState([]);
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '' });
  const [pwdMsg, setPwdMsg] = useState(null);

  useEffect(() => {
    api.getConfig().then(setConfig).catch(() => {});
  }, []);

  const update = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await api.saveConfig(config);
      setTestResult({ type: 'success', msg: 'Configuration enregistrée' });
    } catch (err) {
      setTestResult({ type: 'error', msg: err.message });
    }
    setSaving(false);
    setTimeout(() => setTestResult(null), 3000);
  };

  const testConnection = async () => {
    setTestResult(null);
    try {
      const res = await fetch('/api/config/test-imap', { method: 'POST',
        credentials: 'include', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      setTestResult({ type: data.success ? 'success' : 'error', msg: data.message || data.error });
    } catch (err) {
      setTestResult({ type: 'error', msg: err.message });
    }
    setTimeout(() => setTestResult(null), 8000);
  };

  const fetchNow = async () => {
    setFetching(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/config/fetch-now', { method: 'POST',
        credentials: 'include', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      setTestResult({ type: data.success ? 'success' : 'error', msg: data.success ? `✅ ${data.message}` : data.error });
    } catch (err) {
      setTestResult({ type: 'error', msg: err.message });
    }
    setFetching(false);
    setTimeout(() => setTestResult(null), 10000);
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwdMsg(null);
    try {
      await api.changePassword(pwdForm.oldPassword, pwdForm.newPassword);
      setPwdMsg({ type: 'success', text: 'Mot de passe changé' });
      setPwdForm({ oldPassword: '', newPassword: '' });
    } catch (err) {
      setPwdMsg({ type: 'error', text: err.message });
    }
    setTimeout(() => setPwdMsg(null), 3000);
  };

  const togglePassword = (key) => {
    setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div>
      <h1 style={s.title}>Administration</h1>

      <div style={s.tabs}>
        <button style={{ ...s.tab, ...(tab === 'config' ? s.tabActive : {}) }} onClick={() => setTab('config')}>
          ⚙️ Configuration
        </button>
        <button style={{ ...s.tab, ...(tab === 'password' ? s.tabActive : {}) }} onClick={() => setTab('password')}>
          🔑 Mot de passe
        </button>
        {user?.role === 'admin' && (
          <button style={{ ...s.tab, ...(tab === 'users' ? s.tabActive : {}) }} onClick={() => setTab('users')}>
            👥 Utilisateurs
          </button>
        )}
        <button style={{ ...s.tab, ...(tab === 'logs' ? s.tabActive : {}) }} onClick={() => { setTab('logs'); api.getImportLog(100).then(setImportLog).catch(() => {}); }}>
          📋 Journal d'import
        </button>
      </div>

      {tab === 'config' && (
        <>
          {testResult && (
            <div style={{ ...s.alert,
              background: testResult.type === 'success' ? '#d4edda' : '#f8d7da',
              color: testResult.type === 'success' ? '#155724' : '#721c24',
            }}>{testResult.msg}</div>
          )}

          <div style={s.card}>
            <div style={s.cardHeader}><span style={s.cardIcon}>🔐</span> Connexion Gmail (IMAP) — moissonnage automatique</div>
            <p style={s.cardDesc}>Configure ton mot de passe d'application Gmail pour moissonner les rapports DMARC toutes les heures.</p>

            <FormRow label="Adresse Gmail" value={config.gmail_user || ''} onChange={v => update('gmail_user', v)} placeholder="votre.email@gmail.com" />
            <FormRow label="Mot de passe d'application" value={config.gmail_pass || ''} onChange={v => update('gmail_pass', v)}
              type={showPasswords.gmail_pass ? 'text' : 'password'} placeholder="abcd efgh ijkl mnop"
              action={<button style={s.toggleBtn} onClick={() => togglePassword('gmail_pass')}>{showPasswords.gmail_pass ? '🙈' : '👁️'}</button>}
              help={<span>Crée un mot de passe sur <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{color:'#0f3460'}}>myaccount.google.com/apppasswords</a></span>}
            />
            <FormRow label="Filtre Gmail (optionnel)" value={config.gmail_search || ''} onChange={v => update('gmail_search', v)} placeholder="subject:DMARC" />
            <FormRow label="Expéditeurs (virgule)" value={config.gmail_senders || ''} onChange={v => update('gmail_senders', v)} placeholder="dmarc@dmarcian.com, dmarc@google.com" help="Laisse vide pour chercher tous les expéditeurs" />
          </div>

          <div style={s.card}>
            <div style={s.cardHeader}><span style={s.cardIcon}>📧</span> Notifications email (SMTP)</div>
            <p style={s.cardDesc}>Reçois des alertes par email en cas d'activité suspecte.</p>

            <FormRow label="Serveur SMTP" value={config.smtp_host || ''} onChange={v => update('smtp_host', v)} placeholder="smtp.gmail.com" />
            <FormRow label="Utilisateur SMTP" value={config.smtp_user || ''} onChange={v => update('smtp_user', v)} placeholder="email@gmail.com" />
            <FormRow label="Mot de passe SMTP" value={config.smtp_pass || ''} onChange={v => update('smtp_pass', v)}
              type={showPasswords.smtp_pass ? 'text' : 'password'}
              action={<button style={s.toggleBtn} onClick={() => togglePassword('smtp_pass')}>{showPasswords.smtp_pass ? '🙈' : '👁️'}</button>} />
            <FormRow label="Email de notification" value={config.alert_email || ''} onChange={v => update('alert_email', v)} placeholder="vous@exemple.com" />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            <button style={s.primaryBtn} onClick={save} disabled={saving}>{saving ? 'Enregistrement...' : '💾 Enregistrer'}</button>
            {config.gmail_user && config.gmail_pass && (
              <>
                <button style={s.secondaryBtn} onClick={testConnection}>🔍 Tester IMAP</button>
                <button style={{ ...s.secondaryBtn, background: '#27ae60' }} onClick={fetchNow} disabled={fetching}>
                  {fetching ? '⏳ Moissonnage...' : '📥 Moissonner maintenant'}
                </button>
                <button style={{ ...s.secondaryBtn, background: '#e67e22' }} onClick={async () => {
                  try {
                    const res = await api.fetch('/api/config/mark-all-read', { method: 'POST' });
                    const data = await res.json();
                    alert(data.success ? `${data.count} message(s) marqués lus` : 'Erreur: ' + (data.error || 'inconnue'));
                  } catch (e) { alert('Erreur: ' + e.message); }
                }}>📬 Tout marquer lu</button>
              </>
            )}
          </div>
        </>
      )}

      {tab === 'password' && (
        <div style={s.card}>
          <div style={s.cardHeader}><span style={s.cardIcon}>🔑</span> Changer mon mot de passe</div>
          {pwdMsg && (
            <div style={{ ...s.alert, background: pwdMsg.type === 'success' ? '#d4edda' : '#f8d7da', color: pwdMsg.type === 'success' ? '#155724' : '#721c24' }}>
              {pwdMsg.text}
            </div>
          )}
          <form onSubmit={changePassword}>
            <FormRow label="Mot de passe actuel" value={pwdForm.oldPassword} onChange={v => setPwdForm(p => ({ ...p, oldPassword: v }))} type="password" />
            <FormRow label="Nouveau mot de passe" value={pwdForm.newPassword} onChange={v => setPwdForm(p => ({ ...p, newPassword: v }))} type="password" />
            <button style={s.primaryBtn} type="submit">Changer le mot de passe</button>
          </form>
        </div>
      )}

      {tab === 'users' && user?.role === 'admin' && <UserManagement user={user} />}

      {tab === 'logs' && (
        <div style={s.card}>
          <div style={s.cardHeader}><span style={s.cardIcon}>📋</span> Journal d'import des rapports</div>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={s.th}>Date</th><th style={s.th}>Source</th><th style={s.th}>Fichier</th><th style={s.th}>Statut</th><th style={s.th}>Message</th>
                </tr>
              </thead>
              <tbody>
                {importLog.map((log, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                    <td style={s.td}>{new Date(log.created_at).toLocaleString()}</td>
                    <td style={s.td}>{log.source}</td>
                    <td style={{ ...s.td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.filename}</td>
                    <td style={{ ...s.td, color: log.status === 'success' ? '#27ae60' : '#c0392b', fontWeight: 600 }}>{log.status}</td>
                    <td style={s.td}>{log.message}</td>
                  </tr>
                ))}
                {importLog.length === 0 && <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Aucun import pour l'instant</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FormRow({ label, value, onChange, placeholder, type = 'text', action, help }) {
  return (
    <div style={s.row}>
      <label style={s.label}>{label}</label>
      <div style={s.inputWrap}>
        <input style={s.input} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
        {action && <div style={s.inputAction}>{action}</div>}
      </div>
      {help && <div style={s.help}>{help}</div>}
    </div>
  );
}

const s = {
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '20px' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '20px' },
  tab: { padding: '10px 20px', border: 'none', borderRadius: '8px', background: '#e0e0e0', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#555' },
  tabActive: { background: '#1a1a2e', color: '#fff' },
  alert: { padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid transparent', fontSize: '0.9rem' },
  card: { background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '20px' },
  cardHeader: { fontSize: '1rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' },
  cardIcon: { fontSize: '1.2rem' },
  cardDesc: { fontSize: '0.85rem', color: '#666', marginBottom: '20px', lineHeight: 1.5 },
  row: { marginBottom: '16px' },
  label: { display: 'block', fontSize: '0.8rem', color: '#555', marginBottom: '4px', fontWeight: 600 },
  inputWrap: { display: 'flex', gap: '4px', maxWidth: '500px' },
  input: { flex: 1, padding: '10px 12px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', transition: 'border-color 0.2s' },
  inputAction: { display: 'flex', alignItems: 'center' },
  toggleBtn: { padding: '8px 10px', border: '2px solid #e0e0e0', borderRadius: '8px', background: '#f8f9fa', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 },
  help: { fontSize: '0.78rem', color: '#888', marginTop: '4px' },
  actions: { display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' },
  primaryBtn: { padding: '12px 28px', background: '#e94560', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem' },
  secondaryBtn: { padding: '12px 28px', background: '#0f3460', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem' },
  th: { padding: '8px 10px', borderBottom: '2px solid #eee', fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'left' },
  td: { padding: '6px 10px', borderBottom: '1px solid #eee', fontSize: '0.82rem' },
};

import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function Admin() {
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});

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
      const res = await fetch('/api/config/test-imap', { method: 'POST' });
      const data = await res.json();
      setTestResult({ type: data.success ? 'success' : 'error', msg: data.message || data.error });
    } catch (err) {
      setTestResult({ type: 'error', msg: err.message });
    }
    setTimeout(() => setTestResult(null), 8000);
  };

  const togglePassword = (key) => {
    setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div>
      <h1 style={s.title}>Administration</h1>

      {testResult && (
        <div style={{
          ...s.alert,
          background: testResult.type === 'success' ? '#d4edda' : '#f8d7da',
          color: testResult.type === 'success' ? '#155724' : '#721c24',
          borderColor: testResult.type === 'success' ? '#c3e6cb' : '#f5c6cb',
        }}>
          {testResult.msg}
        </div>
      )}

      <div style={s.card}>
        <div style={s.cardHeader}>
          <span style={s.cardIcon}>🔐</span>
          <span>Connexion Gmail (IMAP) — moissonnage automatique des rapports</span>
        </div>
        <p style={s.cardDesc}>
          Configure ton mot de passe d'application Gmail pour que l'application aille
          chercher automatiquement les rapports DMARC dans ta boîte de réception toutes les heures.
        </p>

        <FormRow
          label="Adresse Gmail"
          value={config.gmail_user || ''}
          onChange={v => update('gmail_user', v)}
          placeholder="votre.email@gmail.com"
        />
        <FormRow
          label="Mot de passe d'application"
          value={config.gmail_pass || ''}
          onChange={v => update('gmail_pass', v)}
          type={showPasswords.gmail_pass ? 'text' : 'password'}
          placeholder="abcd efgh ijkl mnop"
          action={
            <button style={s.toggleBtn} onClick={() => togglePassword('gmail_pass')}>
              {showPasswords.gmail_pass ? '🙈' : '👁️'}
            </button>
          }
          help={
            <span>
              Crée un mot de passe d'application sur{' '}
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer"
                style={{ color: '#0f3460' }}>
                https://myaccount.google.com/apppasswords
              </a>
            </span>
          }
        />
        <FormRow
          label="Filtre de recherche Gmail (optionnel)"
          value={config.gmail_search || ''}
          onChange={v => update('gmail_search', v)}
          placeholder="subject:DMARC"
          help="Laisse vide pour chercher tous les messages. Ex: subject:DMARC"
        />
      </div>

      <div style={s.card}>
        <div style={s.cardHeader}>
          <span style={s.cardIcon}>📧</span>
          <span>Notifications email (SMTP) — alertes de sécurité</span>
        </div>
        <p style={s.cardDesc}>
          Configure un serveur SMTP pour recevoir des alertes par email en cas
          d'activité suspecte détectée.
        </p>

        <FormRow
          label="Serveur SMTP"
          value={config.smtp_host || ''}
          onChange={v => update('smtp_host', v)}
          placeholder="smtp.gmail.com"
        />
        <FormRow
          label="Utilisateur SMTP"
          value={config.smtp_user || ''}
          onChange={v => update('smtp_user', v)}
          placeholder="votre.email@gmail.com"
        />
        <FormRow
          label="Mot de passe SMTP"
          value={config.smtp_pass || ''}
          onChange={v => update('smtp_pass', v)}
          type={showPasswords.smtp_pass ? 'text' : 'password'}
          action={
            <button style={s.toggleBtn} onClick={() => togglePassword('smtp_pass')}>
              {showPasswords.smtp_pass ? '🙈' : '👁️'}
            </button>
          }
        />
        <FormRow
          label="Email de notification"
          value={config.alert_email || ''}
          onChange={v => update('alert_email', v)}
          placeholder="vous@exemple.com"
        />
      </div>

      <div style={s.actions}>
        <button style={s.primaryBtn} onClick={save} disabled={saving}>
          {saving ? 'Enregistrement...' : '💾 Enregistrer la configuration'}
        </button>
        {config.gmail_user && config.gmail_pass && (
          <button style={s.secondaryBtn} onClick={testConnection}>
            🔍 Tester connexion IMAP
          </button>
        )}
      </div>

      <div style={s.helpCard}>
        <h4 style={{ margin: '0 0 8px', color: '#0f3460' }}>📘 Comment obtenir un mot de passe d'application Gmail</h4>
        <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.8, fontSize: '0.9rem' }}>
          <li>Va sur <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer">https://myaccount.google.com/security</a></li>
          <li>Active la <strong>vérification en deux étapes</strong> (si pas déjà fait)</li>
          <li>Va dans <strong>Mots de passe d'application</strong> (cherche dans la barre de recherche Google)</li>
          <li>Crée un mot de passe pour "Mail" et "Windows Computer"</li>
          <li>Copie le mot de passe généré (16 lettres) et colle-le ci-dessus</li>
        </ol>
      </div>
    </div>
  );
}

function FormRow({ label, value, onChange, placeholder, type = 'text', action, help }) {
  return (
    <div style={s.row}>
      <label style={s.label}>{label}</label>
      <div style={s.inputWrap}>
        <input
          style={s.input}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
        {action && <div style={s.inputAction}>{action}</div>}
      </div>
      {help && <div style={s.help}>{help}</div>}
    </div>
  );
}

const s = {
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '24px' },
  alert: {
    padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
    border: '1px solid', fontSize: '0.9rem',
  },
  card: {
    background: '#fff', borderRadius: '12px', padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '20px',
  },
  cardHeader: { fontSize: '1rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' },
  cardIcon: { fontSize: '1.2rem' },
  cardDesc: { fontSize: '0.85rem', color: '#666', marginBottom: '20px', lineHeight: 1.5 },
  row: { marginBottom: '16px' },
  label: { display: 'block', fontSize: '0.8rem', color: '#555', marginBottom: '4px', fontWeight: 600 },
  inputWrap: { display: 'flex', gap: '4px', maxWidth: '500px' },
  input: {
    flex: 1, padding: '10px 12px', border: '2px solid #e0e0e0', borderRadius: '8px',
    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace',
    transition: 'border-color 0.2s',
  },
  inputAction: { display: 'flex', alignItems: 'center' },
  toggleBtn: {
    padding: '8px 10px', border: '2px solid #e0e0e0', borderRadius: '8px',
    background: '#f8f9fa', cursor: 'pointer', fontSize: '1rem', lineHeight: 1,
  },
  help: { fontSize: '0.78rem', color: '#888', marginTop: '4px' },
  actions: { display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' },
  primaryBtn: {
    padding: '12px 28px', background: '#e94560', color: '#fff', border: 'none',
    borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem',
  },
  secondaryBtn: {
    padding: '12px 28px', background: '#0f3460', color: '#fff', border: 'none',
    borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem',
  },
  helpCard: {
    background: '#f8f9fa', borderRadius: '12px', padding: '20px',
    border: '1px solid #e0e0e0',
  },
};

import React, { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(username, password);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={s.wrapper}>
      <form style={s.form} onSubmit={submit}>
        <div style={s.title}>DMARC</div>
        <div style={s.subtitle}>Analyseur de rapports</div>
        {error && <div style={s.error}>{error}</div>}
        <input style={s.input} type="text" placeholder="Nom d'utilisateur" value={username}
          onChange={e => setUsername(e.target.value)} autoFocus />
        <input style={s.input} type="password" placeholder="Mot de passe" value={password}
          onChange={e => setPassword(e.target.value)} />
        <button style={s.btn} type="submit" disabled={loading}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}

const s = {
  wrapper: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  form: {
    background: '#fff', borderRadius: '16px', padding: '40px', width: '340px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center',
  },
  title: { fontSize: '2.5rem', fontWeight: 800, color: '#e94560', letterSpacing: '4px', marginBottom: '4px' },
  subtitle: { fontSize: '0.85rem', color: '#888', marginBottom: '28px' },
  error: { background: '#fde8e8', color: '#c0392b', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px' },
  input: { width: '100%', padding: '12px 16px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' },
  btn: { width: '100%', padding: '12px', background: '#e94560', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', marginTop: '8px' },
};

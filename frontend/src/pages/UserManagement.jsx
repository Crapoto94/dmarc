import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function UserManagement({ user }) {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'viewer' });
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => api.getUsers().then(setUsers).catch(() => {});
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.createUser(newUser.username, newUser.password, newUser.role);
      setNewUser({ username: '', password: '', role: 'viewer' });
      setShowForm(false);
      setMsg({ type: 'success', text: 'Utilisateur créé' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
    setTimeout(() => setMsg(null), 3000);
  };

  const changeRole = async (id, role) => {
    await api.updateUser(id, { role });
    load();
  };

  const resetPassword = async (id) => {
    const pwd = prompt('Nouveau mot de passe :');
    if (!pwd || pwd.length < 4) return alert('Minimum 4 caractères');
    await api.updateUser(id, { password: pwd });
    setMsg({ type: 'success', text: 'Mot de passe réinitialisé' });
    setTimeout(() => setMsg(null), 3000);
  };

  const remove = async (id) => {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    try {
      await api.deleteUser(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Utilisateurs</h1>
        <button style={s.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Annuler' : '+ Nouvel utilisateur'}
        </button>
      </div>

      {msg && (
        <div style={{ ...s.alert, background: msg.type === 'success' ? '#d4edda' : '#f8d7da', color: msg.type === 'success' ? '#155724' : '#721c24' }}>
          {msg.text}
        </div>
      )}

      {showForm && (
        <form style={s.form} onSubmit={create}>
          <input style={s.input} placeholder="Nom d'utilisateur" value={newUser.username}
            onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))} required />
          <input style={s.input} type="password" placeholder="Mot de passe" value={newUser.password}
            onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} required />
          <select style={s.input} value={newUser.role}
            onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
            <option value="viewer">Consultation</option>
            <option value="admin">Administrateur</option>
          </select>
          <button style={s.submitBtn} type="submit">Créer</button>
        </form>
      )}

      <div style={s.list}>
        {users.map(u => (
          <div key={u.id} style={s.card}>
            <div style={s.cardLeft}>
              <div style={s.username}>{u.username}</div>
              <div style={s.roleBadge(u.role)}>{u.role === 'admin' ? 'Admin' : 'Consultation'}</div>
              <div style={s.date}>Créé le {new Date(u.created_at).toLocaleDateString()}</div>
            </div>
            <div style={s.cardActions}>
              <select
                value={u.role}
                onChange={e => changeRole(u.id, e.target.value)}
                style={s.roleSelect}
                disabled={u.id === user?.id}
              >
                <option value="viewer">Consultation</option>
                <option value="admin">Admin</option>
              </select>
              <button style={s.smallBtn} onClick={() => resetPassword(u.id)} title="Réinitialiser mot de passe">
                🔑
              </button>
              {u.id !== user?.id && (
                <button style={{ ...s.smallBtn, color: '#c0392b' }} onClick={() => remove(u.id)} title="Supprimer">
                  🗑️
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e' },
  addBtn: { padding: '10px 20px', background: '#0f3460', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 },
  alert: { padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' },
  form: { background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' },
  input: { padding: '10px 12px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', minWidth: '180px', flex: 1 },
  submitBtn: { padding: '10px 24px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  card: {
    background: '#fff', borderRadius: '10px', padding: '16px 20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center',
  },
  cardLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  username: { fontWeight: 600, color: '#1a1a2e' },
  roleBadge: (role) => ({
    padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
    background: role === 'admin' ? '#fde8e8' : '#e8f4fd',
    color: role === 'admin' ? '#c0392b' : '#0f3460',
  }),
  date: { fontSize: '0.78rem', color: '#aaa' },
  cardActions: { display: 'flex', gap: '8px', alignItems: 'center' },
  roleSelect: {
    padding: '6px 10px', border: '1px solid #ddd', borderRadius: '6px',
    fontSize: '0.8rem', background: '#f8f9fa',
  },
  smallBtn: {
    padding: '6px 8px', border: '1px solid #ddd', borderRadius: '6px',
    background: '#f8f9fa', cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1,
  },
};

import React, { useEffect } from 'react';
import { analyzeRecord } from '../lib/dmarcUtils.js';

function resultColor(result) {
  if (result === 'pass') return '#27ae60';
  if (result === 'fail') return '#c0392b';
  return 'var(--text-secondary)';
}

function boolColor(v) {
  return v ? '#27ae60' : '#c0392b';
}

function Field({ label, value, color, mono }) {
  return (
    <div style={s.field}>
      <span style={s.fieldLabel}>{label}</span>
      <span
        style={{
          ...s.fieldValue,
          ...(mono ? { fontFamily: 'monospace' } : {}),
          ...(color ? { color } : {}),
        }}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}

export default function RecordDetailModal({ record, rblStatus, onClose }) {
  const a = analyzeRecord(record);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const date = a.begin_ts ? new Date(a.begin_ts * 1000).toLocaleDateString() : '—';

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <h3 style={s.title}>Analyse détaillée</h3>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ ...s.badge, background: a.dmarcResult === 'pass' ? '#27ae60' : '#c0392b', color: '#fff' }}>
            DMARC {a.dmarcResult.toUpperCase()}
          </span>
          {rblStatus && (
            <span
              style={{
                ...s.badge,
                background: rblStatus.listed ? '#c0392b' : '#27ae60',
                color: '#fff',
              }}
              title={rblStatus.listed ? rblStatus.lists.join(', ') : undefined}
            >
              {rblStatus.listed ? `🚫 Blacklistée (${rblStatus.lists.length})` : '✅ Non blacklistée'}
            </span>
          )}
        </div>

        <div style={s.grid}>
          <Field label="Source IP" value={a.source_ip} mono />
          <Field label="Header From" value={a.headerFrom} />
          <Field label="Rapporteur" value={a.org_name} />
          <Field label="Date" value={date} />
          <Field label="Volume" value={a.count?.toLocaleString()} />
          <Field label="Org / Pays IP" value={[a.ip_org, a.ip_country].filter(Boolean).join(' — ') || '—'} />
          <Field label="SPF Domain" value={a.spfDomain} mono />
          <Field label="SPF Result" value={a.spfResult} color={resultColor(a.spfResult)} />
          <Field label="SPF Aligned" value={a.spfAligned ? 'Oui' : 'Non'} color={boolColor(a.spfAligned)} />
          <Field label="DKIM Domain" value={a.dkimDomain} mono />
          <Field label="DKIM Selector" value={a.dkimSelector} mono />
          <Field label="DKIM Result" value={a.dkimResult} color={resultColor(a.dkimResult)} />
          <Field label="DKIM Aligned" value={a.dkimAligned ? 'Oui' : 'Non'} color={boolColor(a.dkimAligned)} />
          <Field label="DMARC Result" value={a.dmarcResult} color={resultColor(a.dmarcResult)} />
          <Field label="Disposition" value={a.disposition} />
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modal: {
    background: 'var(--card-bg)', borderRadius: 12, padding: 24,
    boxShadow: '0 8px 40px rgba(0,0,0,0.3)', maxWidth: 640, width: '100%',
    maxHeight: '90vh', overflowY: 'auto',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)', margin: 0 },
  closeBtn: {
    border: 'none', background: 'var(--bg)', color: 'var(--text-secondary)',
    width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem',
  },
  badge: {
    padding: '4px 12px', borderRadius: 6, fontWeight: 700, fontSize: '0.75rem',
  },
  grid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px',
  },
  field: { padding: '8px 12px', background: 'var(--bg)', borderRadius: 8 },
  fieldLabel: {
    display: 'block', fontSize: '0.68rem', color: 'var(--text-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3,
  },
  fieldValue: { fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600, wordBreak: 'break-word' },
};

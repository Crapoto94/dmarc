import React from 'react';
import { analyzeRecord } from '../lib/dmarcUtils.js';

function resultColor(result) {
  if (result === 'pass') return '#27ae60';
  if (result === 'fail') return '#c0392b';
  return '#f39c12';
}

export function SpfCell({ record }) {
  const a = analyzeRecord(record);
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: resultColor(a.spfResult) }}>
        {a.spfResult || '—'}
      </span>
      <span style={{ fontSize: '0.68rem', color: a.spfAligned ? '#27ae60' : '#c0392b' }}>
        {a.spfAligned ? '✓ aligné' : '✗ non aligné'}
      </span>
    </span>
  );
}

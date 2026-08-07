import React from 'react';

export default function SortableTh({ label, field, sortBy, sortDir, onSort, title, style }) {
  const active = sortBy === field;
  return (
    <th
      style={{ ...style, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      onClick={() => onSort(field)}
      title={title || `Trier par ${label}`}
    >
      {label}
      <span style={{ marginLeft: 4, fontSize: '0.7rem', opacity: active ? 1 : 0.35 }}>
        {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    </th>
  );
}

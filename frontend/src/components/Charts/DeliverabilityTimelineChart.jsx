import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CATEGORY_COLORS = {
  perfect: '#27ae60',
  dkim: '#3498db',
  spf: '#f39c12',
  nonconforme: '#c0392b',
};

export default function DeliverabilityTimelineChart({ data = [], category = 'perfect' }) {
  if (!data || data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Aucune donnée</div>;
  }

  const chartData = data.map(d => ({ date: d.day, total: d.total }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" fontSize={10} tick={{ fill: 'var(--text-secondary)' }} angle={-40} textAnchor="end" height={60} />
        <YAxis fontSize={11} tick={{ fill: 'var(--text-secondary)' }} />
        <Tooltip formatter={(v) => [v.toLocaleString(), 'Volume']} />
        <Bar dataKey="total" fill={CATEGORY_COLORS[category] || '#0f3460'} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

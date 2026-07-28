import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function TimelineChart({ data = [] }) {
  if (!data || data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Aucune donnée temporelle</div>;
  }

  const grouped = {};
  for (const d of data) {
    const date = new Date(d.begin_ts * 1000).toLocaleDateString();
    if (!grouped[date]) grouped[date] = { date, pass: 0, fail: 0 };
    grouped[date].pass += d.pass || 0;
    grouped[date].fail += d.fail || 0;
  }

  const chartData = Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" fontSize={11} tick={{ fill: '#888' }} />
        <YAxis fontSize={11} tick={{ fill: '#888' }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="pass" name="Authentifié" fill="#27ae60" radius={[4, 4, 0, 0]} stackId="a" />
        <Bar dataKey="fail" name="Non authentifié" fill="#e74c3c" radius={[4, 4, 0, 0]} stackId="a" />
      </BarChart>
    </ResponsiveContainer>
  );
}

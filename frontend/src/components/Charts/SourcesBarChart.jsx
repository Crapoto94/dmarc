import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function SourcesBarChart({ data = [] }) {
  if (!data || data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Aucune source</div>;
  }

  const chartData = data.map(d => ({
    name: d.source_ip.length > 15 ? d.source_ip.slice(0, 15) + '…' : d.source_ip,
    ip: d.source_ip,
    pass: d.pass || 0,
    fail: d.fail || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis type="number" fontSize={11} tick={{ fill: '#888' }} />
        <YAxis dataKey="name" type="category" fontSize={10} tick={{ fill: '#888' }} />
        <Tooltip formatter={(v, n, p) => [v.toLocaleString(), n]} labelFormatter={() => ''} />
        <Legend />
        <Bar dataKey="pass" name="OK" fill="#27ae60" stackId="a" />
        <Bar dataKey="fail" name="Échec" fill="#e74c3c" stackId="a" />
      </BarChart>
    </ResponsiveContainer>
  );
}

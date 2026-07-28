import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = { pass: '#27ae60', fail: '#e74c3c' };

export default function AuthPieChart({ pass = 0, fail = 0 }) {
  const data = [
    { name: 'Authentifié', value: pass, color: COLORS.pass },
    { name: 'Non authentifié', value: fail, color: COLORS.fail },
  ].filter(d => d.value > 0);

  if (data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Aucune donnée</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          dataKey="value"
          paddingAngle={4}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} stroke="none" />
          ))}
        </Pie>
        <Tooltip formatter={(v) => v.toLocaleString()} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

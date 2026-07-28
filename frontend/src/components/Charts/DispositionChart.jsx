import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#27ae60', '#f39c12', '#e74c3c', '#3498db'];

export default function DispositionChart({ data = [] }) {
  if (!data || data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Aucune donnée</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%" cy="50%"
          innerRadius={50}
          outerRadius={90}
          dataKey="total"
          nameKey="disposition"
          paddingAngle={3}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
          ))}
        </Pie>
        <Tooltip formatter={(v) => v.toLocaleString()} />
        <Legend formatter={(v) => v || 'none'} />
      </PieChart>
    </ResponsiveContainer>
  );
}

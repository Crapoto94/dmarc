import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export default function WeeklyHeatmap({ data }) {
  const chartData = DAYS.map((day, i) => {
    const d = data.find(x => x.dow === i);
    return {
      day,
      total: d ? d.total : 0,
      pass: d ? d.pass : 0,
      pct: d && d.total > 0 ? Math.round((d.pass / d.total) * 100) : 0,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="var(--text-secondary)" />
        <YAxis tick={{ fontSize: 11 }} stroke="var(--text-secondary)" />
        <Tooltip formatter={(v, name) => [v, name === 'pass' ? 'OK' : name === 'total' ? 'Total' : '']} />
        <Bar dataKey="pass" name="pass" fill="#27ae60" radius={[4, 4, 0, 0]} />
        <Bar dataKey="total" name="total" fill="#e0e0e0" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

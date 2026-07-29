import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function TopDomainsChart({ data }) {
  const chartData = data.map(d => ({
    name: d.header_from?.length > 18 ? d.header_from.slice(0, 18) + '…' : d.header_from || '?',
    total: d.total,
    pass: d.pass,
    dkim_only: d.dkim_only,
    spf_only: d.spf_only,
    both_fail: d.both_fail,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--text-secondary)" />
        <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} stroke="var(--text-secondary)" />
        <Tooltip />
        <Legend />
        <Bar dataKey="pass" name="✅ DKIM+SPF" stackId="a" fill="#27ae60" />
        <Bar dataKey="dkim_only" name="🔶 DKIM seul" stackId="a" fill="#f39c12" />
        <Bar dataKey="spf_only" name="🔷 SPF seul" stackId="a" fill="#3498db" />
        <Bar dataKey="both_fail" name="❌ Aucun" stackId="a" fill="#c0392b" />
      </BarChart>
    </ResponsiveContainer>
  );
}

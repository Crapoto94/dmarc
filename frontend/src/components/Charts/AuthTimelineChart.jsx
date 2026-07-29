import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AuthTimelineChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--text-secondary)" />
        <YAxis tick={{ fontSize: 11 }} stroke="var(--text-secondary)" />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="dkim_pass" name="DKIM OK" stroke="#27ae60" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="spf_pass" name="SPF OK" stroke="#3498db" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

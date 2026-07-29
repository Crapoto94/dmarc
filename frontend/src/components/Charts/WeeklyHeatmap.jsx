const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export default function WeeklyHeatmap({ data }) {
  const map = {};
  let maxVal = 0;
  for (const d of data) {
    const key = `${d.dow}-${d.hour}`;
    map[key] = d.pass;
    if (d.pass > maxVal) maxVal = d.pass;
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(24, 1fr)`, gap: 2, minWidth: 600 }}>
        <div />
        {hours.map(h => (
          <div key={h} style={{ fontSize: 10, color: 'var(--text-secondary)', textAlign: 'center' }}>{h}h</div>
        ))}
        {DAYS.map((day, dow) => (
          <>
            <div key={day} style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>{day}</div>
            {hours.map(h => {
              const key = `${dow}-${h}`;
              const val = map[key] || 0;
              const intensity = maxVal > 0 ? val / maxVal : 0;
              return (
                <div
                  key={key}
                  title={`${day} ${h}h: ${val} emails OK`}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 3,
                    background: `rgba(39, 174, 96, ${Math.max(0.05, intensity)})`,
                    border: '1px solid var(--border)',
                  }}
                />
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

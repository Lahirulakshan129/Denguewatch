export default function JobLogs({ logs = [] }) {
  if (!logs.length) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
        No job history yet.
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Status</th>
            <th>Started</th>
            <th>Duration</th>
            <th>Dry run</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{log.type}</td>
              <td style={{
                color: log.status === 'success' ? 'var(--accent-green)'
                  : log.status === 'failed' ? 'var(--accent-red)'
                  : 'var(--accent-blue)',
              }}>
                {log.status}
              </td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                {log.startedAt ? new Date(log.startedAt).toLocaleString('en-GB') : '—'}
              </td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                {log.durationMs != null ? `${log.durationMs}ms` : '—'}
              </td>
              <td>{log.dryRun ? 'yes' : 'no'}</td>
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {log.error || (log.result ? JSON.stringify(log.result).slice(0, 80) : '—')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

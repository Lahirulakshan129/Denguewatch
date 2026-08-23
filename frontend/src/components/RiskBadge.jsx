export default function RiskBadge({ level, score }) {
  const cls = level === 'HIGH' ? 'tag-high' : level === 'MEDIUM' ? 'tag-medium' : 'tag-low'
  return (
    <span className={`tag ${cls}`} style={{ gap: 4 }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: 'currentColor', display: 'inline-block',
        animation: level === 'HIGH' ? 'pulse-glow 2s infinite' : 'none'
      }} />
      {level}
      {score != null && <span style={{ opacity: 0.7 }}> {score}</span>}
    </span>
  )
}

export { RiskBadge }
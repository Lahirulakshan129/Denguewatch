import { computeRisk } from '../hooks/useWeather'

// Approximate district positions as circles on a simplified SVG map
const DISTRICT_POSITIONS = {
  "Jaffna":        { x: 195, y: 28 },
  "Kilinochchi":   { x: 195, y: 68 },
  "Mannar":        { x: 140, y: 88 },
  "Vavuniya":      { x: 200, y: 110 },
  "Mullaitivu":    { x: 230, y: 90 },
  "Trincomalee":   { x: 240, y: 145 },
  "Batticaloa":    { x: 255, y: 205 },
  "Ampara":        { x: 245, y: 250 },
  "Hambantota":    { x: 195, y: 350 },
  "Matara":        { x: 155, y: 360 },
  "Galle":         { x: 110, y: 345 },
  "Ratnapura":     { x: 130, y: 295 },
  "Monaragala":    { x: 210, y: 295 },
  "Badulla":       { x: 200, y: 255 },
  "Nuwara Eliya":  { x: 170, y: 240 },
  "Kandy":         { x: 160, y: 200 },
  "Matale":        { x: 165, y: 165 },
  "Kurunegala":    { x: 135, y: 165 },
  "Puttalam":      { x: 100, y: 155 },
  "Anuradhapura":  { x: 168, y: 128 },
  "Polonnaruwa":   { x: 210, y: 185 },
  "Kegalle":       { x: 125, y: 240 },
  "Kalutara":      { x: 95,  y: 295 },
  "Gampaha":       { x: 85,  y: 255 },
  "Colombo":       { x: 80,  y: 275 },
}

function getRiskFill(level) {
  if (level === 'HIGH')   return '#ef444488'
  if (level === 'MEDIUM') return '#f9731688'
  return '#22c55e66'
}
function getRiskStroke(level) {
  if (level === 'HIGH')   return '#ef4444'
  if (level === 'MEDIUM') return '#f97316'
  return '#22c55e'
}

export default function SriLankaMap({ weatherData, predictions, onDistrictClick, selectedDistrict }) {
  // Latest weather per district
  const latestWeather = {}
  weatherData.forEach(r => {
    const d = r.district
    if (!latestWeather[d]) { latestWeather[d] = r; return }
    const existing = latestWeather[d]
    const newer = parseInt(r.year) > parseInt(existing.year) ||
      (parseInt(r.year) === parseInt(existing.year) && parseInt(r.week) > parseInt(existing.week))
    if (newer) latestWeather[d] = r
  })

  const predMap = {}
  predictions.forEach(p => { predMap[p.district] = p })

  const districts = Object.keys(DISTRICT_POSITIONS).map(name => {
    const weather = latestWeather[name]
    const pos = DISTRICT_POSITIONS[name]
    const { level } = weather ? computeRisk(weather) : { level: 'LOW' }
    const pred = predMap[name]
    return { name, pos, level, pred, weather, hasData: !!weather }
  })

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox="0 0 340 400"
        style={{ width: '100%', maxWidth: 340, display: 'block', margin: '0 auto' }}
      >
        {/* Sri Lanka outline - simplified path */}
        <path
          d="M140,20 L155,18 L170,15 L185,14 L200,16 L215,22 L228,32 L238,45 L246,60 L252,78 L255,98 L258,118 L262,140 L265,162 L266,185 L264,210 L260,232 L253,255 L244,275 L232,295 L218,312 L205,328 L192,342 L180,355 L168,362 L155,368 L142,366 L130,358 L118,345 L108,328 L99,310 L92,290 L88,268 L87,248 L89,228 L93,208 L98,188 L100,166 L99,144 L100,122 L103,100 L108,80 L114,62 L120,46 L130,33 Z"
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* District dots */}
        {districts.map(({ name, pos, level, pred, weather, hasData }) => {
          const isSelected = selectedDistrict === name
          const r = isSelected ? 9 : 7
          return (
            <g
              key={name}
              style={{ cursor: 'pointer' }}
              onClick={() => onDistrictClick?.(name)}
            >
              {isSelected && (
                <circle
                  cx={pos.x} cy={pos.y} r={14}
                  fill="none"
                  stroke={getRiskStroke(level)}
                  strokeWidth={1.5}
                  opacity={0.5}
                  strokeDasharray="3 3"
                />
              )}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={r}
                fill={hasData ? getRiskFill(level) : 'rgba(255,255,255,0.08)'}
                stroke={hasData ? getRiskStroke(level) : 'rgba(255,255,255,0.2)'}
                strokeWidth={isSelected ? 2 : 1}
              />
              {pred?.predicted_cases && (
                <text
                  x={pos.x}
                  y={pos.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    fontSize: '6px',
                    fill: '#fff',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    pointerEvents: 'none',
                  }}
                >
                  {parseInt(pred.predicted_cases) > 99 ? '99+' : pred.predicted_cases}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
        {[['HIGH','#ef4444'],['MEDIUM','#f97316'],['LOW','#22c55e']].map(([l, c]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
            {l}
          </div>
        ))}
      </div>
    </div>
  )
}
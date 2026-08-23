import { useState, useMemo } from 'react'

export default function DistrictTable({ weatherData, predictions, dengue, onDistrictClick }) {
  const [sort, setSort]       = useState({ col: 'predicted_cases', dir: 'desc' })
  const [filter, setFilter]   = useState('')
  const [riskFilter, setRisk] = useState('ALL')

  // Build per-district merged rows
  const rows = useMemo(() => {
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

    // Latest prediction per district
    const predMap = {}
    predictions.forEach(p => { predMap[p.district] = p })

    // Latest dengue per district
    const dengueMap = {}
    if (dengue?.length) dengue.forEach(d => {
      const curr = dengueMap[d.district]
      if (!curr || parseInt(d.week) > parseInt(curr.week)) dengueMap[d.district] = d
    })

    const names = new Set([
      ...Object.keys(latestWeather),
      ...Object.keys(predMap),
      ...Object.keys(dengueMap),
    ])

    return Array.from(names).map((district) => {
      const w = latestWeather[district]
      const pred = predMap[district]
      const act = dengueMap[district]
      return {
        district,
        week: w?.week ?? pred?.predicted_week ?? act?.week,
        year: w?.year ?? pred?.predicted_year ?? act?.year,
        avg_temp: parseFloat(w?.avg_temp) || 0,
        humidity: parseFloat(w?.humidity) || 0,
        precipitation: parseFloat(w?.precipitation) || 0,
        wind_speed: parseFloat(w?.wind_speed) || 0,
        predicted_cases: pred ? parseInt(pred.predicted_cases) : null,
        confidence_low: pred ? parseInt(pred.confidence_low) : null,
        confidence_high: pred ? parseInt(pred.confidence_high) : null,
        reported_cases: act ? parseInt(act.cases) : null,
      }
    })
  }, [weatherData, predictions, dengue])

  const filtered = useMemo(() => {
    return rows
      .filter(r => !filter || r.district.toLowerCase().includes(filter.toLowerCase()))
      .filter(r => riskFilter === 'ALL' || r.risk_level === riskFilter)
      .sort((a, b) => {
        let va = a[sort.col], vb = b[sort.col]
        if (va == null) va = sort.dir === 'asc' ? Infinity : -Infinity
        if (vb == null) vb = sort.dir === 'asc' ? Infinity : -Infinity
        if (typeof va === 'string') return sort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
        return sort.dir === 'asc' ? va - vb : vb - va
      })
  }, [rows, filter, riskFilter, sort])

  const toggleSort = (col) => setSort(s => ({
    col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc'
  }))
  const SortIcon = ({ col }) => {
    if (sort.col !== col) return <span style={{ opacity: 0.2 }}>↕</span>
    return <span style={{ color: 'var(--accent-blue)' }}>{sort.dir === 'asc' ? '↑' : '↓'}</span>
  }

  const high   = rows.filter(r => r.risk_level === 'HIGH').length
  const medium = rows.filter(r => r.risk_level === 'MEDIUM').length
  const low    = rows.filter(r => r.risk_level === 'LOW').length

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search district…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ width: 200 }}
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('district')}>District <SortIcon col="district" /></th>
              <th onClick={() => toggleSort('avg_temp')}>Temp °C <SortIcon col="avg_temp" /></th>
              <th onClick={() => toggleSort('humidity')}>Humidity % <SortIcon col="humidity" /></th>
              <th onClick={() => toggleSort('precipitation')}>Rain mm <SortIcon col="precipitation" /></th>
              <th onClick={() => toggleSort('predicted_cases')}>Predicted <SortIcon col="predicted_cases" /></th>
              <th onClick={() => toggleSort('reported_cases')}>Reported <SortIcon col="reported_cases" /></th>
              <th>Week</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr
                key={row.district}
                style={{ cursor: 'pointer' }}
                onClick={() => onDistrictClick?.(row)}
              >
                <td>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {row.district}
                  </span>
                </td>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)', color: getTempColor(row.avg_temp) }}>
                    {row.avg_temp.toFixed(1)}
                  </span>
                </td>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)', color: getHumColor(row.humidity) }}>
                    {row.humidity.toFixed(1)}
                  </span>
                </td>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)', color: getRainColor(row.precipitation) }}>
                    {row.precipitation.toFixed(1)}
                  </span>
                </td>
                <td>
                  {row.predicted_cases != null ? (
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#ef4444' }}>
                        {row.predicted_cases}
                      </span>
                      {row.confidence_low != null && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>
                          [{row.confidence_low}–{row.confidence_high}]
                        </span>
                      )}
                    </div>
                  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </td>
                <td>
                  {row.reported_cases != null
                    ? <span style={{ fontFamily: 'var(--font-mono)', color: '#eab308' }}>{row.reported_cases}</span>
                    : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                  W{String(row.week).padStart(2,'0')} {row.year}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                  No districts match your filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function getTempColor(t) {
  if (t >= 30) return '#ef4444'
  if (t >= 26) return '#f97316'
  return 'var(--text-secondary)'
}
function getHumColor(h) {
  if (h >= 80) return '#3b82f6'
  if (h >= 70) return '#14b8a6'
  return 'var(--text-secondary)'
}
function getRainColor(r) {
  if (r >= 25) return '#3b82f6'
  if (r >= 10) return '#14b8a6'
  return 'var(--text-secondary)'
}
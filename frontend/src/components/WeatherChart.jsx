import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const COLORS = {
  avg_temp: '#f97316',
  humidity: '#3b82f6',
  precipitation: '#14b8a6',
  wind_speed: '#a855f7',
  predicted_cases: '#ef4444',
  cases: '#eab308',
}

const LABELS = {
  avg_temp: 'Avg Temp (°C)',
  humidity: 'Humidity (%)',
  precipitation: 'Rainfall (mm)',
  wind_speed: 'Wind (km/h)',
  predicted_cases: 'Predicted Cases',
  cases: 'Reported Cases',
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-strong)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: 'var(--text-secondary)' }}>{LABELS[p.dataKey] || p.dataKey}:</span>
          <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
            {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export function WeatherTrendChart({ data, metrics = ['avg_temp', 'humidity'] }) {
  if (!data?.length) return <EmptyChart message="No weather yet. Admin: click Fetch Weather to pull last week from Open-Meteo." />

  const chartData = data.map(row => ({
    week: `W${String(row.week || '').padStart(2,'0')}`,
    ...metrics.reduce((acc, m) => ({ ...acc, [m]: parseFloat(row[m]) || 0 }), {})
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
        <defs>
          {metrics.map(m => (
            <linearGradient key={m} id={`grad_${m}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS[m] || '#888'} stopOpacity={0.25} />
              <stop offset="100%" stopColor={COLORS[m] || '#888'} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
        <Tooltip content={<CustomTooltip />} />
        {metrics.map(m => (
          <Area
            key={m}
            type="monotone"
            dataKey={m}
            stroke={COLORS[m] || '#888'}
            strokeWidth={2}
            fill={`url(#grad_${m})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function PredictionChart({ predictions, dengue }) {
  if (!predictions?.length) return <EmptyChart message="Run prediction to see results" />

  // Merge prediction + actual by district
  const dengueMap = {}
  if (dengue?.length) {
    dengue.forEach(r => { dengueMap[r.district] = parseInt(r.cases) || 0 })
  }

  const data = predictions
    .slice()
    .sort((a, b) => parseInt(b.predicted_cases) - parseInt(a.predicted_cases))
    .slice(0, 15)
    .map(r => ({
      district: r.district?.replace(' District', ''),
      predicted: parseInt(r.predicted_cases) || 0,
      actual: dengueMap[r.district] ?? null,
      low: parseInt(r.confidence_low) || 0,
      high: parseInt(r.confidence_high) || 0,
    }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 70 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis dataKey="district" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="predicted" fill={COLORS.predicted_cases} radius={[0, 4, 4, 0]} maxBarSize={18} name="predicted_cases" />
        {Object.keys(dengueMap).length > 0 && (
          <Bar dataKey="actual" fill={COLORS.cases} radius={[0, 4, 4, 0]} maxBarSize={18} name="cases" />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DistrictTrendChart({ data, district }) {
  if (!data?.length) return <EmptyChart message="No data for this district" />

  const chartData = data
    .filter(r => r.district === district)
    .sort((a, b) => {
      const ya = parseInt(a.year), yb = parseInt(b.year)
      if (ya !== yb) return ya - yb
      return parseInt(a.week) - parseInt(b.week)
    })
    .map(r => ({
      week: `W${String(r.week).padStart(2,'0')}`,
      temp: parseFloat(r.avg_temp) || 0,
      humidity: parseFloat(r.humidity) || 0,
      rain: parseFloat(r.precipitation) || 0,
    }))

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="temp" stroke={COLORS.avg_temp} strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="humidity" stroke={COLORS.humidity} strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="rain" stroke={COLORS.precipitation} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function PredictionHistoryChart({ allPredictions }) {
  if (!allPredictions?.length) return <EmptyChart message="No forecast weeks yet — run prediction after weather is in the database" />

  const byWeek = {}
  allPredictions.forEach(r => {
    const year = parseInt(r.predicted_year) || 0
    const week = parseInt(r.predicted_week) || 0
    const key = `${year}_${String(week).padStart(2,'0')}`
    if (!byWeek[key]) byWeek[key] = { sort: year * 100 + week, week: `Forecast W${String(week).padStart(2,'0')} ${year}`, predicted_cases: 0 }
    byWeek[key].predicted_cases += parseInt(r.predicted_cases) || 0
  })

  const data = Object.values(byWeek).sort((a, b) => a.sort - b.sort).slice(-12)

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="grad_total" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} width={36} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="predicted_cases" stroke="#ef4444" strokeWidth={2} fill="url(#grad_total)" dot={{ r: 3 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function EmptyChart({ message }) {
  return (
    <div style={{
      height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic',
      border: '1px dashed var(--border)', borderRadius: 8
    }}>
      {message}
    </div>
  )
}

export function DistrictYearlyComparisonChart({ district, dengueCounts, allPredictions }) {
  if (!district) return <EmptyChart message="Select a district from the sidebar" />
  
  // X-axis: Weeks 1 to 52
  const weeks = Array.from({ length: 52 }, (_, i) => i + 1)
  
  // Organize data: { week: 1, '2022': 500, '2023': 600, '2026 Forecasted': 300 }
  const dataMap = {}
  weeks.forEach(w => {
    dataMap[w] = { week: `Week ${w}` }
  })
  
  const years = new Set()
  
  // Historical Actuals
  if (dengueCounts) {
    dengueCounts.filter(r => r.district === district).forEach(r => {
      const w = parseInt(r.week)
      const y = r.year
      if (dataMap[w]) {
        dataMap[w][y] = parseInt(r.cases) || 0
        years.add(y)
      }
    })
  }
  
  // Forecasted
  let forecastYear = null
  if (allPredictions) {
    allPredictions.filter(r => r.district === district).forEach(r => {
      const w = parseInt(r.predicted_week)
      const y = r.predicted_year
      forecastYear = y
      const key = `${y} Forecasted`
      if (dataMap[w]) {
        dataMap[w][key] = parseInt(r.predicted_cases) || 0
        years.add(key)
      }
    })
  }
  
  const chartData = Object.values(dataMap).filter((row) =>
    Object.keys(row).some((k) => k !== 'week' && row[k] != null)
  )
  const sortedYears = Array.from(years).sort()
  
  const YEAR_COLORS = [
    '#3b82f6', // 2022 blue
    '#10b981', // 2023 green
    '#f59e0b', // 2024 yellow
    '#ef4444', // 2025 red
    '#8b5cf6', // 2026 purple
    '#64748b'  // forecasted gray
  ]

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
        {sortedYears.map((year, i) => (
          <Line 
            key={year} 
            type="monotone" 
            dataKey={year} 
            stroke={String(year).includes('Forecasted') ? '#64748b' : YEAR_COLORS[i % YEAR_COLORS.length]} 
            strokeWidth={String(year).includes('Forecasted') ? 2 : 1.5}
            strokeDasharray={String(year).includes('Forecasted') ? '5 5' : '0'}
            connectNulls
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
import { useState } from 'react'
import {
  Activity, CloudRain, Brain, Database, FileText, RefreshCw,
  Map, BarChart2, Settings, AlertTriangle, CheckCircle2,
  TrendingUp, Wind, Droplets, Thermometer, Eye
} from 'lucide-react'
import { useWeather, computeRisk, getRiskColor } from './hooks/useWeather'
import StatCard from './components/StatCard'
import SkeletonLoader from './components/SkeletonLoader'
import DistrictTable from './components/DistrictTable'
import JobLogs from './components/logs/JobLogs'
import DatasetInputPanel from './components/dengue/DatasetInputPanel'
import DengueInputPanel from './components/dengue/DengueInputPanel'
import SriLankaMap from './components/SriLankaMap'
import { WeatherTrendChart, PredictionChart, PredictionHistoryChart, DistrictTrendChart, DistrictYearlyComparisonChart } from './components/WeatherChart'
import { useAuth } from './hooks/useAuth'
import Login from './components/Login'
import RiskBadge from './components/RiskBadge'

const TABS = [
  { id: 'overview',    label: 'Overview',    icon: <BarChart2 size={14} /> },
  { id: 'predictions', label: 'Predictions', icon: <Brain size={14} /> },
  { id: 'districts',  label: 'Districts',   icon: <Map size={14} /> },
  { id: 'data',       label: 'Data Input',  icon: <Database size={14} /> },
  { id: 'logs',       label: 'Job Logs',    icon: <FileText size={14} /> },
]

export default function App() {
  const { user, logout, loading: authLoading } = useAuth()
  const [tab, setTab]               = useState('overview')
  const [dryRun, setDryRun]         = useState(false)
  const [selectedDistrict, setSel]  = useState(null)
  const [toast, setToast]           = useState(null)
  const {
    status, logs, weatherData, predictions, allPredictions,
    dengueCounts, weatherStats, loading, jobRunning,
    lastRefresh, runWeatherJob, runPrediction,
    uploadDengue, saveDengue, refresh
  } = useWeather()

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  if (authLoading) return <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}><span className="spinner" /></div>
  if (!user) return <Login />

  const handleWeatherTrigger = async () => {
    try {
      const r = await runWeatherJob(dryRun)
      const weekLabel = r.weeks?.length ? ` across ${r.weeks.length} weeks` : ''
      showToast(`Weather saved: ${r.districts_fetched} district-weeks${weekLabel}${dryRun ? ' (dry run)' : ''}`)
    } catch (e) { showToast(e.message, 'error') }
  }

  const handlePredictionTrigger = async () => {
    try {
      const r = await runPrediction(dryRun)
      if (dryRun) {
        showToast('Preview only — forecasts were not saved. Turn off Dry Run, then run again.')
        return
      }
      const note = r.engine === 'keras' ? ' · BiLSTM model' : r.fallback ? ' · fallback (ML host down)' : ''
      showToast(`Saved next-week forecast for ${r.district_count} districts${note}`)
    } catch (e) { showToast(e.message, 'error') }
  }

  // Derived stats
  const latestWeather = {}
  weatherData.forEach(r => {
    const d = r.district
    if (!latestWeather[d]) { latestWeather[d] = r; return }
    const existing = latestWeather[d]
    const newer = parseInt(r.year) > parseInt(existing.year) ||
      (parseInt(r.year) === parseInt(existing.year) && parseInt(r.week) > parseInt(existing.week))
    if (newer) latestWeather[d] = r
  })
  const latestRows = Object.values(latestWeather)
  const riskCounts = latestRows.reduce((acc, r) => {
    const { level } = computeRisk(r)
    acc[level] = (acc[level] || 0) + 1
    return acc
  }, {})
  const totalPredicted = predictions.reduce((s, p) => s + (parseInt(p.predicted_cases) || 0), 0)
  const avgTemp = latestRows.length
    ? (latestRows.reduce((s, r) => s + (parseFloat(r.avg_temp) || 0), 0) / latestRows.length).toFixed(1)
    : null
  const avgHum = latestRows.length
    ? (latestRows.reduce((s, r) => s + (parseFloat(r.humidity) || 0), 0) / latestRows.length).toFixed(1)
    : null
  const avgRain = latestRows.length
    ? (latestRows.reduce((s, r) => s + (parseFloat(r.precipitation) || 0), 0) / latestRows.length).toFixed(1)
    : null

  // National average data for trend chart
  const weeklyAverages = (() => {
    const byWeek = {}
    weatherData.forEach(r => {
      const key = `${r.year}_${String(r.week).padStart(2,'0')}`
      if (!byWeek[key]) byWeek[key] = { week: r.week, year: r.year, items: [] }
      byWeek[key].items.push(r)
    })
    return Object.values(byWeek)
      .sort((a, b) => parseInt(a.year) !== parseInt(b.year) ? parseInt(a.year) - parseInt(b.year) : parseInt(a.week) - parseInt(b.week))
      .map(({ week, year, items }) => ({
        week, year,
        district: 'National',
        avg_temp:      (items.reduce((s,r) => s + parseFloat(r.avg_temp||0), 0) / items.length).toFixed(1),
        humidity:      (items.reduce((s,r) => s + parseFloat(r.humidity||0), 0) / items.length).toFixed(1),
        precipitation: (items.reduce((s,r) => s + parseFloat(r.precipitation||0), 0) / items.length).toFixed(1),
        wind_speed:    (items.reduce((s,r) => s + parseFloat(r.wind_speed||0), 0) / items.length).toFixed(1),
      }))
  })()

  const districtWeather = selectedDistrict
    ? weatherData.filter(r => r.district === selectedDistrict)
      .sort((a, b) => parseInt(a.year) !== parseInt(b.year) ? parseInt(a.year) - parseInt(b.year) : parseInt(a.week) - parseInt(b.week))
    : []

  const selectedWeather = selectedDistrict ? latestWeather[selectedDistrict] : null
  const selectedRisk    = selectedWeather ? computeRisk(selectedWeather) : null
  const selectedPred    = selectedDistrict ? predictions.find(p => p.district === selectedDistrict) : null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 1000,
          background: toast.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
          border: `1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
          color: toast.type === 'error' ? '#fca5a5' : '#86efac',
          borderRadius: 10, padding: '12px 18px', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 8,
          animation: 'fadeUp 0.2s ease',
          backdropFilter: 'blur(8px)',
          maxWidth: 360
        }}>
          {toast.type === 'error'
            ? <AlertTriangle size={14} />
            : <CheckCircle2 size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        background: 'rgba(10,12,15,0.9)',
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 56 }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32,
                background: 'linear-gradient(135deg, #ef4444, #f97316)',
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16
              }}>🦟</div>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  DengueWatch
                </p>
                <p style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1 }}>
                  Sri Lanka · ML Pipeline
                </p>
              </div>
            </div>

            {/* Nav tabs */}
            <nav style={{ display: 'flex', gap: 2, marginLeft: 12 }}>
              {TABS.filter(t => t.id !== 'data' || ['ADMIN', 'OFFICER'].includes(user?.role)).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 6, border: 'none',
                    background: tab === t.id ? 'var(--bg-elevated)' : 'transparent',
                    color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: tab === t.id ? 500 : 400,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {t.icon}
                  {t.label}
                  {t.id === 'logs' && logs.some(l => l.status === 'running') && (
                    <span style={{ width: 6, height: 6, background: '#3b82f6', borderRadius: '50%' }} />
                  )}
                </button>
              ))}
            </nav>

            <div style={{ flex: 1 }} />

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {user?.role === 'ADMIN' && (
                <>
                  {/* Dry run toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-muted)' }}>
                    <label className="toggle">
                      <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
                      <span className="toggle-slider" />
                    </label>
                    Dry Run (preview, don’t save)
                  </div>

                  {/* Weather trigger */}
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12 }}
                    disabled={jobRunning.weather}
                    onClick={handleWeatherTrigger}
                  >
                    {jobRunning.weather
                      ? <span className="spinner" />
                      : <CloudRain size={13} />}
                    Fetch 4 weeks
                  </button>

                  {/* Prediction trigger */}
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 12 }}
                    disabled={jobRunning.prediction}
                    onClick={handlePredictionTrigger}
                  >
                    {jobRunning.prediction
                      ? <span className="spinner" />
                      : <Brain size={13} />}
                    Run Prediction
                  </button>
                </>
              )}

              <button
                className="btn btn-ghost"
                style={{ padding: '8px 10px' }}
                onClick={refresh}
                title="Refresh all data"
              >
                <RefreshCw size={13} />
              </button>

              <button
                className="btn btn-ghost"
                style={{ padding: '8px 10px', color: 'var(--accent-red)' }}
                onClick={logout}
                title="Log Out"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, maxWidth: 1400, margin: '0 auto', padding: '28px 24px', width: '100%' }}>

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <div className="fade-up">
            
            {/* Top row: Heatmap + Core Stats & History */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 24 }}>
              
              {/* Main Feature: Prediction Heatmap */}
              <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--accent-red)' }}>
                    Dengue Outbreak Heatmap
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Interactive forecast based on latest ML pipeline execution. Click any district to filter.
                  </p>
                </div>
                <div style={{ flex: 1, minHeight: 450 }}>
                  <SriLankaMap
                    predictions={predictions}
                    selectedDistrict={selectedDistrict}
                    onDistrictClick={name => {
                      setSel(name === selectedDistrict ? null : name)
                      setTab('districts')
                    }}
                  />
                </div>
              </div>

              {/* Right column: Stats and Prediction History */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Highlight Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <StatCard
                    label="Predicted Cases"
                    value={loading ? null : predictions.length ? totalPredicted.toLocaleString() : '—'}
                    sub="National total, next week"
                    accent="var(--accent-red)"
                    icon={<AlertTriangle size={15} />}
                    loading={loading}
                  />
                  <StatCard
                    label="Highest Risk"
                    value={loading ? null : predictions.length > 0 ? predictions.sort((a,b)=>b.predicted_cases-a.predicted_cases)[0].district : '—'}
                    sub="Predicted peak district"
                    accent="var(--accent-orange)"
                    icon={<TrendingUp size={15} />}
                    loading={loading}
                  />
                  <StatCard
                    label="Avg Temperature"
                    value={loading ? null : avgTemp ? `${avgTemp}°C` : '—'}
                    sub="Latest week, national average"
                    accent="var(--accent-blue)"
                    icon={<Thermometer size={15} />}
                    loading={loading}
                  />
                  <StatCard
                    label="Avg Rainfall"
                    value={loading ? null : avgRain ? `${avgRain}mm` : '—'}
                    sub="Latest week, national average"
                    accent="var(--accent-blue)"
                    icon={<CloudRain size={15} />}
                    loading={loading}
                  />
                </div>

                {/* Prediction History Chart */}
                <div className="card" style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ marginBottom: 14 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Outbreak Trajectory</h3>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Sum of predicted cases across all 25 districts, by the week being forecasted
                    </p>
                  </div>
                  {loading ? <div className="skeleton" style={{ flex: 1, minHeight: 200 }} /> : (
                    <div style={{ flex: 1, minHeight: 200 }}>
                      <PredictionHistoryChart allPredictions={allPredictions} />
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Secondary row: Weather Context */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>Temperature & Humidity Context</h3>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Supporting meteorological data</p>
                </div>
                {loading ? <div className="skeleton" style={{ height: 180 }} /> : (
                  <WeatherTrendChart data={weeklyAverages} metrics={['avg_temp','humidity']} />
                )}
              </div>

              <div className="card" style={{ padding: 20 }}>
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>Rainfall & Wind Context</h3>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Supporting meteorological data</p>
                </div>
                {loading ? <div className="skeleton" style={{ height: 180 }} /> : (
                  <WeatherTrendChart data={weeklyAverages} metrics={['precipitation','wind_speed']} />
                )}
              </div>
            </div>

            {/* Recent logs strip */}
            {logs.length > 0 && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h4 style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>PIPELINE LOGS</h4>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setTab('logs')}>
                    View all →
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {logs.slice(0, 3).map(log => (
                    <div key={log.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      fontSize: 12, padding: '6px 0',
                      borderBottom: '1px solid var(--border)'
                    }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: log.status === 'success' ? 'var(--accent-green)' : log.status === 'failed' ? 'var(--accent-red)' : 'var(--accent-blue)'
                      }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{log.type}</span>
                      <span style={{ flex: 1, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        {new Date(log.startedAt).toLocaleString('en-GB', { day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit' })}
                      </span>
                      <span style={{ color: log.status === 'success' ? 'var(--accent-green)' : log.status === 'failed' ? 'var(--accent-red)' : 'var(--accent-blue)', fontSize: 11 }}>
                        {log.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PREDICTIONS TAB ── */}
        {tab === 'predictions' && (
          <div className="fade-up">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>
                  ML Predictions
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  TensorFlow/Keras model — 4-week weather + historical case lookback
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {user?.role === 'ADMIN' && (
                <button
                  className="btn btn-primary"
                  disabled={jobRunning.prediction}
                  onClick={handlePredictionTrigger}
                >
                  {jobRunning.prediction ? <span className="spinner" /> : <Brain size={14} />}
                  {jobRunning.prediction ? 'Running…' : 'Run Prediction'}
                </button>
                )}
              </div>
            </div>

            {/* Main Layout: Sidebar + Chart */}
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24, alignItems: 'start', minHeight: 'calc(100vh - 200px)' }}>
              
              {/* Sidebar */}
              <div className="card" style={{ padding: '16px 0', height: '100%', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                <div style={{ padding: '0 16px', marginBottom: 16 }}>
                  <h4 style={{ fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Districts
                  </h4>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <button
                    onClick={() => setSel(null)}
                    style={{
                      textAlign: 'left', padding: '10px 16px',
                      border: 'none', borderLeft: selectedDistrict === null ? '3px solid var(--accent-blue)' : '3px solid transparent',
                      color: selectedDistrict === null ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: selectedDistrict === null ? 'rgba(59,130,246,0.05)' : 'transparent',
                      fontWeight: selectedDistrict === null ? 600 : 400,
                      fontSize: 13, cursor: 'pointer', transition: 'all 0.15s'
                    }}
                  >
                    📊 National Overview
                  </button>
                  <div style={{ height: 1, background: 'var(--border)', margin: '8px 16px' }} />
                  {Array.from(new Set([...dengueCounts.map(d => d.district), ...allPredictions.map(p => p.district)]))
                    .filter(Boolean)
                    .sort()
                    .map(d => (
                      <button
                        key={d}
                        onClick={() => setSel(d)}
                        style={{
                          textAlign: 'left', padding: '10px 16px',
                          border: 'none', borderLeft: selectedDistrict === d ? '3px solid var(--accent-blue)' : '3px solid transparent',
                          color: selectedDistrict === d ? 'var(--text-primary)' : 'var(--text-secondary)',
                          background: selectedDistrict === d ? 'rgba(59,130,246,0.05)' : 'transparent',
                          fontWeight: selectedDistrict === d ? 600 : 400,
                          fontSize: 13, cursor: 'pointer', transition: 'all 0.15s'
                        }}
                      >
                        {d}
                      </button>
                    ))}
                </div>
              </div>

              {/* Main Chart Area */}
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {selectedDistrict ? (
                  <div className="card" style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: 20 }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>
                        {selectedDistrict} - Daily Trend Comparisons
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        Historical actual cases vs current forecast models
                      </p>
                    </div>
                    
                    <div style={{ flex: 1, minHeight: 400 }}>
                      {loading ? (
                        <SkeletonLoader rows={1} cols={1} />
                      ) : (
                        <DistrictYearlyComparisonChart 
                          district={selectedDistrict} 
                          dengueCounts={dengueCounts} 
                          allPredictions={allPredictions} 
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Top district prediction cards */}
                    {predictions.length > 0 && (
                      <>
                        <h4 style={{ fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
                          Top Districts by Predicted Cases
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10, marginBottom: 28 }}>
                          {predictions
                            .slice()
                            .sort((a, b) => parseInt(b.predicted_cases) - parseInt(a.predicted_cases))
                            .slice(0, 4)
                            .map(p => {
                              const cases = parseInt(p.predicted_cases) || 0;
                              const severityColor = cases > 200 ? 'var(--risk-high)' : cases > 50 ? 'var(--risk-medium)' : 'var(--risk-low)';
                              
                              return (
                                <div
                                  key={p.district}
                                  className="card"
                                  style={{ padding: 16, cursor: 'pointer' }}
                                  onClick={() => setSel(p.district)}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <p style={{ fontSize: 13, fontWeight: 600 }}>{p.district}</p>
                                  </div>
                                  <p style={{
                                    fontFamily: 'var(--font-display)',
                                    fontWeight: 800, fontSize: 28,
                                    color: severityColor,
                                    lineHeight: 1
                                  }}>
                                    {p.predicted_cases}
                                  </p>
                                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                                    predicted cases
                                  </p>
                                  {p.confidence_low != null && (
                                    <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                      CI: [{p.confidence_low} – {p.confidence_high}]
                                    </p>
                                  )}
                                </div>
                              )
                            })}
                        </div>
                      </>
                    )}

                    {/* Bar chart */}
                    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                        All Districts — Predicted vs Reported
                      </h3>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
                        Top 15 by predicted case count
                        {dengueCounts.length > 0 && ' · Yellow bars show reported cases where available'}
                      </p>
                      {loading
                        ? <div className="skeleton" style={{ height: 280 }} />
                        : <PredictionChart predictions={predictions} dengue={dengueCounts} />}
                    </div>

                    {/* All predictions table */}
                    {predictions.length > 0 && (
                      <div className="card" style={{ padding: 20 }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
                          All 25 Districts
                        </h3>
                        <div style={{ overflowX: 'auto' }}>
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>District</th>
                                <th>Predicted Cases</th>
                                <th>Confidence Interval</th>
                                <th>Reported Cases</th>
                                <th>Week</th>
                              </tr>
                            </thead>
                            <tbody>
                              {predictions
                                .slice()
                                .sort((a, b) => parseInt(b.predicted_cases) - parseInt(a.predicted_cases))
                                .map(p => {
                                  const cases = parseInt(p.predicted_cases) || 0;
                                  const severityColor = cases > 200 ? 'var(--risk-high)' : cases > 50 ? 'var(--risk-medium)' : 'var(--risk-low)';
                                  const reported = dengueCounts.find(d => d.district === p.district)
                                  return (
                                    <tr key={p.district} style={{ cursor: 'pointer' }}
                                      onClick={() => setSel(p.district)}>
                                      <td style={{ fontWeight: 500 }}>{p.district}</td>
                                      <td>
                                        <span style={{
                                          fontFamily: 'var(--font-mono)', fontWeight: 700,
                                          color: severityColor, fontSize: 14
                                        }}>
                                          {p.predicted_cases}
                                        </span>
                                      </td>
                                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                                        {p.confidence_low != null ? `[${p.confidence_low} – ${p.confidence_high}]` : '—'}
                                      </td>
                                      <td style={{ fontFamily: 'var(--font-mono)', color: '#eab308' }}>
                                        {reported ? reported.cases : '—'}
                                      </td>
                                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                                        W{String(p.predicted_week).padStart(2,'0')} {p.predicted_year}
                                      </td>
                                    </tr>
                                  )
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {!loading && !predictions.length && (
                      <div style={{
                        textAlign: 'center', padding: 64,
                        border: '1px dashed var(--border)', borderRadius: 12
                      }}>
                        <Brain size={40} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 8 }}>No predictions yet</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 13 }}>
                          Make sure weather data exists, then click Run Prediction to generate forecasts.
                        </p>
                        {user?.role === 'ADMIN' && (
                          <button className="btn btn-primary" onClick={handlePredictionTrigger}>
                            <Brain size={14} /> Run Prediction Now
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ── DISTRICTS TAB ── */}
        {tab === 'districts' && (
          <div className="fade-up">
            <div style={{ display: 'grid', gridTemplateColumns: selectedDistrict ? '1fr 360px' : '1fr', gap: 20 }}>
              {/* Main table + map */}
              <div>
                <div style={{ marginBottom: 20 }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>
                    District Outbreak Details
                  </h2>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                    {latestRows.length} districts with weather data · click a row to inspect
                  </p>
                </div>

                <div className="card" style={{ padding: 20, marginBottom: 16 }}>
                  {loading
                    ? <SkeletonLoader rows={8} cols={6} />
                    : <DistrictTable
                        weatherData={weatherData}
                        predictions={predictions}
                        dengue={dengueCounts}
                        onDistrictClick={row => setSel(row.district === selectedDistrict ? null : row.district)}
                      />}
                </div>
              </div>

              {/* District detail panel */}
              {selectedDistrict && (
                <div className="fade-up">
                  <div className="card" style={{ padding: 20, position: 'sticky', top: 80 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18 }}>{selectedDistrict}</h3>
                        {selectedRisk && <RiskBadge level={selectedRisk.level} score={selectedRisk.score} />}
                      </div>
                      <button className="btn btn-ghost" style={{ padding: '5px 8px' }} onClick={() => setSel(null)}>✕</button>
                    </div>

                    {/* Predicted cases */}
                    {selectedPred && (
                      <div style={{
                        background: 'rgba(239,68,68,0.07)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: 8, padding: '12px 16px', marginBottom: 16
                      }}>
                        <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 4 }}>
                          ML Prediction — W{String(selectedPred.predicted_week).padStart(2,'0')} {selectedPred.predicted_year}
                        </p>
                        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: '#ef4444', lineHeight: 1 }}>
                          {selectedPred.predicted_cases}
                          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 6, fontFamily: 'var(--font-body)', fontWeight: 400 }}>
                            cases
                          </span>
                        </p>
                        {selectedPred.confidence_low != null && (
                          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                            95% CI: [{selectedPred.confidence_low} – {selectedPred.confidence_high}]
                          </p>
                        )}
                      </div>
                    )}

                    {/* Supporting Weather Data */}
                    {selectedWeather && (
                      <div>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Supporting Meteorological Data</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                          {[
                            { label: 'Avg Temp', value: `${parseFloat(selectedWeather.avg_temp).toFixed(1)}°C`, icon: '🌡', color: '#f97316' },
                            { label: 'Humidity', value: `${parseFloat(selectedWeather.humidity).toFixed(1)}%`, icon: '💧', color: '#3b82f6' },
                            { label: 'Rainfall', value: `${parseFloat(selectedWeather.precipitation).toFixed(1)}mm`, icon: '🌧', color: '#14b8a6' },
                            { label: 'Wind', value: `${parseFloat(selectedWeather.wind_speed).toFixed(1)} km/h`, icon: '💨', color: '#a855f7' },
                          ].map(item => (
                            <div key={item.label} style={{
                              background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px',
                              border: '1px solid var(--border)'
                            }}>
                              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{item.icon} {item.label}</p>
                              <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color: item.color }}>{item.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Mini trend chart */}
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>WEATHER HISTORY</p>
                      {loading
                        ? <div className="skeleton" style={{ height: 160 }} />
                        : <DistrictTrendChart data={weatherData} district={selectedDistrict} />}
                      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                        {[['temp','#f97316'],['humidity','#3b82f6'],['rain','#14b8a6']].map(([l,c]) => (
                          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                            <span style={{ width: 12, height: 2, background: c, display: 'inline-block', borderRadius: 1 }} />
                            {l}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DATA INPUT TAB ── */}
        {tab === 'data' && (
          <div className="fade-up">
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>
                Data Input
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                Upload weekly dengue case counts to improve ML prediction accuracy
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <DatasetInputPanel />
                <DengueInputPanel
                  dengueCounts={dengueCounts}
                  onUpload={uploadDengue}
                  onSave={saveDengue}
                />
              </div>

              {/* Info panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="card" style={{ padding: 18 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📊 DB Table Schema Requirements</h4>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    <p>The system stores weather and cases historically to train the model.</p>
                    <br />
                    <p style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                      Supports upsert. If the Year, Week, and District already exist, the metrics will be updated.
                    </p>
                  </div>
                </div>

                <div className="card" style={{ padding: 18 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📁 CSV Template</h4>
                  <div style={{
                    background: 'var(--bg-elevated)',
                    borderRadius: 6, padding: '10px 12px',
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: 'var(--text-secondary)',
                    lineHeight: 2,
                    overflowX: 'auto',
                    whiteSpace: 'nowrap'
                  }}>
                    <p style={{ color: 'var(--accent-green)' }}>Year,Week,District,Avg_Temp,Avg_Humidity,Total_Rainfall,Avg_Windspeed,Dengue_Cases</p>
                    <p>2020,1,Ampara,27.08,84.24,22.05,14.06,120</p>
                    <p>2020,2,Ampara,26.14,80.38,48.57,20.82,105</p>
                    <p style={{ color: 'var(--text-muted)' }}>…</p>
                  </div>
                </div>

                <div className="card" style={{ padding: 18 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📈 Data Summary</h4>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                      <span>Dengue records</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{dengueCounts.length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                      <span>Unique weeks</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                        {new Set(dengueCounts.map(r => `${r.week}_${r.year}`)).size}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                      <span>Weather rows</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{weatherStats?.rows ?? '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                      <span>Weather weeks</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{weatherStats?.weeks ?? '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── LOGS TAB ── */}
        {tab === 'logs' && (
          <div className="fade-up">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>
                  Job History
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  {logs.length} executions recorded · auto-refreshes every 30s
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {status?.nextRun && (
                  <div style={{
                    fontSize: 12, color: 'var(--text-muted)', padding: '8px 14px',
                    background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)'
                  }}>
                    Next run: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {new Date(status.nextRun).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Status cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
              {(['weather','prediction','dengue_upload']).map(type => {
                const typeLogs = logs.filter(l => l.type === type)
                const last = typeLogs[0]
                const success = typeLogs.filter(l => l.status === 'success').length
                return (
                  <div key={type} className="card" style={{ padding: 16 }}>
                    <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 8 }}>
                      {type.replace('_',' ')}
                    </p>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, marginBottom: 4 }}>
                      {typeLogs.length}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {success} succeeded
                    </p>
                    {last && (
                      <p style={{ fontSize: 10, color: last.status === 'success' ? 'var(--accent-green)' : last.status === 'failed' ? 'var(--accent-red)' : 'var(--accent-blue)', marginTop: 6 }}>
                        Last: {last.status}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {loading ? <SkeletonLoader rows={6} cols={4} /> : <JobLogs logs={logs} />}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 11, color: 'var(--text-muted)'
      }}>
        <span>DengueWatch · 25 districts · TF/Keras ML pipeline</span>
        {lastRefresh && (
          <span>Last refreshed {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        )}
      </footer>
    </div>
  )
}
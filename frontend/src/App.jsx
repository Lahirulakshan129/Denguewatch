import { useState } from 'react'
import {
  Activity, CloudRain, Brain, Database, FileText, RefreshCw,
  Map, BarChart2, Settings, AlertTriangle, CheckCircle2,
  TrendingUp, Wind, Droplets, Thermometer, Eye
} from 'lucide-react'
import { useWeather, computeRisk, getRiskColor } from './hooks/useWeather'
import StatCard from './components/StatCard'
import SkeletonLoader from './components/SkeletonLoader'
import RiskBadge from './components/RiskBadge'
import DistrictTable from './components/DistrictTable'
import JobLogs from './components/logs/JobLogs'
import DengueInputPanel from './components/dengue/DengueInputPanel'
import SriLankaMap from './components/SriLankaMap'
import {
  WeatherTrendChart, PredictionChart,
  PredictionHistoryChart, DistrictTrendChart
} from './components/WeatherChart'

const TABS = [
  { id: 'overview',    label: 'Overview',    icon: <BarChart2 size={14} /> },
  { id: 'predictions', label: 'Predictions', icon: <Brain size={14} /> },
  { id: 'districts',  label: 'Districts',   icon: <Map size={14} /> },
  { id: 'data',       label: 'Data Input',  icon: <Database size={14} /> },
  { id: 'logs',       label: 'Job Logs',    icon: <FileText size={14} /> },
]

export default function App() {
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

  const handleWeatherTrigger = async () => {
    try {
      const r = await runWeatherJob(dryRun)
      showToast(`Weather fetched: ${r.districts_fetched} districts${dryRun ? ' (dry run)' : ''}`)
    } catch (e) { showToast(e.message, 'error') }
  }

  const handlePredictionTrigger = async () => {
    try {
      const r = await runPrediction(dryRun)
      showToast(`Prediction done: ${r.district_count} districts${dryRun ? ' (dry run)' : ''}`)
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
              {TABS.map(t => (
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
              {/* Dry run toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-muted)' }}>
                <label className="toggle">
                  <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
                Dry Run
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
                Fetch Weather
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

              <button
                className="btn btn-ghost"
                style={{ padding: '8px 10px' }}
                onClick={refresh}
                title="Refresh all data"
              >
                <RefreshCw size={13} />
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
            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
              <StatCard
                label="High Risk Districts"
                value={loading ? null : riskCounts.HIGH || 0}
                sub="As of latest fetch"
                accent="var(--risk-high)"
                icon={<AlertTriangle size={15} />}
                loading={loading}
              />
              <StatCard
                label="Medium Risk"
                value={loading ? null : riskCounts.MEDIUM || 0}
                sub="WHO thresholds"
                accent="var(--risk-medium)"
                icon={<Activity size={15} />}
                loading={loading}
              />
              <StatCard
                label="Low Risk"
                value={loading ? null : riskCounts.LOW || 0}
                sub="Favourable conditions"
                accent="var(--risk-low)"
                icon={<CheckCircle2 size={15} />}
                loading={loading}
              />
              <StatCard
                label="Predicted Cases"
                value={loading ? null : totalPredicted > 0 ? totalPredicted.toLocaleString() : '—'}
                sub="National total, next week"
                accent="var(--accent-blue)"
                icon={<TrendingUp size={15} />}
                loading={loading}
              />
              <StatCard
                label="Avg Temperature"
                value={loading ? null : avgTemp ? `${avgTemp}°C` : '—'}
                sub="National average"
                accent="var(--accent-orange)"
                icon={<Thermometer size={15} />}
                loading={loading}
              />
              <StatCard
                label="Avg Humidity"
                value={loading ? null : avgHum ? `${avgHum}%` : '—'}
                sub="National average"
                accent="var(--accent-blue)"
                icon={<Droplets size={15} />}
                loading={loading}
              />
            </div>

            {/* Charts row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>Temperature & Humidity Trend</h3>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>National weekly averages</p>
                </div>
                {loading ? <div className="skeleton" style={{ height: 220 }} /> : (
                  <WeatherTrendChart data={weeklyAverages} metrics={['avg_temp','humidity']} />
                )}
              </div>

              <div className="card" style={{ padding: 20 }}>
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>Rainfall & Wind Trend</h3>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>National weekly averages</p>
                </div>
                {loading ? <div className="skeleton" style={{ height: 220 }} /> : (
                  <WeatherTrendChart data={weeklyAverages} metrics={['precipitation','wind_speed']} />
                )}
              </div>
            </div>

            {/* Prediction history + map */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>Total Predicted Cases — History</h3>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Sum across all 25 districts per week</p>
                </div>
                {loading ? <div className="skeleton" style={{ height: 180 }} /> : (
                  <PredictionHistoryChart allPredictions={allPredictions} />
                )}
              </div>

              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Risk Map</h3>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Click district to select</p>
                <SriLankaMap
                  weatherData={weatherData}
                  predictions={predictions}
                  selectedDistrict={selectedDistrict}
                  onDistrictClick={name => {
                    setSel(name === selectedDistrict ? null : name)
                    setTab('districts')
                  }}
                />
              </div>
            </div>

            {/* Recent logs strip */}
            {logs.length > 0 && (
              <div style={{ marginTop: 16 }} className="card" style={{ padding: 16, marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h4 style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>RECENT JOBS</h4>
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
                <button
                  className="btn btn-primary"
                  disabled={jobRunning.prediction}
                  onClick={handlePredictionTrigger}
                >
                  {jobRunning.prediction ? <span className="spinner" /> : <Brain size={14} />}
                  {jobRunning.prediction ? 'Running…' : 'Run Prediction'}
                </button>
              </div>
            </div>

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
                    .slice(0, 6)
                    .map(p => {
                      const weather = latestWeather[p.district]
                      const { level } = weather ? computeRisk(weather) : { level: 'LOW' }
                      return (
                        <div
                          key={p.district}
                          className="card"
                          style={{ padding: 16, cursor: 'pointer' }}
                          onClick={() => { setSel(p.district); setTab('districts') }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <p style={{ fontSize: 13, fontWeight: 600 }}>{p.district}</p>
                            <RiskBadge level={level} />
                          </div>
                          <p style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 800, fontSize: 28,
                            color: getRiskColor(level),
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
                        <th>Weather Risk</th>
                        <th>Reported Cases</th>
                        <th>Week</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictions
                        .slice()
                        .sort((a, b) => parseInt(b.predicted_cases) - parseInt(a.predicted_cases))
                        .map(p => {
                          const weather = latestWeather[p.district]
                          const { level } = weather ? computeRisk(weather) : { level: 'LOW' }
                          const reported = dengueCounts.find(d => d.district === p.district)
                          return (
                            <tr key={p.district} style={{ cursor: 'pointer' }}
                              onClick={() => { setSel(p.district); setTab('districts') }}>
                              <td style={{ fontWeight: 500 }}>{p.district}</td>
                              <td>
                                <span style={{
                                  fontFamily: 'var(--font-mono)', fontWeight: 700,
                                  color: getRiskColor(level), fontSize: 14
                                }}>
                                  {p.predicted_cases}
                                </span>
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                                {p.confidence_low != null ? `[${p.confidence_low} – ${p.confidence_high}]` : '—'}
                              </td>
                              <td><RiskBadge level={level} /></td>
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
                <button className="btn btn-primary" onClick={handlePredictionTrigger}>
                  <Brain size={14} /> Run Prediction Now
                </button>
              </div>
            )}
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
                    District Analysis
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

                    {/* Weather grid */}
                    {selectedWeather && (
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
                    )}

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
              <DengueInputPanel
                dengueCounts={dengueCounts}
                onUpload={uploadDengue}
                onSave={saveDengue}
              />

              {/* Info panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="card" style={{ padding: 18 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📊 Model Input Requirements</h4>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    <p>The model uses <strong style={{ color: 'var(--text-primary)' }}>4 weeks lookback</strong> for both weather and dengue counts.</p>
                    <br />
                    <p style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                      Input shape: [25 districts × (4 weeks × 5 weather features + 4 dengue counts)] = 24 features
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
                    lineHeight: 2
                  }}>
                    <p style={{ color: 'var(--accent-green)' }}>district,week,year,cases</p>
                    <p>Colombo,22,2025,47</p>
                    <p>Gampaha,22,2025,31</p>
                    <p>Kandy,22,2025,28</p>
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
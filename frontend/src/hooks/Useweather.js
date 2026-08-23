import { useState, useEffect, useCallback } from 'react'
import * as api from '../api/weatherApi'

export function useWeather() {
  const [status, setStatus]           = useState(null)
  const [logs, setLogs]               = useState([])
  const [weatherData, setWeatherData] = useState([])
  const [predictions, setPredictions] = useState([])
  const [allPredictions, setAllPredictions] = useState([])
  const [dengueCounts, setDengueCounts] = useState([])
  const [weatherStats, setWeatherStats] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [jobRunning, setJobRunning]   = useState({ weather: false, prediction: false })
  const [errors, setErrors]           = useState({})
  const [lastRefresh, setLastRefresh] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const results = await Promise.allSettled([
      api.getStatus(),
      api.getLogs(50),
      api.getWeatherData(),
      api.getPredictions(),
      api.getAllPredictions(),
      api.getDengueCounts(),
      api.getWeatherStats(),
    ])
    const [s, l, w, p, ap, d, ws] = results
    if (s.status === 'fulfilled') setStatus(s.value)
    if (l.status === 'fulfilled') setLogs(l.value)
    if (w.status === 'fulfilled') setWeatherData(w.value)
    if (p.status === 'fulfilled') setPredictions(p.value)
    if (ap.status === 'fulfilled') setAllPredictions(ap.value)
    if (d.status === 'fulfilled') setDengueCounts(d.value)
    if (ws.status === 'fulfilled') setWeatherStats(ws.value)
    setLoading(false)
    setLastRefresh(new Date())
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  const runWeatherJob = useCallback(async (dryRun = false) => {
    setJobRunning(j => ({ ...j, weather: true }))
    try {
      const result = await api.triggerWeather(dryRun)
      await load()
      return result
    } finally {
      setJobRunning(j => ({ ...j, weather: false }))
    }
  }, [load])

  const runPrediction = useCallback(async (dryRun = false) => {
    setJobRunning(j => ({ ...j, prediction: true }))
    try {
      const result = await api.triggerPrediction(dryRun)
      await load()
      return result
    } finally {
      setJobRunning(j => ({ ...j, prediction: false }))
    }
  }, [load])

  const uploadDengue = useCallback(async (file) => {
    const result = await api.uploadDengueCsv(file)
    await load()
    return result
  }, [load])

  const saveDengue = useCallback(async (rows) => {
    const result = await api.saveDengueCounts(rows)
    await load()
    return result
  }, [load])

  return {
    status, logs, weatherData, predictions, allPredictions,
    dengueCounts, weatherStats, loading, jobRunning,
    errors, lastRefresh,
    runWeatherJob, runPrediction, uploadDengue, saveDengue,
    refresh: load,
  }
}

export function computeRisk(row) {
  let score = 0
  const temp  = parseFloat(row.avg_temp)
  const hum   = parseFloat(row.humidity ?? row.avg_humidity)
  const rain  = parseFloat(row.precipitation)

  if (temp >= 26 && temp <= 32) score += 35; else score += 15
  if (hum >= 80)       score += 35
  else if (hum >= 70)  score += 20
  else                 score += 10
  if (rain >= 25)      score += 30
  else if (rain >= 10) score += 20
  else if (rain >= 5)  score += 10
  else                 score += 5

  const level = score >= 75 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW'
  return { score, level }
}

export function formatWeek(week, year) {
  if (!week || !year) return '—'
  return `W${String(week).padStart(2,'0')} ${year}`
}

export function getRiskColor(level) {
  if (level === 'HIGH')   return 'var(--risk-high)'
  if (level === 'MEDIUM') return 'var(--risk-medium)'
  return 'var(--risk-low)'
}

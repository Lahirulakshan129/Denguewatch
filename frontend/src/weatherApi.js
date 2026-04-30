const BASE = '/api'

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, opts)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

// Weather
export const getStatus       = ()                => req('/weather/status')
export const getLogs         = (limit = 30)      => req(`/weather/logs?limit=${limit}`)
export const getWeatherData  = (week, year)      => req(`/weather/data${week ? `?week=${week}&year=${year}` : ''}`)
export const getWeatherStats = ()                => req('/weather/data/stats')
export const triggerWeather  = (dryRun = false)  => req(`/weather/trigger?dryRun=${dryRun}`, { method: 'POST' })

// Predictions
export const getPredictions       = (week, year) => req(`/prediction/latest${week ? `?week=${week}&year=${year}` : ''}`)
export const getAllPredictions     = ()           => req('/prediction/history')
export const triggerPrediction    = (dryRun = false) => req(`/prediction/run?dryRun=${dryRun}`, { method: 'POST' })

// Dengue counts
export const getDengueCounts      = ()           => req('/dengue/counts')
export const uploadDengueCsv      = (file)       => {
  const form = new FormData()
  form.append('file', file)
  return req('/dengue/upload', { method: 'POST', body: form })
}
export const saveDengueCounts     = (rows)       => req('/dengue/counts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rows })
})
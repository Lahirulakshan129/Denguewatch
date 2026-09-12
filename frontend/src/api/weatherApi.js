import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE || '/api'

const client = axios.create({ baseURL: BASE })

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.message || err.response?.data?.detail || err.message
    return Promise.reject(new Error(Array.isArray(msg) ? msg.join(', ') : msg))
  },
)

export const getStatus = async () => (await client.get('/weather/status')).data
export const getLogs = async (limit = 50) => (await client.get('/weather/logs', { params: { limit } })).data
export const getWeatherData = async (week, year) => (await client.get('/weather/data', { params: { week, year } })).data
export const getWeatherStats = async () => (await client.get('/weather/data/stats')).data
export const triggerWeather = async (dryRun = false, weeks = 4) =>
  (await client.post(`/weather/trigger?dryRun=${dryRun}&weeks=${weeks}`)).data

export const triggerPrediction = async (dryRun = false) => (await client.post(`/prediction/run?dryRun=${dryRun}`)).data
export const getPredictions = async () => (await client.get('/prediction/latest')).data
export const getAllPredictions = async () => (await client.get('/prediction/history')).data

export const getDengueCounts = async () => (await client.get('/dengue/counts')).data
export const saveDengueCounts = async (rows) => (await client.post('/dengue/counts', { rows })).data

export const uploadDengueCsv = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return (await client.post('/dengue/upload', formData)).data
}

async function downloadBlob(path, filename) {
  const res = await client.get(path, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([res.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export const downloadTrainingCsv = () => downloadBlob('/dataset/download', 'training_dataset.csv')
export const downloadWeatherCsv = () => downloadBlob('/dataset/download/weather', 'weather_weekly.csv')
export const downloadPredictionsCsv = () => downloadBlob('/dataset/download/predictions', 'predictions.csv')

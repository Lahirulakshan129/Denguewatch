import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE || '/api'

const client = axios.create({ baseURL: BASE })

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const getStatus = async () => (await client.get('/weather/status')).data
export const getLogs = async (limit = 50) => (await client.get('/weather/logs', { params: { limit } })).data
export const getWeatherData = async (week, year) => (await client.get('/weather/data', { params: { week, year } })).data
export const getWeatherStats = async () => (await client.get('/weather/data/stats')).data
export const triggerWeather = async (dryRun = false) => (await client.post(`/weather/trigger?dryRun=${dryRun}`)).data

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

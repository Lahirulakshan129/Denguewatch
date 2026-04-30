export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),

  python: {
    exec: process.env.PYTHON_EXECUTABLE || 'python3',
    scriptsDir: process.env.PYTHON_SCRIPT_PATH || './scripts',
  },

  paths: {
    data: process.env.WEATHER_CSV_PATH || './data',
    logs: process.env.LOG_PATH || './logs/job-history.json',
  },

  job: {
    timeout: parseInt(process.env.JOB_TIMEOUT_MS || '600000', 10),
    retries: parseInt(process.env.JOB_MAX_RETRIES || '2', 10),
  },
});
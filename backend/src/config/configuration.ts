export default () => ({
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    name: process.env.DB_NAME || 'denguewatch',
    synchronize: process.env.DB_SYNC
      ? process.env.DB_SYNC === 'true'
      : process.env.NODE_ENV !== 'production',
    ssl:
      process.env.DB_SSL === 'true'
        ? {
            rejectUnauthorized:
              process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
          }
        : false,
  },
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@denguewatch.gov',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'admin123',
    officerEmail: process.env.SEED_OFFICER_EMAIL || 'officer@denguewatch.gov',
    officerPassword: process.env.SEED_OFFICER_PASSWORD || 'officer123',
  },
  python: {
    executable: process.env.PYTHON_EXECUTABLE || 'python',
    weatherScript: process.env.PYTHON_SCRIPT_PATH || './scripts/fetch_weather.py',
    timeout: parseInt(process.env.JOB_TIMEOUT_MS, 10) || 600000,
    maxRetries: parseInt(process.env.JOB_MAX_RETRIES, 10) || 2,
  },
  ml: {
    serviceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  },
  paths: {
    weatherCsv: process.env.WEATHER_CSV_PATH || './data/weekly_weather.csv',
    dengueCsv: process.env.DENGUE_CSV_PATH || './data/dengue_counts.csv',
    predictionCsv: process.env.PREDICTION_CSV_PATH || './data/predictions.csv',
    modelPath: process.env.MODEL_PATH || './scripts/model/dengue_model.h5',
    logsPath: process.env.LOGS_PATH || './logs/job-history.json',
  },
  api: {
    visualCrossingKey: process.env.VISUAL_CROSSING_API_KEY || '',
  },
});

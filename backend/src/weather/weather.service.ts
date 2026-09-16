import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface WeatherRecord {
  date: string;
  temperature: number;       // °C
  humidity: number;          // %
  rainfall: number;          // mm
  windSpeed: number;         // km/h
  condition: string;
  dengueRiskScore: number;   // 0-100 calculated risk
}

export interface WeatherData {
  lastUpdated: string;
  location: string;
  records: WeatherRecord[];
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly dataFilePath = path.join(process.cwd(), 'data', 'weather-data.json');

  constructor() {
    // Ensure data directory exists
    try {
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch (err: any) {
      this.logger.warn(`Could not create data directory: ${err.message}`);
    }
  }

  /**
   * Simulates fetching weather data from an external weather API.
   * In production, replace this with a real API call (e.g. Open-Meteo, OpenWeatherMap).
   * Uses Colombo, Sri Lanka coordinates as the default location.
   */
  async fetchWeatherData(): Promise<WeatherData> {
    this.logger.log('Fetching weather data from API service...');

    // --- Simulated External Weather API Service ---
    // Replace the block below with your real API call, e.g.:
    // const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=7.0873&longitude=79.9986&...`);
    // const apiData = await response.json();

    const records: WeatherRecord[] = [];
    const today = new Date();

    const conditions = ['Sunny', 'Partly Cloudy', 'Overcast', 'Light Rain', 'Heavy Rain', 'Thunderstorm'];

    // Sri Lanka tropical climate baselines
    const baseTemp = 28 + (Math.random() * 4 - 2);
    const baseHumidity = 75 + (Math.random() * 10 - 5);

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      const isRainyDay = Math.random() > 0.5;
      const rainfall = isRainyDay
        ? parseFloat((Math.random() * 45 + 5).toFixed(1))
        : parseFloat((Math.random() * 3).toFixed(1));

      const temperature = parseFloat((baseTemp + (Math.random() * 3 - 1.5)).toFixed(1));
      const humidity = parseFloat(
        Math.min(98, baseHumidity + (isRainyDay ? 10 : 0) + (Math.random() * 8 - 4)).toFixed(1)
      );
      const windSpeed = parseFloat((Math.random() * 25 + 5).toFixed(1));

      let conditionIndex = isRainyDay
        ? Math.floor(Math.random() * 3) + 3
        : Math.floor(Math.random() * 3);

      // Calculate Dengue Risk Score based on WHO meteorological guidelines
      // High risk: temp 26-32°C, humidity >80%, rainfall >25mm
      const tempScore = temperature >= 26 && temperature <= 32 ? 35 : 15;
      const humidityScore = humidity >= 80 ? 35 : humidity >= 70 ? 20 : 10;
      const rainfallScore = rainfall >= 25 ? 30 : rainfall >= 10 ? 20 : rainfall >= 5 ? 10 : 5;
      const dengueRiskScore = Math.min(100, tempScore + humidityScore + rainfallScore);

      records.push({
        date: date.toISOString().split('T')[0],
        temperature,
        humidity,
        rainfall,
        windSpeed,
        condition: conditions[conditionIndex],
        dengueRiskScore,
      });
    }

    const weatherData: WeatherData = {
      lastUpdated: new Date().toISOString(),
      location: 'Colombo, Sri Lanka',
      records,
    };

    this.logger.log(`Fetched ${records.length} days of weather data`);
    return weatherData;
  }

  /**
   * Saves weather data to a JSON file for persistent storage.
   */
  saveToFile(data: WeatherData): void {
    fs.writeFileSync(this.dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
    this.logger.log(`Weather data saved to ${this.dataFilePath}`);
  }

  /**
   * Reads weather data from the JSON file.
   * Returns null if no data has been fetched yet.
   */
  readFromFile(): WeatherData | null {
    if (!fs.existsSync(this.dataFilePath)) {
      this.logger.warn('No weather data file found. Fetch data first.');
      return null;
    }

    const raw = fs.readFileSync(this.dataFilePath, 'utf-8');
    return JSON.parse(raw) as WeatherData;
  }

  /**
   * Convenience method: fetch + save in one call.
   */
  async fetchAndStore(): Promise<WeatherData> {
    const data = await this.fetchWeatherData();
    this.saveToFile(data);
    return data;
  }
}
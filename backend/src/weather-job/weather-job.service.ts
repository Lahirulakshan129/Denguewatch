import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { LoggingService } from '../logging/logging.service';

@Injectable()
export class WeatherJobService {

  constructor(private readonly logger: LoggingService) {}

  async runPipeline() {
    const start = Date.now();

    try {
      await this.runScript('fetch_weather.py');
      await this.runScript('predict.py');

      this.logger.log({
        status: 'success',
        duration: Date.now() - start,
      });

    } catch (error) {
      this.logger.log({
        status: 'failed',
        error: error.toString(),
        duration: Date.now() - start,
      });

      throw error;
    }
  }

  private runScript(script: string): Promise<void> {
    return new Promise((resolve, reject) => {

      const process = spawn('python3', [`scripts/${script}`]);

      process.stdout.on('data', (data) => {
        console.log(`${script}: ${data}`);
      });

      process.stderr.on('data', (data) => {
        console.error(`${script} ERROR: ${data}`);
      });

      process.on('close', (code) => {
        if (code === 0) resolve();
        else reject(`${script} failed with code ${code}`);
      });

    });
  }
}
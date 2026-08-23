import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  const config = app.get(ConfigService);
  app.enableCors({ origin: config.get<string[]>('corsOrigins') });
  const port = config.get<number>('port') || 3001;
  await app.listen(port);
  console.log(`DengueWatch backend running at http://localhost:${port}`);
}
bootstrap();

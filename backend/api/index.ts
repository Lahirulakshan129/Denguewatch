import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import express, { Request, Response } from 'express';
import { AppModule } from '../src/app.module';

const server = express();
let cachedServer: any = null;

async function bootstrapServer() {
  if (!cachedServer) {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(server),
      { logger: ['log', 'warn', 'error'] },
    );
    const config = app.get(ConfigService);
    const origins = config.get<string[]>('corsOrigins') || '*';
    app.enableCors({
      origin: origins,
      credentials: true,
    });
    await app.init();
    cachedServer = server;
  }
  return cachedServer;
}

export default async function handler(req: Request, res: Response) {
  try {
    await bootstrapServer();
    if (req.headers['x-matched-path'] && req.url === '/api') {
      req.url = req.headers['x-matched-path'] as string;
    }
    server(req, res);
  } catch (err: any) {
    console.error('Serverless function bootstrap error:', err);
    res.status(500).json({
      statusCode: 500,
      message: 'Internal server error during NestJS bootstrap',
      error: err?.message || String(err),
    });
  }
}

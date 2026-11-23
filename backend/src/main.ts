import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Request, Response } from 'express';
import { AppModule } from './app.module';

const server = express();
let cachedApp: Awaited<ReturnType<typeof NestFactory.create>> | null = null;

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;
  if (origin === 'http://localhost:5173') return true;
  if (origin.endsWith('.vercel.app')) return true;
  if (
    process.env.FRONTEND_URL &&
    origin === process.env.FRONTEND_URL.replace(/\/+$/, '')
  ) {
    return true;
  }
  return false;
}

async function createNestApp() {
  if (cachedApp) {
    return cachedApp;
  }

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

  app.enableCors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin not allowed by CORS: ${origin}`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.init();
  cachedApp = app;
  return app;
}

// Handler para entornos serverless (Vercel)
export default async function handler(req: Request, res: Response) {
  await createNestApp();
  server(req, res);
}

// Arranque tradicional en desarrollo local
if (!process.env.VERCEL) {
  createNestApp().then(async (app) => {
    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`Backend corriendo en http://localhost:${port}`);
  });
}
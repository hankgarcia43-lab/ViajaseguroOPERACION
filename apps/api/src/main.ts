import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/$/, '');
}

function getCorsConfig() {
  const rawOrigins = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  const allowAll = rawOrigins.includes('*');
  const allowedOrigins = rawOrigins
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter((origin) => origin.length > 0 && origin !== '*');

  return { allowAll, allowedOrigins };
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const { allowAll, allowedOrigins } = getCorsConfig();

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (origin, callback) => {
      if (allowAll || !origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origen no permitido por CORS: ${origin}`), false);
    }
  });
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/'
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
}

void bootstrap();

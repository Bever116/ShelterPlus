import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { AppModule } from './app.module';
import { corsConfig } from './config/cors.config';

async function bootstrap() {
  const certsDir = join(__dirname, '../certs');
  const keyPath = join(certsDir, 'key.pem');
  const certPath = join(certsDir, 'cert.pem');

  let httpsOptions: { key: Buffer; cert: Buffer } | undefined;

  if (existsSync(keyPath) && existsSync(certPath)) {
    httpsOptions = {
      key: readFileSync(keyPath),
      cert: readFileSync(certPath)
    };
  } else {
    Logger.warn(
      'HTTPS certificates not found; falling back to HTTP. ' +
        `Looked for key at ${keyPath} and cert at ${certPath}.`
    );
  }

  const app = await NestFactory.create(AppModule, httpsOptions ? { httpsOptions } : undefined);
  app.enableCors(corsConfig);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true }
    })
  );

  const sessionSecret = process.env.SESSION_SECRET ?? 'development-secret';
  app.use(cookieParser());
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'none',
        secure: true
      }
    })
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 3333;
  await app.listen(port);
  Logger.log(
    `API running on ${httpsOptions ? 'https' : 'http'}://localhost:${port}`
  );
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

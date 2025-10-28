import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { corsConfig } from './config/cors.config';
// !!! TEMP DEBUG !!!
console.log('BOOT_ID=DEV-HTTPS-CORS-777 __filename=', __filename, '__dirname=', __dirname, 'CWD=', process.cwd());

async function bootstrap() {
    // --- HTTPS: ищем key.pem / cert.pem в нескольких типичных местах ---
    const candidates = [
        join(__dirname, '../certs'),
        join(__dirname, '../../certs'),
        resolve(process.cwd(), 'apps/api/certs'),
        resolve(process.cwd(), 'certs'),
    ];

    let httpsOptions: { key: Buffer; cert: Buffer } | undefined;

    for (const dir of candidates) {
        const keyPath = join(dir, 'key.pem');
        const certPath = join(dir, 'cert.pem');
        Logger.warn(`Looking for HTTPS certs: ${keyPath} | ${certPath}`);

        if (existsSync(keyPath) && existsSync(certPath)) {
            Logger.log(`Found HTTPS certs in: ${dir}`);
            httpsOptions = {
                key: readFileSync(keyPath),
                cert: readFileSync(certPath),
            };
            break;
        }
    }

    if (!httpsOptions) {
        Logger.warn('HTTPS certificates not found; falling back to HTTP.');
    }

    const app = await NestFactory.create(AppModule, httpsOptions ? { httpsOptions } : undefined);

    // --- Вариант A: включаем CORS по конфигу (origin без '*', credentials: true и т.д.) ---
    app.enableCors(corsConfig);

    // --- Жёсткий мидлвар: перебиваем любые '*' и корректно отвечаем на preflight ---
    const ALLOWED_ORIGIN = 'http://localhost:3000';
    app.use((req: Request, res: Response, next: NextFunction) => {
        const origin = req.headers.origin as string | undefined;

        if (origin === ALLOWED_ORIGIN) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Vary', 'Origin');
            res.setHeader(
                'Access-Control-Allow-Methods',
                'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
            );
            res.setHeader(
                'Access-Control-Allow-Headers',
                'Content-Type, Authorization, Accept, X-Requested-With',
            );
        }

        if (req.method === 'OPTIONS') {
            return res.status(204).end();
        }

        next();
    });

    // --- Валидация ---
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }),
    );

    // --- Cookie + Session (cross-site cookies требуют HTTPS и SameSite=None) ---
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
                secure: true, // обязателен при SameSite=None (нужен HTTPS)
            },
        }),
    );

    // --- Start ---
    const port = process.env.PORT ? Number(process.env.PORT) : 3333;
    await app.listen(port);
    Logger.log(`API running on ${httpsOptions ? 'https' : 'http'}://localhost:${port}`);
}

bootstrap().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
});

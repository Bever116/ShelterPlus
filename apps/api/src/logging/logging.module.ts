import { Global, Module } from '@nestjs/common';
import type { Logger } from 'pino';
import { apiLogger } from './pino.factory';
import { PinoLoggerService } from './logger.service';
import { LoggingInterceptor } from './logging.interceptor';
import { GlobalExceptionFilter } from './exception.filter';

@Global()
@Module({
  providers: [
    {
      provide: 'API_PINO_LOGGER',
      useValue: apiLogger
    },
    {
      provide: PinoLoggerService,
      useFactory: (logger: Logger) => new PinoLoggerService(logger),
      inject: ['API_PINO_LOGGER']
    },
    LoggingInterceptor,
    GlobalExceptionFilter
  ],
  exports: ['API_PINO_LOGGER', PinoLoggerService, LoggingInterceptor, GlobalExceptionFilter]
})
export class LoggingModule {}

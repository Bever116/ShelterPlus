import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLoggerService } from './logger.service';
import { getRequestId } from './request-context';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const errorInstance = exception instanceof Error ? exception : new Error(String(exception ?? 'Unknown error'));

    const scopedLogger = this.logger.forContext('GlobalExceptionFilter');
    scopedLogger.error(errorInstance, {
      action: 'exception',
      statusCode: status,
      method: request?.method,
      url: request?.originalUrl ?? request?.url
    });

    const responseBody = (() => {
      if (exception instanceof HttpException) {
        const payload = exception.getResponse();
        if (typeof payload === 'string') {
          return { statusCode: status, message: payload };
        }
        if (payload && typeof payload === 'object') {
          return { statusCode: status, ...(payload as Record<string, unknown>) };
        }
      }
      return { statusCode: status, message: 'Internal server error' };
    })();

    response.status(status).json({
      ...responseBody,
      requestId: getRequestId()
    });
  }
}

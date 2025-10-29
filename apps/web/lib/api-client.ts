import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { REQUEST_ID_HEADER } from '@shelterplus/shared/logging';
import { logger, getRequestId } from '../src/lib/logger';
import { API_BASE_URL } from './api-config';

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    metadata?: { startTime: number; requestId?: string };
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const requestId = getRequestId();
  config.metadata = { startTime: Date.now(), requestId };
  config.headers = config.headers ?? {};
  if (requestId) {
    const headers = config.headers as Record<string, unknown> & { set?: (key: string, value: string) => void };
    if (typeof headers.set === 'function') {
      headers.set(REQUEST_ID_HEADER, requestId);
    } else {
      headers[REQUEST_ID_HEADER] = requestId;
    }
  }
  const method = (config.method ?? 'get').toUpperCase();
  const url = config.url ?? '';
  const bodyKeys = config.data && typeof config.data === 'object' ? Object.keys(config.data as Record<string, unknown>) : undefined;
  logger.debug({ action: 'axios.request', method, url, requestId, bodyKeys }, 'Dispatching API request');
  return config;
});

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const metadata = (response.config as InternalAxiosRequestConfig).metadata;
    const duration = metadata ? Date.now() - metadata.startTime : undefined;
    const method = (response.config.method ?? 'get').toUpperCase();
    const url = response.config.url ?? '';
    const requestId = metadata?.requestId;
    logger.debug({ action: 'axios.response', method, url, status: response.status, durationMs: duration, requestId }, 'API request resolved');
    return response;
  },
  (error) => {
    const config = error.config as InternalAxiosRequestConfig | undefined;
    const metadata = config?.metadata;
    const duration = metadata ? Date.now() - metadata.startTime : undefined;
    const method = (config?.method ?? 'get').toUpperCase();
    const url = config?.url ?? '';
    const requestId = metadata?.requestId;
    logger.error({
      action: 'axios.response.error',
      method,
      url,
      status: error.response?.status,
      durationMs: duration,
      requestId,
      err: error instanceof Error ? error : new Error(String(error ?? 'Unknown error'))
    }, 'API request failed');
    return Promise.reject(error);
  }
);

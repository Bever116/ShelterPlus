import { AsyncLocalStorage } from 'async_hooks';
import type { RequestContextStore } from '@shelterplus/shared/logging';

const storage = new AsyncLocalStorage<RequestContextStore>();

export const runWithRequestContext = <T>(
  context: RequestContextStore,
  callback: () => T
): T => {
  const current = storage.getStore() ?? {};
  return storage.run({ ...current, ...context }, callback);
};

export const getRequestContext = (): RequestContextStore | undefined => storage.getStore();

export const getRequestId = (): string | undefined => storage.getStore()?.requestId as string | undefined;

export const setRequestContextValue = (key: string, value: unknown): void => {
  const store = storage.getStore();
  if (store) {
    store[key] = value;
  }
};

export const bindToRequestContext = <T extends (...args: unknown[]) => unknown>(fn: T): T => {
  const store = storage.getStore();
  if (!store) {
    return fn;
  }
  return ((...args: unknown[]) => storage.run(store, () => fn(...args))) as T;
};

'use client';

import { createContext, useContext, type ReactNode } from 'react';

const RequestIdContext = createContext<string | undefined>(undefined);

export const RequestIdProvider = ({ requestId, children }: { requestId?: string; children: ReactNode }) => (
  <RequestIdContext.Provider value={requestId}>{children}</RequestIdContext.Provider>
);

export const useRequestId = () => useContext(RequestIdContext);

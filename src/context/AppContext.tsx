import { createContext, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAppData } from '../hooks/useAppData';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import type { ConnectionStatus } from '../hooks/useConnectionStatus';

type AppContextType = ReturnType<typeof useAppData> & {
  connectionStatus: ConnectionStatus;
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const appData = useAppData();
  const { status: connectionStatus, checkNow } = useConnectionStatus();
  const prevStatus = useRef(connectionStatus);

  // Auto-reconnect: when status transitions disconnected → connected and there's a save error,
  // trigger a retry
  useEffect(() => {
    if (prevStatus.current === 'disconnected' && connectionStatus === 'connected' && appData.saveError) {
      appData.retrySave();
    }
    prevStatus.current = connectionStatus;
  }, [connectionStatus, appData.saveError, appData.retrySave]);

  // When a save error first appears, do an immediate connection check
  // so the status indicator updates quickly
  useEffect(() => {
    if (appData.saveError) {
      checkNow();
    }
  }, [appData.saveError, checkNow]);

  return (
    <AppContext.Provider value={{ ...appData, connectionStatus }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AppData, Session, ArchivedSession, Casino, CreditCard, CardDeposit } from '../models/types';
import {
  loadAppDataAsync,
  saveAppDataAsync,
  generateId,
  stashEmergencyBackup,
  clearEmergencyBackup,
  StaleDataError,
} from '../services/persistence';

const SAVE_DEBOUNCE_MS = 500;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000; // 1s, 2s, 4s
const BACKGROUND_RETRY_MS = 15000;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useAppData() {
  const [data, setData] = useState<AppData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [staleDataReloaded, setStaleDataReloaded] = useState(false);

  // Refs for debounce and retry
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const pendingData = useRef<AppData | null>(null);
  const isSaving = useRef(false);
  const hasUnsavedChanges = useRef(false);
  const latestData = useRef<AppData | null>(null);
  const isFirstLoad = useRef(true);
  const dataVersionRef = useRef<number | undefined>(undefined);

  // Keep latestData in sync
  useEffect(() => {
    latestData.current = data;
  }, [data]);

  // Combined error for backward compat
  const error = loadError || saveError;

  // Background retry loop — retries every 15s after fast retries fail
  const startBackgroundRetry = useCallback((dataToSave: AppData) => {
    // Don't start if already running
    if (backgroundRetryTimer.current) return;

    const attempt = () => {
      const current = latestData.current || dataToSave;
      isSaving.current = true;
      setSaveStatus('saving');
      saveAppDataAsync({ ...current, dataVersion: dataVersionRef.current })
        .then(() => {
          isSaving.current = false;
          hasUnsavedChanges.current = false;
          setSaveError(null);
          setSaveStatus('saved');
          clearEmergencyBackup();
          backgroundRetryTimer.current = null;
          // Auto-reset to idle after 2s
          savedResetTimer.current = setTimeout(() => setSaveStatus('idle'), 2000);
        })
        .catch(() => {
          isSaving.current = false;
          setSaveStatus('error');
          // Schedule next background attempt
          backgroundRetryTimer.current = setTimeout(attempt, BACKGROUND_RETRY_MS);
        });
    };

    backgroundRetryTimer.current = setTimeout(attempt, BACKGROUND_RETRY_MS);
  }, []);

  const stopBackgroundRetry = useCallback(() => {
    if (backgroundRetryTimer.current) {
      clearTimeout(backgroundRetryTimer.current);
      backgroundRetryTimer.current = null;
    }
  }, []);

  // Perform the actual save with retry logic
  const doSave = useCallback(async (dataToSave: AppData, attempt = 0) => {
    isSaving.current = true;
    setSaveStatus('saving');
    if (savedResetTimer.current) {
      clearTimeout(savedResetTimer.current);
      savedResetTimer.current = null;
    }
    try {
      const newVersion = await saveAppDataAsync(dataToSave);
      // Success — update dataVersion, clear save error and retry count
      isSaving.current = false;
      hasUnsavedChanges.current = false;
      setSaveError(null);
      setSaveStatus('saved');
      clearEmergencyBackup();
      stopBackgroundRetry();
      // Update the dataVersion ref so next save uses it (don't use setData to avoid re-triggering save)
      if (newVersion !== undefined) {
        dataVersionRef.current = newVersion;
      }
      // Auto-reset to idle after 2s
      savedResetTimer.current = setTimeout(() => setSaveStatus('idle'), 2000);
      retryCount.current = 0;
    } catch (err: any) {
      isSaving.current = false;

      // Handle stale data conflict — reload from server and alert the user
      if (err instanceof StaleDataError) {
        console.warn('Stale data detected — reloading from server');
        dataVersionRef.current = err.currentData.dataVersion;
        isFirstLoad.current = true; // Prevent the setData from triggering another save
        setData(err.currentData);
        hasUnsavedChanges.current = false;
        setSaveError(null);
        setSaveStatus('idle');
        setStaleDataReloaded(true);
        stopBackgroundRetry();
        clearEmergencyBackup();
        retryCount.current = 0;
        return;
      }

      const message = err?.message || 'Save failed';
      console.error(`Save failed (attempt ${attempt + 1}/${MAX_RETRIES}):`, message);

      if (attempt + 1 < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt); // 1s, 2s, 4s
        console.log(`Retrying save in ${delay}ms...`);
        retryCount.current = attempt + 1;
        retryTimer.current = setTimeout(() => {
          // Use the latest pending data if available, otherwise the original
          const latest = pendingData.current || dataToSave;
          pendingData.current = null;
          doSave(latest, attempt + 1);
        }, delay);
      } else {
        // All fast retries exhausted — show error, stash backup, start background retry
        retryCount.current = 0;
        setSaveError(message);
        setSaveStatus('error');
        stashEmergencyBackup(dataToSave);
        startBackgroundRetry(dataToSave);
      }
    }
  }, [startBackgroundRetry, stopBackgroundRetry]);

  // Schedule a debounced save
  const scheduleSave = useCallback((dataToSave: AppData) => {
    hasUnsavedChanges.current = true;
    // Clear any pending debounce
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    // If a retry is in progress, store as pending so the retry picks up the latest
    if (retryTimer.current) {
      pendingData.current = dataToSave;
      return;
    }
    // If background retry is running, store pending and let it pick up latest
    if (backgroundRetryTimer.current) {
      pendingData.current = dataToSave;
      return;
    }
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      doSave({ ...dataToSave, dataVersion: dataVersionRef.current });
    }, SAVE_DEBOUNCE_MS);
  }, [doSave]);

  // Load data from API (JSON file) on mount
  useEffect(() => {
    loadAppDataAsync()
      .then(apiData => {
        dataVersionRef.current = apiData.dataVersion;
        setData(apiData);
        setLoadError(null);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load data from API:', err);
        setLoadError('Unable to connect to server. Please make sure the API server is running.');
        setIsLoading(false);
      });

    // Cleanup timers on unmount
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (backgroundRetryTimer.current) clearTimeout(backgroundRetryTimer.current);
      if (savedResetTimer.current) clearTimeout(savedResetTimer.current);
    };
  }, []);

  // beforeunload protection
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges.current) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Save data whenever it changes (skip the initial load — no need to re-save what we just loaded)
  useEffect(() => {
    if (!isLoading && data) {
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        return;
      }
      scheduleSave(data);
    }
  }, [data, isLoading, scheduleSave]);

  // Manual retry — immediately re-POST the current data
  const retrySave = useCallback(() => {
    if (!data) return;
    // Cancel any pending timers
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    stopBackgroundRetry();
    retryTimer.current = null;
    debounceTimer.current = null;
    retryCount.current = 0;
    setSaveError(null);
    doSave({ ...data, dataVersion: dataVersionRef.current });
  }, [data, doSave, stopBackgroundRetry]);

  const dismissStaleWarning = useCallback(() => {
    setStaleDataReloaded(false);
  }, []);

  // Dismiss save error — next data change will trigger a new save attempt
  const clearError = useCallback(() => {
    setSaveError(null);
    setSaveStatus('idle');
    retryCount.current = 0;
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    // Don't stop background retry — it should keep trying silently
  }, []);

  // Sessions
  const addSession = useCallback((session: Omit<Session, 'id'>) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sessions: [...prev.sessions, { ...session, id: generateId() }],
      };
    });
  }, []);

  const updateSession = useCallback((id: string, updates: Partial<Session>) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sessions: prev.sessions.map(s => s.id === id ? { ...s, ...updates } : s),
      };
    });
  }, []);

  // Archive session instead of deleting (soft delete)
  const archiveSession = useCallback((id: string, reason?: string) => {
    setData(prev => {
      if (!prev) return prev;
      const sessionToArchive = prev.sessions.find(s => s.id === id);
      if (!sessionToArchive) return prev;

      const archivedSession: ArchivedSession = {
        ...sessionToArchive,
        archivedAt: new Date().toISOString(),
        archiveReason: reason,
      };

      return {
        ...prev,
        sessions: prev.sessions.filter(s => s.id !== id),
        archivedSessions: [...(prev.archivedSessions || []), archivedSession],
      };
    });
  }, []);

  // Restore an archived session
  const restoreSession = useCallback((id: string) => {
    setData(prev => {
      if (!prev) return prev;
      const archived = (prev.archivedSessions || []).find(s => s.id === id);
      if (!archived) return prev;

      // Remove archive metadata and restore as regular session
      const { archivedAt: _, archiveReason: __, ...restoredSession } = archived;

      return {
        ...prev,
        sessions: [...prev.sessions, restoredSession as Session],
        archivedSessions: (prev.archivedSessions || []).filter(s => s.id !== id),
      };
    });
  }, []);

  // Permanently delete an archived session (use with caution)
  const permanentlyDeleteSession = useCallback((id: string) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        archivedSessions: (prev.archivedSessions || []).filter(s => s.id !== id),
      };
    });
  }, []);

  const combineSessions = useCallback((sessionIds: string[]) => {
    setData(prev => {
      if (!prev) return prev;
      const sessionsToMerge = prev.sessions.filter(s => sessionIds.includes(s.id));
      if (sessionsToMerge.length < 2) return prev;

      // Sort by date to get range
      const sorted = [...sessionsToMerge].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const earliestDate = sorted[0].date;
      const latestDate = sorted[sorted.length - 1].date;

      // Merge cardDeposits from all sessions, grouping by creditCardID
      const depositsByCard = new Map<string, number>();
      sessionsToMerge.forEach(s => {
        if (s.cardDeposits && Array.isArray(s.cardDeposits)) {
          s.cardDeposits.forEach(cd => {
            const current = depositsByCard.get(cd.creditCardID) || 0;
            depositsByCard.set(cd.creditCardID, current + cd.amount);
          });
        }
      });

      // Convert back to cardDeposits array
      const mergedCardDeposits: CardDeposit[] = Array.from(depositsByCard.entries()).map(
        ([creditCardID, amount]) => ({ creditCardID, amount })
      );

      // Sum total deposits and withdrawals
      const totalDeposit = mergedCardDeposits.reduce((sum, cd) => sum + cd.amount, 0);
      const totalWithdrawal = sessionsToMerge.reduce((sum, s) => sum + s.withdrawalAmount, 0);

      // Use the casino from the first session (or most common)
      const casinoID = sessionsToMerge[0].casinoID;

      // Combine notes
      const notes = sessionsToMerge
        .filter(s => s.notes)
        .map(s => s.notes)
        .join('; ');

      // Create date range note
      const startDateStr = new Date(earliestDate).toLocaleDateString();
      const endDateStr = new Date(latestDate).toLocaleDateString();
      const dateRangeNote = startDateStr === endDateStr
        ? `Combined ${sessionsToMerge.length} sessions`
        : `Combined ${sessionsToMerge.length} sessions (${startDateStr} - ${endDateStr})`;

      const combinedSession: Session = {
        id: generateId(),
        date: latestDate, // Use latest date as the session date
        casinoID,
        cardDeposits: mergedCardDeposits,
        depositAmount: totalDeposit,
        withdrawalAmount: totalWithdrawal,
        notes: notes ? `${dateRangeNote}; ${notes}` : dateRangeNote,
      };

      // Remove merged sessions and add combined one
      const remainingSessions = prev.sessions.filter(s => !sessionIds.includes(s.id));
      return {
        ...prev,
        sessions: [...remainingSessions, combinedSession],
      };
    });
  }, []);

  // Casinos
  const addCasino = useCallback((casino: Omit<Casino, 'id'>) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        casinos: [...prev.casinos, { ...casino, id: generateId() }],
      };
    });
  }, []);

  const updateCasino = useCallback((id: string, updates: Partial<Casino>) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        casinos: prev.casinos.map(c => c.id === id ? { ...c, ...updates } : c),
      };
    });
  }, []);

  const deleteCasino = useCallback((id: string) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        casinos: prev.casinos.filter(c => c.id !== id),
      };
    });
  }, []);

  // Credit Cards
  const addCreditCard = useCallback((card: Omit<CreditCard, 'id'>) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        creditCards: [...prev.creditCards, { ...card, id: generateId() }],
      };
    });
  }, []);

  const updateCreditCard = useCallback((id: string, updates: Partial<CreditCard>) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        creditCards: prev.creditCards.map(c => c.id === id ? { ...c, ...updates } : c),
      };
    });
  }, []);

  const deleteCreditCard = useCallback((id: string) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        creditCards: prev.creditCards.filter(c => c.id !== id),
      };
    });
  }, []);

  // Helpers
  const getCasino = useCallback((id: string) => {
    return data?.casinos.find(c => c.id === id);
  }, [data?.casinos]);

  const getCreditCard = useCallback((id: string | undefined) => {
    if (!id) return undefined;
    return data?.creditCards.find(c => c.id === id);
  }, [data?.creditCards]);

  // Default empty data for loading state
  const emptyData: AppData = { sessions: [], archivedSessions: [], casinos: [], creditCards: [], schemaVersion: 7 };
  const currentData = data ? { ...data, archivedSessions: data.archivedSessions || [] } : emptyData;

  const activeCasinos = currentData.casinos.filter(c => c.isActive);
  const activeCreditCards = currentData.creditCards.filter(c => c.isActive);

  const yearsWithSessions = [...new Set(currentData.sessions.map(s => new Date(s.date).getFullYear()))].sort((a, b) => b - a);

  return {
    data: currentData,
    isLoading,
    error,
    loadError,
    saveError,
    saveStatus,
    staleDataReloaded,
    dismissStaleWarning,
    clearError,
    retrySave,
    addSession,
    updateSession,
    archiveSession,
    restoreSession,
    permanentlyDeleteSession,
    combineSessions,
    addCasino,
    updateCasino,
    deleteCasino,
    addCreditCard,
    updateCreditCard,
    deleteCreditCard,
    getCasino,
    getCreditCard,
    activeCasinos,
    activeCreditCards,
    yearsWithSessions,
  };
}

import { useState, useEffect, useCallback } from 'react';
import type { AppData, Session, Casino, CreditCard, CardDeposit } from '../models/types';
import { loadAppData, loadAppDataAsync, saveAppDataAsync, generateId } from '../services/persistence';

export function useAppData() {
  const [data, setData] = useState<AppData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data from API (JSON file) on mount
  useEffect(() => {
    loadAppDataAsync()
      .then(apiData => {
        setData(apiData);
        setError(null);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Failed to load data from API:', error);
        setError('Unable to connect to server. Please make sure the API server is running.');
        setIsLoading(false);
      });
  }, []);

  // Save data to API (JSON file) whenever it changes
  useEffect(() => {
    if (!isLoading && data && !error) {
      saveAppDataAsync(data).catch(err => {
        console.error('Failed to save:', err);
        setError('Unable to save data. Please make sure the API server is running.');
      });
    }
  }, [data, isLoading, error]);

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

  const deleteSession = useCallback((id: string) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sessions: prev.sessions.filter(s => s.id !== id),
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
  const emptyData: AppData = { sessions: [], casinos: [], creditCards: [], schemaVersion: 6 };
  const currentData = data || emptyData;

  const activeCasinos = currentData.casinos.filter(c => c.isActive);
  const activeCreditCards = currentData.creditCards.filter(c => c.isActive);

  const yearsWithSessions = [...new Set(currentData.sessions.map(s => new Date(s.date).getFullYear()))].sort((a, b) => b - a);

  return {
    data: currentData,
    isLoading,
    error,
    addSession,
    updateSession,
    deleteSession,
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

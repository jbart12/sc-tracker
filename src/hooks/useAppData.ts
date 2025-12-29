import { useState, useEffect, useCallback } from 'react';
import type { AppData, Session, Casino, CreditCard } from '../models/types';
import { loadAppData, loadAppDataAsync, saveAppDataAsync, generateId } from '../services/persistence';

export function useAppData() {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [isLoading, setIsLoading] = useState(true);

  // Load data from API on mount
  useEffect(() => {
    loadAppDataAsync()
      .then(apiData => {
        setData(apiData);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Failed to load data:', error);
        setIsLoading(false);
      });
  }, []);

  // Save data to API whenever it changes (after initial load)
  useEffect(() => {
    if (!isLoading) {
      saveAppDataAsync(data).catch(console.error);
    }
  }, [data, isLoading]);

  // Sessions
  const addSession = useCallback((session: Omit<Session, 'id'>) => {
    setData(prev => ({
      ...prev,
      sessions: [...prev.sessions, { ...session, id: generateId() }],
    }));
  }, []);

  const updateSession = useCallback((id: string, updates: Partial<Session>) => {
    setData(prev => ({
      ...prev,
      sessions: prev.sessions.map(s => s.id === id ? { ...s, ...updates } : s),
    }));
  }, []);

  const deleteSession = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      sessions: prev.sessions.filter(s => s.id !== id),
    }));
  }, []);

  const combineSessions = useCallback((sessionIds: string[]) => {
    setData(prev => {
      const sessionsToMerge = prev.sessions.filter(s => sessionIds.includes(s.id));
      if (sessionsToMerge.length < 2) return prev;

      // Sort by date to get range
      const sorted = [...sessionsToMerge].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const earliestDate = sorted[0].date;
      const latestDate = sorted[sorted.length - 1].date;

      // Sum deposits and withdrawals
      const totalDeposit = sessionsToMerge.reduce((sum, s) => sum + s.depositAmount, 0);
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
        creditCardID: sessionsToMerge[0].creditCardID,
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
    setData(prev => ({
      ...prev,
      casinos: [...prev.casinos, { ...casino, id: generateId() }],
    }));
  }, []);

  const updateCasino = useCallback((id: string, updates: Partial<Casino>) => {
    setData(prev => ({
      ...prev,
      casinos: prev.casinos.map(c => c.id === id ? { ...c, ...updates } : c),
    }));
  }, []);

  const deleteCasino = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      casinos: prev.casinos.filter(c => c.id !== id),
    }));
  }, []);

  // Credit Cards
  const addCreditCard = useCallback((card: Omit<CreditCard, 'id'>) => {
    setData(prev => ({
      ...prev,
      creditCards: [...prev.creditCards, { ...card, id: generateId() }],
    }));
  }, []);

  const updateCreditCard = useCallback((id: string, updates: Partial<CreditCard>) => {
    setData(prev => ({
      ...prev,
      creditCards: prev.creditCards.map(c => c.id === id ? { ...c, ...updates } : c),
    }));
  }, []);

  const deleteCreditCard = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      creditCards: prev.creditCards.filter(c => c.id !== id),
    }));
  }, []);

  // Helpers
  const getCasino = useCallback((id: string) => {
    return data.casinos.find(c => c.id === id);
  }, [data.casinos]);

  const getCreditCard = useCallback((id: string | undefined) => {
    if (!id) return undefined;
    return data.creditCards.find(c => c.id === id);
  }, [data.creditCards]);

  const activeCasinos = data.casinos.filter(c => c.isActive);
  const activeCreditCards = data.creditCards.filter(c => c.isActive);

  const yearsWithSessions = [...new Set(data.sessions.map(s => new Date(s.date).getFullYear()))].sort((a, b) => b - a);

  return {
    data,
    isLoading,
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

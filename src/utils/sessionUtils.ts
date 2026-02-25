import type { Session } from '../models/types';

// Get total deposit amount from cardDeposits array (with fallback for legacy data)
export function getTotalDeposit(session: Session): number {
  if (session.cardDeposits && Array.isArray(session.cardDeposits) && session.cardDeposits.length > 0) {
    return session.cardDeposits.reduce((sum, cd) => sum + cd.amount, 0);
  }
  // Fallback to depositAmount for legacy/unmigrated data
  return session.depositAmount || 0;
}

// Get total foreign transaction fees from cardDeposits
export function getTotalForeignTransactionFees(session: Session): number {
  if (!session.cardDeposits || !Array.isArray(session.cardDeposits)) {
    return 0;
  }
  return session.cardDeposits.reduce((sum, cd) => {
    if (!cd.foreignTransactionFeePercent || cd.foreignTransactionFeePercent <= 0) {
      return sum;
    }
    return sum + (cd.amount * cd.foreignTransactionFeePercent / 100);
  }, 0);
}

// A session is pending if it has a deposit but no withdrawal yet
export function isPending(session: Session): boolean {
  return getTotalDeposit(session) > 0 && session.withdrawalAmount === 0;
}

// A session is complete if it has a withdrawal amount (even if 0 deposit)
export function isComplete(session: Session): boolean {
  return session.withdrawalAmount > 0 || (getTotalDeposit(session) === 0 && session.withdrawalAmount === 0);
}

export function getNetResult(session: Session): number {
  return session.withdrawalAmount - getTotalDeposit(session);
}

export function isWin(session: Session): boolean {
  // Pending sessions are not wins
  if (isPending(session)) return false;
  return getNetResult(session) > 0;
}

export function isLoss(session: Session): boolean {
  // Pending sessions are not losses (yet)
  if (isPending(session)) return false;
  return getNetResult(session) < 0;
}

export function getRtpPercentage(session: Session): number | null {
  const totalDeposit = getTotalDeposit(session);
  if (totalDeposit <= 0) return null;
  // Don't show RTP for pending sessions
  if (isPending(session)) return null;
  return (session.withdrawalAmount / totalDeposit) * 100;
}

export function getTaxYear(session: Session): number {
  return new Date(session.date).getFullYear();
}

export function getLossAmount(session: Session): number {
  return isLoss(session) ? Math.abs(getNetResult(session)) : 0;
}

export function getWinAmount(session: Session): number {
  return isWin(session) ? getNetResult(session) : 0;
}

export function sortByDateDescending(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function sortByDateAscending(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function filterByYear(sessions: Session[], year: number): Session[] {
  return sessions.filter(s => getTaxYear(s) === year);
}

export function filterByCasino(sessions: Session[], casinoID: string): Session[] {
  return sessions.filter(s => s.casinoID === casinoID);
}

export function filterByCreditCard(sessions: Session[], creditCardID: string): Session[] {
  return sessions.filter(s => {
    // New multi-card format
    if (s.cardDeposits && Array.isArray(s.cardDeposits)) {
      return s.cardDeposits.some(cd => cd.creditCardID === creditCardID);
    }
    return false;
  });
}

// Get start and end of the current week (Sunday to Saturday)
export function getCurrentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday

  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function filterByCurrentWeek(sessions: Session[]): Session[] {
  const { start, end } = getCurrentWeekRange();
  return sessions.filter(s => {
    const sessionDate = new Date(s.date);
    return sessionDate >= start && sessionDate <= end;
  });
}

// Get start and end of a specific month
export function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month, 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(year, month + 1, 0); // Last day of month
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

// Get start and end of the current month
export function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  return getMonthRange(now.getFullYear(), now.getMonth());
}

export function filterByMonth(sessions: Session[], year: number, month: number): Session[] {
  const { start, end } = getMonthRange(year, month);
  return sessions.filter(s => {
    const sessionDate = new Date(s.date);
    return sessionDate >= start && sessionDate <= end;
  });
}

export function filterByCurrentMonth(sessions: Session[]): Session[] {
  const now = new Date();
  return filterByMonth(sessions, now.getFullYear(), now.getMonth());
}

export function filterByDate(sessions: Session[], dateString: string): Session[] {
  return sessions.filter(s => s.date.slice(0, 10) === dateString);
}

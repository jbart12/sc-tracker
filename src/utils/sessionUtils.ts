import type { Session } from '../models/types';

// A session is pending if it has a deposit but no withdrawal yet
export function isPending(session: Session): boolean {
  return session.depositAmount > 0 && session.withdrawalAmount === 0;
}

// A session is complete if it has a withdrawal amount (even if 0 deposit)
export function isComplete(session: Session): boolean {
  return session.withdrawalAmount > 0 || (session.depositAmount === 0 && session.withdrawalAmount === 0);
}

export function getNetResult(session: Session): number {
  return session.withdrawalAmount - session.depositAmount;
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
  if (session.depositAmount <= 0) return null;
  // Don't show RTP for pending sessions
  if (isPending(session)) return null;
  return (session.withdrawalAmount / session.depositAmount) * 100;
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
  return sessions.filter(s => s.creditCardID === creditCardID);
}

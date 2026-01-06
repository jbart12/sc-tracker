import type { Session, CreditCard, TaxCalculation, FilingStatus, ItemizationAnalysis } from '../models/types';
import { filterByYear, isWin, isLoss, isPending, getWinAmount, getLossAmount, getTotalDeposit } from './sessionUtils';

const INDIANA_TAX_RATE = 0.0323;
const OBBBA_START_YEAR = 2026;

export function calculateTax(
  sessions: Session[],
  creditCards: CreditCard[],
  year: number
): TaxCalculation {
  const yearSessions = filterByYear(sessions, year);
  // Only include completed sessions for tax calculations
  const completedSessions = yearSessions.filter(s => !isPending(s));

  // Basic totals (from completed sessions only)
  const totalDeposits = completedSessions.reduce((sum, s) => sum + getTotalDeposit(s), 0);
  const totalWithdrawals = completedSessions.reduce((sum, s) => sum + s.withdrawalAmount, 0);
  const netResult = totalWithdrawals - totalDeposits;

  // Separate wins and losses for tax purposes
  const grossWinnings = completedSessions.reduce((sum, s) => sum + getWinAmount(s), 0);
  const grossLosses = completedSessions.reduce((sum, s) => sum + getLossAmount(s), 0);

  // Federal deductible losses
  const federalDeductibleLosses = calculateFederalDeductibleLosses(year, grossWinnings, grossLosses);
  const federalTaxableIncome = grossWinnings - federalDeductibleLosses;

  // Indiana: No loss deduction for amateur gamblers
  const indianaTaxableIncome = grossWinnings;
  const indianaStateTax = indianaTaxableIncome * INDIANA_TAX_RATE;

  // Cashback calculation (include all sessions since deposits still earn cashback)
  const estimatedCashback = calculateCashback(yearSessions, creditCards);

  // Session counts (completed only)
  const winningSessions = completedSessions.filter(isWin).length;
  const losingSessions = completedSessions.filter(isLoss).length;
  const breakEvenSessions = completedSessions.filter(s => s.withdrawalAmount === getTotalDeposit(s)).length;

  return {
    year,
    totalDeposits,
    totalWithdrawals,
    grossWinnings,
    grossLosses,
    netResult,
    federalDeductibleLosses,
    federalTaxableIncome,
    indianaTaxableIncome,
    indianaStateTax,
    estimatedCashback,
    totalSessions: completedSessions.length,
    winningSessions,
    losingSessions,
    breakEvenSessions,
  };
}

export function calculateFederalDeductibleLosses(
  year: number,
  winnings: number,
  losses: number
): number {
  if (year >= OBBBA_START_YEAR) {
    // OBBBA: Lesser of 90% of losses OR 90% of gains
    const ninetyPercentLosses = losses * 0.9;
    const ninetyPercentGains = winnings * 0.9;
    const cap = Math.min(ninetyPercentLosses, ninetyPercentGains);
    // Can't deduct more than actual losses
    return Math.min(losses, cap);
  } else {
    // Pre-2026: Losses up to winnings
    return Math.min(losses, winnings);
  }
}

export function calculateCashback(sessions: Session[], creditCards: CreditCard[]): number {
  return sessions.reduce((total, session) => {
    // New multi-card format
    if (session.cardDeposits && Array.isArray(session.cardDeposits)) {
      return total + session.cardDeposits.reduce((cardTotal, deposit) => {
        const card = creditCards.find(c => c.id === deposit.creditCardID);
        if (!card) return cardTotal;
        return cardTotal + deposit.amount * (card.cashbackPercentage / 100);
      }, 0);
    }
    return total;
  }, 0);
}

// Calculate cashback for a single session
export function calculateSessionCashback(session: Session, creditCards: CreditCard[]): number {
  if (!session.cardDeposits || !Array.isArray(session.cardDeposits)) return 0;
  return session.cardDeposits.reduce((total, deposit) => {
    const card = creditCards.find(c => c.id === deposit.creditCardID);
    if (!card) return total;
    return total + deposit.amount * (card.cashbackPercentage / 100);
  }, 0);
}

export function calculateRTP(totalDeposits: number, totalWithdrawals: number): number | null {
  if (totalDeposits <= 0) return null;
  return (totalWithdrawals / totalDeposits) * 100;
}

export function getStandardDeduction(year: number, filingStatus: FilingStatus): number {
  if (filingStatus === 'single') {
    if (year === 2024) return 14600;
    if (year === 2025) return 15000;
    return 15000;
  } else {
    if (year === 2024) return 29200;
    if (year === 2025) return 30000;
    return 30000;
  }
}

export function analyzeItemization(
  taxCalculation: TaxCalculation,
  filingStatus: FilingStatus,
  otherItemizedDeductions: number = 0
): ItemizationAnalysis {
  const standardDeduction = getStandardDeduction(taxCalculation.year, filingStatus);
  const totalItemized = taxCalculation.federalDeductibleLosses + otherItemizedDeductions;
  const benefit = totalItemized - standardDeduction;

  return {
    standardDeduction,
    gamblingLossDeduction: taxCalculation.federalDeductibleLosses,
    totalItemizedDeductions: totalItemized,
    benefitFromItemizing: benefit,
    shouldItemize: benefit > 0,
  };
}

import type { Session, CreditCard, TaxCalculation, FilingStatus, ItemizationAnalysis } from '../models/types';
import { filterByYear, isWin, isLoss, isPending, getWinAmount, getLossAmount, getTotalDeposit } from './sessionUtils';

// Indiana state tax rates (decreasing annually)
const INDIANA_STATE_TAX_RATES: Record<number, number> = {
  2024: 0.0305,
  2025: 0.0300,
  2026: 0.0295,
  2027: 0.0290, // Planned future rate
};

// Warrick County tax rate (flat)
const WARRICK_COUNTY_TAX_RATE = 0.0050;

// Federal tax rate (user's marginal bracket - married filing jointly 24%)
const FEDERAL_TAX_RATE = 0.24;

const OBBBA_START_YEAR = 2026;

function getIndianaStateRate(year: number): number {
  if (year in INDIANA_STATE_TAX_RATES) {
    return INDIANA_STATE_TAX_RATES[year];
  }
  // Default to latest known rate for future years
  return year > 2027 ? 0.0290 : 0.0305;
}

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
  const federalTaxRate = FEDERAL_TAX_RATE;
  const federalTaxOwed = federalTaxableIncome * federalTaxRate;

  // Indiana: No loss deduction for amateur gamblers
  const indianaTaxableIncome = grossWinnings;
  const indianaStateRate = getIndianaStateRate(year);
  const indianaCountyRate = WARRICK_COUNTY_TAX_RATE;
  const indianaStateTax = indianaTaxableIncome * indianaStateRate;
  const indianaCountyTax = indianaTaxableIncome * indianaCountyRate;
  const indianaTotalTax = indianaStateTax + indianaCountyTax;

  // Total tax owed (federal + state + county)
  const totalTaxOwed = federalTaxOwed + indianaTotalTax;

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
    federalTaxRate,
    federalTaxOwed,
    indianaTaxableIncome,
    indianaStateRate,
    indianaStateTax,
    indianaCountyRate,
    indianaCountyTax,
    indianaTotalTax,
    totalTaxOwed,
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
    // OBBBA (effective 2026): Only 90% of losses are deductible, still capped by winnings
    // See: https://taxfoundation.org/blog/gambling-losses-tax-big-beautiful-bill/
    const ninetyPercentLosses = losses * 0.9;
    return Math.min(ninetyPercentLosses, winnings);
  } else {
    // Pre-2026: Losses deductible up to winnings (100%)
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

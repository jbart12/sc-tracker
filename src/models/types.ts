// Core data types for SC Tracker

export interface Session {
  id: string;
  date: string; // ISO date string
  casinoID: string;
  creditCardID?: string;
  depositAmount: number;
  withdrawalAmount: number;
  notes?: string;
}

export interface Casino {
  id: string;
  name: string;
  isActive: boolean;
  depositPresets: number[];
}

export interface CreditCard {
  id: string;
  name: string;
  lastFourDigits?: string;
  cashbackPercentage: number;
  isActive: boolean;
}

export interface AppData {
  sessions: Session[];
  casinos: Casino[];
  creditCards: CreditCard[];
  schemaVersion: number;
}

export interface TaxCalculation {
  year: number;
  totalDeposits: number;
  totalWithdrawals: number;
  grossWinnings: number;
  grossLosses: number;
  netResult: number;
  federalDeductibleLosses: number;
  federalTaxableIncome: number;
  indianaTaxableIncome: number;
  indianaStateTax: number;
  estimatedCashback: number;
  totalSessions: number;
  winningSessions: number;
  losingSessions: number;
  breakEvenSessions: number;
}

export type FilingStatus = 'single' | 'marriedFilingJointly';

export interface ItemizationAnalysis {
  standardDeduction: number;
  gamblingLossDeduction: number;
  totalItemizedDeductions: number;
  benefitFromItemizing: number;
  shouldItemize: boolean;
}

export interface YTDStats {
  sessionCount: number;
  totalDeposits: number;
  totalWithdrawals: number;
  netResult: number;
  rtpPercentage: number | null;
  totalCashback: number;
  isProfit: boolean;
  isLoss: boolean;
  pendingCount?: number;
}

export interface CasinoStats {
  casino: Casino;
  sessionCount: number;
  totalDeposits: number;
  totalWithdrawals: number;
  netResult: number;
  rtpPercentage: number | null;
}

export type SortOrder = 'dateDesc' | 'dateAsc' | 'amountDesc' | 'amountAsc';

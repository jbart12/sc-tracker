// Core data types for SC Tracker

export interface CardDeposit {
  creditCardID: string;
  amount: number;
  cashbackOverride?: number; // Optional override for calculated cashback
  foreignTransactionFeePercent?: number; // Foreign transaction fee percentage (e.g., 3 for 3%)
}

export interface Session {
  id: string;
  date: string; // ISO date string
  casinoID: string;
  cardDeposits: CardDeposit[];  // Multi-card deposits
  depositAmount: number;        // Computed total (for backward compat)
  withdrawalAmount: number;
  notes?: string;
}

export interface ArchivedSession extends Session {
  archivedAt: string; // ISO date string when archived
  archiveReason?: string;
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
  archivedSessions: ArchivedSession[];
  casinos: Casino[];
  creditCards: CreditCard[];
  schemaVersion: number;
  dataVersion?: number; // Optimistic concurrency version — incremented on each save
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
  federalTaxRate: number;
  federalTaxOwed: number;
  indianaTaxableIncome: number;
  indianaStateRate: number;
  indianaStateTax: number;
  indianaCountyRate: number;
  indianaCountyTax: number;
  indianaTotalTax: number;
  totalTaxOwed: number;
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
  netWithCashback: number;  // Net result including cashback earnings
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
  cashback: number;
  totalProfit: number;
  rtpPercentage: number | null;
}

export type SortOrder = 'dateDesc' | 'dateAsc' | 'amountDesc' | 'amountAsc';

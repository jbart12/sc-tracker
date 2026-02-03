import type { Session, Casino, CreditCard } from '../models/types';
import {
  filterByYear,
  sortByDateAscending,
  isPending,
  getTotalDeposit,
  getNetResult,
  isWin,
  isLoss
} from './sessionUtils';
import { calculateSessionCashback, calculateRTP } from './taxCalculator';

export interface CumulativeProfitDataPoint {
  date: string;
  profit: number;
  profitWithCashback: number;
  sessionCount: number;
}

export interface CasinoPerformanceData {
  name: string;
  netProfit: number;
  totalProfit: number; // includes cashback
  sessionCount: number;
}

export interface ActivityHeatmapData {
  date: string;
  count: number;
  profit: number;
}

export interface SessionOutcomeData {
  name: string;
  value: number;
  color: string;
}

export interface DepositDistributionData {
  name: string;
  value: number;
  color: string;
}

// Calculate cumulative profit over time for a given year
export function calculateCumulativeProfit(
  sessions: Session[],
  creditCards: CreditCard[],
  year: number
): CumulativeProfitDataPoint[] {
  const yearSessions = filterByYear(sessions, year).filter(s => !isPending(s));
  const sorted = sortByDateAscending(yearSessions);

  let cumulativeProfit = 0;
  let cumulativeProfitWithCashback = 0;
  let sessionCount = 0;

  const dataPoints: CumulativeProfitDataPoint[] = [];

  for (const session of sorted) {
    const netResult = getNetResult(session);
    const cashback = calculateSessionCashback(session, creditCards);

    cumulativeProfit += netResult;
    cumulativeProfitWithCashback += netResult + cashback;
    sessionCount++;

    dataPoints.push({
      date: session.date,
      profit: cumulativeProfit,
      profitWithCashback: cumulativeProfitWithCashback,
      sessionCount,
    });
  }

  return dataPoints;
}

// Calculate net profit by casino for a given year
export function calculateCasinoPerformance(
  sessions: Session[],
  casinos: Casino[],
  creditCards: CreditCard[],
  year: number
): CasinoPerformanceData[] {
  const yearSessions = filterByYear(sessions, year).filter(s => !isPending(s));

  // O(1) lookup map for casino names
  const casinoLookup = new Map(casinos.map(c => [c.id, c]));

  const statsMap = new Map<string, { netProfit: number; cashback: number; count: number }>();

  for (const session of yearSessions) {
    const existing = statsMap.get(session.casinoID) || { netProfit: 0, cashback: 0, count: 0 };
    existing.netProfit += getNetResult(session);
    existing.cashback += calculateSessionCashback(session, creditCards);
    existing.count++;
    statsMap.set(session.casinoID, existing);
  }

  const results: CasinoPerformanceData[] = [];

  for (const [casinoID, stats] of statsMap) {
    const casino = casinoLookup.get(casinoID);
    results.push({
      name: casino?.name || 'Unknown',
      netProfit: stats.netProfit,
      totalProfit: stats.netProfit + stats.cashback,
      sessionCount: stats.count,
    });
  }

  // Sort by total profit descending
  return results.sort((a, b) => b.totalProfit - a.totalProfit);
}

// Generate activity heatmap data for a full year
export function calculateActivityHeatmap(
  sessions: Session[],
  creditCards: CreditCard[],
  year: number
): ActivityHeatmapData[] {
  const yearSessions = filterByYear(sessions, year).filter(s => !isPending(s));

  // Create map of date -> { count, profit }
  const dateMap = new Map<string, { count: number; profit: number }>();

  for (const session of yearSessions) {
    const dateKey = session.date.split('T')[0]; // Get YYYY-MM-DD
    const existing = dateMap.get(dateKey) || { count: 0, profit: 0 };
    const cashback = calculateSessionCashback(session, creditCards);
    existing.count++;
    existing.profit += getNetResult(session) + cashback;
    dateMap.set(dateKey, existing);
  }

  // Generate all dates for the year (avoiding date mutation issues)
  const result: ActivityHeatmapData[] = [];
  const current = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  while (current <= endDate) {
    const dateKey = current.toISOString().split('T')[0];
    const data = dateMap.get(dateKey);
    result.push({
      date: dateKey,
      count: data?.count || 0,
      profit: data?.profit || 0,
    });
    current.setDate(current.getDate() + 1);
  }

  return result;
}

// Calculate session outcomes (Win/Loss/Break-even)
export function calculateSessionOutcomes(
  sessions: Session[],
  year: number
): SessionOutcomeData[] {
  const yearSessions = filterByYear(sessions, year).filter(s => !isPending(s));

  let wins = 0;
  let losses = 0;
  let breakEven = 0;

  for (const session of yearSessions) {
    if (isWin(session)) wins++;
    else if (isLoss(session)) losses++;
    else breakEven++;
  }

  return [
    { name: 'Wins', value: wins, color: '#22c55e' },
    { name: 'Losses', value: losses, color: '#ef4444' },
    { name: 'Break Even', value: breakEven, color: '#64748b' },
  ].filter(d => d.value > 0);
}

// Calculate overall RTP for a year
export function calculateOverallRTP(
  sessions: Session[],
  year: number
): number | null {
  const yearSessions = filterByYear(sessions, year).filter(s => !isPending(s));

  const totalDeposits = yearSessions.reduce((sum, s) => sum + getTotalDeposit(s), 0);
  const totalWithdrawals = yearSessions.reduce((sum, s) => sum + s.withdrawalAmount, 0);

  return calculateRTP(totalDeposits, totalWithdrawals);
}

// Color palette for pie charts
export const CHART_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'
] as const;

// Calculate deposit distribution by casino
export function calculateDepositDistribution(
  sessions: Session[],
  casinos: Casino[],
  year: number
): DepositDistributionData[] {
  const yearSessions = filterByYear(sessions, year).filter(s => !isPending(s));

  // O(1) lookup map for casino names
  const casinoLookup = new Map(casinos.map(c => [c.id, c]));

  const depositMap = new Map<string, number>();

  for (const session of yearSessions) {
    const deposit = getTotalDeposit(session);
    const existing = depositMap.get(session.casinoID) || 0;
    depositMap.set(session.casinoID, existing + deposit);
  }

  const results: DepositDistributionData[] = [];
  let colorIndex = 0;

  for (const [casinoID, total] of depositMap) {
    const casino = casinoLookup.get(casinoID);
    results.push({
      name: casino?.name || 'Unknown',
      value: total,
      color: CHART_COLORS[colorIndex % CHART_COLORS.length],
    });
    colorIndex++;
  }

  // Sort by deposit amount descending
  return results.sort((a, b) => b.value - a.value);
}

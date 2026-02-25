import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { calculateTax, calculateRTP, calculateCashback, calculateSessionCashback } from '../../utils/taxCalculator';
import { filterByYear, filterByCasino, filterByCurrentWeek, getCurrentWeekRange, filterByMonth, getMonthRange, filterByDate, isPending, getTotalDeposit, getTotalForeignTransactionFees } from '../../utils/sessionUtils';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import type { CasinoStats } from '../../models/types';
import './Dashboard.css';

interface PeriodStats {
  sessionCount: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalBet: number;
  netResult: number;
  netWithCashback: number;
  totalCashback: number;
  totalForeignFees: number;
  rtpPercentage: number | null;
}

interface WeeklyStats extends PeriodStats {
  weekStart: Date;
  weekEnd: Date;
}

interface MonthlyStats extends PeriodStats {
  monthStart: Date;
  monthEnd: Date;
}

interface DailyStats extends PeriodStats {
  date: string;
}

interface YearlyStats extends PeriodStats {
  year: number;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function Dashboard() {
  const { data, yearsWithSessions, isLoading } = useApp();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  // Daily selector state
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });

  // Monthly selector state
  const [selectedMonthYear, setSelectedMonthYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // Yearly selector state
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Update selected years when data loads
  useEffect(() => {
    if (yearsWithSessions.length > 0) {
      if (!yearsWithSessions.includes(selectedYear)) {
        setSelectedYear(yearsWithSessions[0]);
      }
      if (!yearsWithSessions.includes(selectedMonthYear)) {
        setSelectedMonthYear(yearsWithSessions[0]);
      }
    }
  }, [yearsWithSessions, selectedYear, selectedMonthYear]);

  const availableYears = useMemo(() => {
    const years = new Set(yearsWithSessions);
    years.add(currentYear);
    return [...years].sort((a, b) => b - a);
  }, [yearsWithSessions, currentYear]);

  // Available months for selected year (only months that have sessions, plus current month if current year)
  const availableMonths = useMemo(() => {
    const yearSessions = filterByYear(data.sessions, selectedMonthYear);
    const monthsWithSessions = new Set(yearSessions.map(s => new Date(s.date).getMonth()));

    // If it's the current year, include the current month
    if (selectedMonthYear === currentYear) {
      monthsWithSessions.add(currentMonth);
    }

    return [...monthsWithSessions].sort((a, b) => b - a);
  }, [data.sessions, selectedMonthYear, currentYear, currentMonth]);

  // When year changes for monthly selector, adjust month if needed
  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const dailyStats = useMemo((): DailyStats => {
    const daySessions = filterByDate(data.sessions, selectedDate);
    const completedSessions = daySessions.filter(s => !isPending(s));

    const totalDeposits = completedSessions.reduce((sum, s) => sum + getTotalDeposit(s), 0);
    const totalWithdrawals = completedSessions.reduce((sum, s) => sum + s.withdrawalAmount, 0);
    const totalForeignFees = completedSessions.reduce((sum, s) => sum + getTotalForeignTransactionFees(s), 0);
    const netResult = totalWithdrawals - totalDeposits - totalForeignFees;
    const totalCashback = calculateCashback(completedSessions, data.creditCards);
    const netWithCashback = netResult + totalCashback;
    const totalBet = totalDeposits * 3;

    return {
      sessionCount: completedSessions.length,
      totalDeposits,
      totalWithdrawals,
      totalBet,
      netResult,
      netWithCashback,
      totalCashback,
      totalForeignFees,
      rtpPercentage: calculateRTP(totalDeposits, totalWithdrawals),
      date: selectedDate,
    };
  }, [data.sessions, data.creditCards, selectedDate]);

  const weeklyStats = useMemo((): WeeklyStats => {
    const { start, end } = getCurrentWeekRange();
    const weekSessions = filterByCurrentWeek(data.sessions);
    const completedSessions = weekSessions.filter(s => !isPending(s));

    const totalDeposits = completedSessions.reduce((sum, s) => sum + getTotalDeposit(s), 0);
    const totalWithdrawals = completedSessions.reduce((sum, s) => sum + s.withdrawalAmount, 0);
    const totalForeignFees = completedSessions.reduce((sum, s) => sum + getTotalForeignTransactionFees(s), 0);
    const netResult = totalWithdrawals - totalDeposits - totalForeignFees;
    const totalCashback = calculateCashback(completedSessions, data.creditCards);
    const netWithCashback = netResult + totalCashback;
    const totalBet = totalDeposits * 3;

    return {
      sessionCount: completedSessions.length,
      totalDeposits,
      totalWithdrawals,
      totalBet,
      netResult,
      netWithCashback,
      totalCashback,
      totalForeignFees,
      rtpPercentage: calculateRTP(totalDeposits, totalWithdrawals),
      weekStart: start,
      weekEnd: end,
    };
  }, [data.sessions, data.creditCards]);

  const monthlyStats = useMemo((): MonthlyStats => {
    const { start, end } = getMonthRange(selectedMonthYear, selectedMonth);
    const monthSessions = filterByMonth(data.sessions, selectedMonthYear, selectedMonth);
    const completedSessions = monthSessions.filter(s => !isPending(s));

    const totalDeposits = completedSessions.reduce((sum, s) => sum + getTotalDeposit(s), 0);
    const totalWithdrawals = completedSessions.reduce((sum, s) => sum + s.withdrawalAmount, 0);
    const totalForeignFees = completedSessions.reduce((sum, s) => sum + getTotalForeignTransactionFees(s), 0);
    const netResult = totalWithdrawals - totalDeposits - totalForeignFees;
    const totalCashback = calculateCashback(completedSessions, data.creditCards);
    const netWithCashback = netResult + totalCashback;
    const totalBet = totalDeposits * 3;

    return {
      sessionCount: completedSessions.length,
      totalDeposits,
      totalWithdrawals,
      totalBet,
      netResult,
      netWithCashback,
      totalCashback,
      totalForeignFees,
      rtpPercentage: calculateRTP(totalDeposits, totalWithdrawals),
      monthStart: start,
      monthEnd: end,
    };
  }, [data.sessions, data.creditCards, selectedMonthYear, selectedMonth]);

  const yearlyStats = useMemo((): YearlyStats => {
    const yearSessions = filterByYear(data.sessions, selectedYear);
    const completedSessions = yearSessions.filter(s => !isPending(s));

    const totalDeposits = completedSessions.reduce((sum, s) => sum + getTotalDeposit(s), 0);
    const totalWithdrawals = completedSessions.reduce((sum, s) => sum + s.withdrawalAmount, 0);
    const totalForeignFees = completedSessions.reduce((sum, s) => sum + getTotalForeignTransactionFees(s), 0);
    const netResult = totalWithdrawals - totalDeposits - totalForeignFees;
    const totalCashback = calculateCashback(completedSessions, data.creditCards);
    const netWithCashback = netResult + totalCashback;
    const totalBet = totalDeposits * 3;

    return {
      sessionCount: completedSessions.length,
      totalDeposits,
      totalWithdrawals,
      totalBet,
      netResult,
      netWithCashback,
      totalCashback,
      totalForeignFees,
      rtpPercentage: calculateRTP(totalDeposits, totalWithdrawals),
      year: selectedYear,
    };
  }, [data.sessions, data.creditCards, selectedYear]);

  const allTimeStats = useMemo((): PeriodStats => {
    const completedSessions = data.sessions.filter(s => !isPending(s));

    const totalDeposits = completedSessions.reduce((sum, s) => sum + getTotalDeposit(s), 0);
    const totalWithdrawals = completedSessions.reduce((sum, s) => sum + s.withdrawalAmount, 0);
    const totalForeignFees = completedSessions.reduce((sum, s) => sum + getTotalForeignTransactionFees(s), 0);
    const netResult = totalWithdrawals - totalDeposits - totalForeignFees;
    const totalCashback = calculateCashback(completedSessions, data.creditCards);
    const netWithCashback = netResult + totalCashback;
    const totalBet = totalDeposits * 3;

    return {
      sessionCount: completedSessions.length,
      totalDeposits,
      totalWithdrawals,
      totalBet,
      netResult,
      netWithCashback,
      totalCashback,
      totalForeignFees,
      rtpPercentage: calculateRTP(totalDeposits, totalWithdrawals),
    };
  }, [data.sessions, data.creditCards]);

  const taxCalculation = useMemo(
    () => calculateTax(data.sessions, data.creditCards, selectedYear),
    [data.sessions, data.creditCards, selectedYear]
  );

  const casinoStats = useMemo((): CasinoStats[] => {
    const yearSessions = filterByYear(data.sessions, selectedYear);
    return data.casinos
      .map(casino => {
        const casinoSessions = filterByCasino(yearSessions, casino.id);
        if (casinoSessions.length === 0) return null;

        // Total deposits includes all sessions
        const totalDeposits = casinoSessions.reduce((sum, s) => sum + getTotalDeposit(s), 0);
        // Only calculate net from completed sessions
        const completedSessions = casinoSessions.filter(s => !isPending(s));
        const completedDeposits = completedSessions.reduce((sum, s) => sum + getTotalDeposit(s), 0);
        const totalWithdrawals = completedSessions.reduce((sum, s) => sum + s.withdrawalAmount, 0);
        const totalForeignFees = completedSessions.reduce((sum, s) => sum + getTotalForeignTransactionFees(s), 0);
        const netResult = totalWithdrawals - completedDeposits - totalForeignFees;

        // Calculate cashback for this casino's sessions
        const cashback = casinoSessions.reduce((sum, s) => sum + calculateSessionCashback(s, data.creditCards), 0);
        const totalProfit = netResult + cashback;

        return {
          casino,
          sessionCount: casinoSessions.length,
          totalDeposits,
          totalWithdrawals,
          netResult,
          cashback,
          totalProfit,
          rtpPercentage: calculateRTP(completedDeposits, totalWithdrawals),
        };
      })
      .filter((s): s is CasinoStats => s !== null)
      .sort((a, b) => b.totalProfit - a.totalProfit);
  }, [data.sessions, data.casinos, data.creditCards, selectedYear]);

  if (isLoading) {
    return <div className="dashboard"><p>Loading...</p></div>;
  }

  return (
    <div className="dashboard">
      {/* Daily Stats */}
      <div className="period-stats">
        <div className="period-header">
          <h3>Today</h3>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="period-picker"
          />
        </div>
        {dailyStats.sessionCount > 0 ? (
          <StatsGrid stats={dailyStats} />
        ) : (
          <p className="no-sessions">No sessions on {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
        )}
      </div>

      {/* Weekly Stats */}
      <div className="period-stats">
        <div className="period-header">
          <h3>This Week</h3>
          <span className="period-range">
            {weeklyStats.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weeklyStats.weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
        {weeklyStats.sessionCount > 0 ? (
          <StatsGrid stats={weeklyStats} />
        ) : (
          <p className="no-sessions">No sessions this week</p>
        )}
      </div>

      {/* Monthly Stats */}
      <div className="period-stats">
        <div className="period-header">
          <h3>Monthly</h3>
          <div className="period-selectors">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="period-picker"
            >
              {availableMonths.map(month => (
                <option key={month} value={month}>{MONTH_NAMES_SHORT[month]}</option>
              ))}
            </select>
            <select
              value={selectedMonthYear}
              onChange={(e) => setSelectedMonthYear(Number(e.target.value))}
              className="period-picker"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
        {monthlyStats.sessionCount > 0 ? (
          <StatsGrid stats={monthlyStats} />
        ) : (
          <p className="no-sessions">No sessions in {MONTH_NAMES[selectedMonth]} {selectedMonthYear}</p>
        )}
      </div>

      {/* Yearly Stats */}
      <div className="period-stats">
        <div className="period-header">
          <h3>Yearly</h3>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="period-picker"
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        {yearlyStats.sessionCount > 0 ? (
          <StatsGrid stats={yearlyStats} />
        ) : (
          <p className="no-sessions">No sessions in {selectedYear}</p>
        )}
      </div>

      {/* All-Time Stats */}
      <div className="period-stats">
        <div className="period-header">
          <h3>All Time</h3>
        </div>
        {allTimeStats.sessionCount > 0 ? (
          <StatsGrid stats={allTimeStats} />
        ) : (
          <p className="no-sessions">No sessions recorded</p>
        )}
      </div>

      <div className="tax-preview">
        <h3>Tax Preview</h3>
        <div className="tax-columns">
          <div className="tax-column">
            <h4>Federal</h4>
            <div className="tax-row">
              <span>Taxable Income</span>
              <span>{formatCurrency(taxCalculation.federalTaxableIncome)}</span>
            </div>
            <div className="tax-row">
              <span>Deductible Losses</span>
              <span>{formatCurrency(taxCalculation.federalDeductibleLosses)}</span>
            </div>
          </div>
          <div className="tax-divider" />
          <div className="tax-column">
            <h4>Indiana State</h4>
            <div className="tax-row">
              <span>Taxable Income</span>
              <span>{formatCurrency(taxCalculation.indianaTaxableIncome)}</span>
            </div>
            <div className="tax-row">
              <span>Estimated Tax (3.23%)</span>
              <span>{formatCurrency(taxCalculation.indianaStateTax)}</span>
            </div>
          </div>
        </div>
        {selectedYear >= 2026 && (
          <p className="tax-note">OBBBA 90% deduction cap applied for {selectedYear}</p>
        )}
      </div>

      {casinoStats.length > 0 && (
        <div className="casino-breakdown">
          <h3>By Casino</h3>
          <div className="casino-header">
            <span className="casino-name">Casino</span>
            <span className="casino-sessions">Sessions</span>
            <span className="casino-deposits">Deposits</span>
            <span className="casino-withdrawals">Withdrawals</span>
            <span className="casino-cashback">Cashback</span>
            <span className="casino-result">Net</span>
            <span className="casino-profit">Profit</span>
            <span className="casino-rtp">RTP</span>
          </div>
          {casinoStats.map(stat => (
            <div key={stat.casino.id} className="casino-row">
              <span className="casino-name">{stat.casino.name}</span>
              <span className="casino-sessions">{stat.sessionCount}</span>
              <span className="casino-deposits">{formatCurrency(stat.totalDeposits)}</span>
              <span className="casino-withdrawals">{formatCurrency(stat.totalWithdrawals)}</span>
              <span className="casino-cashback">{formatCurrency(stat.cashback)}</span>
              <span className={`casino-result ${stat.netResult >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(stat.netResult)}
              </span>
              <span className={`casino-profit ${stat.totalProfit >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(stat.totalProfit)}
              </span>
              <span className="casino-rtp">
                {stat.rtpPercentage ? formatPercent(stat.rtpPercentage) : '-'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatsGrid({ stats }: { stats: PeriodStats }) {
  return (
    <div className="stats-grid">
      <div className="stats-item">
        <span className="stats-label">Sessions</span>
        <span className="stats-value">{stats.sessionCount}</span>
      </div>
      <div className="stats-item">
        <span className="stats-label">Deposited</span>
        <span className="stats-value">{formatCurrency(stats.totalDeposits)}</span>
      </div>
      <div className="stats-item">
        <span className="stats-label">Total Bet</span>
        <span className="stats-value">{formatCurrency(stats.totalBet)}</span>
      </div>
      <div className="stats-item">
        <span className="stats-label">Withdrawn</span>
        <span className="stats-value">{formatCurrency(stats.totalWithdrawals)}</span>
      </div>
      <div className="stats-item">
        <span className="stats-label">Net Result</span>
        <span className={`stats-value ${stats.netResult > 0 ? 'positive' : stats.netResult < 0 ? 'negative' : ''}`}>
          {formatCurrency(stats.netResult)}
        </span>
      </div>
      <div className="stats-item">
        <span className="stats-label">Cashback</span>
        <span className="stats-value positive">{formatCurrency(stats.totalCashback)}</span>
      </div>
      <div className="stats-item highlight">
        <span className="stats-label">Profit</span>
        <span className={`stats-value ${stats.netWithCashback > 0 ? 'positive' : stats.netWithCashback < 0 ? 'negative' : ''}`}>
          {formatCurrency(stats.netWithCashback)}
        </span>
      </div>
      <div className="stats-item">
        <span className="stats-label">RTP</span>
        <span className="stats-value">
          {stats.rtpPercentage ? formatPercent(stats.rtpPercentage) : 'N/A'}
        </span>
      </div>
    </div>
  );
}

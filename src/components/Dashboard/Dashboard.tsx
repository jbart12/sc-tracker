import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { calculateTax, calculateRTP, calculateCashback, calculateSessionCashback } from '../../utils/taxCalculator';
import { filterByYear, filterByCasino, filterByCurrentWeek, getCurrentWeekRange, isPending, getTotalDeposit } from '../../utils/sessionUtils';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import type { YTDStats, CasinoStats } from '../../models/types';
import './Dashboard.css';

interface WeeklyStats {
  sessionCount: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalBet: number; // 3x deposits
  netResult: number;
  netWithCashback: number;
  totalCashback: number;
  rtpPercentage: number | null;
  weekStart: Date;
  weekEnd: Date;
}

export function Dashboard() {
  const { data, yearsWithSessions, isLoading } = useApp();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Update selected year when data loads
  useEffect(() => {
    if (yearsWithSessions.length > 0 && !yearsWithSessions.includes(selectedYear)) {
      setSelectedYear(yearsWithSessions[0]);
    }
  }, [yearsWithSessions, selectedYear]);

  const availableYears = useMemo(() => {
    const years = new Set(yearsWithSessions);
    years.add(currentYear);
    return [...years].sort((a, b) => b - a);
  }, [yearsWithSessions, currentYear]);

  const ytdStats = useMemo((): YTDStats => {
    const yearSessions = filterByYear(data.sessions, selectedYear);
    const completedSessions = yearSessions.filter(s => !isPending(s));
    const pendingCount = yearSessions.filter(isPending).length;

    // Total deposits includes all sessions
    const totalDeposits = yearSessions.reduce((sum, s) => sum + getTotalDeposit(s), 0);
    // Only count withdrawals and calculate net from completed sessions
    const totalWithdrawals = completedSessions.reduce((sum, s) => sum + s.withdrawalAmount, 0);
    const completedDeposits = completedSessions.reduce((sum, s) => sum + getTotalDeposit(s), 0);
    const netResult = totalWithdrawals - completedDeposits;
    const totalCashback = calculateCashback(yearSessions, data.creditCards);
    const netWithCashback = netResult + totalCashback;

    return {
      sessionCount: yearSessions.length,
      totalDeposits,
      totalWithdrawals,
      netResult,
      netWithCashback,
      rtpPercentage: calculateRTP(completedDeposits, totalWithdrawals),
      totalCashback,
      isProfit: netResult > 0,
      isLoss: netResult < 0,
      pendingCount,
    };
  }, [data.sessions, data.creditCards, selectedYear]);

  const weeklyStats = useMemo((): WeeklyStats => {
    const { start, end } = getCurrentWeekRange();
    const weekSessions = filterByCurrentWeek(data.sessions);
    const completedSessions = weekSessions.filter(s => !isPending(s));

    // Only use completed sessions for all stats
    const totalDeposits = completedSessions.reduce((sum, s) => sum + getTotalDeposit(s), 0);
    const totalWithdrawals = completedSessions.reduce((sum, s) => sum + s.withdrawalAmount, 0);
    const netResult = totalWithdrawals - totalDeposits;
    const totalCashback = calculateCashback(completedSessions, data.creditCards);
    const netWithCashback = netResult + totalCashback;
    const totalBet = totalDeposits * 3; // 3x playthrough assumption

    return {
      sessionCount: completedSessions.length,
      totalDeposits,
      totalWithdrawals,
      totalBet,
      netResult,
      netWithCashback,
      totalCashback,
      rtpPercentage: calculateRTP(totalDeposits, totalWithdrawals),
      weekStart: start,
      weekEnd: end,
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
        const netResult = totalWithdrawals - completedDeposits;

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
      <div className="dashboard-header">
        <h2>Year-to-Date Summary</h2>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="year-picker"
        >
          {availableYears.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <div className="stat-cards">
        <StatCard
          title="Total Profit"
          value={formatCurrency(ytdStats.netWithCashback)}
          valueClass={ytdStats.netWithCashback > 0 ? 'positive' : ytdStats.netWithCashback < 0 ? 'negative' : ''}
          large
        />
        <StatCard title="Sessions" value={String(ytdStats.sessionCount)} />
        <StatCard title="Total Deposited" value={formatCurrency(ytdStats.totalDeposits)} />
        <StatCard title="Total Withdrawn" value={formatCurrency(ytdStats.totalWithdrawals)} />
        <StatCard
          title="Net Result"
          value={formatCurrency(ytdStats.netResult)}
          valueClass={ytdStats.isProfit ? 'positive' : ytdStats.isLoss ? 'negative' : ''}
        />
        <StatCard title="Cashback Earned" value={formatCurrency(ytdStats.totalCashback)} />
        <StatCard
          title="RTP"
          value={ytdStats.rtpPercentage ? formatPercent(ytdStats.rtpPercentage) : 'N/A'}
        />
      </div>

      <div className="weekly-stats">
        <h3>
          This Week
          <span className="week-range">
            {weeklyStats.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weeklyStats.weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </h3>
        {weeklyStats.sessionCount > 0 ? (
          <div className="weekly-grid">
            <div className="weekly-stat">
              <span className="weekly-label">Sessions</span>
              <span className="weekly-value">{weeklyStats.sessionCount}</span>
            </div>
            <div className="weekly-stat">
              <span className="weekly-label">Deposited</span>
              <span className="weekly-value">{formatCurrency(weeklyStats.totalDeposits)}</span>
            </div>
            <div className="weekly-stat">
              <span className="weekly-label">Total Bet</span>
              <span className="weekly-value">{formatCurrency(weeklyStats.totalBet)}</span>
            </div>
            <div className="weekly-stat">
              <span className="weekly-label">Withdrawn</span>
              <span className="weekly-value">{formatCurrency(weeklyStats.totalWithdrawals)}</span>
            </div>
            <div className="weekly-stat">
              <span className="weekly-label">Net Result</span>
              <span className={`weekly-value ${weeklyStats.netResult > 0 ? 'positive' : weeklyStats.netResult < 0 ? 'negative' : ''}`}>
                {formatCurrency(weeklyStats.netResult)}
              </span>
            </div>
            <div className="weekly-stat">
              <span className="weekly-label">Cashback</span>
              <span className="weekly-value positive">{formatCurrency(weeklyStats.totalCashback)}</span>
            </div>
            <div className="weekly-stat highlight">
              <span className="weekly-label">Profit</span>
              <span className={`weekly-value ${weeklyStats.netWithCashback > 0 ? 'positive' : weeklyStats.netWithCashback < 0 ? 'negative' : ''}`}>
                {formatCurrency(weeklyStats.netWithCashback)}
              </span>
            </div>
            <div className="weekly-stat">
              <span className="weekly-label">RTP</span>
              <span className="weekly-value">
                {weeklyStats.rtpPercentage ? formatPercent(weeklyStats.rtpPercentage) : 'N/A'}
              </span>
            </div>
          </div>
        ) : (
          <p className="no-sessions">No sessions this week</p>
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

function StatCard({ title, value, valueClass = '', large = false }: { title: string; value: string; valueClass?: string; large?: boolean }) {
  return (
    <div className={`stat-card ${large ? 'stat-card-large' : ''}`}>
      <div className="stat-title">{title}</div>
      <div className={`stat-value ${valueClass}`}>{value}</div>
    </div>
  );
}

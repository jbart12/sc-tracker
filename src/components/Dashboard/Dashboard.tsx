import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { calculateTax, calculateRTP, calculateCashback } from '../../utils/taxCalculator';
import { filterByYear, filterByCasino, isPending } from '../../utils/sessionUtils';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import type { YTDStats, CasinoStats } from '../../models/types';
import './Dashboard.css';

export function Dashboard() {
  const { data, yearsWithSessions } = useApp();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(
    yearsWithSessions.length > 0 ? yearsWithSessions[0] : currentYear
  );

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
    const totalDeposits = yearSessions.reduce((sum, s) => sum + s.depositAmount, 0);
    // Only count withdrawals and calculate net from completed sessions
    const totalWithdrawals = completedSessions.reduce((sum, s) => sum + s.withdrawalAmount, 0);
    const completedDeposits = completedSessions.reduce((sum, s) => sum + s.depositAmount, 0);
    const netResult = totalWithdrawals - completedDeposits;
    const totalCashback = calculateCashback(yearSessions, data.creditCards);

    return {
      sessionCount: yearSessions.length,
      totalDeposits,
      totalWithdrawals,
      netResult,
      rtpPercentage: calculateRTP(completedDeposits, totalWithdrawals),
      totalCashback,
      isProfit: netResult > 0,
      isLoss: netResult < 0,
      pendingCount,
    };
  }, [data.sessions, data.creditCards, selectedYear]);

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
        const totalDeposits = casinoSessions.reduce((sum, s) => sum + s.depositAmount, 0);
        // Only calculate net from completed sessions
        const completedSessions = casinoSessions.filter(s => !isPending(s));
        const completedDeposits = completedSessions.reduce((sum, s) => sum + s.depositAmount, 0);
        const totalWithdrawals = completedSessions.reduce((sum, s) => sum + s.withdrawalAmount, 0);

        return {
          casino,
          sessionCount: casinoSessions.length,
          totalDeposits,
          totalWithdrawals,
          netResult: totalWithdrawals - completedDeposits,
          rtpPercentage: calculateRTP(completedDeposits, totalWithdrawals),
        };
      })
      .filter((s): s is CasinoStats => s !== null)
      .sort((a, b) => b.sessionCount - a.sessionCount);
  }, [data.sessions, data.casinos, selectedYear]);

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
        <StatCard title="Sessions" value={String(ytdStats.sessionCount)} />
        <StatCard title="Total Deposited" value={formatCurrency(ytdStats.totalDeposits)} />
        <StatCard title="Total Withdrawn" value={formatCurrency(ytdStats.totalWithdrawals)} />
        <StatCard
          title="Net Result"
          value={formatCurrency(ytdStats.netResult)}
          valueClass={ytdStats.isProfit ? 'positive' : ytdStats.isLoss ? 'negative' : ''}
        />
        <StatCard
          title="RTP"
          value={ytdStats.rtpPercentage ? formatPercent(ytdStats.rtpPercentage) : 'N/A'}
        />
        <StatCard title="Cashback Earned" value={formatCurrency(ytdStats.totalCashback)} />
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
            <span className="casino-result">Net</span>
            <span className="casino-rtp">RTP</span>
          </div>
          {casinoStats.map(stat => (
            <div key={stat.casino.id} className="casino-row">
              <span className="casino-name">{stat.casino.name}</span>
              <span className="casino-sessions">{stat.sessionCount}</span>
              <span className="casino-deposits">{formatCurrency(stat.totalDeposits)}</span>
              <span className="casino-withdrawals">{formatCurrency(stat.totalWithdrawals)}</span>
              <span className={`casino-result ${stat.netResult >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(stat.netResult)}
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

function StatCard({ title, value, valueClass = '' }: { title: string; value: string; valueClass?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-title">{title}</div>
      <div className={`stat-value ${valueClass}`}>{value}</div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  calculateCumulativeProfit,
  calculateCasinoPerformance,
  calculateActivityHeatmap,
  calculateSessionOutcomes,
  calculateOverallRTP,
  calculateDepositDistribution,
} from '../../utils/chartDataUtils';
import { ChartErrorBoundary } from './ChartErrorBoundary';
import { CumulativeProfitChart } from './charts/CumulativeProfitChart';
import { CasinoPerformanceChart } from './charts/CasinoPerformanceChart';
import { ActivityHeatmap } from './charts/ActivityHeatmap';
import { SessionOutcomeChart } from './charts/SessionOutcomeChart';
import { RTPGauge } from './charts/RTPGauge';
import { DepositDistributionChart } from './charts/DepositDistributionChart';
import './Analytics.css';

export function Analytics() {
  const { data, yearsWithSessions, isLoading } = useApp();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const cumulativeProfitData = useMemo(
    () => calculateCumulativeProfit(data.sessions, data.creditCards, selectedYear),
    [data.sessions, data.creditCards, selectedYear]
  );

  const casinoPerformanceData = useMemo(
    () => calculateCasinoPerformance(data.sessions, data.casinos, data.creditCards, selectedYear),
    [data.sessions, data.casinos, data.creditCards, selectedYear]
  );

  const activityHeatmapData = useMemo(
    () => calculateActivityHeatmap(data.sessions, data.creditCards, selectedYear),
    [data.sessions, data.creditCards, selectedYear]
  );

  const sessionOutcomeData = useMemo(
    () => calculateSessionOutcomes(data.sessions, selectedYear),
    [data.sessions, selectedYear]
  );

  const overallRTP = useMemo(
    () => calculateOverallRTP(data.sessions, selectedYear),
    [data.sessions, selectedYear]
  );

  const depositDistributionData = useMemo(
    () => calculateDepositDistribution(data.sessions, data.casinos, selectedYear),
    [data.sessions, data.casinos, selectedYear]
  );

  if (isLoading) {
    return (
      <div className="analytics">
        <div className="loading">Loading analytics...</div>
      </div>
    );
  }

  // Build year options (at least show current year even if no sessions)
  const yearOptions = yearsWithSessions.length > 0
    ? [...new Set([...yearsWithSessions, currentYear])].sort((a, b) => b - a)
    : [currentYear];

  return (
    <div className="analytics">
      <div className="analytics-header">
        <h2>Analytics</h2>
        <select
          className="year-picker"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          aria-label="Select year for analytics"
        >
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      <div className="chart-card full-width">
        <h3>Cumulative Profit/Loss Over Time</h3>
        <ChartErrorBoundary chartName="Cumulative Profit Chart">
          <CumulativeProfitChart data={cumulativeProfitData} />
        </ChartErrorBoundary>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Casino Performance</h3>
          <ChartErrorBoundary chartName="Casino Performance Chart">
            <CasinoPerformanceChart data={casinoPerformanceData} />
          </ChartErrorBoundary>
        </div>

        <div className="chart-card">
          <h3>Session Outcomes</h3>
          <ChartErrorBoundary chartName="Session Outcomes Chart">
            <SessionOutcomeChart data={sessionOutcomeData} />
          </ChartErrorBoundary>
        </div>

        <div className="chart-card">
          <h3>Deposit Distribution</h3>
          <ChartErrorBoundary chartName="Deposit Distribution Chart">
            <DepositDistributionChart data={depositDistributionData} />
          </ChartErrorBoundary>
        </div>

        <div className="chart-card">
          <h3>Overall RTP</h3>
          <ChartErrorBoundary chartName="RTP Gauge">
            <RTPGauge rtp={overallRTP} />
          </ChartErrorBoundary>
        </div>
      </div>

      <div className="chart-card full-width">
        <h3>Activity Heatmap</h3>
        <ChartErrorBoundary chartName="Activity Heatmap">
          <ActivityHeatmap data={activityHeatmapData} year={selectedYear} />
        </ChartErrorBoundary>
      </div>
    </div>
  );
}

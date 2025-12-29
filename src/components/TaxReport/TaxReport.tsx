import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import type { FilingStatus } from '../../models/types';
import { calculateTax, analyzeItemization } from '../../utils/taxCalculator';
import { formatCurrency } from '../../utils/formatters';
import './TaxReport.css';

export function TaxReport() {
  const { data, yearsWithSessions } = useApp();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(
    yearsWithSessions.length > 0 ? yearsWithSessions[0] : currentYear
  );
  const [filingStatus, setFilingStatus] = useState<FilingStatus>('single');
  const [otherDeductions, setOtherDeductions] = useState('');

  const availableYears = useMemo(() => {
    const years = new Set(yearsWithSessions);
    years.add(currentYear);
    return [...years].sort((a, b) => b - a);
  }, [yearsWithSessions, currentYear]);

  const taxCalculation = useMemo(
    () => calculateTax(data.sessions, data.creditCards, selectedYear),
    [data.sessions, data.creditCards, selectedYear]
  );

  const itemizationAnalysis = useMemo(
    () => analyzeItemization(taxCalculation, filingStatus, parseFloat(otherDeductions) || 0),
    [taxCalculation, filingStatus, otherDeductions]
  );

  const exportCSV = () => {
    const headers = ['Date', 'Casino', 'Card', 'Deposit', 'Withdrawal', 'Net', 'Notes'];
    const rows = data.sessions
      .filter(s => new Date(s.date).getFullYear() === selectedYear)
      .map(s => {
        const casino = data.casinos.find(c => c.id === s.casinoID);
        const card = data.creditCards.find(c => c.id === s.creditCardID);
        return [
          new Date(s.date).toLocaleDateString(),
          casino?.name || 'Unknown',
          card?.name || '',
          s.depositAmount,
          s.withdrawalAmount,
          s.withdrawalAmount - s.depositAmount,
          s.notes || '',
        ].join(',');
      });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sc-tracker-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="tax-report">
      <div className="tax-report-header">
        <h2>Tax Year Report</h2>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          {availableYears.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        <div className="header-spacer" />
        <button className="btn-secondary" onClick={exportCSV}>
          Export CSV
        </button>
      </div>

      <section className="tax-section">
        <h3>Summary</h3>
        <div className="summary-stats">
          <MiniStat label="Sessions" value={taxCalculation.totalSessions} />
          <MiniStat label="Winning" value={taxCalculation.winningSessions} className="positive" />
          <MiniStat label="Losing" value={taxCalculation.losingSessions} className="negative" />
          <MiniStat label="Break Even" value={taxCalculation.breakEvenSessions} />
        </div>
        <div className="summary-row">
          <div>
            <span className="label">Total Deposited</span>
            <span className="value">{formatCurrency(taxCalculation.totalDeposits)}</span>
          </div>
          <div>
            <span className="label">Total Withdrawn</span>
            <span className="value">{formatCurrency(taxCalculation.totalWithdrawals)}</span>
          </div>
          <div>
            <span className="label">Net Result</span>
            <span className={`value ${taxCalculation.netResult >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(taxCalculation.netResult)}
            </span>
          </div>
        </div>
      </section>

      <section className="tax-section">
        <h3>Federal Tax</h3>
        <div className="tax-details">
          <LabeledRow label="Gross Winnings" value={formatCurrency(taxCalculation.grossWinnings)} />
          <LabeledRow label="Gross Losses" value={formatCurrency(taxCalculation.grossLosses)} />
          <div className="divider" />
          <LabeledRow
            label="Deductible Losses (Schedule A)"
            value={formatCurrency(taxCalculation.federalDeductibleLosses)}
            help="Losses you can deduct if you itemize"
          />
          <LabeledRow
            label="Federal Taxable Gambling Income"
            value={formatCurrency(taxCalculation.federalTaxableIncome)}
            highlighted
          />
        </div>
        {selectedYear >= 2026 && (
          <p className="warning">OBBBA 90% deduction cap applied (effective 2026)</p>
        )}
        <p className="note">
          Note: Gambling losses can only be deducted if you itemize deductions on Schedule A.
        </p>
      </section>

      <section className="tax-section">
        <h3>Indiana State Tax</h3>
        <div className="tax-details">
          <LabeledRow
            label="Taxable Income"
            value={formatCurrency(taxCalculation.indianaTaxableIncome)}
            help="Indiana taxes gross winnings without loss deduction"
          />
          <LabeledRow
            label="Estimated State Tax (3.23%)"
            value={formatCurrency(taxCalculation.indianaStateTax)}
            highlighted
          />
        </div>
        <p className="warning">
          Indiana does NOT allow gambling loss deductions for amateur gamblers.
        </p>
      </section>

      <section className="tax-section">
        <h3>Itemization Analysis</h3>
        <div className="tax-details">
          <div className="form-row">
            <label>Filing Status</label>
            <select
              value={filingStatus}
              onChange={(e) => setFilingStatus(e.target.value as FilingStatus)}
            >
              <option value="single">Single</option>
              <option value="marriedFilingJointly">Married Filing Jointly</option>
            </select>
          </div>
          <div className="form-row">
            <label>Other Itemized Deductions</label>
            <div className="input-group">
              <span>$</span>
              <input
                type="number"
                value={otherDeductions}
                onChange={(e) => setOtherDeductions(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="divider" />
          <LabeledRow label="Standard Deduction" value={formatCurrency(itemizationAnalysis.standardDeduction)} />
          <LabeledRow label="Gambling Loss Deduction" value={formatCurrency(itemizationAnalysis.gamblingLossDeduction)} />
          <LabeledRow label="Total Itemized" value={formatCurrency(itemizationAnalysis.totalItemizedDeductions)} />
          <div className="divider" />
          <div className="itemization-result">
            {itemizationAnalysis.shouldItemize ? (
              <span className="positive">✓ Itemizing may benefit you</span>
            ) : (
              <span className="neutral">ℹ Standard deduction likely better</span>
            )}
            <span className={itemizationAnalysis.benefitFromItemizing > 0 ? 'positive' : ''}>
              Difference: {formatCurrency(itemizationAnalysis.benefitFromItemizing)}
            </span>
          </div>
        </div>
      </section>

      <section className="tax-section">
        <h3>Cashback Earned</h3>
        <div className="tax-details">
          <LabeledRow
            label="Estimated Cashback from Deposits"
            value={formatCurrency(taxCalculation.estimatedCashback)}
            highlighted
          />
        </div>
        <p className="note">
          This is based on the cashback percentages configured for your credit cards.
        </p>
      </section>
    </div>
  );
}

function MiniStat({ label, value, className = '' }: { label: string; value: number; className?: string }) {
  return (
    <div className="mini-stat">
      <span className={`mini-stat-value ${className}`}>{value}</span>
      <span className="mini-stat-label">{label}</span>
    </div>
  );
}

function LabeledRow({ label, value, help, highlighted }: { label: string; value: string; help?: string; highlighted?: boolean }) {
  return (
    <div className={`labeled-row ${highlighted ? 'highlighted' : ''}`}>
      <span className="label">
        {label}
        {help && <span className="help" title={help}>?</span>}
      </span>
      <span className="value">{value}</span>
    </div>
  );
}

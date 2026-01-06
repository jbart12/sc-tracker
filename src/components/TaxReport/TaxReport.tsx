import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import type { FilingStatus } from '../../models/types';
import { calculateTax, analyzeItemization, calculateSessionCashback } from '../../utils/taxCalculator';
import { getTotalDeposit } from '../../utils/sessionUtils';
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
    const headers = ['Date', 'Casino', 'Cards', 'Deposit', 'Withdrawal', 'Net', 'Cashback', 'Notes'];
    const rows = data.sessions
      .filter(s => new Date(s.date).getFullYear() === selectedYear)
      .map(s => {
        const casino = data.casinos.find(c => c.id === s.casinoID);

        // Format card deposits
        let cardsStr = '';
        const totalDeposit = getTotalDeposit(s);
        const sessionCashback = calculateSessionCashback(s, data.creditCards);

        if (s.cardDeposits && Array.isArray(s.cardDeposits) && s.cardDeposits.length > 0) {
          cardsStr = s.cardDeposits.map(cd => {
            const card = data.creditCards.find(c => c.id === cd.creditCardID);
            return card ? `${card.name}: $${cd.amount}` : `Unknown: $${cd.amount}`;
          }).join('; ');
        }

        // Escape fields that might contain commas
        const escapeField = (field: string) => {
          if (field.includes(',') || field.includes('"')) {
            return `"${field.replace(/"/g, '""')}"`;
          }
          return field;
        };

        return [
          new Date(s.date).toLocaleDateString(),
          escapeField(casino?.name || 'Unknown'),
          escapeField(cardsStr),
          totalDeposit.toFixed(2),
          s.withdrawalAmount.toFixed(2),
          (s.withdrawalAmount - totalDeposit).toFixed(2),
          sessionCashback.toFixed(2),
          escapeField(s.notes || ''),
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
          <div>
            <span className="label">Net + Cashback</span>
            <span className={`value ${(taxCalculation.netResult + taxCalculation.estimatedCashback) >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(taxCalculation.netResult + taxCalculation.estimatedCashback)}
            </span>
          </div>
        </div>
      </section>

      <section className="tax-section">
        <h3>Federal Tax</h3>
        <div className="tax-details">
          <LabeledRow label="Gross Winnings (Taxable Income)" value={formatCurrency(taxCalculation.grossWinnings)} />
          <LabeledRow label="Gross Losses" value={formatCurrency(taxCalculation.grossLosses)} />
          {selectedYear >= 2026 && taxCalculation.grossLosses > 0 && (
            <>
              <div className="divider" />
              <LabeledRow
                label="90% of Losses (OBBBA Limit)"
                value={formatCurrency(taxCalculation.grossLosses * 0.9)}
                help="Only 90% of gambling losses are deductible starting 2026"
              />
              <LabeledRow
                label="Non-Deductible (10% Haircut)"
                value={formatCurrency(taxCalculation.grossLosses * 0.1)}
                className="negative"
              />
            </>
          )}
          <div className="divider" />
          <LabeledRow
            label={selectedYear >= 2026 ? "Deductible Losses (OBBBA 90%)" : "Deductible Losses (Schedule A)"}
            value={formatCurrency(taxCalculation.federalDeductibleLosses)}
            help={selectedYear >= 2026
              ? "90% of losses, capped by winnings"
              : "Losses up to winnings amount"}
            highlighted
          />
          <LabeledRow
            label="Federal Taxable Gambling Income"
            value={formatCurrency(taxCalculation.federalTaxableIncome)}
          />
          <div className="divider" />
          <LabeledRow
            label={`Federal Tax Owed (${(taxCalculation.federalTaxRate * 100).toFixed(0)}% bracket)`}
            value={formatCurrency(taxCalculation.federalTaxOwed)}
            highlighted
          />
          {selectedYear >= 2026 && taxCalculation.grossLosses > 0 && (
            <LabeledRow
              label="Extra Tax Due to OBBBA"
              value={formatCurrency(Math.min(taxCalculation.grossLosses * 0.1, taxCalculation.grossWinnings) * taxCalculation.federalTaxRate)}
              help="Additional federal tax from non-deductible 10% of losses"
              className="negative"
            />
          )}
        </div>
        {selectedYear >= 2026 && (
          <div className="warning-box">
            <strong>OBBBA 90% Cap (In Effect)</strong>
            <p>The One Big Beautiful Bill Act limits gambling loss deductions to 90% of losses.
            You may owe tax on "phantom income" - money you never actually earned.</p>
          </div>
        )}
        <p className="note">
          Note: Gambling losses can only be deducted if you itemize deductions on Schedule A.
        </p>
      </section>

      <section className="tax-section">
        <h3>Indiana State & County Tax</h3>
        <div className="tax-details">
          <LabeledRow
            label="Taxable Income"
            value={formatCurrency(taxCalculation.indianaTaxableIncome)}
            help="Indiana taxes gross winnings without loss deduction"
          />
          <div className="divider" />
          <LabeledRow
            label={`State Tax (${(taxCalculation.indianaStateRate * 100).toFixed(2)}%)`}
            value={formatCurrency(taxCalculation.indianaStateTax)}
          />
          <LabeledRow
            label={`Warrick County Tax (${(taxCalculation.indianaCountyRate * 100).toFixed(2)}%)`}
            value={formatCurrency(taxCalculation.indianaCountyTax)}
          />
          <div className="divider" />
          <LabeledRow
            label={`Total Indiana Tax (${((taxCalculation.indianaStateRate + taxCalculation.indianaCountyRate) * 100).toFixed(2)}%)`}
            value={formatCurrency(taxCalculation.indianaTotalTax)}
            highlighted
          />
        </div>
        <p className="warning">
          Indiana does NOT allow gambling loss deductions for amateur gamblers.
        </p>
      </section>

      <section className="tax-section total-tax-section">
        <h3>Total Estimated Tax Liability</h3>
        <div className="tax-details">
          <LabeledRow
            label={`Federal Tax (${(taxCalculation.federalTaxRate * 100).toFixed(0)}%)`}
            value={formatCurrency(taxCalculation.federalTaxOwed)}
          />
          <LabeledRow
            label={`Indiana State Tax (${(taxCalculation.indianaStateRate * 100).toFixed(2)}%)`}
            value={formatCurrency(taxCalculation.indianaStateTax)}
          />
          <LabeledRow
            label={`Warrick County Tax (${(taxCalculation.indianaCountyRate * 100).toFixed(2)}%)`}
            value={formatCurrency(taxCalculation.indianaCountyTax)}
          />
          <div className="divider" />
          <LabeledRow
            label="Total Tax Owed"
            value={formatCurrency(taxCalculation.totalTaxOwed)}
            highlighted
            className="total-row"
          />
          <LabeledRow
            label="After-Tax Net (Gambling Result - Tax)"
            value={formatCurrency(taxCalculation.netResult - taxCalculation.totalTaxOwed)}
            className={taxCalculation.netResult - taxCalculation.totalTaxOwed >= 0 ? 'positive' : 'negative'}
          />
          <LabeledRow
            label="After-Tax Net + Cashback"
            value={formatCurrency(taxCalculation.netResult - taxCalculation.totalTaxOwed + taxCalculation.estimatedCashback)}
            className={taxCalculation.netResult - taxCalculation.totalTaxOwed + taxCalculation.estimatedCashback >= 0 ? 'positive' : 'negative'}
            highlighted
          />
        </div>
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

function LabeledRow({ label, value, help, highlighted, className }: { label: string; value: string; help?: string; highlighted?: boolean; className?: string }) {
  return (
    <div className={`labeled-row ${highlighted ? 'highlighted' : ''} ${className || ''}`}>
      <span className="label">
        {label}
        {help && <span className="help" title={help}>?</span>}
      </span>
      <span className={`value ${className || ''}`}>{value}</span>
    </div>
  );
}

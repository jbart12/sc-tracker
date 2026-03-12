import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import type { FilingStatus } from '../../models/types';
import { calculateTax, analyzeItemization, calculateSessionCashback } from '../../utils/taxCalculator';
import { getTotalDeposit } from '../../utils/sessionUtils';
import { formatCurrency } from '../../utils/formatters';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Title
    doc.setFontSize(18);
    doc.text(`SC Tracker - ${selectedYear} Tax Report`, pageWidth / 2, y, { align: 'center' });
    y += 12;

    // --- Tax Summary Section ---
    doc.setFontSize(14);
    doc.text('Tax Summary', 14, y);
    y += 8;

    const tc = taxCalculation;

    // Summary stats table
    autoTable(doc, {
      startY: y,
      head: [['', 'Amount']],
      body: [
        ['Total Sessions', String(tc.totalSessions)],
        ['Winning Sessions', String(tc.winningSessions)],
        ['Losing Sessions', String(tc.losingSessions)],
        ['Break Even Sessions', String(tc.breakEvenSessions)],
        ['Total Deposited', formatCurrency(tc.totalDeposits)],
        ['Total Withdrawn', formatCurrency(tc.totalWithdrawals)],
        ['Net Result', formatCurrency(tc.netResult)],
        ['Estimated Cashback', formatCurrency(tc.estimatedCashback)],
        ['Net + Cashback', formatCurrency(tc.netResult + tc.estimatedCashback)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [66, 66, 66] },
      margin: { left: 14, right: 14 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;

    // Federal Tax table
    doc.setFontSize(14);
    doc.text('Federal Tax', 14, y);
    y += 8;

    const federalRows: string[][] = [
      ['Gross Winnings (Taxable Income)', formatCurrency(tc.grossWinnings)],
      ['Gross Losses', formatCurrency(tc.grossLosses)],
    ];
    if (selectedYear >= 2026 && tc.grossLosses > 0) {
      federalRows.push(
        ['90% of Losses (OBBBA Limit)', formatCurrency(tc.grossLosses * 0.9)],
        ['Non-Deductible (10% Haircut)', formatCurrency(tc.grossLosses * 0.1)],
      );
    }
    federalRows.push(
      [selectedYear >= 2026 ? 'Deductible Losses (OBBBA 90%)' : 'Deductible Losses (Schedule A)', formatCurrency(tc.federalDeductibleLosses)],
      ['Federal Taxable Gambling Income', formatCurrency(tc.federalTaxableIncome)],
      [`Federal Tax Owed (${(tc.federalTaxRate * 100).toFixed(0)}% bracket)`, formatCurrency(tc.federalTaxOwed)],
    );
    if (selectedYear >= 2026 && tc.grossLosses > 0) {
      federalRows.push(
        ['Extra Tax Due to OBBBA', formatCurrency(Math.min(tc.grossLosses * 0.1, tc.grossWinnings) * tc.federalTaxRate)],
      );
    }

    autoTable(doc, {
      startY: y,
      head: [['', 'Amount']],
      body: federalRows,
      theme: 'striped',
      headStyles: { fillColor: [66, 66, 66] },
      margin: { left: 14, right: 14 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;

    // Indiana State & County Tax table
    doc.setFontSize(14);
    doc.text('Indiana State & County Tax', 14, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['', 'Amount']],
      body: [
        ['Taxable Income (Gross Winnings)', formatCurrency(tc.indianaTaxableIncome)],
        [`State Tax (${(tc.indianaStateRate * 100).toFixed(2)}%)`, formatCurrency(tc.indianaStateTax)],
        [`Warrick County Tax (${(tc.indianaCountyRate * 100).toFixed(2)}%)`, formatCurrency(tc.indianaCountyTax)],
        [`Total Indiana Tax (${((tc.indianaStateRate + tc.indianaCountyRate) * 100).toFixed(2)}%)`, formatCurrency(tc.indianaTotalTax)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [66, 66, 66] },
      margin: { left: 14, right: 14 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;

    // Total Tax Liability table
    doc.setFontSize(14);
    doc.text('Total Estimated Tax Liability', 14, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['', 'Amount']],
      body: [
        [`Federal Tax (${(tc.federalTaxRate * 100).toFixed(0)}%)`, formatCurrency(tc.federalTaxOwed)],
        [`Indiana State Tax (${(tc.indianaStateRate * 100).toFixed(2)}%)`, formatCurrency(tc.indianaStateTax)],
        [`Warrick County Tax (${(tc.indianaCountyRate * 100).toFixed(2)}%)`, formatCurrency(tc.indianaCountyTax)],
        ['Total Tax Owed', formatCurrency(tc.totalTaxOwed)],
        ['After-Tax Net (Result - Tax)', formatCurrency(tc.netResult - tc.totalTaxOwed)],
        ['After-Tax Net + Cashback', formatCurrency(tc.netResult - tc.totalTaxOwed + tc.estimatedCashback)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [66, 66, 66] },
      margin: { left: 14, right: 14 },
      didParseCell: (hookData) => {
        // Bold the total rows
        if (hookData.row.index === 3 || hookData.row.index === 5) {
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
    });
    // --- Session Detail Table ---
    doc.addPage();
    y = 20;
    doc.setFontSize(14);
    doc.text('Session Details', 14, y);
    y += 8;

    const sessionRows = data.sessions
      .filter(s => new Date(s.date).getFullYear() === selectedYear)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(s => {
        const casino = data.casinos.find(c => c.id === s.casinoID);
        const totalDeposit = getTotalDeposit(s);
        const sessionCashback = calculateSessionCashback(s, data.creditCards);
        const net = s.withdrawalAmount - totalDeposit;

        let cardsStr = '';
        if (s.cardDeposits && Array.isArray(s.cardDeposits) && s.cardDeposits.length > 0) {
          cardsStr = s.cardDeposits.map(cd => {
            const card = data.creditCards.find(c => c.id === cd.creditCardID);
            return card ? `${card.name}: $${cd.amount}` : `$${cd.amount}`;
          }).join('\n');
        }

        return [
          new Date(s.date).toLocaleDateString(),
          casino?.name || 'Unknown',
          cardsStr,
          formatCurrency(totalDeposit),
          formatCurrency(s.withdrawalAmount),
          formatCurrency(net),
          formatCurrency(sessionCashback),
        ];
      });

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Casino', 'Cards', 'Deposit', 'Withdrawal', 'Net', 'Cashback']],
      body: sessionRows,
      theme: 'striped',
      headStyles: { fillColor: [66, 66, 66] },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 22 },
        2: { cellWidth: 40 },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    // Footer on each page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(
        `Generated ${new Date().toLocaleDateString()} — SC Tracker — Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    doc.save(`sc-tracker-${selectedYear}-tax-report.pdf`);
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
        <button className="btn-secondary" onClick={exportPDF}>
          Export PDF
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

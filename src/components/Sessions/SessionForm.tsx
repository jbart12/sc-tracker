import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import type { Session, CardDeposit } from '../../models/types';
import { formatCurrency, formatPresetAmount, toISODateString, formatPercent } from '../../utils/formatters';
import { WELLS_FARGO_ACTIVE_CASH_ID, CRYPTO_COM_JADE_ID } from '../../services/persistence';
import './SessionForm.css';

interface SessionFormProps {
  session: Session | null;
  onClose: () => void;
}

interface CardDepositFormState {
  id: string;
  creditCardID: string;
  amount: string;
  cashbackOverride: string; // Empty string means use calculated default
  foreignTransactionFeePercent: string; // Empty string means no fee
}

export function SessionForm({ session, onClose }: SessionFormProps) {
  const { data, addSession, updateSession } = useApp();
  const isEdit = session !== null;

  const [date, setDate] = useState(session?.date ? session.date.split('T')[0] : toISODateString(new Date()));
  const [casinoID, setCasinoID] = useState<string>(session?.casinoID || '');
  const [withdrawalAmount, setWithdrawalAmount] = useState(session?.withdrawalAmount.toString() || '');
  const [notes, setNotes] = useState(session?.notes || '');
  const [quickAddAmounts, setQuickAddAmounts] = useState<Record<string, string>>({});

  // Initialize card deposits state
  const [cardDeposits, setCardDeposits] = useState<CardDepositFormState[]>(() => {
    if (session?.cardDeposits && session.cardDeposits.length > 0) {
      return session.cardDeposits.map((cd, i) => ({
        id: `deposit-${i}`,
        creditCardID: cd.creditCardID,
        amount: cd.amount.toString(),
        cashbackOverride: cd.cashbackOverride !== undefined ? cd.cashbackOverride.toString() : '',
        foreignTransactionFeePercent: cd.foreignTransactionFeePercent !== undefined ? cd.foreignTransactionFeePercent.toString() : '',
      }));
    }
    // Default: Two sections for Wells Fargo and Crypto.com
    return [
      { id: 'deposit-0', creditCardID: WELLS_FARGO_ACTIVE_CASH_ID, amount: '', cashbackOverride: '', foreignTransactionFeePercent: '' },
      { id: 'deposit-1', creditCardID: CRYPTO_COM_JADE_ID, amount: '', cashbackOverride: '', foreignTransactionFeePercent: '' },
    ];
  });

  const activeCasinos = data.casinos.filter(c => c.isActive || c.id === session?.casinoID);
  const activeCreditCards = data.creditCards.filter(c => c.isActive);

  // Auto-select first casino if none selected
  useEffect(() => {
    if (!casinoID && activeCasinos.length > 0) {
      setCasinoID(activeCasinos[0].id);
    }
  }, [casinoID, activeCasinos]);

  const selectedCasino = useMemo(
    () => data.casinos.find(c => c.id === casinoID),
    [data.casinos, casinoID]
  );

  // Calculate totals and cashback
  const calculations = useMemo(() => {
    const totalDeposits = cardDeposits.reduce((sum, cd) => {
      return sum + (parseFloat(cd.amount) || 0);
    }, 0);

    const totalCashback = cardDeposits.reduce((sum, cd) => {
      // Use override if provided, otherwise calculate from card percentage
      if (cd.cashbackOverride !== '') {
        return sum + (parseFloat(cd.cashbackOverride) || 0);
      }
      const amount = parseFloat(cd.amount) || 0;
      const card = data.creditCards.find(c => c.id === cd.creditCardID);
      if (!card) return sum;
      return sum + (amount * card.cashbackPercentage / 100);
    }, 0);

    const totalForeignFees = cardDeposits.reduce((sum, cd) => {
      const feePercent = parseFloat(cd.foreignTransactionFeePercent) || 0;
      if (feePercent <= 0) return sum;
      const amount = parseFloat(cd.amount) || 0;
      return sum + (amount * feePercent / 100);
    }, 0);

    const withdrawal = parseFloat(withdrawalAmount) || 0;
    const netResult = withdrawal - totalDeposits - totalForeignFees;
    const netWithCashback = netResult + totalCashback;
    const rtpPercentage = totalDeposits > 0 ? (withdrawal / totalDeposits) * 100 : null;

    return { totalDeposits, totalCashback, totalForeignFees, withdrawal, netResult, netWithCashback, rtpPercentage };
  }, [cardDeposits, withdrawalAmount, data.creditCards]);

  // Get cashback for a specific card deposit
  const getDepositCashback = (creditCardID: string, amount: string): number => {
    const parsedAmount = parseFloat(amount) || 0;
    const card = data.creditCards.find(c => c.id === creditCardID);
    if (!card || parsedAmount <= 0) return 0;
    return parsedAmount * card.cashbackPercentage / 100;
  };

  // Validation: at least one deposit with amount > 0
  const hasValidDeposit = cardDeposits.some(cd => (parseFloat(cd.amount) || 0) > 0);
  const isValid = casinoID && hasValidDeposit;

  // Update a card deposit field
  const updateCardDeposit = (id: string, field: 'creditCardID' | 'amount' | 'cashbackOverride' | 'foreignTransactionFeePercent', value: string) => {
    setCardDeposits(prev => prev.map(cd =>
      cd.id === id ? { ...cd, [field]: value } : cd
    ));
  };

  // Add preset amount to a specific card deposit
  const handleAddPreset = (cardDepositId: string, amount: number) => {
    setCardDeposits(prev => prev.map(cd => {
      if (cd.id !== cardDepositId) return cd;
      const current = parseFloat(cd.amount) || 0;
      return { ...cd, amount: (current + amount).toString() };
    }));
  };

  // Add a new card section
  const handleAddCardSection = () => {
    // Find a card that isn't already selected
    const usedCardIds = new Set(cardDeposits.map(cd => cd.creditCardID));
    const availableCard = activeCreditCards.find(card => !usedCardIds.has(card.id));

    setCardDeposits(prev => [
      ...prev,
      {
        id: `deposit-${Date.now()}`,
        creditCardID: availableCard?.id || activeCreditCards[0]?.id || '',
        amount: '',
        cashbackOverride: '',
        foreignTransactionFeePercent: '',
      }
    ]);
  };

  // Remove a card section
  const handleRemoveCardSection = (id: string) => {
    if (cardDeposits.length <= 1) return; // Must have at least one
    setCardDeposits(prev => prev.filter(cd => cd.id !== id));
  };

  // Quick-add a custom amount to a card deposit
  const handleQuickAdd = (cardDepositId: string) => {
    const addValue = parseFloat(quickAddAmounts[cardDepositId] || '');
    if (!addValue || addValue <= 0) return;
    setCardDeposits(prev => prev.map(cd => {
      if (cd.id !== cardDepositId) return cd;
      const current = parseFloat(cd.amount) || 0;
      return { ...cd, amount: (current + addValue).toString() };
    }));
    setQuickAddAmounts(prev => ({ ...prev, [cardDepositId]: '' }));
  };

  // Clear a card deposit amount
  const handleClearAmount = (id: string) => {
    setCardDeposits(prev => prev.map(cd =>
      cd.id === id ? { ...cd, amount: '' } : cd
    ));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    // Filter out empty deposits and convert to proper format
    const validDeposits: CardDeposit[] = cardDeposits
      .filter(cd => (parseFloat(cd.amount) || 0) > 0)
      .map(cd => {
        const deposit: CardDeposit = {
          creditCardID: cd.creditCardID,
          amount: parseFloat(cd.amount) || 0,
        };
        // Only include override if user explicitly set one
        if (cd.cashbackOverride !== '') {
          deposit.cashbackOverride = parseFloat(cd.cashbackOverride) || 0;
        }
        // Include foreign transaction fee if set
        if (cd.foreignTransactionFeePercent !== '') {
          deposit.foreignTransactionFeePercent = parseFloat(cd.foreignTransactionFeePercent) || 0;
        }
        return deposit;
      });

    const sessionData = {
      date: `${date}T12:00:00.000Z`,
      casinoID,
      cardDeposits: validDeposits,
      depositAmount: calculations.totalDeposits, // Store computed total for backward compat
      withdrawalAmount: calculations.withdrawal,
      notes: notes || undefined,
    };

    if (isEdit && session) {
      updateSession(session.id, sessionData);
    } else {
      addSession(sessionData);
    }

    onClose();
  };

  // Check if a card is already used in another section
  const isCardUsedElsewhere = (cardId: string, currentSectionId: string) => {
    return cardDeposits.some(cd => cd.id !== currentSectionId && cd.creditCardID === cardId);
  };

  return (
    <div className="modal-overlay">
      <div className="modal session-form-modal">
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2>{isEdit ? 'Edit Session' : 'Start Session'}</h2>
            <div className="modal-header-actions">
              <button type="submit" className="btn-primary btn-header-save" disabled={!isValid}>Save</button>
              <button type="button" className="modal-close" onClick={onClose}>&times;</button>
            </div>
          </div>
          <div className="form-body">
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Casino</label>
            <select
              value={casinoID}
              onChange={(e) => setCasinoID(e.target.value)}
              required
            >
              <option value="">Select Casino</option>
              {activeCasinos.map(casino => (
                <option key={casino.id} value={casino.id}>{casino.name}</option>
              ))}
            </select>
          </div>

          <div className="form-section-header">
            <h3>Deposits</h3>
          </div>

          {cardDeposits.map((cd) => {
            const card = data.creditCards.find(c => c.id === cd.creditCardID);
            const cashback = getDepositCashback(cd.creditCardID, cd.amount);

            return (
              <div key={cd.id} className="card-deposit-section">
                <div className="card-deposit-header">
                  <span className="card-deposit-label">
                    {card?.name || 'Card'} {card ? `(${card.cashbackPercentage}%)` : ''}
                  </span>
                  {cardDeposits.length > 1 && (
                    <button
                      type="button"
                      className="card-deposit-remove"
                      onClick={() => handleRemoveCardSection(cd.id)}
                      title="Remove this card"
                    >
                      &times;
                    </button>
                  )}
                </div>

                <div className="form-group">
                  <label>Card</label>
                  <select
                    value={cd.creditCardID}
                    onChange={(e) => updateCardDeposit(cd.id, 'creditCardID', e.target.value)}
                  >
                    {activeCreditCards.map(creditCard => (
                      <option
                        key={creditCard.id}
                        value={creditCard.id}
                        disabled={isCardUsedElsewhere(creditCard.id, cd.id)}
                      >
                        {creditCard.name} ({creditCard.cashbackPercentage}%)
                        {creditCard.lastFourDigits ? ` ...${creditCard.lastFourDigits}` : ''}
                        {isCardUsedElsewhere(creditCard.id, cd.id) ? ' (in use)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Amount</label>
                  <div className="input-with-clear">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={cd.amount}
                      onChange={(e) => updateCardDeposit(cd.id, 'amount', e.target.value)}
                      placeholder="0"
                    />
                    {cd.amount && (
                      <button type="button" className="clear-btn" onClick={() => handleClearAmount(cd.id)}>
                        &times;
                      </button>
                    )}
                  </div>
                </div>

                <div className="quick-add">
                  <span className="quick-add-plus">+</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Add..."
                    value={quickAddAmounts[cd.id] || ''}
                    onChange={(e) => setQuickAddAmounts(prev => ({ ...prev, [cd.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleQuickAdd(cd.id); } }}
                  />
                  <button type="button" onClick={() => handleQuickAdd(cd.id)}>Add</button>
                </div>

                {selectedCasino?.depositPresets && selectedCasino.depositPresets.length > 0 && (
                  <div className="form-group presets-group">
                    <div className="presets">
                      {selectedCasino.depositPresets.map(amount => (
                        <button
                          key={amount}
                          type="button"
                          className="preset-btn"
                          onClick={() => handleAddPreset(cd.id, amount)}
                        >
                          {formatPresetAmount(amount)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="card-fees-row">
                  <div className="card-cashback-group">
                    <label>Cashback</label>
                    <div className="cashback-input-wrapper">
                      <span className="cashback-dollar">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="cashback-input"
                        value={cd.cashbackOverride !== '' ? cd.cashbackOverride : (cashback > 0 ? cashback.toFixed(2) : '')}
                        onChange={(e) => updateCardDeposit(cd.id, 'cashbackOverride', e.target.value)}
                        placeholder={cashback > 0 ? cashback.toFixed(2) : '0.00'}
                      />
                      {cd.cashbackOverride !== '' && (
                        <button
                          type="button"
                          className="cashback-reset-btn"
                          onClick={() => updateCardDeposit(cd.id, 'cashbackOverride', '')}
                          title="Reset to calculated value"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    {cd.cashbackOverride !== '' && cashback > 0 && (
                      <div className="cashback-calc-hint">
                        Calculated: {formatCurrency(cashback)}
                      </div>
                    )}
                  </div>

                  <div className="card-fee-group">
                    <label>Foreign Tx Fee</label>
                    <div className="fee-input-wrapper">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        className="fee-input"
                        value={cd.foreignTransactionFeePercent}
                        onChange={(e) => updateCardDeposit(cd.id, 'foreignTransactionFeePercent', e.target.value)}
                        placeholder="0"
                      />
                      <span className="fee-percent">%</span>
                    </div>
                    {cd.foreignTransactionFeePercent !== '' && parseFloat(cd.foreignTransactionFeePercent) > 0 && (
                      <div className="fee-calc-hint">
                        = {formatCurrency((parseFloat(cd.amount) || 0) * (parseFloat(cd.foreignTransactionFeePercent) || 0) / 100)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className="add-card-btn"
            onClick={handleAddCardSection}
            disabled={cardDeposits.length >= activeCreditCards.length}
          >
            + Add Another Card
          </button>

          <div className="form-section-header">
            <h3>Withdrawal</h3>
          </div>

          <div className="form-group">
            <label>Amount</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={withdrawalAmount}
              onChange={(e) => setWithdrawalAmount(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="summary-section">
            <h3>Summary</h3>
            <div className="summary-row">
              <span>Total Deposits</span>
              <span>{formatCurrency(calculations.totalDeposits)}</span>
            </div>
            <div className="summary-row">
              <span>Total Cashback</span>
              <span className="positive">{formatCurrency(calculations.totalCashback)}</span>
            </div>
            {calculations.totalForeignFees > 0 && (
              <div className="summary-row">
                <span>Foreign Tx Fees</span>
                <span className="negative">{formatCurrency(-calculations.totalForeignFees)}</span>
              </div>
            )}
            <div className="summary-row">
              <span>Withdrawal</span>
              <span>{formatCurrency(calculations.withdrawal)}</span>
            </div>
            <div className="summary-divider"></div>
            <div className="summary-row total">
              <span>Net Result</span>
              <span className={calculations.netResult > 0 ? 'positive' : calculations.netResult < 0 ? 'negative' : ''}>
                {formatCurrency(calculations.netResult)}
              </span>
            </div>
            <div className="summary-row total">
              <span>Net + Cashback</span>
              <span className={calculations.netWithCashback > 0 ? 'positive' : calculations.netWithCashback < 0 ? 'negative' : ''}>
                {formatCurrency(calculations.netWithCashback)}
              </span>
            </div>
            {calculations.rtpPercentage !== null && (
              <div className="summary-row">
                <span>RTP</span>
                <span>{formatPercent(calculations.rtpPercentage)}</span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!isValid}>
              Save
            </button>
          </div>
          </div>
        </form>
      </div>
    </div>
  );
}

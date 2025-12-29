import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import type { Session } from '../../models/types';
import { formatCurrency, formatPresetAmount, toISODateString } from '../../utils/formatters';
import './SessionForm.css';

interface SessionFormProps {
  session: Session | null;
  onClose: () => void;
}

export function SessionForm({ session, onClose }: SessionFormProps) {
  const { data, addSession, updateSession } = useApp();
  const isEdit = session !== null;

  const [date, setDate] = useState(session?.date ? session.date.split('T')[0] : toISODateString(new Date()));
  const [casinoID, setCasinoID] = useState<string>(session?.casinoID || '');
  const [creditCardID, setCreditCardID] = useState<string>(session?.creditCardID || '');
  const [depositAmount, setDepositAmount] = useState(session?.depositAmount.toString() || '');
  const [withdrawalAmount, setWithdrawalAmount] = useState(session?.withdrawalAmount.toString() || '');
  const [notes, setNotes] = useState(session?.notes || '');

  const activeCasinos = data.casinos.filter(c => c.isActive || c.id === session?.casinoID);
  const activeCreditCards = data.creditCards.filter(c => c.isActive || c.id === session?.creditCardID);

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

  const deposit = parseFloat(depositAmount) || 0;
  const withdrawal = parseFloat(withdrawalAmount) || 0;
  const netResult = withdrawal - deposit;
  const rtpPercentage = deposit > 0 ? (withdrawal / deposit) * 100 : null;

  const isValid = casinoID && deposit > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const sessionData = {
      date: `${date}T12:00:00.000Z`,
      casinoID,
      creditCardID: creditCardID || undefined,
      depositAmount: deposit,
      withdrawalAmount: withdrawal,
      notes: notes || undefined,
    };

    if (isEdit && session) {
      updateSession(session.id, sessionData);
    } else {
      addSession(sessionData);
    }

    onClose();
  };

  const handleAddPreset = (amount: number) => {
    const current = parseFloat(depositAmount) || 0;
    setDepositAmount((current + amount).toString());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Session' : 'Start Session'}</h2>
        </div>

        <form onSubmit={handleSubmit}>
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

          <div className="form-group">
            <label>Credit Card</label>
            <select
              value={creditCardID}
              onChange={(e) => setCreditCardID(e.target.value)}
            >
              <option value="">None</option>
              {activeCreditCards.map(card => (
                <option key={card.id} value={card.id}>
                  {card.name}{card.lastFourDigits ? ` (...${card.lastFourDigits})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Deposit Amount</label>
            <div className="input-with-clear">
              <input
                type="number"
                step="0.01"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0"
                required
              />
              {depositAmount && (
                <button type="button" className="clear-btn" onClick={() => setDepositAmount('')}>
                  &times;
                </button>
              )}
            </div>
          </div>

          {selectedCasino?.depositPresets && selectedCasino.depositPresets.length > 0 && (
            <div className="form-group">
              <label>Quick Add</label>
              <div className="presets">
                {selectedCasino.depositPresets.map(amount => (
                  <button
                    key={amount}
                    type="button"
                    className="preset-btn"
                    onClick={() => handleAddPreset(amount)}
                  >
                    {formatPresetAmount(amount)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Withdrawal Amount</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={withdrawalAmount}
              onChange={(e) => setWithdrawalAmount(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="form-group computed">
            <div className="computed-row">
              <span>Net Result</span>
              <span className={netResult > 0 ? 'positive' : netResult < 0 ? 'negative' : ''}>
                {formatCurrency(netResult)}
              </span>
            </div>
            {rtpPercentage !== null && (
              <div className="computed-row">
                <span>RTP</span>
                <span>{rtpPercentage.toFixed(1)}%</span>
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
        </form>
      </div>
    </div>
  );
}

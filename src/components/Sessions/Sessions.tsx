import { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import type { Session, SortOrder } from '../../models/types';
import { getNetResult, isWin, isLoss, isPending, getRtpPercentage, sortByDateDescending, sortByDateAscending } from '../../utils/sessionUtils';
import { formatCurrency, formatDate, formatPercent } from '../../utils/formatters';
import { SessionForm } from './SessionForm';
import './Sessions.css';

export function Sessions() {
  const { data, deleteSession, updateSession, combineSessions, getCasino, getCreditCard } = useApp();
  const [searchText, setSearchText] = useState('');
  const [casinoFilter, setCasinoFilter] = useState<string | null>(null);
  const [cardFilter, setCardFilter] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('dateDesc');
  const [showForm, setShowForm] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingWithdrawalId, setEditingWithdrawalId] = useState<string | null>(null);
  const [editingWithdrawalValue, setEditingWithdrawalValue] = useState('');
  const withdrawalInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingWithdrawalId && withdrawalInputRef.current) {
      withdrawalInputRef.current.focus();
      withdrawalInputRef.current.select();
    }
  }, [editingWithdrawalId]);

  const filteredSessions = useMemo(() => {
    let sessions = [...data.sessions];

    // Filter by casino
    if (casinoFilter) {
      sessions = sessions.filter(s => s.casinoID === casinoFilter);
    }

    // Filter by card
    if (cardFilter) {
      sessions = sessions.filter(s => s.creditCardID === cardFilter);
    }

    // Filter by search text
    if (searchText) {
      const search = searchText.toLowerCase();
      sessions = sessions.filter(s => {
        const casino = getCasino(s.casinoID);
        const card = getCreditCard(s.creditCardID);
        return (
          casino?.name.toLowerCase().includes(search) ||
          card?.name.toLowerCase().includes(search) ||
          s.notes?.toLowerCase().includes(search)
        );
      });
    }

    // Sort
    switch (sortOrder) {
      case 'dateDesc':
        return sortByDateDescending(sessions);
      case 'dateAsc':
        return sortByDateAscending(sessions);
      case 'amountDesc':
        return sessions.sort((a, b) => b.depositAmount - a.depositAmount);
      case 'amountAsc':
        return sessions.sort((a, b) => a.depositAmount - b.depositAmount);
      default:
        return sessions;
    }
  }, [data.sessions, casinoFilter, cardFilter, searchText, sortOrder, getCasino, getCreditCard]);

  const clearFilters = () => {
    setSearchText('');
    setCasinoFilter(null);
    setCardFilter(null);
  };

  const hasFilters = searchText || casinoFilter || cardFilter;

  const handleEdit = (session: Session) => {
    setEditingSession(session);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingSession(null);
  };

  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredSessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSessions.map(s => s.id)));
    }
  };

  const handleCombine = () => {
    if (selectedIds.size < 2) return;

    const selectedSessions = filteredSessions.filter(s => selectedIds.has(s.id));
    const casinos = new Set(selectedSessions.map(s => s.casinoID));

    if (casinos.size > 1) {
      if (!confirm('Selected sessions are from different casinos. The combined session will use the first casino. Continue?')) {
        return;
      }
    }

    combineSessions([...selectedIds]);
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  // Calculate selection summary
  const selectionSummary = useMemo(() => {
    if (selectedIds.size === 0) return null;
    const selected = filteredSessions.filter(s => selectedIds.has(s.id));
    const totalDeposit = selected.reduce((sum, s) => sum + s.depositAmount, 0);
    const totalWithdrawal = selected.reduce((sum, s) => sum + s.withdrawalAmount, 0);
    return { count: selected.length, totalDeposit, totalWithdrawal };
  }, [selectedIds, filteredSessions]);

  const startEditingWithdrawal = (session: Session) => {
    setEditingWithdrawalId(session.id);
    setEditingWithdrawalValue(session.withdrawalAmount.toString());
  };

  const cancelEditingWithdrawal = () => {
    setEditingWithdrawalId(null);
    setEditingWithdrawalValue('');
  };

  const saveWithdrawal = (sessionId: string) => {
    const value = parseFloat(editingWithdrawalValue) || 0;
    updateSession(sessionId, { withdrawalAmount: value });
    setEditingWithdrawalId(null);
    setEditingWithdrawalValue('');
  };

  return (
    <div className="sessions">
      <div className="sessions-toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          {searchText && (
            <button className="clear-search" onClick={() => setSearchText('')}>
              &times;
            </button>
          )}
        </div>

        <select
          value={casinoFilter || ''}
          onChange={(e) => setCasinoFilter(e.target.value || null)}
        >
          <option value="">All Casinos</option>
          {data.casinos.map(casino => (
            <option key={casino.id} value={casino.id}>{casino.name}</option>
          ))}
        </select>

        <select
          value={cardFilter || ''}
          onChange={(e) => setCardFilter(e.target.value || null)}
        >
          <option value="">All Cards</option>
          {data.creditCards.map(card => (
            <option key={card.id} value={card.id}>
              {card.name}{card.lastFourDigits ? ` (...${card.lastFourDigits})` : ''}
            </option>
          ))}
        </select>

        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
        >
          <option value="dateDesc">Date (Newest)</option>
          <option value="dateAsc">Date (Oldest)</option>
          <option value="amountDesc">Amount (High)</option>
          <option value="amountAsc">Amount (Low)</option>
        </select>

        {hasFilters && (
          <button className="btn-secondary" onClick={clearFilters}>
            Clear
          </button>
        )}

        <div className="toolbar-spacer" />

        <button
          className={`btn-secondary ${selectMode ? 'active' : ''}`}
          onClick={toggleSelectMode}
        >
          {selectMode ? 'Cancel' : 'Select'}
        </button>

        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Start Session
        </button>
      </div>

      {selectMode && selectionSummary && selectionSummary.count > 0 && (
        <div className="selection-bar">
          <span className="selection-count">
            {selectionSummary.count} selected
          </span>
          <span className="selection-summary">
            Deposit: {formatCurrency(selectionSummary.totalDeposit)} |
            Withdrawal: {formatCurrency(selectionSummary.totalWithdrawal)} |
            Net: {formatCurrency(selectionSummary.totalWithdrawal - selectionSummary.totalDeposit)}
          </span>
          <div className="selection-actions">
            <button
              className="btn-primary"
              onClick={handleCombine}
              disabled={selectionSummary.count < 2}
            >
              Combine ({selectionSummary.count})
            </button>
          </div>
        </div>
      )}

      {filteredSessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h3>No Sessions</h3>
          {data.sessions.length === 0 ? (
            <>
              <p>Click to start tracking your first session.</p>
              <button className="btn-primary" onClick={() => setShowForm(true)}>
                Start Session
              </button>
            </>
          ) : (
            <>
              <p>No sessions match your filters.</p>
              <button className="btn-secondary" onClick={clearFilters}>
                Clear Filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="sessions-table">
          <table>
            <thead>
              <tr>
                {selectMode && (
                  <th className="checkbox-col">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredSessions.length && filteredSessions.length > 0}
                      onChange={selectAll}
                    />
                  </th>
                )}
                <th>Date</th>
                <th>Casino</th>
                <th>Card</th>
                <th className="number">Deposit</th>
                <th className="number">Withdrawal</th>
                <th className="number">Net</th>
                <th className="number">RTP</th>
                {!selectMode && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map(session => {
                const casino = getCasino(session.casinoID);
                const card = getCreditCard(session.creditCardID);
                const net = getNetResult(session);
                const rtp = getRtpPercentage(session);
                const isSelected = selectedIds.has(session.id);
                const isEditingWithdrawal = editingWithdrawalId === session.id;

                return (
                  <tr
                    key={session.id}
                    className={`${isSelected ? 'selected' : ''} ${isEditingWithdrawal ? 'editing' : ''}`}
                    onClick={selectMode ? () => toggleSelect(session.id) : undefined}
                  >
                    {selectMode && (
                      <td className="checkbox-col">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(session.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    )}
                    <td>{formatDate(session.date)}</td>
                    <td>{casino?.name || 'Unknown'}</td>
                    <td>{card ? `${card.name}${card.lastFourDigits ? ` (...${card.lastFourDigits})` : ''}` : '-'}</td>
                    <td className="number">{formatCurrency(session.depositAmount)}</td>
                    <td className="number withdrawal-cell">
                      {isEditingWithdrawal ? (
                        <div className="inline-edit">
                          <input
                            ref={withdrawalInputRef}
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={editingWithdrawalValue}
                            onChange={(e) => setEditingWithdrawalValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveWithdrawal(session.id);
                              if (e.key === 'Escape') cancelEditingWithdrawal();
                            }}
                          />
                          <button
                            className="btn-save"
                            onClick={() => saveWithdrawal(session.id)}
                            title="Save"
                          >
                            Save
                          </button>
                          <button
                            className="btn-cancel"
                            onClick={cancelEditingWithdrawal}
                            title="Cancel"
                          >
                            &times;
                          </button>
                        </div>
                      ) : (
                        <span
                          className="editable-value"
                          onClick={(e) => {
                            if (!selectMode) {
                              e.stopPropagation();
                              startEditingWithdrawal(session);
                            }
                          }}
                          title="Click to edit"
                        >
                          {formatCurrency(session.withdrawalAmount)}
                        </span>
                      )}
                    </td>
                    <td className={`number ${isPending(session) ? 'pending' : isWin(session) ? 'positive' : isLoss(session) ? 'negative' : ''}`}>
                      {isPending(session) ? 'Pending' : formatCurrency(net)}
                    </td>
                    <td className="number">{isPending(session) ? '-' : rtp ? formatPercent(rtp) : '-'}</td>
                    {!selectMode && (
                      <td className="actions">
                        <button className="btn-icon" onClick={() => handleEdit(session)} title="Edit">
                          ✏️
                        </button>
                        <button
                          className="btn-icon danger"
                          onClick={() => {
                            if (confirm('Delete this session?')) {
                              deleteSession(session.id);
                            }
                          }}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <SessionForm
          session={editingSession}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
}

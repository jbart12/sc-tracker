import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { Casino, CreditCard, ArchivedSession } from '../../models/types';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getTotalDeposit } from '../../utils/sessionUtils';
import './Settings.css';

type SettingsTab = 'casinos' | 'creditCards' | 'archived';

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('casinos');
  const { data } = useApp();

  const archivedCount = data.archivedSessions?.length || 0;

  return (
    <div className="settings">
      <div className="settings-tabs">
        <button
          className={activeTab === 'casinos' ? 'active' : ''}
          onClick={() => setActiveTab('casinos')}
        >
          Casinos
        </button>
        <button
          className={activeTab === 'creditCards' ? 'active' : ''}
          onClick={() => setActiveTab('creditCards')}
        >
          Credit Cards
        </button>
        <button
          className={activeTab === 'archived' ? 'active' : ''}
          onClick={() => setActiveTab('archived')}
        >
          Archived {archivedCount > 0 && <span className="badge">{archivedCount}</span>}
        </button>
      </div>

      {activeTab === 'casinos' && <CasinosSection />}
      {activeTab === 'creditCards' && <CreditCardsSection />}
      {activeTab === 'archived' && <ArchivedSessionsSection />}
    </div>
  );
}

function CasinosSection() {
  const { data, addCasino, updateCasino, deleteCasino } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingCasino, setEditingCasino] = useState<Casino | null>(null);
  const [casinoToDelete, setCasinoToDelete] = useState<Casino | null>(null);

  const handleEdit = (casino: Casino) => {
    setEditingCasino(casino);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingCasino(null);
  };

  return (
    <div className="settings-section">
      <div className="section-header">
        <h3>Manage Casinos</h3>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Add Casino
        </button>
      </div>

      {data.casinos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏢</div>
          <h3>No Casinos</h3>
          <p>Add a casino to start tracking sessions.</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            Add Casino
          </button>
        </div>
      ) : (
        <div className="item-list">
          {data.casinos.map(casino => (
            <div key={casino.id} className="item-row">
              <div className="item-info">
                <span className="item-name">{casino.name}</span>
                {!casino.isActive && <span className="item-badge">Inactive</span>}
              </div>
              <div className="item-actions">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={casino.isActive}
                    onChange={() => updateCasino(casino.id, { isActive: !casino.isActive })}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <button className="btn-icon" onClick={() => handleEdit(casino)}>
                  ✏️
                </button>
                <button
                  className="btn-icon danger"
                  onClick={() => setCasinoToDelete(casino)}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <CasinoForm
          casino={editingCasino}
          onClose={handleCloseForm}
          onSave={(casinoData) => {
            if (editingCasino) {
              updateCasino(editingCasino.id, casinoData);
            } else {
              addCasino(casinoData);
            }
            handleCloseForm();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={casinoToDelete !== null}
        title="Delete Casino?"
        message={`Are you sure you want to delete "${casinoToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (casinoToDelete) {
            deleteCasino(casinoToDelete.id);
            setCasinoToDelete(null);
          }
        }}
        onCancel={() => setCasinoToDelete(null)}
      />
    </div>
  );
}

function CreditCardsSection() {
  const { data, addCreditCard, updateCreditCard, deleteCreditCard } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [cardToDelete, setCardToDelete] = useState<CreditCard | null>(null);

  const handleEdit = (card: CreditCard) => {
    setEditingCard(card);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingCard(null);
  };

  return (
    <div className="settings-section">
      <div className="section-header">
        <h3>Manage Credit Cards</h3>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Add Card
        </button>
      </div>

      {data.creditCards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💳</div>
          <h3>No Credit Cards</h3>
          <p>Add a credit card to track cashback earnings.</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            Add Card
          </button>
        </div>
      ) : (
        <div className="item-list">
          {data.creditCards.map(card => (
            <div key={card.id} className="item-row">
              <div className="item-info">
                <span className="item-name">
                  {card.name}{card.lastFourDigits ? ` (...${card.lastFourDigits})` : ''}
                </span>
                <span className="item-detail">
                  {card.cashbackPercentage}% cashback
                  {!card.isActive && ' • Inactive'}
                </span>
              </div>
              <div className="item-actions">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={card.isActive}
                    onChange={() => updateCreditCard(card.id, { isActive: !card.isActive })}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <button className="btn-icon" onClick={() => handleEdit(card)}>
                  ✏️
                </button>
                <button
                  className="btn-icon danger"
                  onClick={() => setCardToDelete(card)}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <CreditCardForm
          card={editingCard}
          onClose={handleCloseForm}
          onSave={(cardData) => {
            if (editingCard) {
              updateCreditCard(editingCard.id, cardData);
            } else {
              addCreditCard(cardData);
            }
            handleCloseForm();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={cardToDelete !== null}
        title="Delete Credit Card?"
        message={`Are you sure you want to delete "${cardToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (cardToDelete) {
            deleteCreditCard(cardToDelete.id);
            setCardToDelete(null);
          }
        }}
        onCancel={() => setCardToDelete(null)}
      />
    </div>
  );
}

function ArchivedSessionsSection() {
  const { data, restoreSession, permanentlyDeleteSession, getCasino } = useApp();
  const [sessionToRestore, setSessionToRestore] = useState<ArchivedSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<ArchivedSession | null>(null);

  const archivedSessions = data.archivedSessions || [];

  return (
    <div className="settings-section">
      <div className="section-header">
        <h3>Archived Sessions</h3>
      </div>

      {archivedSessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3>No Archived Sessions</h3>
          <p>Sessions you archive will appear here. You can restore them at any time.</p>
        </div>
      ) : (
        <div className="item-list archived-list">
          {archivedSessions.map(session => {
            const casino = getCasino(session.casinoID);
            const deposit = getTotalDeposit(session);
            const net = session.withdrawalAmount - deposit;

            return (
              <div key={session.id} className="item-row archived-row">
                <div className="item-info">
                  <span className="item-name">
                    {formatDate(session.date)} - {casino?.name || 'Unknown'}
                  </span>
                  <span className="item-detail">
                    Deposit: {formatCurrency(deposit)} | Withdrawal: {formatCurrency(session.withdrawalAmount)} | Net: {formatCurrency(net)}
                  </span>
                  <span className="item-detail archived-date">
                    Archived: {formatDate(session.archivedAt)}
                  </span>
                </div>
                <div className="item-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => setSessionToRestore(session)}
                  >
                    Restore
                  </button>
                  <button
                    className="btn-icon danger"
                    onClick={() => setSessionToDelete(session)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={sessionToRestore !== null}
        title="Restore Session?"
        message="This session will be restored to your active sessions."
        variant="warning"
        confirmLabel="Restore"
        onConfirm={() => {
          if (sessionToRestore) {
            restoreSession(sessionToRestore.id);
            setSessionToRestore(null);
          }
        }}
        onCancel={() => setSessionToRestore(null)}
      />

      <ConfirmDialog
        isOpen={sessionToDelete !== null}
        title="Permanently Delete?"
        message="This will permanently delete this session. This action cannot be undone!"
        confirmLabel="Delete Forever"
        onConfirm={() => {
          if (sessionToDelete) {
            permanentlyDeleteSession(sessionToDelete.id);
            setSessionToDelete(null);
          }
        }}
        onCancel={() => setSessionToDelete(null)}
      />
    </div>
  );
}

interface CasinoFormProps {
  casino: Casino | null;
  onClose: () => void;
  onSave: (data: Omit<Casino, 'id'>) => void;
}

function CasinoForm({ casino, onClose, onSave }: CasinoFormProps) {
  const [name, setName] = useState(casino?.name || '');
  const [isActive, setIsActive] = useState(casino?.isActive ?? true);

  const isValid = name.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSave({
      name: name.trim(),
      isActive,
      depositPresets: casino?.depositPresets || [],
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{casino ? 'Edit Casino' : 'Add Casino'}</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Casino Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Stake.us"
              autoFocus
            />
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>
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

interface CreditCardFormProps {
  card: CreditCard | null;
  onClose: () => void;
  onSave: (data: Omit<CreditCard, 'id'>) => void;
}

function CreditCardForm({ card, onClose, onSave }: CreditCardFormProps) {
  const [name, setName] = useState(card?.name || '');
  const [lastFourDigits, setLastFourDigits] = useState(card?.lastFourDigits || '');
  const [cashbackPercentage, setCashbackPercentage] = useState(card?.cashbackPercentage.toString() || '');
  const [isActive, setIsActive] = useState(card?.isActive ?? true);

  const isValid = name.trim().length > 0 && parseFloat(cashbackPercentage) >= 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSave({
      name: name.trim(),
      lastFourDigits: lastFourDigits.trim() || undefined,
      cashbackPercentage: parseFloat(cashbackPercentage) || 0,
      isActive,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{card ? 'Edit Credit Card' : 'Add Credit Card'}</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Card Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Chase Sapphire"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Last 4 Digits (optional)</label>
            <input
              type="text"
              value={lastFourDigits}
              onChange={(e) => setLastFourDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
              maxLength={4}
            />
          </div>
          <div className="form-group">
            <label>Cashback Percentage</label>
            <div className="input-with-suffix">
              <input
                type="number"
                step="0.1"
                min="0"
                value={cashbackPercentage}
                onChange={(e) => setCashbackPercentage(e.target.value)}
                placeholder="2.0"
              />
              <span>%</span>
            </div>
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>
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

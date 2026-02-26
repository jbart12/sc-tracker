import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { filterByCreditCard } from '../../utils/sessionUtils';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import type { CreditCard } from '../../models/types';
import './Cards.css';

interface CasinoBreakdown {
  casinoId: string;
  casinoName: string;
  sessionCount: number;
  totalDeposited: number;
}

interface CardStats {
  card: CreditCard;
  sessionCount: number;
  totalDeposited: number;
  totalCashback: number;
  effectiveRate: number | null;
  casinoBreakdown: CasinoBreakdown[];
}

export function Cards() {
  const { data, activeCreditCards, getCasino, isLoading } = useApp();

  const cardStats = useMemo((): CardStats[] => {
    return activeCreditCards.map(card => {
      const sessions = filterByCreditCard(data.sessions, card.id);

      // Sum only this card's deposits across all sessions
      let totalDeposited = 0;
      let totalCashback = 0;
      const casinoMap = new Map<string, { casinoName: string; sessionCount: number; totalDeposited: number }>();

      for (const session of sessions) {
        // Per-card deposit amount for this card
        const cardDeposit = session.cardDeposits
          .filter(cd => cd.creditCardID === card.id)
          .reduce((sum, cd) => sum + cd.amount, 0);

        totalDeposited += cardDeposit;

        // Per-card cashback: respect cashbackOverride
        const cardCashback = session.cardDeposits
          .filter(cd => cd.creditCardID === card.id)
          .reduce((sum, cd) => {
            if (cd.cashbackOverride !== undefined) {
              return sum + cd.cashbackOverride;
            }
            return sum + cd.amount * (card.cashbackPercentage / 100);
          }, 0);
        totalCashback += cardCashback;

        // Casino breakdown
        const casino = getCasino(session.casinoID);
        const casinoName = casino?.name || 'Unknown';
        const existing = casinoMap.get(session.casinoID);
        if (existing) {
          existing.sessionCount++;
          existing.totalDeposited += cardDeposit;
        } else {
          casinoMap.set(session.casinoID, {
            casinoName,
            sessionCount: 1,
            totalDeposited: cardDeposit,
          });
        }
      }

      const casinoBreakdown = Array.from(casinoMap.entries())
        .map(([casinoId, stats]) => ({ casinoId, ...stats }))
        .sort((a, b) => b.totalDeposited - a.totalDeposited);

      return {
        card,
        sessionCount: sessions.length,
        totalDeposited,
        totalCashback,
        effectiveRate: totalDeposited > 0 ? (totalCashback / totalDeposited) * 100 : null,
        casinoBreakdown,
      };
    });
  }, [data.sessions, activeCreditCards, getCasino]);

  if (isLoading) {
    return <div className="cards-page"><p>Loading...</p></div>;
  }

  if (activeCreditCards.length === 0) {
    return (
      <div className="cards-page">
        <h2>Cards</h2>
        <div className="card-panel">
          <p className="no-sessions">No active credit cards. Add cards in Settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cards-page">
      <h2>Cards</h2>
      {cardStats.map(stats => (
        <CardPanel key={stats.card.id} stats={stats} />
      ))}
    </div>
  );
}

function CardPanel({ stats }: { stats: CardStats }) {
  const { card, sessionCount, totalDeposited, totalCashback, effectiveRate, casinoBreakdown } = stats;

  const cardLabel = card.lastFourDigits
    ? `${card.name} (${card.lastFourDigits})`
    : card.name;

  return (
    <div className="card-panel">
      <div className="card-panel-header">
        <h3 className="card-panel-name">{cardLabel}</h3>
        <span className="card-panel-rate">{formatPercent(card.cashbackPercentage)} cashback</span>
      </div>

      {sessionCount === 0 ? (
        <p className="no-sessions">No sessions recorded with this card</p>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stats-item">
              <span className="stats-label">Sessions</span>
              <span className="stats-value">{sessionCount}</span>
            </div>
            <div className="stats-item">
              <span className="stats-label">Total Deposited</span>
              <span className="stats-value">{formatCurrency(totalDeposited)}</span>
            </div>
            <div className="stats-item">
              <span className="stats-label">Total Cashback</span>
              <span className="stats-value positive">{formatCurrency(totalCashback)}</span>
            </div>
            <div className="stats-item highlight">
              <span className="stats-label">Effective Rate</span>
              <span className="stats-value">{effectiveRate !== null ? formatPercent(effectiveRate) : 'N/A'}</span>
            </div>
          </div>

          <div className="card-casino-breakdown">
            <h4>Casino Breakdown</h4>
            <div className="card-casino-header">
              <span className="card-casino-name">Casino</span>
              <span className="card-casino-sessions">Sessions</span>
              <span className="card-casino-deposited">Deposited</span>
            </div>
            {casinoBreakdown.map(cb => (
              <div key={cb.casinoId} className="card-casino-row">
                <span className="card-casino-name">{cb.casinoName}</span>
                <span className="card-casino-sessions">{cb.sessionCount}</span>
                <span className="card-casino-deposited">{formatCurrency(cb.totalDeposited)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

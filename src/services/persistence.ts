import type { AppData, Casino, Session } from '../models/types';

const STORAGE_KEY = 'sc-tracker-data';
const CURRENT_SCHEMA_VERSION = 5;

const STAKE_US_PRESETS = [20, 50, 100, 200, 300, 500, 1000, 2000];

// Fixed IDs for default casinos
const STAKE_US_ID = '00000000-0000-0000-0000-000000000001';
const CROWN_COIN_ID = '00000000-0000-0000-0000-000000000002';
const MCLUCK_ID = '00000000-0000-0000-0000-000000000003';

const DEFAULT_CASINOS: Casino[] = [
  { id: STAKE_US_ID, name: 'Stake.us', isActive: true, depositPresets: STAKE_US_PRESETS },
  { id: CROWN_COIN_ID, name: 'CrownCoinCasino', isActive: true, depositPresets: [] },
  { id: MCLUCK_ID, name: 'McLuck', isActive: true, depositPresets: [] },
];

// Seed sessions from purchase history (COMPLETED only, grouped by day)
const STAKE_US_SEED_SESSIONS: Omit<Session, 'id'>[] = [
  { date: '2025-12-29T12:00:00.000Z', casinoID: STAKE_US_ID, depositAmount: 9000, withdrawalAmount: 0 },
  { date: '2025-12-24T12:00:00.000Z', casinoID: STAKE_US_ID, depositAmount: 9000, withdrawalAmount: 0 },
  { date: '2025-12-23T12:00:00.000Z', casinoID: STAKE_US_ID, depositAmount: 8000, withdrawalAmount: 0 },
  { date: '2025-12-22T12:00:00.000Z', casinoID: STAKE_US_ID, depositAmount: 8000, withdrawalAmount: 0 },
  { date: '2025-12-19T12:00:00.000Z', casinoID: STAKE_US_ID, depositAmount: 8000, withdrawalAmount: 0 },
  { date: '2025-12-18T12:00:00.000Z', casinoID: STAKE_US_ID, depositAmount: 8000, withdrawalAmount: 0 },
  { date: '2025-12-17T12:00:00.000Z', casinoID: STAKE_US_ID, depositAmount: 8000, withdrawalAmount: 0 },
  { date: '2025-12-16T12:00:00.000Z', casinoID: STAKE_US_ID, depositAmount: 5000, withdrawalAmount: 0 },
  { date: '2025-12-15T12:00:00.000Z', casinoID: STAKE_US_ID, depositAmount: 5000, withdrawalAmount: 0 },
  { date: '2025-12-12T12:00:00.000Z', casinoID: STAKE_US_ID, depositAmount: 5000, withdrawalAmount: 0 },
  { date: '2025-12-11T12:00:00.000Z', casinoID: STAKE_US_ID, depositAmount: 5000, withdrawalAmount: 0 },
  { date: '2025-12-10T12:00:00.000Z', casinoID: STAKE_US_ID, depositAmount: 5000, withdrawalAmount: 0 },
  { date: '2025-12-09T12:00:00.000Z', casinoID: STAKE_US_ID, depositAmount: 2000, withdrawalAmount: 0 },
  { date: '2025-12-08T12:00:00.000Z', casinoID: STAKE_US_ID, depositAmount: 2000, withdrawalAmount: 0 },
  { date: '2025-12-06T12:00:00.000Z', casinoID: STAKE_US_ID, depositAmount: 3400, withdrawalAmount: 0 },
  { date: '2025-12-05T12:00:00.000Z', casinoID: STAKE_US_ID, depositAmount: 600, withdrawalAmount: 0 },
];

// CrownCoinCasino sessions
const CROWN_COIN_SEED_SESSIONS: Omit<Session, 'id'>[] = [
  { date: '2025-12-19T12:00:00.000Z', casinoID: CROWN_COIN_ID, depositAmount: 1000, withdrawalAmount: 897 },
  { date: '2025-12-18T12:00:00.000Z', casinoID: CROWN_COIN_ID, depositAmount: 1000, withdrawalAmount: 0 },
  { date: '2025-12-17T12:00:00.000Z', casinoID: CROWN_COIN_ID, depositAmount: 1000, withdrawalAmount: 2600 },
];

// McLuck sessions (7 × $299.99 on 12/16, 4 × $299.99 on 12/15)
const MCLUCK_SEED_SESSIONS: Omit<Session, 'id'>[] = [
  { date: '2025-12-16T12:00:00.000Z', casinoID: MCLUCK_ID, depositAmount: 2099.93, withdrawalAmount: 0 },
  { date: '2025-12-15T12:00:00.000Z', casinoID: MCLUCK_ID, depositAmount: 1199.96, withdrawalAmount: 0 },
];

const SEED_SESSIONS = [...STAKE_US_SEED_SESSIONS, ...CROWN_COIN_SEED_SESSIONS, ...MCLUCK_SEED_SESSIONS];

function getDefaultAppData(): AppData {
  // Generate IDs for seed sessions
  const sessions: Session[] = SEED_SESSIONS.map((s, i) => ({
    ...s,
    id: `seed-session-${String(i + 1).padStart(4, '0')}`,
  }));

  return {
    sessions,
    casinos: DEFAULT_CASINOS,
    creditCards: [],
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

function migrate(data: AppData): AppData {
  let migrated = { ...data };

  // v1 -> v2: Add deposit presets to Stake.us casinos
  if (migrated.schemaVersion < 2) {
    migrated.casinos = migrated.casinos.map(casino => {
      if (casino.name === 'Stake.us' && (!casino.depositPresets || casino.depositPresets.length === 0)) {
        return { ...casino, depositPresets: STAKE_US_PRESETS };
      }
      return casino;
    });
  }

  // v2 -> v3: Add seed sessions if none exist
  if (migrated.schemaVersion < 3) {
    if (!migrated.sessions || migrated.sessions.length === 0) {
      // Find or create Stake.us casino
      let stakeUs = migrated.casinos.find(c => c.name === 'Stake.us');
      if (!stakeUs) {
        stakeUs = { id: STAKE_US_ID, name: 'Stake.us', isActive: true, depositPresets: STAKE_US_PRESETS };
        migrated.casinos.push(stakeUs);
      }

      // Add seed sessions with the correct casino ID
      migrated.sessions = SEED_SESSIONS.map((s, i) => ({
        ...s,
        id: `seed-session-${String(i + 1).padStart(4, '0')}`,
        casinoID: stakeUs!.id,
      }));
    }
  }

  // v3 -> v4: Add CrownCoinCasino sessions
  if (migrated.schemaVersion < 4) {
    // Ensure CrownCoinCasino exists
    let crownCoin = migrated.casinos.find(c => c.name === 'CrownCoinCasino');
    if (!crownCoin) {
      crownCoin = { id: CROWN_COIN_ID, name: 'CrownCoinCasino', isActive: true, depositPresets: [] };
      migrated.casinos.push(crownCoin);
    }

    // Add CrownCoin sessions (check for duplicates by date + casino)
    const existingDates = new Set(
      migrated.sessions
        .filter(s => s.casinoID === crownCoin!.id)
        .map(s => s.date.split('T')[0])
    );

    const newSessions = CROWN_COIN_SEED_SESSIONS
      .filter(s => !existingDates.has(s.date.split('T')[0]))
      .map((s, i) => ({
        ...s,
        id: `crowncoin-session-${String(i + 1).padStart(4, '0')}`,
        casinoID: crownCoin!.id,
      }));

    migrated.sessions = [...migrated.sessions, ...newSessions];
  }

  // v4 -> v5: Add McLuck sessions
  if (migrated.schemaVersion < 5) {
    // Ensure McLuck exists
    let mcluck = migrated.casinos.find(c => c.name === 'McLuck');
    if (!mcluck) {
      mcluck = { id: MCLUCK_ID, name: 'McLuck', isActive: true, depositPresets: [] };
      migrated.casinos.push(mcluck);
    }

    // Add McLuck sessions (check for duplicates by date + casino)
    const existingDates = new Set(
      migrated.sessions
        .filter(s => s.casinoID === mcluck!.id)
        .map(s => s.date.split('T')[0])
    );

    const newMcLuckSessions = MCLUCK_SEED_SESSIONS
      .filter(s => !existingDates.has(s.date.split('T')[0]))
      .map((s, i) => ({
        ...s,
        id: `mcluck-session-${String(i + 1).padStart(4, '0')}`,
        casinoID: mcluck!.id,
      }));

    migrated.sessions = [...migrated.sessions, ...newMcLuckSessions];
  }

  migrated.schemaVersion = CURRENT_SCHEMA_VERSION;
  return migrated;
}

export function loadAppData(): AppData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return getDefaultAppData();
    }
    const data = JSON.parse(stored) as AppData;
    return migrate(data);
  } catch (error) {
    console.error('Failed to load app data:', error);
    return getDefaultAppData();
  }
}

export function saveAppData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save app data:', error);
  }
}

export function generateId(): string {
  return crypto.randomUUID();
}

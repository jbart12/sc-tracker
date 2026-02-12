import type { AppData, Casino, CreditCard, Session } from '../models/types';

const STORAGE_KEY = 'sc-tracker-data';
const API_BASE = '/api';
const CURRENT_SCHEMA_VERSION = 8;

const STAKE_US_PRESETS = [20, 50, 100, 200, 300, 500, 1000, 2000];

// Fixed IDs for default casinos
const STAKE_US_ID = '00000000-0000-0000-0000-000000000001';
const CROWN_COIN_ID = '00000000-0000-0000-0000-000000000002';
const MCLUCK_ID = '00000000-0000-0000-0000-000000000003';

// Fixed IDs for default credit cards
export const WELLS_FARGO_ACTIVE_CASH_ID = '00000000-0000-0000-0000-000000000101';
export const CRYPTO_COM_JADE_ID = '00000000-0000-0000-0000-000000000102';

const DEFAULT_CREDIT_CARDS: CreditCard[] = [
  { id: WELLS_FARGO_ACTIVE_CASH_ID, name: 'Wells Fargo Active Cash', cashbackPercentage: 2, isActive: true },
  { id: CRYPTO_COM_JADE_ID, name: 'Crypto.com Jade', cashbackPercentage: 4.5, isActive: true },
];

const DEFAULT_CASINOS: Casino[] = [
  { id: STAKE_US_ID, name: 'Stake.us', isActive: true, depositPresets: STAKE_US_PRESETS },
  { id: CROWN_COIN_ID, name: 'CrownCoinCasino', isActive: true, depositPresets: [] },
  { id: MCLUCK_ID, name: 'McLuck', isActive: true, depositPresets: [] },
];

// Raw seed data (without cardDeposits, will be added in getDefaultAppData)
interface RawSeedSession {
  date: string;
  casinoID: string;
  depositAmount: number;
  withdrawalAmount: number;
}

// Seed sessions from purchase history (COMPLETED only, grouped by day)
const STAKE_US_SEED_SESSIONS: RawSeedSession[] = [
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
const CROWN_COIN_SEED_SESSIONS: RawSeedSession[] = [
  { date: '2025-12-19T12:00:00.000Z', casinoID: CROWN_COIN_ID, depositAmount: 1000, withdrawalAmount: 897 },
  { date: '2025-12-18T12:00:00.000Z', casinoID: CROWN_COIN_ID, depositAmount: 1000, withdrawalAmount: 0 },
  { date: '2025-12-17T12:00:00.000Z', casinoID: CROWN_COIN_ID, depositAmount: 1000, withdrawalAmount: 2600 },
];

// McLuck sessions (7 × $299.99 on 12/16, 4 × $299.99 on 12/15)
const MCLUCK_SEED_SESSIONS: RawSeedSession[] = [
  { date: '2025-12-16T12:00:00.000Z', casinoID: MCLUCK_ID, depositAmount: 2099.93, withdrawalAmount: 0 },
  { date: '2025-12-15T12:00:00.000Z', casinoID: MCLUCK_ID, depositAmount: 1199.96, withdrawalAmount: 0 },
];

const SEED_SESSIONS = [...STAKE_US_SEED_SESSIONS, ...CROWN_COIN_SEED_SESSIONS, ...MCLUCK_SEED_SESSIONS];

function getDefaultAppData(): AppData {
  // Generate IDs for seed sessions with cardDeposits
  const sessions: Session[] = SEED_SESSIONS.map((s, i) => ({
    ...s,
    id: `seed-session-${String(i + 1).padStart(4, '0')}`,
    cardDeposits: [{ creditCardID: WELLS_FARGO_ACTIVE_CASH_ID, amount: s.depositAmount }],
  }));

  return {
    sessions,
    archivedSessions: [],
    casinos: DEFAULT_CASINOS,
    creditCards: [...DEFAULT_CREDIT_CARDS],
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
      // Note: cardDeposits will be added by v5→v6 migration
      migrated.sessions = SEED_SESSIONS.map((s, i) => ({
        ...s,
        id: `seed-session-${String(i + 1).padStart(4, '0')}`,
        casinoID: stakeUs!.id,
      })) as Session[];
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

    // Note: cardDeposits will be added by v5→v6 migration
    const newSessions = CROWN_COIN_SEED_SESSIONS
      .filter(s => !existingDates.has(s.date.split('T')[0]))
      .map((s, i) => ({
        ...s,
        id: `crowncoin-session-${String(i + 1).padStart(4, '0')}`,
        casinoID: crownCoin!.id,
      })) as Session[];

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

    // Note: cardDeposits will be added by v5→v6 migration
    const newMcLuckSessions = MCLUCK_SEED_SESSIONS
      .filter(s => !existingDates.has(s.date.split('T')[0]))
      .map((s, i) => ({
        ...s,
        id: `mcluck-session-${String(i + 1).padStart(4, '0')}`,
        casinoID: mcluck!.id,
      })) as Session[];

    migrated.sessions = [...migrated.sessions, ...newMcLuckSessions];
  }

  // v5 -> v6: Add multi-card deposit support
  if (migrated.schemaVersion < 6) {
    // Step 1: Ensure default credit cards exist
    for (const defaultCard of DEFAULT_CREDIT_CARDS) {
      const existing = migrated.creditCards.find(c =>
        c.name === defaultCard.name || c.id === defaultCard.id
      );
      if (!existing) {
        migrated.creditCards.push({ ...defaultCard });
      }
    }

    // Step 2: Migrate sessions to use cardDeposits array
    migrated.sessions = migrated.sessions.map(session => {
      // Skip if already migrated (has cardDeposits array)
      if (Array.isArray((session as any).cardDeposits) && (session as any).cardDeposits.length > 0) {
        return session;
      }

      const depositAmount = session.depositAmount || 0;

      // Determine card ID: use existing creditCardID, or default to Wells Fargo
      const cardID = (session as any).creditCardID || WELLS_FARGO_ACTIVE_CASH_ID;

      return {
        ...session,
        cardDeposits: depositAmount > 0 ? [{ creditCardID: cardID, amount: depositAmount }] : [],
        depositAmount: depositAmount,  // Keep for backward compat
      };
    });
  }

  // v6 -> v7: Add archived sessions support
  if (migrated.schemaVersion < 7) {
    // Ensure archivedSessions array exists
    if (!migrated.archivedSessions) {
      migrated.archivedSessions = [];
    }
  }

  // v7 -> v8: Add 3% foreign transaction fee to Shuffle.us sessions with Crypto.com Jade card
  if (migrated.schemaVersion < 8) {
    // Find Shuffle.us casino by name (since it's user-created, not a fixed ID)
    const shuffleCasino = migrated.casinos.find(c => c.name.toLowerCase().includes('shuffle'));

    if (shuffleCasino) {
      migrated.sessions = migrated.sessions.map(session => {
        if (session.casinoID !== shuffleCasino.id) return session;
        if (!session.cardDeposits || !Array.isArray(session.cardDeposits)) return session;

        // Update card deposits to add foreign transaction fee for Crypto.com Jade
        const updatedDeposits = session.cardDeposits.map(cd => {
          if (cd.creditCardID === CRYPTO_COM_JADE_ID && !cd.foreignTransactionFeePercent) {
            return { ...cd, foreignTransactionFeePercent: 3 };
          }
          return cd;
        });

        return { ...session, cardDeposits: updatedDeposits };
      });
    }
  }

  migrated.schemaVersion = CURRENT_SCHEMA_VERSION;
  return migrated;
}

// Load from localStorage (for migration)
function loadFromLocalStorage(): AppData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as AppData;
  } catch {
    return null;
  }
}

// Clear localStorage after successful migration
function clearLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}

// Fetch with timeout (10s default)
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const EMERGENCY_BACKUP_KEY = 'sc-tracker-unsaved';

// Translate opaque browser/network errors into user-friendly messages
function classifyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/Failed to fetch|Load failed|NetworkError|network/i.test(msg)) {
    return 'Server is not reachable. It may have stopped or restarted.';
  }
  if (/Request timed out|AbortError|timeout/i.test(msg)) {
    return 'Server took too long to respond.';
  }
  return msg;
}

// Parse error detail from server JSON response
async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body.detail) return body.detail;
    if (body.error) return body.error;
  } catch {
    // response wasn't JSON
  }
  return response.statusText;
}

// Load data from API
export async function loadAppDataAsync(): Promise<AppData> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE}/data`);
  } catch (err) {
    throw new Error(classifyError(err));
  }
  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new Error(`Failed to load data (HTTP ${response.status}): ${detail}`);
  }

  const apiData = await response.json();

  if (apiData) {
    // Data exists in file, migrate if needed
    // Clear any stale emergency backup now that we loaded successfully
    clearEmergencyBackup();
    return migrate(apiData);
  }

  // No data in file - check localStorage for one-time migration
  const localData = loadFromLocalStorage();
  if (localData) {
    console.log('Migrating data from localStorage to file storage...');
    const migrated = migrate(localData);
    // Save to file and clear localStorage
    await saveAppDataAsync(migrated);
    clearLocalStorage();
    console.log('Migration complete!');
    return migrated;
  }

  // No data anywhere - return defaults
  return getDefaultAppData();
}

// Save data to API
export async function saveAppDataAsync(data: AppData): Promise<void> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  } catch (err) {
    throw new Error(classifyError(err));
  }

  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new Error(`Failed to save data (HTTP ${response.status}): ${detail}`);
  }
}

// Emergency backup to localStorage when server is unreachable
export function stashEmergencyBackup(data: AppData): void {
  try {
    localStorage.setItem(EMERGENCY_BACKUP_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be full or unavailable
  }
}

export function clearEmergencyBackup(): void {
  try {
    localStorage.removeItem(EMERGENCY_BACKUP_KEY);
  } catch {
    // Ignore errors
  }
}

export function hasEmergencyBackup(): boolean {
  try {
    return localStorage.getItem(EMERGENCY_BACKUP_KEY) !== null;
  } catch {
    return false;
  }
}

// Synchronous versions for backward compatibility during initial load
export function loadAppData(): AppData {
  const localData = loadFromLocalStorage();
  if (localData) {
    return migrate(localData);
  }
  return getDefaultAppData();
}

export function saveAppData(data: AppData): void {
  // This is now a no-op for sync saves - we use async saves
  // But keep it to prevent errors during transition
  saveAppDataAsync(data).catch(console.error);
}

export function generateId(): string {
  return crypto.randomUUID();
}

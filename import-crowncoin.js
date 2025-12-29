// SC Tracker - CrownCoinCasino Import Script
// Run this in the browser console at http://localhost:3000

(function() {
  const STORAGE_KEY = 'sc-tracker-data';

  // Load existing data
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    console.error('No existing data found. Please open the app first.');
    return;
  }

  const data = JSON.parse(stored);

  // Find CrownCoinCasino
  const crownCoin = data.casinos.find(c => c.name === 'CrownCoinCasino');
  if (!crownCoin) {
    console.error('CrownCoinCasino not found. Please add it in Settings first.');
    return;
  }

  // Sessions to import (grouped by day with deposits and withdrawals)
  const sessionsToImport = [
    { date: '2025-12-19', deposit: 1000, withdrawal: 897 },   // 5 × $200, REDEEM 897
    { date: '2025-12-18', deposit: 1000, withdrawal: 0 },     // 5 × $200
    { date: '2025-12-17', deposit: 1000, withdrawal: 2600 },  // 5 × $200, REDEEM 2.6K
  ];

  // Create session objects
  const newSessions = sessionsToImport.map(s => ({
    id: crypto.randomUUID(),
    date: s.date + 'T12:00:00.000Z',
    casinoID: crownCoin.id,
    creditCardID: undefined,
    depositAmount: s.deposit,
    withdrawalAmount: s.withdrawal,
    notes: 'Imported from CrownCoinCasino history'
  }));

  // Check for duplicates (same date, casino, and deposit amount)
  const existingSessions = data.sessions || [];
  const filtered = newSessions.filter(newS => {
    const newDate = newS.date.split('T')[0];
    return !existingSessions.some(existingS => {
      const existingDate = existingS.date.split('T')[0];
      return existingDate === newDate &&
             existingS.depositAmount === newS.depositAmount &&
             existingS.casinoID === newS.casinoID;
    });
  });

  if (filtered.length === 0) {
    console.log('All sessions already exist. Nothing to import.');
    return;
  }

  // Add new sessions
  data.sessions = [...existingSessions, ...filtered];

  // Save
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  console.log(`Imported ${filtered.length} CrownCoinCasino sessions!`);
  console.log('Total deposits: $' + filtered.reduce((sum, s) => sum + s.depositAmount, 0).toLocaleString());
  console.log('Total withdrawals: $' + filtered.reduce((sum, s) => sum + s.withdrawalAmount, 0).toLocaleString());
  console.log('');
  console.log('Refresh the page to see the imported sessions.');
})();

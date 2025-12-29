// SC Tracker - Session Import Script
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

  // Find Stake.us casino
  const stakeUs = data.casinos.find(c => c.name === 'Stake.us');
  if (!stakeUs) {
    console.error('Stake.us casino not found. Please add it in Settings first.');
    return;
  }

  // Sessions to import (grouped by day, COMPLETED only)
  const sessionsToImport = [
    { date: '2025-12-29', deposit: 9000 },  // 1000 + 2000 + 2000 + 2000 + 2000
    { date: '2025-12-24', deposit: 9000 },  // 1000 + 2000 + 2000 + 2000 + 2000
    { date: '2025-12-23', deposit: 8000 },  // 2000 + 2000 + 2000 + 2000
    { date: '2025-12-22', deposit: 8000 },  // 2000 + 2000 + 2000 + 2000
    { date: '2025-12-19', deposit: 8000 },  // 2000 + 2000 + 2000 + 2000
    { date: '2025-12-18', deposit: 8000 },  // 2000 + 2000 + 2000 + 2000
    { date: '2025-12-17', deposit: 8000 },  // 2000 + 2000 + 2000 + 2000 (1 EXPIRED skipped)
    { date: '2025-12-16', deposit: 5000 },  // 2000 + 1000 + 2000 (1 EXPIRED skipped)
    { date: '2025-12-15', deposit: 5000 },  // 1000 + 2000 + 2000
    { date: '2025-12-12', deposit: 5000 },  // 2000 + 2000 + 1000
    { date: '2025-12-11', deposit: 5000 },  // 2000 + 2000 + 1000
    { date: '2025-12-10', deposit: 5000 },  // 1000 + 1000 + 2000 + 1000
    { date: '2025-12-09', deposit: 2000 },  // 2000 (1 EXPIRED skipped)
    { date: '2025-12-08', deposit: 2000 },  // 2000
    { date: '2025-12-06', deposit: 3400 },  // 100 + 11*300
    { date: '2025-12-05', deposit: 600 },   // 300 + 300
  ];

  // Create session objects
  const newSessions = sessionsToImport.map(s => ({
    id: crypto.randomUUID(),
    date: new Date(s.date + 'T12:00:00').toISOString(),
    casinoID: stakeUs.id,
    creditCardID: undefined,
    depositAmount: s.deposit,
    withdrawalAmount: 0,  // Update these manually in the app
    notes: 'Imported from purchase history'
  }));

  // Check for duplicates (same date and deposit amount)
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

  console.log(`✅ Imported ${filtered.length} sessions!`);
  console.log('Total deposit amount: $' + filtered.reduce((sum, s) => sum + s.depositAmount, 0).toLocaleString());
  console.log('');
  console.log('⚠️  Withdrawal amounts are set to $0. Please update them in the Sessions tab.');
  console.log('');
  console.log('🔄 Refresh the page to see the imported sessions.');
})();

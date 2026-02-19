const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '..');
const DATA_FILE = process.env.DATA_FILE || path.join(PROJECT_ROOT, 'data', 'sc-tracker-data.json');
const AUTO_COMMIT = process.env.AUTO_COMMIT !== 'false'; // Enable by default
const GIT_DEBOUNCE_MS = 30000; // Commit at most every 30 seconds

// --- Crash / error logging to file ---
const LOG_DIR = path.join(PROJECT_ROOT, 'logs');
const CRASH_LOG = path.join(LOG_DIR, 'crash.log');
const SERVER_LOG = path.join(LOG_DIR, 'server.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function logToFile(filepath, message) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(filepath, entry);
  } catch { /* ignore logging failures */ }
}

function logCrash(label, error) {
  const stack = error instanceof Error ? error.stack : String(error);
  const msg = `${label}\n${stack}\n${'─'.repeat(60)}`;
  logToFile(CRASH_LOG, msg);
  console.error(`${label}`, error);
}

function logServer(message) {
  logToFile(SERVER_LOG, message);
}

// Capture uncaught exceptions — log to file then exit
process.on('uncaughtException', (err) => {
  logCrash('UNCAUGHT EXCEPTION', err);
  logServer('Server crashed due to uncaught exception');
  // Give the write a moment to flush, then exit
  setTimeout(() => process.exit(1), 100);
});

app.use(express.json({ limit: '10mb' }));

// CORS headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// GET /api/data - Read data file
app.get('/api/data', (req, res) => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      res.json(JSON.parse(data));
    } else {
      // Return null if no data file exists yet
      res.json(null);
    }
  } catch (error) {
    console.error('Error reading data file:', error);
    res.status(500).json({ error: 'Failed to read data', detail: error.message });
  }
});

// Run a shell command asynchronously with a timeout
function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: PROJECT_ROOT, timeout: 15000 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout.trim());
    });
  });
}

// Debounced auto-commit: batches rapid saves into a single commit
let gitCommitTimer = null;
let gitRunning = false;

function scheduleAutoCommit() {
  if (!AUTO_COMMIT) return;
  if (gitCommitTimer) clearTimeout(gitCommitTimer);
  gitCommitTimer = setTimeout(doAutoCommit, GIT_DEBOUNCE_MS);
}

async function doAutoCommit() {
  gitCommitTimer = null;
  if (gitRunning) {
    // Another commit is in progress; reschedule so we don't miss this change
    scheduleAutoCommit();
    return;
  }
  gitRunning = true;
  try {
    const status = await run('git status --porcelain data/sc-tracker-data.json');
    if (!status) return;

    await run('git add data/sc-tracker-data.json');
    await run('git commit -m "Auto-save data"');
    await run('git push');

    console.log('Auto-committed and pushed data changes');
  } catch (error) {
    console.error('Auto-commit failed:', error.message);
  } finally {
    gitRunning = false;
  }
}

// POST /api/data - Write data file (atomic: write tmp then rename)
app.post('/api/data', (req, res) => {
  const data = req.body;
  const tmpFile = DATA_FILE + '.tmp';

  try {
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
    fs.renameSync(tmpFile, DATA_FILE);
    res.json({ success: true });

    // Schedule git commit (debounced, completely decoupled from response)
    scheduleAutoCommit();
  } catch (error) {
    console.error('Error writing data file:', error);
    // Clean up tmp file if it exists
    try { fs.unlinkSync(tmpFile); } catch {} // eslint-disable-line no-empty
    res.status(500).json({ error: 'Failed to write data', detail: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Express error middleware (4-param handler)
app.use((err, req, res, _next) => {
  logCrash(`EXPRESS ERROR on ${req.method} ${req.path}`, err);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

const server = app.listen(PORT, () => {
  console.log(`SC Tracker API server running on port ${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
  logServer(`Server started on port ${PORT} (PID: ${process.pid})`);
});

// Graceful shutdown — wait for in-progress git op, flush pending commit
function gracefulShutdown(signal) {
  logServer(`${signal} received — shutting down (PID: ${process.pid})`);
  console.log(`\n${signal} received. Shutting down...`);

  // Flush any pending debounced commit immediately
  if (gitCommitTimer) {
    clearTimeout(gitCommitTimer);
    gitCommitTimer = null;
    // Fire the commit synchronously before exit
    doAutoCommit().finally(() => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 5000);
    });
  } else {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logCrash('UNHANDLED REJECTION', reason);
});

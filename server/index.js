const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '..');
const DATA_FILE = process.env.DATA_FILE || path.join(PROJECT_ROOT, 'data', 'sc-tracker-data.json');
const AUTO_COMMIT = process.env.AUTO_COMMIT !== 'false'; // Enable by default

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

// Write queue — serializes file writes and git operations so they can't conflict
let writeQueue = Promise.resolve();

function enqueueWrite(fn) {
  writeQueue = writeQueue.then(fn).catch(err => {
    console.error('Write queue error:', err.message);
  });
  return writeQueue;
}

// Auto-commit and push data file changes (non-blocking)
async function autoCommitAndPush() {
  if (!AUTO_COMMIT) return;

  try {
    const status = await run('git status --porcelain data/sc-tracker-data.json');
    if (!status) return;

    await run('git add data/sc-tracker-data.json');
    await run('git commit -m "Auto-save data"');
    await run('git push');

    console.log('Auto-committed and pushed data changes');
  } catch (error) {
    console.error('Auto-commit failed:', error.message);
  }
}

// POST /api/data - Write data file
app.post('/api/data', (req, res) => {
  const data = req.body;

  enqueueWrite(async () => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
      res.json({ success: true });

      // Auto-commit in background (don't block response)
      setImmediate(() => enqueueWrite(autoCommitAndPush));
    } catch (error) {
      console.error('Error writing data file:', error);
      res.status(500).json({ error: 'Failed to write data', detail: error.message });
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Express error middleware (4-param handler)
app.use((err, req, res, _next) => {
  console.error('Unhandled express error:', err);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

app.listen(PORT, () => {
  console.log(`SC Tracker API server running on port ${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

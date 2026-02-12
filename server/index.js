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

// Separate queues: file writes must not block behind slow git operations
let fileQueue = Promise.resolve();
let gitQueue = Promise.resolve();

function enqueueFileWrite(fn) {
  fileQueue = fileQueue.then(fn).catch(err => {
    console.error('File write queue error:', err.message);
  });
  return fileQueue;
}

function enqueueGitOp(fn) {
  gitQueue = gitQueue.then(fn).catch(err => {
    console.error('Git queue error:', err.message);
  });
  return gitQueue;
}

// Auto-commit and push data file changes (runs in git queue, never blocks saves)
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

  enqueueFileWrite(async () => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
      res.json({ success: true });

      // Auto-commit in separate git queue (never blocks file writes)
      enqueueGitOp(autoCommitAndPush);
    } catch (error) {
      console.error('Error writing data file:', error);
      res.status(500).json({ error: 'Failed to write data', detail: error.message });
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Express error middleware (4-param handler)
app.use((err, req, res, _next) => {
  console.error('Unhandled express error:', err);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

const server = app.listen(PORT, () => {
  console.log(`SC Tracker API server running on port ${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});

// Graceful shutdown — drain both queues before exiting
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Draining queues...`);
  Promise.all([fileQueue, gitQueue])
    .then(() => {
      console.log('Queues drained. Shutting down.');
      server.close(() => process.exit(0));
      // Force exit after 5s if server.close hangs
      setTimeout(() => process.exit(0), 5000);
    })
    .catch(err => {
      console.error('Error draining queues:', err.message);
      process.exit(1);
    });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

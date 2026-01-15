const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = process.env.DATA_FILE || '/data/sc-tracker-data.json';
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '..');
const AUTO_COMMIT = process.env.AUTO_COMMIT !== 'false'; // Enable by default

app.use(express.json({ limit: '10mb' }));

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
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// Auto-commit and push data file changes
function autoCommitAndPush() {
  if (!AUTO_COMMIT) return;

  try {
    // Check if file has changes
    const status = execSync('git status --porcelain data/sc-tracker-data.json', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    }).trim();

    if (!status) {
      return; // No changes to commit
    }

    // Stage, commit, and push
    execSync('git add data/sc-tracker-data.json', { cwd: PROJECT_ROOT });
    execSync('git commit -m "Auto-save data"', { cwd: PROJECT_ROOT });
    execSync('git push', { cwd: PROJECT_ROOT });

    console.log('Auto-committed and pushed data changes');
  } catch (error) {
    // Don't fail the request if git operations fail
    console.error('Auto-commit failed:', error.message);
  }
}

// POST /api/data - Write data file
app.post('/api/data', (req, res) => {
  try {
    const data = req.body;
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });

    // Auto-commit in background (don't block response)
    setImmediate(autoCommitAndPush);
  } catch (error) {
    console.error('Error writing data file:', error);
    res.status(500).json({ error: 'Failed to write data' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`SC Tracker API server running on port ${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});

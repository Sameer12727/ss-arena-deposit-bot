const fs = require('fs');
const path = require('path');

const COLORS = {
  info: '\x1b[36m',    // cyan
  warn: '\x1b[33m',    // yellow
  error: '\x1b[31m',   // red
  success: '\x1b[32m', // green
  reset: '\x1b[0m'
};

const LOG_DIR = path.join(__dirname, 'logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function writeToFile(level, message) {
  const date = new Date().toISOString().split('T')[0];
  const filePath = path.join(LOG_DIR, `bot-${date}.log`);
  const logLine = `[${getTimestamp()}] [${level.toUpperCase()}] ${message}\n`;
  fs.appendFile(filePath, logLine, (err) => {
    if (err) console.error('Failed to write log to file:', err);
  });
}

function log(level, message) {
  const color = COLORS[level] || COLORS.reset;
  console.log(`${color}[${getTimestamp()}] [${level.toUpperCase()}]${COLORS.reset} ${message}`);
  writeToFile(level, message);
}

module.exports = {
  info: (msg) => log('info', msg),
  warn: (msg) => log('warn', msg),
  error: (msg) => log('error', msg),
  success: (msg) => log('success', msg)
};
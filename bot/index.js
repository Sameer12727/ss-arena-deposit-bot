require('dotenv').config();
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const logger = require('./logger');
const { handleMessage } = require('./commands');

logger.info('Initializing SS Arena Payment Manager Bot...');

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'ss-arena-bot' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  }
});

client.on('qr', (qr) => {
  logger.info('QR Code generated. Scan to authenticate.');
  qrcode.generate(qr, { small: true });
  console.log('\n📱 Scan the QR code above with WhatsApp to connect!');
  console.log('   WhatsApp → Settings → Linked Devices → Link a Device\n');
});

client.on('authenticated', () => {
  logger.success('WhatsApp Authenticated! Session saved.');
});

client.on('auth_failure', (msg) => {
  logger.error(`Auth failure: ${msg}`);
  logger.warn('Delete .wwebjs_auth folder and restart to re-scan QR.');
});

client.on('ready', () => {
  logger.success('🚀 SS Arena Bot is LIVE and ready!');
  // Start Firestore listeners after bot is ready
  require('./listeners').startListeners(client);
});

client.on('message', async (message) => {
  await handleMessage(client, message);
});

client.on('disconnected', (reason) => {
  logger.warn(`Bot disconnected: ${reason}`);
  logger.info('Restarting in 5 seconds...');
  setTimeout(() => {
    client.initialize();
  }, 5000);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down bot...');
  await client.destroy();
  process.exit(0);
});

client.initialize();
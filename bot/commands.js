const { isValidTransactionId, isValidImageMime, extractTransactionId, sanitizePhone } = require('./validators');
const { saveDeposit, getDepositByTxn, getSettings } = require('./firebase');
const { uploadToImgBB } = require('./imgbb');
const logger = require('./logger');

const userState = new Map();

async function handleMessage(client, message) {
  try {
    const chat = await message.getChat();
    if (chat.isGroup) return; // Ignore groups

    const userNumber = message.from;
    const userName = message._data.notifyName || sanitizePhone(userNumber);
    const text = message.body ? message.body.trim().toLowerCase() : '';
    const state = userState.get(userNumber);

    // Command handlers
    if (text === 'help' || text === '?') return sendHelp(client, message);
    if (text === 'cancel') return cancelFlow(client, message, userNumber);
    if (text.startsWith('status')) return checkStatus(client, message, text);

    // Step 0: Start / Deposit trigger
    if (text === 'start' || text === 'deposit' || text === 'hi' || text === 'hello' || !state) {
      return sendWelcome(client, message, userNumber);
    }

    // Step 2: Awaiting TXN + Screenshot
    if (state && state.step === 'awaiting_txn_and_screenshot') {
      return processDeposit(client, message, userNumber, userName, state);
    }

  } catch (error) {
    logger.error(`Error handling message: ${error.message}`);
    client.sendMessage(message.from, '⚠️ An unexpected error occurred. Please try again or type "help".');
  }
}

async function sendWelcome(client, message, userNumber) {
  const settings = await getSettings();
  const accName = settings.accountName || 'N/A';
  const payNum = settings.paymentNumber || 'N/A';
  const amount = settings.depositAmount || 'N/A';

  const welcomeMsg = `🎮 *SS Arena Payment Manager*\n━━━━━━━━━━━━━━━━\nAssalam o Alaikum! 👋\n\nSS ARENA me deposit krne ke liye DEPOSIT type karein.\n\n💳 *Payment Details:*\n• Account: ${accName} (${payNum})\n• Amount: Rs. ${amount}\n• Method: Only JAZZCASH\n\n📋 *Payment karne ke liye:*\nReply mein likho: *deposit*\n\nMain sirf payments handle karta hoon. 🤖`;
  const welcomeMsg = `🎮 *SS Arena Payment Manager*\n━━━━━━━━━━━━━━━━\nAssalam o Alaikum! 👋\n\nSS ARENA me deposit krne ke liye DEPOSIT type karein.\n\n💳 *Payment Details:*\n• Account: ${accName} (${payNum})\n• Amount: Rs. ${amount}\n• Method: Only JAZZCASH\n\n📋 *Payment karne ke baad:*\nReply mein likho: *deposit*\n\nMain sirf payments handle karta hoon. 🤖`;

  await client.sendMessage(message.from, welcomeMsg);
  
  if (message.body.trim().toLowerCase() === 'deposit') {
    userState.set(userNumber, { step: 'awaiting_txn_and_screenshot' });
    const depositMsg = `📤 *Payment Proof Submit Karein*\n━━━━━━━━━━━━━━━━\nEk hi message mein yeh dono cheezein bhejein:\n\n1️⃣ *Transaction ID* (pehli line mein)\n2️⃣ *Payment screenshot* (image attach karein)\n\n*Example:*\nTXN123456789\n[screenshot attach]\n\n⚠️ Dono cheezein ek saath zaroori hain.`;
    await client.sendMessage(message.from, depositMsg);
  }
}

async function processDeposit(client, message, userNumber, userName) {
  const textBody = message.body || '';

  // CHECK: Does the message have media? 
  const hasMedia = message.hasMedia;
  const isInlineImage = message.type === 'image';
  const isDocumentImage = message.type === 'document' && isValidImageMime(message.mimetype);
  const isValidImage = isInlineImage || isDocumentImage;

  // Validation: Missing Image or Invalid Format
  if (!hasMedia || !isValidImage) {
    return client.sendMessage(message.from, '❌ Screenshot nahi mili ya format galat hai. Transaction ID ke saath image attach karein. (Sirf image files allowed hain)');
  }

  // Validation: Missing TXN ID
  const txnId = extractTransactionId(textBody);
  if (!txnId) {
    return client.sendMessage(message.from, '❌ Transaction ID nahi mili. Pehli line mein Transaction ID likhein.');
  }

  // Validation: TXN ID Format
  const txnValidation = isValidTransactionId(txnId);
  if (!txnValidation.valid) {
    return client.sendMessage(message.from, `❌ Transaction ID format galat hai. ${txnValidation.error}`);
  }

  // Validation: Duplicate TXN
  const existing = await getDepositByTxn(txnId);
  if (existing) {
    return client.sendMessage(message.from, '⚠️ Yeh Transaction ID pehle se submit ho chuka hai. Agar problem ho to support se contact karein.');
  }

  // All validations passed - Process
  await client.sendMessage(message.from, '⏳ Processing your deposit...');

  try {
    const media = await message.downloadMedia();
    if (!media || !media.data) {
      throw new Error('Failed to download image from WhatsApp');
    }

    // Convert Base64 data URL to Buffer
    const buffer = Buffer.from(media.data, 'base64');
    
    // Determine file extension from mimetype
    const ext = media.mimetype ? media.mimetype.split('/')[1] : 'png';
    const fileName = `txn_${txnId}_${Date.now()}.${ext}`;
    
    // Upload to ImgBB
    const imgResult = await uploadToImgBB(buffer, fileName);

    // Save to Firestore
    await saveDeposit({
      userNumber,
      userName,
      transactionId: txnId,
      screenshotURL: imgResult.url,
      screenshotThumb: imgResult.thumb,
      paymentId: '',
      rejectReason: '',
      adminNote: '',
      processedAt: null
    });

    // Clear state
    userState.delete(userNumber);

    // UPDATED MESSAGE: Status link hataya, aur yahan notify karne ka zikr kiya
    const successMsg = `✅ *Deposit Request Submit Ho Gaya!*\n━━━━━━━━━━━━━━━━━\n📋 Transaction ID: ${txnId}\n⏳ Status: Pending Review\n\nAdmin review karne ke baad aapko *yahi par* Payment ID aur Instructions bata diye jayenge.\n\nWait karein — 5-30 minutes mein reply milegi. 🙏`;
    
    await client.sendMessage(message.from, successMsg);
    logger.success(`Deposit processed successfully for TXN: ${txnId}`);

  } catch (error) {
    logger.error(`Processing error for ${userNumber}: ${error.message}`);
    if (error.message === 'DUPLICATE_TXN') {
      await client.sendMessage(message.from, '⚠️ Yeh Transaction ID pehle se submit ho chuka hai.');
    } else {
      await client.sendMessage(message.from, '❌ Deposit submit karte waqt error aaya. Dobara try karein ya "deposit" likh kar dobara shuru karein.');
    }
  }
}

async function checkStatus(client, message, text) {
  const parts = text.split(' ');
  if (parts.length < 2) {
    return client.sendMessage(message.from, '📋 Format: status <Transaction ID>\n\nExample: status TXN123456');
  }
  const txnId = parts[1].trim();
  const deposit = await getDepositByTxn(txnId);
  
  if (!deposit) {
    return client.sendMessage(message.from, `❌ Transaction ID "${txnId}" nahi mili.`);
  }

  let statusText = '';
  if (deposit.status === 'pending') statusText = '⏳ Pending Review';
  if (deposit.status === 'approved') statusText = `✅ Approved (Payment ID: ${deposit.paymentId})`;
  if (deposit.status === 'rejected') statusText = `❌ Rejected (Reason: ${deposit.rejectReason || 'Not specified'})`;

  await client.sendMessage(message.from, `📋 *Status for ${txnId}:*\n━━━━━━━━━━━━━━━━\n${statusText}`);
}

async function sendHelp(client, message) {
  const helpMsg = `🤖 *SS Arena Bot Commands*\n━━━━━━━━━━━━━━━━\n• *deposit* - Payment submit karein\n• *status <TXN_ID>* - Payment status check karein\n• *cancel* - Current flow cancel karein\n• *help* - Yeh message dikhayein`;
  await client.sendMessage(message.from, helpMsg);
}

async function cancelFlow(client, message, userNumber) {
  if (userState.has(userNumber)) {
    userState.delete(userNumber);
    await client.sendMessage(message.from, '🚫 Current process cancel ho gaya. Dobara shuru karne ke liye "deposit" likhein.');
  } else {
    await client.sendMessage(message.from, 'Koi active process nahi hai. "deposit" likh kar shuru karein.');
  }
}

module.exports = { handleMessage };

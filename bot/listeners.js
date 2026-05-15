const { onDepositChange, markNotified } = require('./firebase');
const logger = require('./logger');

function startListeners(client) {
  logger.info('Starting Firestore real-time listeners...');

  onDepositChange((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      // Only process modifications to prevent old docs from firing on restart
      if (change.type === 'modified') {
        const data = change.doc.data();
        const docId = change.doc.id;

        // Extra safety check
        if (data.notified) return;

        processNotification(client, docId, data);
      }
    });
  });
}

async function processNotification(client, docId, data) {
  const { userNumber, status, transactionId, paymentId, rejectReason } = data;

  try {
    let message = '';

    if (status === 'approved') {
      message = `🎉 *Payment Approved!*\n━━━━━━━━━━━━━━━━\n✅ Mubarak ho! Aapka payment confirm ho gaya.\n\n🎮 *Payment ID:* ${paymentId}\n📋 *Transaction ID:* ${transactionId}\n\nYeh Payment ID tournament registration mein use karein.\nSS Arena mein khush aamdeed! 🔥`;
    } else if (status === 'rejected') {
      message = `❌ *Payment Rejected*\n━━━━━━━━━━━━━━━━\nAapka deposit reject kar diya gaya.\n\n📋 *Transaction ID:* ${transactionId}\n📝 *Reason:* ${rejectReason || 'Not specified'}\n\nDobara submit karne ke liye 'deposit' likhein ya support se contact karein.`;
    }

    if (message) {
      await client.sendMessage(userNumber, message);
      await markNotified(docId);
      logger.success(`Notification sent to ${userNumber} for TXN ${transactionId} [${status}]`);
    }
  } catch (error) {
    // Intentionally NOT marking as notified so it retries on next restart/update
    logger.error(`Failed to send notification to ${userNumber}: ${error.message}`);
  }
}

module.exports = { startListeners };
const { onDepositChange, markNotified } = require('./firebase');
const logger = require('./logger');

function startListeners(client) {
  logger.info('Starting Firestore real-time listeners...');

  onDepositChange((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      // BUG FIX: Firestore triggers 'added' when a doc enters the query scope.
      // When a deposit goes from 'pending' to 'approved', it enters this query, 
      // so we MUST listen to both 'added' and 'modified'.
      if (change.type === 'added' || change.type === 'modified') {
        const data = change.doc.data();
        const docId = change.doc.id;

        // Extra safety check to avoid double-sending
        if (data.notified) return;

        processNotification(client, docId, data);
      }
    });
  });
}

async function processNotification(client, docId, data) {
  const { userNumber, status, transactionId, paymentId, rejectReason, adminNote } = data;

  try {
    let message = '';

    if (status === 'approved') {
      // Agar admin ne koi instruction/ID diya hai to usko message mein add karein
      let instructionPart = '';
      if (adminNote && adminNote.trim() !== '') {
        instructionPart = `\n\n📝 *Admin Instructions:* ${adminNote}`;
      }

      message = `🎉 *Payment Approved!*\n━━━━━━━━━━━━━━━━\n✅ Mubarak ho! Aapka payment confirm ho gaya.\n\n🎮 *Payment ID:* ${paymentId}\n📋 *Transaction ID:* ${transactionId}${instructionPart}\n\nYeh Payment ID Wallet Deposit Section mein use karein.\nSS Arena mein deposit krne ke liye ap ka Thanks! 🔥`;
      
    } else if (status === 'rejected') {
      message = `❌ *Payment Rejected*\n━━━━━━━━━━━━━━━━\nAapka deposit reject kar diya gaya.\n\n📋 *Transaction ID:* ${transactionId}\n📝 *Reason:* ${rejectReason || 'Not specified'}\n\nDobara submit karne ke liye 'deposit' likhein ya support se contact karein.`;
    }

    if (message) {
      await client.sendMessage(userNumber, message);
      await markNotified(docId);
      logger.success(`Notification sent to ${userNumber} for TXN ${transactionId} [${status}]`);
    }
  } catch (error) {
    // Agar message bhejne mein error aaye to notified=true nahi karein, taake bot restart par dobara try kare
    logger.error(`Failed to send notification to ${userNumber}: ${error.message}`);
  }
}

module.exports = { startListeners };

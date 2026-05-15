function isValidTransactionId(txnId) {
  if (!txnId) return { valid: false, error: 'Transaction ID is missing.' };
  const trimmed = txnId.trim();
  const regex = /^[A-Za-z0-9\-_]{6,25}$/;
  if (!regex.test(trimmed)) {
    return { valid: false, error: 'Invalid format. Only letters, numbers, hyphens, underscores (6-25 chars).' };
  }
  return { valid: true, error: null };
}

// Updated: Now allows ANY image mime type (image/*)
function isValidImageMime(mimeType) {
  if (!mimeType) return false;
  const lowerMime = mimeType.toLowerCase();
  // Allow any mime type that starts with 'image/' (e.g., image/jpeg, image/webp, image/heic, image/bmp)
  return lowerMime.startsWith('image/');
}

function isPrivateChat(message) {
  return !message.from.includes('@g.us') && !message.fromMe;
}

function extractTransactionId(messageBody) {
  if (!messageBody) return null;
  const lines = messageBody.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

function sanitizePhone(waId) {
  return waId.replace('@c.us', '');
}

module.exports = {
  isValidTransactionId,
  isValidImageMime,
  isPrivateChat,
  extractTransactionId,
  sanitizePhone
};
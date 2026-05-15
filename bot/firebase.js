const admin = require('firebase-admin');
const logger = require('./logger');

// Initialize Firebase Admin
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function saveDeposit(data) {
  // Anti-duplicate check
  const existing = await getDepositByTxn(data.transactionId);
  if (existing) {
    throw new Error('DUPLICATE_TXN');
  }

  const docRef = await db.collection('deposits').add({
    ...data,
    status: 'pending',
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    notified: false
  });
  
  logger.success(`Deposit saved to Firestore: ${docRef.id}`);
  return docRef.id;
}

async function getDepositByTxn(txnId) {
  const snapshot = await db.collection('deposits')
    .where('transactionId', '==', txnId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

async function updateDeposit(docId, data) {
  await db.collection('deposits').doc(docId).update(data);
  logger.info(`Deposit ${docId} updated with: ${JSON.stringify(data)}`);
}

async function getSettings() {
  const doc = await db.collection('settings').doc('config').get();
  if (!doc.exists) {
    logger.warn('Settings document does not exist!');
    return {};
  }
  return doc.data();
}

function onDepositChange(callback) {
  return db.collection('deposits')
    .where('notified', '==', false)
    .where('status', 'in', ['approved', 'rejected'])
    .onSnapshot(callback);
}

async function markNotified(docId) {
  await db.collection('deposits').doc(docId).update({ notified: true });
  logger.info(`Deposit ${docId} marked as notified.`);
}

module.exports = {
  saveDeposit,
  getDepositByTxn,
  updateDeposit,
  getSettings,
  onDepositChange,
  markNotified
};
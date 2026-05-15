const admin = require('firebase-admin');
const logger = require('./logger');
const path = require('path');

/**
 * 1. FIREBASE INITIALIZATION
 * Hum direct JSON file use kar rahe hain kyunki .env mein 
 * Private Key aksar formatting errors create karti hai.
 */
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

try {
    const serviceAccount = require(serviceAccountPath);

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        logger.success('✅ Firebase Admin initialized successfully!');
    }
} catch (error) {
    logger.error('❌ CRITICAL: Failed to load serviceAccountKey.json');
    console.error(error);
    process.exit(1); // Agar key nahi mili toh bot start na ho
}

const db = admin.firestore();

// --- FUNCTIONS ---

/**
 * Naya deposit Firestore mein save karne ke liye
 */
async function saveDeposit(data) {
    // Duplicate check (Taa'ke ek hi Transaction ID do baar save na ho)
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

/**
 * Transaction ID ke zariye purana record check karna
 */
async function getDepositByTxn(txnId) {
    const snapshot = await db.collection('deposits')
        .where('transactionId', '==', txnId)
        .limit(1)
        .get();

    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

/**
 * Deposit ka status update karna (Approved/Rejected)
 */
async function updateDeposit(docId, data) {
    await db.collection('deposits').doc(docId).update(data);
    logger.info(`Deposit ${docId} updated.`);
}

/**
 * Firestore se bot ki settings mangwana
 */
async function getSettings() {
    const doc = await db.collection('settings').doc('config').get();
    if (!doc.exists) {
        logger.warn('Settings document not found in Firestore!');
        return {};
    }
    return doc.data();
}

/**
 * Firestore mein tabdeeli par nazar rakhna (Real-time Listener)
 */
function onDepositChange(callback) {
    return db.collection('deposits')
        .where('notified', '==', false)
        .where('status', 'in', ['approved', 'rejected'])
        .onSnapshot(callback);
}

/**
 * Notification bhejne ke baad record ko mark karna
 */
async function markNotified(docId) {
    await db.collection('deposits').doc(docId).update({ notified: true });
}

module.exports = {
    saveDeposit,
    getDepositByTxn,
    updateDeposit,
    getSettings,
    onDepositChange,
    markNotified,
    db
};
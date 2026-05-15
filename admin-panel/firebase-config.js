const firebaseConfig = {
  apiKey: "AIzaSyDKSeoIQsBxI-GOrZWQ0B7EHplvCSSfBDM",
  authDomain: "ss-arena.firebaseapp.com",
  projectId: "ss-arena",
  storageBucket: "ss-arena.firebasestorage.app",
  messagingSenderId: "224454272643",
  appId: "1:224454272643:web:005187ed991a49920d9db6",
  measurementId: "G-X3QKDTQT1T"
};

// Do not modify below this line
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { 
  getAuth,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  inMemoryPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendPasswordResetEmail,
  type User
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  doc, 
  query,
  where,
  orderBy,
  onSnapshot,
  setDoc,
  getDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp,
  limit as firestoreLimit
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAExtesWZPAEbQbGm5Rp17ek1PuWx_uceQ",
  authDomain: "fco-manager-caccd.firebaseapp.com",
  projectId: "fco-manager-caccd",
  storageBucket: "fco-manager-caccd.firebasestorage.app",
  messagingSenderId: "766313707978",
  appId: "1:766313707978:web:9b508cb48ab77f5b8d3733",
  measurementId: "G-MC87ME0J12"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Detect iOS Capacitor WebView where persistence hangs (both indexedDB AND browserLocal)
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isCapacitor = !!(window as any).Capacitor;

// On iOS Capacitor, use inMemoryPersistence — the app already handles session
// restoration via localStorage manually in AuthContext, so Firebase persistence
// is not needed. This prevents the SDK from hanging on internal storage calls.
// On Android/other, try indexedDB first with browserLocal fallback.
const persistencePromise = (isIOS && isCapacitor)
  ? setPersistence(auth, inMemoryPersistence)
  : (isCapacitor
    ? setPersistence(auth, browserLocalPersistence).catch(() => setPersistence(auth, inMemoryPersistence))
    : setPersistence(auth, indexedDBLocalPersistence).catch(() => setPersistence(auth, browserLocalPersistence))
  );

export const authReady = Promise.race([
  persistencePromise,
  new Promise<void>((resolve) => setTimeout(resolve, 2000))
]);

export const db = getFirestore(app);

// Secondary app for creating users without switching the current session
export const createUserWithoutSignIn = async (email: string, password: string) => {
  const secondaryApp = initializeApp(firebaseConfig, 'secondary');
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    return userCredential;
  } finally {
    await signOut(secondaryAuth);
    await deleteApp(secondaryApp);
  }
};

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendPasswordResetEmail,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  setDoc,
  getDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp,
  firestoreLimit,
  type User
};

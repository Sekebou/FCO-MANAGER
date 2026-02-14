import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
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
  arrayRemove
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
export const db = getFirestore(app);

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
  type User
};

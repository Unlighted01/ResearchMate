import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  //GoogleAuthProvider,
  //signInWithPopup,
  //signInWithCredential,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC2Ws7B-YMcC4vz7c6R313D4ZwdnVbjpXg",
  authDomain: "researchmate-61a8a.firebaseapp.com",
  projectId: "researchmate-61a8a",
  storageBucket: "researchmate-61a8a.firebasestorage.app",
  messagingSenderId: "63045817614",
  appId: "1:63045817614:web:bc2b5cf1df65c31d63f35f",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export everything
export {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  //GoogleAuthProvider,
  //signInWithPopup,
  //signInWithCredential,
  collection,
  addDoc,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
};

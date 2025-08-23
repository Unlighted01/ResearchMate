// lib/firebase-init.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
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

const firebaseConfig = {
  apiKey: "AIzaSyC2Ws7B-YMcC4vz7c6R313D4ZwdnVbjpXg",
  authDomain: "researchmate-61a8a.firebaseapp.com",
  projectId: "researchmate-61a8a",
  storageBucket: "researchmate-61a8a.firebasestorage.app",
  messagingSenderId: "63045817614",
  appId: "1:63045817614:web:bc2b5cf1df65c31d63f35f",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ EXPLICITLY export everything popup.js uses
export {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  collection,
  addDoc,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  GoogleAuthProvider, // ✅ now exported
  signInWithPopup, // ✅ now exported
};

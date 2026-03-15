'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyAhYX4rOSAwQx-ZQJvK9nDH7dFE8--wvK4",
  authDomain: "studio-3399112819-1f547.firebaseapp.com",
  projectId: "studio-3399112819-1f547",
  storageBucket: "studio-3399112819-1f547.firebasestorage.app",
  messagingSenderId: "225328847693",
  appId: "1:225328847693:web:4cfc1ea413e17269cf3504"
};

// Singleton pattern for HMR stability in Next.js
// Attaching to globalThis ensures the same instance is reused across HMR cycles
const globalWithFirebase = globalThis as unknown as {
  __FIREBASE_APP__?: FirebaseApp;
  __FIREBASE_AUTH__?: Auth;
  __FIREBASE_DB__?: Firestore;
};

function getFirebaseApp(): FirebaseApp {
  if (globalWithFirebase.__FIREBASE_APP__) return globalWithFirebase.__FIREBASE_APP__;
  
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  
  if (process.env.NODE_ENV !== 'production') {
    globalWithFirebase.__FIREBASE_APP__ = app;
  }
  
  return app;
}

const app = getFirebaseApp();
const auth = globalWithFirebase.__FIREBASE_AUTH__ || getAuth(app);
const db = globalWithFirebase.__FIREBASE_DB__ || getFirestore(app);

if (process.env.NODE_ENV !== 'production') {
  globalWithFirebase.__FIREBASE_AUTH__ = auth;
  globalWithFirebase.__FIREBASE_DB__ = db;
}

export { app, auth, db };
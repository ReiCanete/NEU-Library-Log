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

// Singleton pattern to handle Next.js HMR reloads safely
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (typeof window !== 'undefined') {
  const globalApp = (globalThis as any)._firebaseApp as FirebaseApp | undefined;
  if (globalApp) {
    app = globalApp;
  } else {
    app = initializeApp(firebaseConfig);
    (globalThis as any)._firebaseApp = app;
  }
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  // Server-side placeholder
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };

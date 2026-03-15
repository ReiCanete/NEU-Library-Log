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

// Robust Singleton pattern for Next.js HMR stability
const G = (typeof window !== 'undefined' ? window : globalThis) as any;

function getFirebaseInstance(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (!G._firebaseApp) {
    G._firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    G._firebaseAuth = getAuth(G._firebaseApp);
    G._firebaseDb = getFirestore(G._firebaseApp);
  }
  return {
    app: G._firebaseApp,
    auth: G._firebaseAuth,
    db: G._firebaseDb
  };
}

const { app, auth, db } = typeof window !== 'undefined' 
  ? getFirebaseInstance() 
  : { app: null as any, auth: null as any, db: null as any };

export { app, auth, db };

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

// Robust Singleton pattern to survive Next.js HMR reloads
const G = (typeof window !== 'undefined' ? window : globalThis) as any;

function getFirebaseInstance(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (typeof window === 'undefined') {
    return { app: null as any, auth: null as any, db: null as any };
  }

  if (!G._firebaseApp) {
    G._firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  
  if (!G._firebaseAuth) {
    G._firebaseAuth = getAuth(G._firebaseApp);
  }
  
  if (!G._firebaseDb) {
    G._firebaseDb = getFirestore(G._firebaseApp);
  }

  return {
    app: G._firebaseApp,
    auth: G._firebaseAuth,
    db: G._firebaseDb
  };
}

const { app, auth, db } = getFirebaseInstance();

export { app, auth, db };

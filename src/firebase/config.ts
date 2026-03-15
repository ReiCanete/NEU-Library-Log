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

// Singleton pattern using globalThis to survive Next.js HMR cycles
const G = globalThis as any;

const app: FirebaseApp = G._fapp || (typeof window !== 'undefined' ? (G._fapp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)) : undefined);
const auth: Auth = G._fauth || (typeof window !== 'undefined' ? (G._fauth = getAuth(app)) : undefined);
const db: Firestore = G._fdb || (typeof window !== 'undefined' ? (G._fdb = getFirestore(app)) : undefined);

export { app, auth, db };

'use client';

import { app, auth, db as firestore } from './config';

/**
 * Singleton exports for Firebase services
 */
export { app, auth, firestore };

/**
 * Standard initialization function for the Firebase Provider.
 * Returns the singleton instances.
 */
export function initializeFirebase() {
  return { app, firestore, auth };
}

export * from './provider';
export * from './client-provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './errors';
export * from './error-emitter';

'use client';

import { app, auth, db as firestore } from './config';
export { app, auth, firestore };

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

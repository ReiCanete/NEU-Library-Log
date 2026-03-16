export const firebaseErrorMessages: Record<string, string> = {
  'auth/user-not-found': 'No account found with this email address.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-credential': 'Invalid email or password. Please try again.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Please check your connection.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/unauthorized-domain': 'This domain is not authorized for sign-in.',
  'permission-denied': 'You do not have permission to perform this action.',
  'unavailable': 'Service temporarily unavailable. Please try again.',
  'not-found': 'The requested record was not found.',
  'already-exists': 'This record already exists.',
  'deadline-exceeded': 'Request timed out. Please try again.',
};

export const getErrorMessage = (error: any): string => {
  if (error?.code && firebaseErrorMessages[error.code]) {
    return firebaseErrorMessages[error.code];
  }
  // Check if the message contains the code string (common in Firebase v10+)
  for (const code in firebaseErrorMessages) {
    if (error?.message?.includes(code)) {
      return firebaseErrorMessages[code];
    }
  }
  return error?.message || 'An unexpected error occurred. Please try again.';
};

export const logAppError = (component: string, action: string, error: any) => {
  // Prevent console error overlays for expected authentication failures
  const errorCode = error?.code || error?.message || '';
  const commonAuthErrors = [
    'auth/invalid-credential',
    'auth/user-not-found',
    'auth/wrong-password',
    'auth/too-many-requests',
    'auth/network-request-failed',
    'auth/popup-closed-by-user'
  ];

  if (commonAuthErrors.some(err => errorCode.includes(err))) {
    console.info(`[Auth Attempt] ${component}/${action}: ${errorCode}`);
    return;
  }

  console.error(`[NEU Library Log Error] [${component}] [${action}]:`, error);
};

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { initializeFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

const provider = new GoogleAuthProvider();
// Add specific scopes needed
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cache the access token in memory
let cachedAccessToken: string | null = null;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If logged in but cache is empty, we must prompt login on action
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

/**
 * Save ledger state (emails, matches, overrides) to central database (Express Server-Side JSON Store).
 * This replaces Firestore to avoid iframe security blocks (3rd-party cookies/sandboxing) and adblocker issues.
 */
export const saveLedgerToCloud = async (emails: any[], matches: any[], overrides: any) => {
  const timestamp = new Date().toISOString();
  
  // Always update local backup first to prevent any data loss
  try {
    localStorage.setItem('shared_ledger_local_backup', JSON.stringify({
      emails,
      matches,
      overrides,
      updatedAt: timestamp,
    }));
  } catch (e) {
    console.warn('Failed to save local backup to localStorage:', e);
  }

  try {
    const response = await fetch('/api/ledger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emails,
        matches,
        overrides,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Failed to save ledger on the server');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.warn('Server ledger save error:', error.message || error);
    throw error;
  }
};

/**
 * Load ledger state from Express Server-Side JSON Store.
 */
export const loadLedgerFromCloud = async () => {
  try {
    const response = await fetch('/api/ledger');
    if (!response.ok) {
      throw new Error('Failed to load ledger from the server');
    }
    const data = await response.json();
    return data; // returns full state or null
  } catch (error: any) {
    console.warn('Server ledger load error:', error.message || error);
    throw error;
  }
};


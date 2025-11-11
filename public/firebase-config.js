// Firebase configuration - load from server
// Using compat API to match the HTML script tags
let firebaseConfig = {};

// Initialize variables that will be populated after config is loaded
let auth;
let provider;

// Fetch the Firebase configuration from the server
async function initializeFirebase() {
  try {
    // Check if Firebase is already loaded (from HTML script tags)
    if (typeof firebase === 'undefined') {
      console.error('Firebase not loaded. Make sure firebase-app-compat.js is loaded before this script.');
      // Retry after a short delay
      setTimeout(initializeFirebase, 1000);
      return;
    }
    
    const response = await fetch('/api/firebase-config');
    if (!response.ok) {
      throw new Error(`Failed to fetch Firebase config: ${response.status} ${response.statusText}`);
    }
    
    firebaseConfig = await response.json();
    
    // Validate config
    if (!firebaseConfig || !firebaseConfig.apiKey) {
      throw new Error('Invalid Firebase configuration received from server');
    }
    
    // Initialize Firebase with the fetched config using compat API
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    
    // Initialize auth using compat API
    if (!firebase.auth) {
      throw new Error('Firebase Auth not loaded. Make sure firebase-auth-compat.js is loaded.');
    }
    
    auth = firebase.auth();
    provider = new firebase.auth.GoogleAuthProvider();
    
    // Dispatch event to notify app that Firebase is ready
    document.dispatchEvent(new Event('firebaseReady'));
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    // Dispatch error event so other parts of the app can handle it
    document.dispatchEvent(new CustomEvent('firebaseError', { detail: error }));
  }
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFirebase);
} else {
  initializeFirebase();
}

// Export auth functionality using compat API
export const signInWithPopup = (auth, provider) => {
  return auth.signInWithPopup(provider);
};

export const onAuthStateChanged = (auth, callback) => {
  return auth.onAuthStateChanged(callback);
};

export const signOut = (auth) => {
  return auth.signOut();
};

export { auth, provider };
// Export GoogleAuthProvider - firebase is loaded from HTML script tags before this module
// Access it via a getter to ensure it's available when used
export const GoogleAuthProvider = new Proxy({}, {
  get(target, prop) {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      throw new Error('Firebase Auth not initialized. Wait for firebaseReady event.');
    }
    return firebase.auth.GoogleAuthProvider[prop];
  }
}); 
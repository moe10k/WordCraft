// Firebase configuration - will be loaded from server
let firebaseConfig = {};

// Initialize Firebase
let db;
let auth;
let leaderboard;
let isInitialized = false;

// Leaderboard class to handle all leaderboard operations
class Leaderboard {
    constructor() {
        if (!db) {
            console.error('Firebase DB not initialized');
            return;
        }
        this.scoresRef = db.collection('scores');
        console.log('Leaderboard instance created');
    }

    static getInstance() {
        if (!leaderboard) {
            leaderboard = new Leaderboard();
        }
        return leaderboard;
    }

    isUserAuthenticated() {
        return auth.currentUser !== null && 
               !auth.currentUser.isAnonymous && 
               auth.currentUser.email !== null;
    }

    getCurrentUser() {
        return auth.currentUser;
    }

    async updateScore(username) {
        try {
            // Check if Firebase is initialized
            if (!firebase.apps.length) {
                console.error('Firebase not initialized');
                return { updated: false, reason: 'firebase-not-initialized' };
            }

            // Get the current user
            const user = auth.currentUser;
            console.log('Current auth state:', user ? 'Authenticated' : 'Not authenticated');
            
            // Additional logging to debug authentication state
            if (user) {
                console.log('User details:', {
                    isAnonymous: user.isAnonymous,
                    hasEmail: !!user.email,
                    providerData: user.providerData.map(p => p.providerId)
                });
            }
            
            // Strict check for authenticated users
            if (!this.isUserAuthenticated()) {
                console.log('Guest or anonymous user win NOT recorded in leaderboard:', username);
                return { updated: false, reason: 'guest-user' };
            }
            
            console.log('Authenticated user win WILL BE recorded in leaderboard:', username);

            const userDoc = this.scoresRef.doc(username);
            const doc = await userDoc.get();
            
            console.log('Updating wins for authenticated user:', username);
            if (doc.exists) {
                console.log('Current data:', doc.data());
                // Use Firestore's increment operation to safely increment wins
                const increment = firebase.firestore.FieldValue.increment(1);
                console.log('Applying increment operation...');
                
                const updateData = {
                    wins: increment,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                    uid: user.uid,
                    email: user.email // Store email for verification
                };
                
                await userDoc.update(updateData);
                
                // Fetch the updated document
                const updatedDoc = await userDoc.get();
                const newData = updatedDoc.data();
                console.log('Updated data:', newData);
                console.log(`Wins updated for ${username} from ${doc.data().wins || 0} to ${newData.wins}`);
                return true;
            } else {
                console.log('Creating new user entry for authenticated user...');
                // New user, create their first win entry
                const newUserData = {
                    username: username,
                    wins: 1,
                    uid: user.uid,
                    email: user.email, // Store email for verification
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                };
                await userDoc.set(newUserData);
                console.log(`New player created for ${username} with initial data:`, newUserData);
                return true;
            }
        } catch (error) {
            console.error('Error updating wins:', error);
            return { updated: false, reason: 'error', message: error.message };
        }
    }

    async getTopPlayers(limit = 10) {
        try {
            console.log('Fetching top players...');
            const snapshot = await this.scoresRef
                .orderBy('wins', 'desc')
                .limit(limit)
                .get();

            const players = snapshot.docs.map(doc => {
                const data = doc.data();
                console.log('Player data:', doc.id, data);
                return {
                    username: doc.id,
                    wins: data.wins || 0
                };
            });
            console.log('Retrieved players:', players);
            return players;
        } catch (error) {
            console.error('Error getting top players:', error);
            return [];
        }
    }

    async getPlayerStats(username) {
        try {
            const doc = await this.scoresRef.doc(username).get();
            if (doc.exists) {
                return doc.data();
            }
            return null;
        } catch (error) {
            console.error('Error getting player stats:', error);
            return null;
        }
    }

    async updateLeaderboardDisplay() {
        try {
            const leaderboardElement = document.getElementById('leaderboardList');
            
            if (!leaderboardElement) {
                console.error('Leaderboard element not found');
                return;
            }

            leaderboardElement.innerHTML = '';
            
            // Check authentication with strict criteria
            if (!this.isUserAuthenticated()) {
                console.log('Not showing leaderboard to non-authenticated user');
                const messageDiv = document.createElement('div');
                messageDiv.className = 'leaderboard-message';
                messageDiv.innerHTML = `
                    <p>Sign in with Google to:</p>
                    <ul>
                        <li>Track your high scores</li>
                        <li>Compete on the leaderboard</li>
                        <li>Save your game statistics</li>
                    </ul>
                `;
                leaderboardElement.appendChild(messageDiv);
                return;
            }

            // Get and display top players only for authenticated users
            const topPlayers = await this.getTopPlayers();
            
            // If no players, show empty message
            if (topPlayers.length === 0) {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'leaderboard-message';
                messageDiv.innerHTML = '<p>No wins recorded yet. Win a game to be the first!</p>';
                leaderboardElement.appendChild(messageDiv);
                return;
            }
            
            topPlayers.forEach((player, index) => {
                const entry = document.createElement('div');
                entry.className = 'leaderboard-entry';
                entry.innerHTML = `
                    <span class="rank">#${index + 1}</span>
                    <span class="username">${player.username}</span>
                    <span class="score">Wins: ${player.wins}</span>
                `;
                leaderboardElement.appendChild(entry);
            });
        } catch (error) {
            console.error('Error updating leaderboard display:', error);
        }
    }
}

// Initialize Firebase and Leaderboard
async function initializeFirebase() {
    if (isInitialized) {
        return true;
    }

    try {
        // Check if Firebase is available
        if (typeof firebase === 'undefined') {
            console.warn('Firebase not loaded yet');
            return false;
        }

        // Fetch Firebase config from server if not already loaded
        if (!firebaseConfig.apiKey) {
            try {
                const response = await fetch('/api/firebase-config');
                if (!response.ok) {
                    throw new Error('Failed to fetch Firebase config');
                }
                firebaseConfig = await response.json();
                console.log('Firebase config loaded from server');
            } catch (error) {
                console.error('Error fetching Firebase config:', error);
                return false;
            }
        }

        // Initialize Firebase if not already initialized
        if (!firebase.apps.length) {
            console.log('Initializing Firebase app...');
            firebase.initializeApp(firebaseConfig);
        }

        // Check if auth and firestore are available
        if (!firebase.auth || !firebase.firestore) {
            console.warn('Firebase auth or firestore not loaded yet');
            return false;
        }

        // Initialize Firebase services
        auth = firebase.auth();
        db = firebase.firestore();

        // Enable offline persistence
        db.enablePersistence()
            .catch((err) => {
                if (err.code == 'failed-precondition') {
                    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
                } else if (err.code == 'unimplemented') {
                    console.warn('The current browser does not support persistence.');
                }
            });

        console.log('Firebase initialized in leaderboard.js');
        isInitialized = true;
        
        // Initialize leaderboard after Firebase is ready
        initializeLeaderboard();

        return true;
    } catch (error) {
        console.error("Error initializing Firebase in leaderboard.js:", error);
        return false;
    }
}

function initializeLeaderboard() {
    try {
        leaderboard = Leaderboard.getInstance();
        // Expose leaderboard instance and getter to window
        window.leaderboard = leaderboard;
        window.getLeaderboard = () => leaderboard;
        console.log('Leaderboard initialized and exposed to window');
        
        // Set up auth state listener
        auth.onAuthStateChanged((user) => {
            if (user && !user.isAnonymous && user.email) {
                console.log('Fully authenticated user is signed in:', user.email);
                leaderboard.updateLeaderboardDisplay();
            } else {
                console.log('User is either signed out, anonymous, or lacks email verification');
                // Still update display to show the sign-in message
                leaderboard.updateLeaderboardDisplay();
            }
        });
    } catch (error) {
        console.error('Error initializing leaderboard:', error);
    }
}

// Try to initialize immediately if Firebase is already loaded
if (typeof firebase !== 'undefined') {
    initializeFirebase().catch(error => {
        console.error('Failed to initialize Firebase:', error);
    });
}

// Also listen for the firebaseReady event as a backup
document.addEventListener('firebaseReady', () => {
    if (!isInitialized) {
        initializeFirebase().catch(error => {
            console.error('Failed to initialize Firebase on firebaseReady event:', error);
        });
    }
});

// Retry initialization if it fails
let retryCount = 0;
const maxRetries = 5;
async function retryInitialization() {
    if (!isInitialized && retryCount < maxRetries) {
        console.log(`Retrying Firebase initialization (attempt ${retryCount + 1}/${maxRetries})`);
        retryCount++;
        setTimeout(async () => {
            try {
                const success = await initializeFirebase();
                if (success) {
                    console.log('Firebase initialization successful on retry');
                } else if (retryCount < maxRetries) {
                    retryInitialization();
                }
            } catch (error) {
                console.error('Error during retry:', error);
                if (retryCount < maxRetries) {
                    retryInitialization();
                }
            }
        }, 1000 * retryCount); // Exponential backoff
    }
}

// Start retry process if initial load fails
initializeFirebase().catch(() => {
    retryInitialization();
});
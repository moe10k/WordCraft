// server.js

// Imports and Initial Setup
require('dotenv').config(); // Load environment variables
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
app.use(express.static('public'));

// Add endpoint to serve Firebase config securely
app.get('/api/firebase-config', (req, res) => {
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  };
  res.json(firebaseConfig);
});

// Global Variables
// Note: scores, lives, currentPlayerTurn, and gameInProgress are now managed per-lobby
// Keeping some for backward compatibility but they're not actively used in the lobby system
let userMap = {};
let totalPlayers = 0; // Kept for tracking total connected players
let playerTimer = {};

// Add authentication tracking
let authenticatedUsers = {}; // { socketId: { uid, displayName, email, photoURL } }

// Lobby System
let lobbies = {};  // { lobbyId: { players: {}, gameState: {}, inProgress: false } }
let playerLobbies = {};  // { socketId: lobbyId }

function createLobby(socket) {
    const lobbyId = Math.random().toString(36).substring(2, 8).toUpperCase();
    lobbies[lobbyId] = {
        players: {},
        gameState: {
            scores: {},
            lives: {},
            currentLetters: generateRandomLetters(),
            currentPlayerTurn: null,
            readyPlayers: 0
        },
        inProgress: false
    };
    joinLobby(socket, lobbyId);
    return lobbyId;
}

function joinLobby(socket, lobbyId) {
    if (!lobbies[lobbyId]) {
        socket.emit('lobbyError', 'Lobby does not exist');
        return false;
    }
    if (lobbies[lobbyId].inProgress) {
        socket.emit('lobbyError', 'Game already in progress');
        return false;
    }
    
    // Get username from userMap
    const username = userMap[socket.id];
    if (!username) {
        socket.emit('lobbyError', 'Please set a username first');
        return false;
    }
    
    // Check for duplicate names in the target lobby
    const isDuplicateName = Object.values(lobbies[lobbyId].players)
        .some(player => player.name === username);
    if (isDuplicateName) {
        socket.emit('lobbyError', 'Username already exists in this lobby');
        return false;
    }
    
    // Remove player from previous lobby if any
    if (playerLobbies[socket.id]) {
        leaveLobby(socket);
    }
    
    playerLobbies[socket.id] = lobbyId;
    lobbies[lobbyId].players[socket.id] = { name: username, ready: false };
    
    // Immediately send current lobby state to the new player
    const playerStatus = Object.entries(lobbies[lobbyId].players).map(([_, player]) => ({
        name: player.name,
        ready: player.ready
    }));
    socket.emit('lobbyUpdate', {
        lobbyId,
        players: playerStatus
    });
    
    // Then notify all players in the lobby about the new player
    updateLobbyPlayers(lobbyId);
    return true;
}

function leaveLobby(socket) {
    const lobbyId = playerLobbies[socket.id];
    if (lobbyId && lobbies[lobbyId]) {
        // Clear timer for this player
        clearPlayerTimer(socket.id);
        
        // If this player was the current turn, move to next player
        const lobby = lobbies[lobbyId];
        if (lobby.inProgress && lobby.gameState.currentPlayerTurn === socket.id) {
            checkAndProceedToNextTurn(lobbyId);
        }
        
        delete lobbies[lobbyId].players[socket.id];
        delete playerLobbies[socket.id];
        
        // If lobby is empty, delete it
        if (Object.keys(lobbies[lobbyId].players).length === 0) {
            delete lobbies[lobbyId];
        } else {
            updateLobbyPlayers(lobbyId);
        }
    }
}

function updateLobbyPlayers(lobbyId) {
    if (!lobbies[lobbyId]) return;
    
    const playerStatus = Object.entries(lobbies[lobbyId].players).map(([socketId, player]) => ({
        name: player.name,
        ready: player.ready
    }));
    
    io.to(lobbyId).emit('lobbyUpdate', {
        lobbyId,
        players: playerStatus
    });
}

// Helper Functions
function generateRandomLetters() { // Generates two random letters for the current round of the game
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomIndex1 = Math.floor(Math.random() * alphabet.length);
    let randomIndex2;
    do {
        randomIndex2 = Math.floor(Math.random() * alphabet.length);
    } while (randomIndex1 === randomIndex2);
    return alphabet[randomIndex1] + alphabet[randomIndex2];
}

function logAllPlayers() { 
    const playerList = Object.entries(userMap).map(([socketId, username]) => {
        return username || 'not set';
    }).join(', ');
    
    log(`Current Players: ${playerList}`, 'logAllPlayers');
}

function updateAllPlayers() { // Updates all connected players with the current game state (letters, scores, lives)
    // Instead of broadcasting all players to everyone, we'll send personalized lists to each player
    
    // For each connected socket
    Object.keys(userMap).forEach(socketId => {
        const socket = io.sockets.sockets.get(socketId);
        if (!socket) return; // Skip if socket is no longer connected
        
        // Check if player is in a lobby
        const lobbyId = playerLobbies[socketId];
        
        if (lobbyId && lobbies[lobbyId]) {
            // If in a lobby, only show players from same lobby - this is already handled by updateLobbyPlayers
            // No need to do anything here, as updateLobbyPlayers is called whenever lobby state changes
        } else {
            // If not in a lobby, only show this player
            const username = userMap[socketId];
            if (username) {
                const soloPlayerList = [{
                    name: username,
                    ready: false
                }];
                
                socket.emit('playerListUpdate', soloPlayerList);
            }
        }
    });
    
    // Game data is now handled per-lobby, so we don't need global game state broadcasting
}

function handleError(socket, error, context = '') { // Logs an error to the console and emits an error message to the client
    const errorMessage = context 
        ? `Error in ${context}: ${error.message || error}` 
        : `Error: ${error.message || error}`;
    
    console.error(errorMessage);
    if (socket) {
        socket.emit('error', 'An error occurred. Please try again.');
    }
}

function log(message, context = '') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${context ? `[${context}] ` : ''}${message}`);
}

// Socket Event Handlers
function guessHandler(socket) {
    return async function (word) {
        try {
            if (!canPlayerGuess(socket)) return;

            const lobbyId = playerLobbies[socket.id];
            if (!lobbyId) return;

            const isValid = await handleGuessValidation(socket, word);
            clearPlayerTimer(socket.id);

            if (!isValid) {
                handleInvalidGuess(socket);
            } else {
                handleValidGuess(socket, word);
            }

            checkAndProceedToNextTurn(lobbyId);
        } catch (error) {
            handleError(socket, error, 'guessHandler');
        }
    };
}

function canPlayerGuess(socket) {
    const lobbyId = playerLobbies[socket.id];
    const lobby = lobbies[lobbyId];
    
    if (!lobby || !lobby.inProgress) {
        socket.emit('actionBlocked', 'The game is not in progress.');
        return false;
    }

    if (socket.id !== lobby.gameState.currentPlayerTurn) {
        socket.emit('actionBlocked', 'Wait for your turn.');
        return false;
    }

    // Get username from userMap
    const username = userMap[socket.id];
    if (!username) {
        socket.emit('actionBlocked', 'Username not found.');
        return false;
    }

    const playerLives = lobby.gameState.lives[username];
    if (!playerLives || playerLives <= 0) {
        socket.emit('actionBlocked', 'You have no lives remaining.');
        return false;
    }

    return true;
}

async function handleGuessValidation(socket, word) {
    const lobbyId = playerLobbies[socket.id];
    const lobby = lobbies[lobbyId];
    if (!lobby) return false;

    if (!isValidGuessInput(socket, word)) {
        return false;
    }

    const isValidWord = await checkWordValidity(word);
    if (isValidWord && isValidGuess(word, lobby.gameState.currentLetters)) {
        return true;
    }
    return false;
}

function updatePlayerStatus() { // Updates all connected players with the current player status (ready or not)
    // Note: This function is currently not used in the lobby system
    // The lobby system uses updateLobbyPlayers instead
    // Keeping this for backward compatibility but it may not work correctly with current userMap structure
    const playerStatus = Object.entries(userMap).map(([socketId, username]) => {
        const lobbyId = playerLobbies[socketId];
        const ready = lobbyId && lobbies[lobbyId] ? lobbies[lobbyId].players[socketId]?.ready || false : false;
        return {
            name: username,
            ready: ready
        };
    });
    io.emit('playerStatusUpdate', playerStatus);
}

function setPlayerReady(socket, isReady) {
    try {
        const lobbyId = playerLobbies[socket.id];
        if (!lobbyId || !lobbies[lobbyId]) {
            socket.emit('actionBlocked', 'You must be in a lobby to ready up.');
            return;
        }
        
        if (lobbies[lobbyId].inProgress) {
            socket.emit('actionBlocked', 'Game in progress. Wait for the next round.');
            return;
        }
        
        // Get username from userMap instead of socket.username
        const username = userMap[socket.id] || 'Unknown player';
        
        log(`${username} is ${isReady ? 'Ready' : 'Unready'}!`, 'setPlayerReady');
        lobbies[lobbyId].players[socket.id].ready = isReady;
        
        // Update lobby state
        updateLobbyPlayers(lobbyId);
        
        // Check if all players are ready to start the game
        checkLobbyPlayersReady(lobbyId);
    } catch (error) {
        handleError(socket, error, 'setPlayerReady');
    }
}

function checkLobbyPlayersReady(lobbyId) {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;
    
    const players = Object.values(lobby.players);
    const allReady = players.length > 1 && players.every(player => player.ready);
    
    if (allReady) {
        lobby.inProgress = true;
        lobby.gameState.currentLetters = generateRandomLetters();
        
        // Initialize game state for the lobby
        const playerIds = Object.keys(lobby.players);
        lobby.gameState.currentPlayerTurn = playerIds[Math.floor(Math.random() * playerIds.length)];
        
        // Initialize scores and lives for all players in the lobby
        playerIds.forEach(playerId => {
            const playerName = lobby.players[playerId].name;
            lobby.gameState.scores[playerName] = 0;
            lobby.gameState.lives[playerName] = 3;
        });
        
        // Notify all players in the lobby that the game has started
        io.to(lobbyId).emit('gameUpdate', {
            letters: lobby.gameState.currentLetters,
            scores: lobby.gameState.scores,
            lives: lobby.gameState.lives,
            gameStarted: true
        });
        
        // Reset ready status
        Object.values(lobby.players).forEach(player => player.ready = false);
        updateLobbyPlayers(lobbyId);
        
        // Start the first turn
        emitLobbyCurrentTurn(lobbyId);
        startPlayerTimer(lobby.gameState.currentPlayerTurn, lobbyId);
    }
}

function emitLobbyCurrentTurn(lobbyId) {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;
    
    const currentUsername = lobby.players[lobby.gameState.currentPlayerTurn]?.name || 'Unknown';
    io.to(lobbyId).emit('turnUpdate', currentUsername);
    log(`Current player's turn in lobby ${lobbyId}: ${currentUsername}`, 'emitLobbyCurrentTurn');
}

// DEPRECATED: This function is no longer used in the lobby system
// Each lobby manages its own state via resetLobby()
// Keeping for reference but not called anywhere
/*
function resetPlayerState() { // Resets the game state for all players and notifies them to reset their UI
    try {
        log(`Resetting game state for all players.`,'resetPlayerState');
        scores = {}; // Reset scores
        lives = {}; // Reset lives
        userMap = {}; // Reset user map
        totalPlayers = 0; // Reset player count
        readyPlayers = 0; // Reset ready player count
        gameInProgress = false; // Set game status to not in progress
        currentPlayerTurn = null; // Clear current player turn
        currentLetters = generateRandomLetters(); // Reset letters for a new game

        // Clear all player timers
        Object.keys(playerTimer).forEach(timerId => {
            clearInterval(playerTimer[timerId]); // Use clearInterval to reset player timers
        });
        playerTimer = {}; // Reset the timer object

        updateAllPlayers();
        updatePlayerStatus();
        io.emit('gameReset'); // Notify all clients to reset their UI
        logAllPlayers();
    } catch (error) {
        console.error('Error resetting player state:', error);
    }
}
*/

function checkAndProceedToNextTurn(lobbyId) {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;

    // Clear any existing timer
    if (lobby.gameState.currentPlayerTurn) {
        clearPlayerTimer(lobby.gameState.currentPlayerTurn);
    }

    // Get players with lives
    const playersWithLives = Object.entries(lobby.players)
        .filter(([_, player]) => lobby.gameState.lives[player.name] > 0)
        .map(([id]) => id);

    if (playersWithLives.length <= 1) {
        if (playersWithLives.length === 1) {
            const winnerName = lobby.players[playersWithLives[0]].name;
            io.to(lobbyId).emit('gameWin', winnerName);
        } else {
            // Edge case: no players with lives (shouldn't happen, but safety check)
            log('No players with lives remaining in lobby ' + lobbyId, 'checkAndProceedToNextTurn');
        }
        resetLobby(lobbyId);
        return;
    }

    // Find next player
    const currentIndex = playersWithLives.indexOf(lobby.gameState.currentPlayerTurn);
    const nextIndex = (currentIndex + 1) % playersWithLives.length;
    lobby.gameState.currentPlayerTurn = playersWithLives[nextIndex];

    // Start timer for next player
    emitLobbyCurrentTurn(lobbyId);
    startPlayerTimer(lobby.gameState.currentPlayerTurn, lobbyId);
}

// NOTE: This function is deprecated and not used in the lobby system.
// The lobby system uses checkAndProceedToNextTurn instead.
// Keeping this commented out for reference, but it references old global variables
// that don't exist in the lobby-based architecture.
/*
function moveToNextPlayerTurn(playerIds) {
    try {
        // Find the index of the current player in the active players array
        let currentIndex = playerIds.indexOf(currentPlayerTurn);
        
        // If current player isn't in the array (already out), start from beginning
        if (currentIndex === -1) currentIndex = 0;
        
        clearPlayerTimer(currentPlayerTurn);

        let nextPlayerFound = false;
        let attempts = 0;
        
        // Loop to find the next valid player
        while (!nextPlayerFound && attempts < playerIds.length) {
            currentIndex = (currentIndex + 1) % playerIds.length;
            const nextPlayerId = playerIds[currentIndex];
            
            // Verify player exists and has lives
            if (userMap[nextPlayerId] && lives[userMap[nextPlayerId]] > 0) {
                currentPlayerTurn = nextPlayerId;
                nextPlayerFound = true;
            }
            
            attempts++;
        }

        if (!nextPlayerFound) {
            log("All players are out of lives. Game Over.", 'moveToNextPlayerTurn');
            currentPlayerTurn = null;
            gameInProgress = false;
            io.emit('gameOver', 'All players are out of lives. Game Over!');
        } else {
            emitCurrentTurn();
            startPlayerTimer(currentPlayerTurn);
        }
    } catch (error) {
        handleError(null, error, 'moveToNextPlayerTurn');
    }
}
*/

// DEPRECATED: This function is no longer used in the lobby system
// The lobby system uses canPlayerGuess() instead which checks lobby-specific state
// Keeping for reference but not called anywhere
/*
function isPlayersTurn(socket) { // Checks if it is the player's turn to guess
    if (!gameInProgress) {
        socket.emit('actionBlocked', 'The game is not in progress.');
        return false;
    }
    if (socket.id !== currentPlayerTurn) {
        socket.emit('actionBlocked', 'Wait for your turn.');
        return false;
    }
    return true;
}
*/

function hasPlayerLives(socket) { // Checks if the player has any lives remaining
    // Get username from userMap
    const username = userMap[socket.id];
    
    // Check if the player has lives in the correct lobby
    const lobbyId = playerLobbies[socket.id];
    if (!lobbyId || !lobbies[lobbyId]) {
        socket.emit('actionBlocked', 'You must be in a game to make a guess.');
        return false;
    }
    
    // Get current lives from the lobby game state
    if (lobbies[lobbyId].gameState.lives[username] <= 0) {
        socket.emit('actionBlocked', 'You have no lives remaining.');
        console.log(`${username} has no more lives. Guess ignored.`);
        return false;
    }
    return true;
}

function handleInvalidGuess(socket) {
    const lobbyId = playerLobbies[socket.id];
    const lobby = lobbies[lobbyId];
    if (!lobby) return;

    // Get username from userMap
    const username = userMap[socket.id];
    if (!username) {
        console.error(`Username not found for socket ${socket.id}`);
        return;
    }

    const gameState = lobby.gameState;
    socket.emit('invalidWord', 'The word is not valid');
    gameState.lives[username] = (gameState.lives[username] || 1) - 1;
    
    // Update all players in the lobby
    io.to(lobbyId).emit('gameUpdate', {
        letters: gameState.currentLetters,
        scores: gameState.scores,
        lives: gameState.lives,
        gameStarted: true
    });

    if (gameState.lives[username] <= 0) {
        socket.emit('gameOver');
    }
}

function handleValidGuess(socket, word) {
    const lobbyId = playerLobbies[socket.id];
    const lobby = lobbies[lobbyId];
    if (!lobby) return;

    // Get username from userMap
    const username = userMap[socket.id];
    if (!username) {
        console.error(`Username not found for socket ${socket.id}`);
        return;
    }

    const gameState = lobby.gameState;
    gameState.scores[username] = (gameState.scores[username] || 0) + 1;
    gameState.currentLetters = generateRandomLetters();
    
    // Update all players in the lobby
    io.to(lobbyId).emit('gameUpdate', {
        letters: gameState.currentLetters,
        scores: gameState.scores,
        lives: gameState.lives,
        gameStarted: true
    });
}

function isValidGuessInput(socket, word) { // Validates the player's guess input
    if (!word || typeof word !== 'string' || word.trim().length === 0) {
        socket.emit('invalidWord', 'Invalid guess.');
        return false;
    }
    return true;
}

async function checkWordValidity(word) {
    try {
        // First attempt - Datamuse API
        const response = await axios.get(`https://api.datamuse.com/words?sp=${word}&md=d`, {
            timeout: 3000 // Add timeout to prevent hanging
        });
        
        if (response.data.length > 0 && response.data[0].word === word) {
            return true;
        }
        
        // Fall back to a basic dictionary check if available
        // This is a placeholder - you might want to implement a local dictionary
        if (word.length > 2) {
            // Simple validation for demonstration - allow words longer than 2 chars
            // In production you'd want a more robust fallback
            return true;
        }
        
        log(`Word validation failed for: ${word}`, 'checkWordValidity');
        return false;
    } catch (error) {
        log(`Error validating word: ${word}, Error: ${error.message}`, 'checkWordValidity');
        // Graceful degradation - if API fails, accept the word if it meets basic criteria
        // In production, you might want a more sophisticated fallback
        if (word.length > 2) {
            log(`Word accepted by fallback validation: ${word}`, 'checkWordValidity');
            return true;
        }
        return false;
    }
}

function isValidGuess(word, letters) { // Checks if the guessed word contains the required letters
    const [letter1, letter2] = letters.split('');
    const upperWord = word.toUpperCase();
    return upperWord.includes(letter1) && upperWord.includes(letter2);
}

function typingHandler(socket) { // Handles a player typing a message and broadcasts it to all other players
    return function({ username, text }) {
        try {
            socket.broadcast.emit('playerTyping', { username, text });
        } catch (error) {
            console.error('Error in typingHandler:', error);
        }
    };
}

function handlePlayerDisconnect(socket) {
    try {
        const lobbyId = playerLobbies[socket.id];
        if (!lobbyId || !lobbies[lobbyId]) return;

        const lobby = lobbies[lobbyId];
        const wasCurrentPlayerTurn = socket.id === lobby.gameState.currentPlayerTurn;
        
        // Clear the timer for this player
        clearPlayerTimer(socket.id);
        
        // Get username from userMap
        const username = userMap[socket.id];
        
        // Remove player from game state
        if (username) {
            delete lobby.gameState.scores[username];
            delete lobby.gameState.lives[username];
        }
        
        // Remove player from lobby
        delete lobby.players[socket.id];
        delete playerLobbies[socket.id];

        // Immediately update all remaining players with new game state
        if (lobby.inProgress) {
            io.to(lobbyId).emit('gameUpdate', {
                letters: lobby.gameState.currentLetters,
                scores: lobby.gameState.scores,
                lives: lobby.gameState.lives,
                gameStarted: true
            });
        }
        
        // Update lobby player list
        updateLobbyPlayers(lobbyId);

        // Handle turn transition if this was the current player's turn
        if (wasCurrentPlayerTurn && lobby.inProgress) {
            checkAndProceedToNextTurn(lobbyId);
        }
        
        // Check if only one player remains
        const remainingPlayers = Object.keys(lobby.players);
        if (remainingPlayers.length === 1 && lobby.inProgress) {
            const lastPlayer = lobby.players[remainingPlayers[0]];
            io.to(lobbyId).emit('gameWin', lastPlayer.name);
            resetLobby(lobbyId);
        }
        
        // Delete lobby if empty
        if (remainingPlayers.length === 0) {
            delete lobbies[lobbyId];
        }

        log(`Player ${username || socket.id} disconnected from lobby ${lobbyId}`, 'handlePlayerDisconnect');
    } catch (error) {
        handleError(null, error, 'handlePlayerDisconnect');
    }
}

function startPlayerTimer(socketId, lobbyId) {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;

    // Clear any existing timer and delete reference
    if (playerTimer[socketId]) {
        clearInterval(playerTimer[socketId]);
        delete playerTimer[socketId];
    }
    
    let remainingTime = 10;

    playerTimer[socketId] = setInterval(() => {
        try {
            // Check if lobby and player still exist before proceeding
            const currentLobby = lobbies[lobbyId];
            if (!currentLobby || !currentLobby.players[socketId]) {
                // Player or lobby no longer exists, clean up timer
                clearInterval(playerTimer[socketId]);
                delete playerTimer[socketId];
                return;
            }
            
            if (remainingTime > 0) {
                remainingTime--;
                io.to(lobbyId).emit('timerUpdate', remainingTime);
            } else {
                clearInterval(playerTimer[socketId]);
                delete playerTimer[socketId];
                
                // Double-check lobby and player still exist before modifying game state
                const finalLobby = lobbies[lobbyId];
                if (!finalLobby || !finalLobby.players[socketId]) {
                    return;
                }
                
                const username = finalLobby.players[socketId]?.name;
                if (username && finalLobby.gameState.lives[username] !== undefined) {
                    finalLobby.gameState.lives[username]--;
                    
                    io.to(lobbyId).emit('gameUpdate', {
                        letters: finalLobby.gameState.currentLetters,
                        scores: finalLobby.gameState.scores,
                        lives: finalLobby.gameState.lives,
                        gameStarted: true
                    });

                    if (finalLobby.gameState.lives[username] <= 0) {
                        io.to(socketId).emit('gameOver');
                    }
                }
                
                // Only proceed to next turn if lobby still exists
                if (lobbies[lobbyId]) {
                    checkAndProceedToNextTurn(lobbyId);
                }
                io.to(lobbyId).emit('timerUpdate', null);
            }
        } catch (error) {
            // Handle any errors in timer callback
            log(`Error in player timer for ${socketId}: ${error.message}`, 'startPlayerTimer');
            clearInterval(playerTimer[socketId]);
            delete playerTimer[socketId];
        }
    }, 1000);
}

function clearPlayerTimer(socketId) { // Clears the timer for a player's turn
    if (playerTimer[socketId]) {
        clearInterval(playerTimer[socketId]);
        delete playerTimer[socketId]; // Delete reference to prevent memory leak
    }
    // Only emit to the specific lobby if the player is in one
    const lobbyId = playerLobbies[socketId];
    if (lobbyId && lobbies[lobbyId]) {
        io.to(lobbyId).emit('timerUpdate', null);
        io.to(lobbyId).emit('typingCleared');
    } else {
        // Fallback to global emit if not in a lobby (shouldn't happen in current system)
        io.emit('timerUpdate', null);
        io.emit('typingCleared');
    }
}

function handleFreeSkip(socket) {
    try {
        const lobbyId = playerLobbies[socket.id];
        const lobby = lobbies[lobbyId];
        if (!lobby || socket.id !== lobby.gameState.currentPlayerTurn) {
            socket.emit('actionBlocked', 'You can only skip on your turn.');
            return;
        }

        lobby.gameState.currentLetters = generateRandomLetters();
        io.to(lobbyId).emit('gameUpdate', {
            letters: lobby.gameState.currentLetters,
            scores: lobby.gameState.scores,
            lives: lobby.gameState.lives,
            gameStarted: true
        });
        
        checkAndProceedToNextTurn(lobbyId);
    } catch (error) {
        handleError(socket, error, 'handleFreeSkip');
    }
}

function resetLobby(lobbyId) {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;

    lobby.inProgress = false;
    lobby.gameState = {
        scores: {},
        lives: {},
        currentLetters: generateRandomLetters(),
        currentPlayerTurn: null,
        readyPlayers: 0
    };

    // Clear all timers for the lobby
    Object.keys(lobby.players).forEach(playerId => {
        if (playerTimer[playerId]) {
            clearInterval(playerTimer[playerId]);
            delete playerTimer[playerId]; // Clean up timer reference
        }
    });

    // Reset ready status
    Object.values(lobby.players).forEach(player => player.ready = false);
    
    // Update clients
    io.to(lobbyId).emit('gameReset');
    updateLobbyPlayers(lobbyId);
}

// Add this function to check for and remove stale sessions
function checkForStaleSessions(username) {
    // Look for any socket IDs that have this username
    const existingSockets = Object.entries(userMap)
        .filter(([_, existingUsername]) => existingUsername === username)
        .map(([socketId, _]) => socketId);
    
    if (existingSockets.length > 0) {
        log(`Found ${existingSockets.length} potential stale sessions for username: ${username}`, 'checkForStaleSessions');
        
        // Check if these sockets are still connected
        existingSockets.forEach(socketId => {
            if (!socketId) return; // Null check
            
            const socket = io.sockets.sockets.get(socketId);
            if (!socket || !socket.connected) {
                log(`Cleaning up stale session: ${socketId}`, 'checkForStaleSessions');
                
                // Clean up all references to this socket
                if (userMap[socketId]) {
                    delete userMap[socketId];
                }
                // Note: scores and lives are now managed per-lobby, not globally
                if (authenticatedUsers[socketId]) {
                    delete authenticatedUsers[socketId];
                }
                
                // Clean up timer if exists
                if (playerTimer[socketId]) {
                    clearPlayerTimer(socketId);
                }
                
                // Clean up from lobbies
                const lobbyId = playerLobbies[socketId];
                if (lobbyId && lobbies[lobbyId]) {
                    // Clear timer before removing from lobby
                    clearPlayerTimer(socketId);
                    
                    delete lobbies[lobbyId].players[socketId];
                    delete playerLobbies[socketId];
                    
                    // If lobby is empty, delete it
                    if (Object.keys(lobbies[lobbyId].players).length === 0) {
                        delete lobbies[lobbyId];
                    } else {
                        updateLobbyPlayers(lobbyId);
                    }
                }
            }
        });
    }
}

// Socket Connection
io.on('connection', (socket) => {
    log(`New connection: ${socket.id}`, 'socketConnection');
    
    // Handle user authentication
    socket.on('userAuthenticated', (userData) => {
        log(`User authenticated: ${userData.displayName} (${userData.uid})`);
        // Store authenticated user data
        authenticatedUsers[socket.id] = userData;
    });
    
    socket.on('userSignedOut', () => {
        // Handle player disconnect (includes lobby cleanup)
        handlePlayerDisconnect(socket);
        
        // Clean up global player data
        if (userMap[socket.id]) {
            log(`Cleaning up signed out player: ${userMap[socket.id]} (${socket.id})`, 'userSignedOut');
            delete userMap[socket.id];
            // Note: scores and lives are now managed per-lobby, not globally
            if (authenticatedUsers[socket.id]) {
                delete authenticatedUsers[socket.id];
            }
            totalPlayers = Math.max(0, totalPlayers - 1);
            
            // Notify all remaining clients to update their player lists
            updateAllPlayers();
        }
        
        // Instead of disconnecting, just emit a success event
        socket.emit('signOutComplete');
    });
    
    // Update setUsername handler
    socket.on('setUsername', (data) => {
        let username;
        let isAuthenticated = false;
        let uid = null;
        
        // Check if we received an object (new format) or string (old format for backward compatibility)
        if (typeof data === 'object') {
            username = data.username;
            isAuthenticated = data.authenticated;
            uid = data.uid;
        } else {
            username = data; // Old format - just a username string
        }
        
        if (!username || typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 20) {
            socket.emit('usernameError', 'Invalid username. Must be 3-20 characters long.');
            return;
        }
        
        // Attempt to clean up any stale sessions with this username
        checkForStaleSessions(username);
        
        // Check for existing username again after cleaning stale sessions
        const isUsernameTaken = Object.values(userMap).includes(username);
        if (isUsernameTaken) {
            socket.emit('usernameError', 'Username already taken');
            return;
        }
        
        userMap[socket.id] = username;
        log(`Username set: ${username} (${socket.id}) - Authenticated: ${isAuthenticated}`);
        // Note: scores and lives are now initialized per-lobby when game starts, not globally
        totalPlayers++;
        
        // If the user is authenticated, store additional info
        if (isAuthenticated && uid) {
            log(`Linking authenticated user ${uid} with socket ${socket.id}`);
            // You could store additional info here if needed
        }
        
        socket.emit('usernameSet', username);
        socket.emit('lobbyControlsShow');
        updateAllPlayers();
    });
    
    socket.on('guess', guessHandler(socket));
    socket.on('ready', (isReady) => setPlayerReady(socket, isReady));
    socket.on('typing', typingHandler(socket));
    socket.on('clearTyping', () => {
        const lobbyId = playerLobbies[socket.id];
        if (lobbyId && lobbies[lobbyId]) {
            io.to(lobbyId).emit('typingCleared');
        } else {
            socket.broadcast.emit('typingCleared');
        }
    });
    socket.on('freeSkip', () => handleFreeSkip(socket));
    
    // Lobby System Events
    socket.on('createLobby', () => {
        // Check if username is set using userMap
        if (!userMap[socket.id]) {
            socket.emit('lobbyError', 'Please set a username first');
            return;
        }
        const lobbyId = createLobby(socket);
        socket.join(lobbyId);
        socket.emit('lobbyCreated', lobbyId);
    });
    
    socket.on('joinLobby', (lobbyId) => {
        // Check if username is set using userMap
        if (!userMap[socket.id]) {
            socket.emit('lobbyError', 'Please set a username first');
            return;
        }
        if (joinLobby(socket, lobbyId)) {
            socket.join(lobbyId);
            socket.emit('lobbyJoined', lobbyId);
        }
    });
    
    socket.on('leaveLobby', () => {
        const lobbyId = playerLobbies[socket.id];
        if (lobbyId) {
            socket.leave(lobbyId);
            leaveLobby(socket);
            socket.emit('lobbyLeft');
        }
    });
    
    socket.on('resetGameRequest', () => {
        const lobbyId = playerLobbies[socket.id];
        if (lobbyId && lobbies[lobbyId]) {
            resetLobby(lobbyId);
            log(`Game reset requested by ${userMap[socket.id] || socket.id} in lobby ${lobbyId}`, 'resetGameRequest');
        } else {
            socket.emit('lobbyError', 'You are not in a lobby');
        }
    });
    
    socket.on('disconnect', () => {
        // Handle player disconnect (includes lobby cleanup)
        handlePlayerDisconnect(socket);
        
        // Clean up global player data
        if (userMap[socket.id]) {
            log(`Cleaning up disconnected player: ${userMap[socket.id]} (${socket.id})`, 'disconnect');
            delete userMap[socket.id];
            // Note: scores and lives are now managed per-lobby, not globally
            if (authenticatedUsers[socket.id]) {
                delete authenticatedUsers[socket.id];
            }
            totalPlayers = Math.max(0, totalPlayers - 1);
            
            // Notify all remaining clients to update their player lists
            updateAllPlayers();
        }
    });

    // Add this event handler for when a client requests their player list
    socket.on('requestPlayerList', () => {
        // Send this player only their own player info
        if (userMap[socket.id]) {
            const soloPlayerList = [{
                name: userMap[socket.id],
                ready: false
            }];
            
            socket.emit('playerListUpdate', soloPlayerList);
        }
    });
});

// Server Initialization
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    log(`Server is running on port ${PORT}`, 'server.listen');
});
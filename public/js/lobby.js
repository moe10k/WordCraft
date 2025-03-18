// Lobby.js - Handles the lobby functionality
// This file manages the lobby UI, socket events, and lobby management

// DOM Elements
const lobbyContainer = document.getElementById('lobby-container');
const lobbyNameElement = document.getElementById('lobby-name');
const playersContainer = document.getElementById('lobby-players-container');
const readyBtn = document.getElementById('ready-btn');
const startGameBtn = document.getElementById('start-game-btn');
const leaveLobbyBtn = document.getElementById('leave-lobby-btn');
const chatContainer = document.getElementById('lobby-chat-container');
const chatMessages = document.getElementById('lobby-chat-messages');
const chatInput = document.getElementById('lobby-chat-input');
const chatSendBtn = document.getElementById('lobby-chat-send-btn');
const lobbySettingsBtn = document.getElementById('lobby-settings-btn');
const lobbySettingsModal = document.getElementById('lobby-settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const lobbySettingsForm = document.getElementById('lobby-settings-form');
const lobbyCodeElement = document.getElementById('lobby-code');
const copyCodeBtn = document.getElementById('copy-code-btn');
const lobbyMessageElement = document.getElementById('lobby-message');

// Lobby state variables
let lobbyId = null;
let lobbyData = null;
let isHost = false;
let isReady = false;
let players = [];
let user = null;

// Get the socket instance from socket.js
const socket = getSocket();

// Initialize the lobby
function initLobby() {
    // Get the lobby ID from the URL
    const urlParams = new URLSearchParams(window.location.search);
    lobbyId = urlParams.get('id');
    
    if (!lobbyId) {
        showMessage('Lobby ID not found. Redirecting to menu...', 'error');
        setTimeout(() => {
            window.location.href = '/menu.html';
        }, 3000);
        return;
    }
    
    // Get user data from localStorage
    user = JSON.parse(localStorage.getItem('user'));
    
    if (!user) {
        showMessage('User not logged in. Redirecting to login...', 'error');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 3000);
        return;
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Join the lobby room
    joinLobby();
    
    // Load lobby data
    loadLobbyData();
}

// Set up event listeners
function setupEventListeners() {
    // Ready button
    readyBtn.addEventListener('click', toggleReady);
    
    // Start game button
    startGameBtn.addEventListener('click', startGame);
    
    // Leave lobby button
    leaveLobbyBtn.addEventListener('click', leaveLobby);
    
    // Chat send button
    chatSendBtn.addEventListener('click', sendChatMessage);
    
    // Chat input - send on Enter key
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
    
    // Lobby settings button
    lobbySettingsBtn.addEventListener('click', () => {
        lobbySettingsModal.style.display = 'flex';
    });
    
    // Close settings button
    closeSettingsBtn.addEventListener('click', () => {
        lobbySettingsModal.style.display = 'none';
    });
    
    // Lobby settings form
    lobbySettingsForm.addEventListener('submit', updateLobbySettings);
    
    // Copy lobby code button
    copyCodeBtn.addEventListener('click', copyLobbyCode);
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === lobbySettingsModal) {
            lobbySettingsModal.style.display = 'none';
        }
    });
}

// Join the lobby room
function joinLobby() {
    socket.emit('lobby:join', lobbyId);
}

// Load lobby data from the server
function loadLobbyData() {
    fetch(`/api/lobby/${lobbyId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateLobbyData(data.lobby);
        } else {
            showMessage(data.message || 'Failed to load lobby data', 'error');
        }
    })
    .catch(error => {
        console.error('Error loading lobby data:', error);
        showMessage('Error loading lobby data. Please try again.', 'error');
    });
}

// Update the lobby data and UI
function updateLobbyData(lobby) {
    lobbyData = lobby;
    players = lobby.players;
    isHost = lobby.host === user._id;
    
    // Find the current player in the lobby
    const currentPlayer = players.find(player => player._id === user._id);
    isReady = currentPlayer ? currentPlayer.isReady : false;
    
    // Update UI
    updateLobbyUI();
}

// Update the lobby UI
function updateLobbyUI() {
    // Update lobby name
    lobbyNameElement.textContent = lobbyData.name;
    
    // Update lobby code
    lobbyCodeElement.textContent = lobbyId;
    
    // Update players list
    updatePlayersUI();
    
    // Update buttons based on user role
    updateButtonsUI();
    
    // Update settings form if user is host
    if (isHost) {
        document.getElementById('lobby-name-input').value = lobbyData.name;
        document.getElementById('max-players-input').value = lobbyData.maxPlayers;
        document.getElementById('private-lobby-checkbox').checked = lobbyData.isPrivate;
        document.getElementById('lobby-password-input').value = lobbyData.password || '';
        
        lobbySettingsBtn.style.display = 'block';
    } else {
        lobbySettingsBtn.style.display = 'none';
    }
}

// Update the players UI
function updatePlayersUI() {
    playersContainer.innerHTML = '';
    
    players.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.className = `player-card ${player.isReady ? 'ready' : 'not-ready'}`;
        
        // Check if this is the host
        const isPlayerHost = player._id === lobbyData.host;
        
        // Check if this is the current user
        const isCurrentUser = player._id === user._id;
        
        // Create player info HTML
        playerElement.innerHTML = `
            <div class="player-name">
                ${player.username} 
                ${isPlayerHost ? '<span class="host-badge">Host</span>' : ''}
                ${isCurrentUser ? '(You)' : ''}
            </div>
            <div class="player-status">
                ${player.isReady ? 'Ready' : 'Not Ready'}
            </div>
        `;
        
        playersContainer.appendChild(playerElement);
    });
}

// Update buttons based on user role and state
function updateButtonsUI() {
    // Ready button
    readyBtn.textContent = isReady ? 'Not Ready' : 'Ready';
    readyBtn.className = isReady ? 'btn not-ready-btn' : 'btn ready-btn';
    
    // Start game button - only visible to host and only enabled if all players are ready
    if (isHost) {
        startGameBtn.style.display = 'block';
        
        // Check if all players are ready
        const allPlayersReady = players.every(player => player.isReady);
        startGameBtn.disabled = !allPlayersReady || players.length < 2;
        
        if (!allPlayersReady) {
            startGameBtn.title = 'All players must be ready to start the game';
        } else if (players.length < 2) {
            startGameBtn.title = 'Need at least 2 players to start the game';
        } else {
            startGameBtn.title = 'Start the game';
        }
    } else {
        startGameBtn.style.display = 'none';
    }
}

// Toggle ready status
function toggleReady() {
    isReady = !isReady;
    
    fetch(`/api/lobby/${lobbyId}/ready`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ isReady })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            showMessage(data.message || 'Failed to update ready status', 'error');
            isReady = !isReady; // Revert the change
        }
    })
    .catch(error => {
        console.error('Error updating ready status:', error);
        showMessage('Error updating ready status. Please try again.', 'error');
        isReady = !isReady; // Revert the change
    });
    
    // Update UI immediately for better UX
    updateButtonsUI();
}

// Start the game
function startGame() {
    if (!isHost) return;
    
    fetch(`/api/game/start/${lobbyId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Game started successfully, redirect will happen via socket event
            showMessage('Starting game...', 'success');
        } else {
            showMessage(data.message || 'Failed to start game', 'error');
        }
    })
    .catch(error => {
        console.error('Error starting game:', error);
        showMessage('Error starting game. Please try again.', 'error');
    });
}

// Leave the lobby
function leaveLobby() {
    if (confirm('Are you sure you want to leave the lobby?')) {
        fetch(`/api/lobby/${lobbyId}/leave`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                socket.emit('lobby:leave', lobbyId);
                window.location.href = '/menu.html';
            } else {
                showMessage(data.message || 'Failed to leave lobby', 'error');
            }
        })
        .catch(error => {
            console.error('Error leaving lobby:', error);
            showMessage('Error leaving lobby. Please try again.', 'error');
        });
    }
}

// Send a chat message
function sendChatMessage() {
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    socket.emit('lobby:chat', { lobbyId, message });
    chatInput.value = '';
}

// Add a chat message to the chat container
function addChatMessage(username, message, isSystem = false) {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${isSystem ? 'system-message' : ''}`;
    messageElement.innerHTML = isSystem 
        ? `<span class="system-text">${message}</span>` 
        : `<span class="chat-username">${username}:</span> <span class="chat-text">${message}</span>`;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Update lobby settings
function updateLobbySettings(e) {
    e.preventDefault();
    
    if (!isHost) return;
    
    const formData = new FormData(lobbySettingsForm);
    const settings = {
        name: formData.get('lobbyName'),
        maxPlayers: parseInt(formData.get('maxPlayers')),
        isPrivate: formData.get('isPrivate') === 'on',
        password: formData.get('lobbyPassword')
    };
    
    fetch(`/api/lobby/${lobbyId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(settings)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showMessage('Lobby settings updated successfully', 'success');
            lobbySettingsModal.style.display = 'none';
        } else {
            showMessage(data.message || 'Failed to update lobby settings', 'error');
        }
    })
    .catch(error => {
        console.error('Error updating lobby settings:', error);
        showMessage('Error updating lobby settings. Please try again.', 'error');
    });
}

// Copy lobby code to clipboard
function copyLobbyCode() {
    navigator.clipboard.writeText(lobbyId)
        .then(() => {
            showMessage('Lobby code copied to clipboard!', 'success');
        })
        .catch(err => {
            console.error('Could not copy text: ', err);
            showMessage('Failed to copy lobby code', 'error');
        });
}

// Show a message in the lobby message element
function showMessage(message, type = 'info') {
    lobbyMessageElement.textContent = message;
    lobbyMessageElement.className = `lobby-message ${type}`;
    
    // Clear the message after 5 seconds for non-error messages
    if (type !== 'error') {
        setTimeout(() => {
            lobbyMessageElement.textContent = '';
            lobbyMessageElement.className = 'lobby-message';
        }, 5000);
    }
}

// Socket event handlers
socket.on('lobby:user-joined', (data) => {
    addChatMessage('System', `${data.username} joined the lobby`, true);
});

socket.on('lobby:user-left', (data) => {
    addChatMessage('System', `${data.username} left the lobby`, true);
});

socket.on('lobby:chat-message', (data) => {
    addChatMessage(data.username, data.message);
});

socket.on('lobby:updated', (data) => {
    updateLobbyData(data.lobby);
});

socket.on('game:started', (data) => {
    window.location.href = `/game.html?id=${data.game._id}`;
});

socket.on('lobby:error', (data) => {
    showMessage(data.message, 'error');
});

// Initialize the lobby when the page loads
document.addEventListener('DOMContentLoaded', initLobby);

// Handle page unload to leave the lobby properly
window.addEventListener('beforeunload', () => {
    socket.emit('lobby:leave', lobbyId);
}); 
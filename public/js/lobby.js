// Lobby.js - Handles the lobby functionality
// This file manages the lobby UI, socket events, and lobby management

// DOM Elements
const lobbyContainer = document.querySelector('.lobby-container');
const lobbyNameElement = document.getElementById('lobby-name');
const playersContainer = document.getElementById('players-container');
const readyBtn = document.getElementById('ready-btn');
const startGameBtn = document.getElementById('start-game-btn');
const leaveLobbyBtn = document.getElementById('leave-lobby-btn');
const chatContainer = document.getElementById('chat-container');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const lobbySettingsBtn = document.getElementById('lobby-settings-btn');
const lobbySettingsModal = document.getElementById('lobby-settings-modal');
const closeModalButtons = document.querySelectorAll('.close-modal');
const lobbySettingsForm = document.getElementById('lobby-settings-form');
const lobbyCodeElement = document.getElementById('lobby-code');
const copyCodeBtn = document.getElementById('copy-code-btn');
const lobbyMessageElement = document.getElementById('lobby-message');
const loadingOverlay = document.getElementById('loading-overlay');
const onlineCountElement = document.getElementById('online-count');
const settingsPrivateLobbyCheckbox = document.getElementById('settings-private-lobby');
const settingsPasswordGroup = document.getElementById('settings-password-group');

// Lobby state variables
let lobbyId = null;
let lobbyData = null;
let isHost = false;
let isReady = false;
let players = [];
let user = null;

// Get the socket instance from socket.js
const socket = getSafeSocket();

// Initialize the lobby
function initLobby() {
    // Initialize particles
    initParticles();
    
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
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        showMessage('User data not found. Please log in again.', 'error');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 3000);
        return;
    }
    
    try {
        user = JSON.parse(userStr);
    } catch (err) {
        showMessage('Invalid user data. Please log in again.', 'error');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 3000);
        return;
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Join the lobby via socket
    joinLobby();
    
    // Load lobby data
    loadLobbyData();
}

// Initialize particles background
function initParticles() {
    particlesJS('particles-background', {
        particles: {
            number: {
                value: 80,
                density: {
                    enable: true,
                    value_area: 800
                }
            },
            color: {
                value: '#00c7fc'
            },
            shape: {
                type: 'circle',
                stroke: {
                    width: 0,
                    color: '#000000'
                },
                polygon: {
                    nb_sides: 5
                }
            },
            opacity: {
                value: 0.5,
                random: false,
                anim: {
                    enable: false,
                    speed: 1,
                    opacity_min: 0.1,
                    sync: false
                }
            },
            size: {
                value: 3,
                random: true,
                anim: {
                    enable: false,
                    speed: 40,
                    size_min: 0.1,
                    sync: false
                }
            },
            line_linked: {
                enable: true,
                distance: 150,
                color: '#00c7fc',
                opacity: 0.4,
                width: 1
            },
            move: {
                enable: true,
                speed: 2,
                direction: 'none',
                random: false,
                straight: false,
                out_mode: 'out',
                bounce: false,
                attract: {
                    enable: false,
                    rotateX: 600,
                    rotateY: 1200
                }
            }
        },
        interactivity: {
            detect_on: 'canvas',
            events: {
                onhover: {
                    enable: true,
                    mode: 'grab'
                },
                onclick: {
                    enable: true,
                    mode: 'push'
                },
                resize: true
            },
            modes: {
                grab: {
                    distance: 140,
                    line_linked: {
                        opacity: 1
                    }
                },
                bubble: {
                    distance: 400,
                    size: 40,
                    duration: 2,
                    opacity: 8,
                    speed: 3
                },
                repulse: {
                    distance: 200,
                    duration: 0.4
                },
                push: {
                    particles_nb: 4
                },
                remove: {
                    particles_nb: 2
                }
            }
        },
        retina_detect: true
    });
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
    
    // Chat input (Enter key)
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
    
    // Lobby settings button
    lobbySettingsBtn.addEventListener('click', () => {
        // Only populate form if user is host
        if (isHost && lobbyData) {
            document.getElementById('settings-lobby-name').value = lobbyData.name;
            document.getElementById('settings-max-players').value = lobbyData.maxPlayers;
            settingsPrivateLobbyCheckbox.checked = lobbyData.isPrivate;
            document.getElementById('settings-round-time').value = lobbyData.roundTime || 30;
            document.getElementById('settings-rounds').value = lobbyData.rounds || 3;
            
            if (lobbyData.isPrivate) {
                settingsPasswordGroup.style.display = 'block';
            } else {
                settingsPasswordGroup.style.display = 'none';
            }
        }
        openModal(lobbySettingsModal);
    });
    
    // Settings form
    lobbySettingsForm.addEventListener('submit', updateLobbySettings);
    
    // Copy lobby code button
    copyCodeBtn.addEventListener('click', copyLobbyCode);
    
    // Private lobby checkbox in settings
    settingsPrivateLobbyCheckbox.addEventListener('change', () => {
        if (settingsPrivateLobbyCheckbox.checked) {
            settingsPasswordGroup.style.display = 'block';
        } else {
            settingsPasswordGroup.style.display = 'none';
        }
    });
    
    // Close modal buttons
    closeModalButtons.forEach(button => {
        button.addEventListener('click', () => {
            closeAllModals();
        });
    });
    
    // Cancel settings button
    document.getElementById('cancel-settings').addEventListener('click', () => {
        closeAllModals();
    });
    
    // Socket event listeners
    socket.on('lobbyData', updateLobbyData);
    socket.on('lobbyMessage', (message) => {
        addChatMessage('System', message, true);
    });
    socket.on('chatMessage', (data) => {
        addChatMessage(data.username, data.message);
    });
    socket.on('gameStarting', () => {
        showMessage('Game is starting...', 'success');
        setTimeout(() => {
            window.location.href = `/game.html?id=${lobbyId}`;
        }, 2000);
    });
    socket.on('onlineCount', (count) => {
        if (onlineCountElement) {
            onlineCountElement.textContent = count;
        }
    });
}

// Helper function to open modals
function openModal(modal) {
    if (modal) {
        modal.style.display = 'flex';
    }
}

// Helper function to close modals
function closeModal(modal) {
    if (modal) {
        modal.style.display = 'none';
    }
}

// Close all modals
function closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        closeModal(modal);
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
            closeAllModals();
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

// Initialize the lobby when the page loads
document.addEventListener('DOMContentLoaded', initLobby);

// Handle page unload to leave the lobby properly
window.addEventListener('beforeunload', () => {
    socket.emit('lobby:leave', lobbyId);
}); 
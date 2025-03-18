/**
 * Menu JavaScript
 * Handles menu functionality, lobby listing, and profile
 */

// DOM Elements
const usernameElement = document.getElementById('username');
const logoutBtn = document.getElementById('logout-btn');
const gamesPlayedElement = document.getElementById('games-played');
const winsElement = document.getElementById('wins');
const winRateElement = document.getElementById('win-rate');
const wordsCreatedElement = document.getElementById('words-created');
const lobbiesListElement = document.getElementById('lobbies-list');
const refreshLobbiesBtn = document.getElementById('refresh-lobbies-btn');
const createLobbyBtn = document.getElementById('create-lobby-btn');
const privateLobbyCodeInput = document.getElementById('private-lobby-code');
const joinPrivateBtn = document.getElementById('join-private-btn');
const menuMessageElement = document.getElementById('menu-message');
const loadingOverlay = document.getElementById('loading-overlay');

// Modal Elements
const createLobbyModal = document.getElementById('create-lobby-modal');
const createLobbyForm = document.getElementById('create-lobby-form');
const privateLobbyCheckbox = document.getElementById('private-lobby');
const passwordGroup = document.getElementById('password-group');
const cancelCreateLobbyBtn = document.getElementById('cancel-create-lobby');
const joinPrivateModal = document.getElementById('join-private-modal');
const joinPrivateForm = document.getElementById('join-private-form');
const cancelJoinPrivateBtn = document.getElementById('cancel-join-private');
const closeModalButtons = document.querySelectorAll('.close-modal');

// User data
let userData = null;
let lobbies = [];
let selectedLobbyId = null;

// Socket instance - use the existing socket from socket.js
const socketInstance = getSocket();

// Initialize the menu
function initMenu() {
    checkAuthentication();
    setupEventListeners();
    fetchLobbies();
    setupSocketListeners();
}

// Check if user is authenticated
function checkAuthentication() {
    console.log("Checking authentication in menu.js");
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
        console.log("No token found, redirecting to login");
        window.location.href = '/index.html';
        return;
    }

    console.log("Token found, fetching user profile");
    // Fetch user data
    fetch('/api/auth/profile', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            console.log("Authentication failed, status:", response.status);
            throw new Error('Authentication failed');
        }
        return response.json();
    })
    .then(data => {
        console.log("User data received:", data);
        userData = data.user || data; // Handle both response structures
        updateUserInfo(userData);
    })
    .catch(error => {
        console.error('Error fetching user data:', error);
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        window.location.href = '/index.html';
    })
    .finally(() => {
        hideLoading();
    });
}

// Set up event listeners
function setupEventListeners() {
    // Logout button
    logoutBtn.addEventListener('click', handleLogout);

    // Refresh lobbies button
    refreshLobbiesBtn.addEventListener('click', fetchLobbies);

    // Create lobby button
    createLobbyBtn.addEventListener('click', () => {
        createLobbyModal.style.display = 'block';
    });

    // Private lobby checkbox
    privateLobbyCheckbox.addEventListener('change', () => {
        passwordGroup.style.display = privateLobbyCheckbox.checked ? 'block' : 'none';
    });

    // Create lobby form
    createLobbyForm.addEventListener('submit', handleCreateLobby);

    // Cancel create lobby button
    cancelCreateLobbyBtn.addEventListener('click', () => {
        createLobbyModal.style.display = 'none';
        createLobbyForm.reset();
        passwordGroup.style.display = 'none';
    });

    // Join private lobby button
    joinPrivateBtn.addEventListener('click', () => {
        const lobbyCode = privateLobbyCodeInput.value.trim();
        if (!lobbyCode) {
            showMessage('Please enter a lobby code', 'error');
            return;
        }
        
        // Check if lobby exists and is private
        fetch(`/api/lobbies/${lobbyCode}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Lobby not found');
                }
                return response.json();
            })
            .then(lobby => {
                if (!lobby.isPrivate) {
                    // If not private, join directly
                    joinLobby(lobby._id);
                } else {
                    // If private, show password modal
                    selectedLobbyId = lobby._id;
                    joinPrivateModal.style.display = 'block';
                }
            })
            .catch(error => {
                showMessage('Lobby not found', 'error');
            });
    });

    // Join private form
    joinPrivateForm.addEventListener('submit', handleJoinPrivate);

    // Cancel join private button
    cancelJoinPrivateBtn.addEventListener('click', () => {
        joinPrivateModal.style.display = 'none';
        joinPrivateForm.reset();
        selectedLobbyId = null;
    });

    // Close modal buttons
    closeModalButtons.forEach(button => {
        button.addEventListener('click', () => {
            createLobbyModal.style.display = 'none';
            joinPrivateModal.style.display = 'none';
            createLobbyForm.reset();
            joinPrivateForm.reset();
            passwordGroup.style.display = 'none';
            selectedLobbyId = null;
        });
    });

    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === createLobbyModal) {
            createLobbyModal.style.display = 'none';
            createLobbyForm.reset();
            passwordGroup.style.display = 'none';
        }
        if (event.target === joinPrivateModal) {
            joinPrivateModal.style.display = 'none';
            joinPrivateForm.reset();
            selectedLobbyId = null;
        }
    });
}

// Set up socket listeners
function setupSocketListeners() {
    socketInstance.on('lobbyCreated', (lobby) => {
        lobbies.unshift(lobby);
        updateLobbiesList();
    });

    socketInstance.on('lobbyUpdated', (updatedLobby) => {
        const index = lobbies.findIndex(lobby => lobby._id === updatedLobby._id);
        if (index !== -1) {
            lobbies[index] = updatedLobby;
            updateLobbiesList();
        }
    });

    socketInstance.on('lobbyDeleted', (lobbyId) => {
        lobbies = lobbies.filter(lobby => lobby._id !== lobbyId);
        updateLobbiesList();
    });

    socketInstance.on('error', (error) => {
        showMessage(error.message, 'error');
    });
}

// Handle logout
function handleLogout() {
    showLoading();
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    window.location.href = '/index.html';
}

// Fetch lobbies from the server
function fetchLobbies() {
    lobbiesListElement.innerHTML = '<div class="loading-spinner"></div>';
    
    fetch('/api/lobbies')
        .then(response => response.json())
        .then(data => {
            lobbies = data;
            updateLobbiesList();
        })
        .catch(error => {
            console.error('Error fetching lobbies:', error);
            lobbiesListElement.innerHTML = '<div class="error-message">Failed to load lobbies</div>';
        });
}

// Update the lobbies list in the UI
function updateLobbiesList() {
    if (lobbies.length === 0) {
        lobbiesListElement.innerHTML = '<div class="no-lobbies">No lobbies available. Create one!</div>';
        return;
    }

    lobbiesListElement.innerHTML = '';
    
    lobbies.forEach(lobby => {
        const lobbyElement = document.createElement('div');
        lobbyElement.className = 'lobby-item';
        
        const isJoinable = lobby.players.length < lobby.maxPlayers && !lobby.gameStarted;
        
        lobbyElement.innerHTML = `
            <div class="lobby-info">
                <h3>${lobby.name}</h3>
                <div class="lobby-details">
                    <span class="lobby-players">${lobby.players.length}/${lobby.maxPlayers} players</span>
                    <span class="lobby-status ${lobby.gameStarted ? 'in-game' : 'waiting'}">${lobby.gameStarted ? 'In Game' : 'Waiting'}</span>
                    ${lobby.isPrivate ? '<span class="lobby-private"><i class="fas fa-lock"></i> Private</span>' : ''}
                </div>
            </div>
            <button class="btn join-btn ${!isJoinable ? 'disabled' : ''}" data-id="${lobby._id}" ${!isJoinable ? 'disabled' : ''}>
                ${isJoinable ? 'Join' : lobby.gameStarted ? 'In Game' : 'Full'}
            </button>
        `;
        
        lobbiesListElement.appendChild(lobbyElement);
        
        // Add event listener to join button
        const joinBtn = lobbyElement.querySelector('.join-btn');
        if (isJoinable) {
            joinBtn.addEventListener('click', () => {
                if (lobby.isPrivate) {
                    selectedLobbyId = lobby._id;
                    joinPrivateModal.style.display = 'block';
                } else {
                    joinLobby(lobby._id);
                }
            });
        }
    });
}

// Update user info in the UI
function updateUserInfo(user) {
    usernameElement.textContent = user.username;
    
    // Update stats
    if (user.stats) {
        gamesPlayedElement.textContent = user.stats.gamesPlayed || 0;
        winsElement.textContent = user.stats.wins || 0;
        
        const winRate = user.stats.gamesPlayed > 0 
            ? Math.round((user.stats.wins / user.stats.gamesPlayed) * 100) 
            : 0;
        winRateElement.textContent = `${winRate}%`;
        
        wordsCreatedElement.textContent = user.stats.wordsCreated || 0;
    }
}

// Handle create lobby form submission
function handleCreateLobby(event) {
    event.preventDefault();
    showLoading();
    
    const formData = new FormData(createLobbyForm);
    const lobbyData = {
        name: formData.get('name'),
        maxPlayers: parseInt(formData.get('maxPlayers')),
        isPrivate: formData.get('isPrivate') === 'on',
        password: formData.get('password') || undefined
    };
    
    fetch('/api/lobbies', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(lobbyData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to create lobby');
        }
        return response.json();
    })
    .then(lobby => {
        createLobbyModal.style.display = 'none';
        createLobbyForm.reset();
        passwordGroup.style.display = 'none';
        
        // Redirect to lobby page
        window.location.href = `/lobby.html?id=${lobby._id}`;
    })
    .catch(error => {
        console.error('Error creating lobby:', error);
        showMessage('Failed to create lobby', 'error');
        hideLoading();
    });
}

// Handle join private lobby form submission
function handleJoinPrivate(event) {
    event.preventDefault();
    
    if (!selectedLobbyId) {
        showMessage('No lobby selected', 'error');
        return;
    }
    
    showLoading();
    
    const password = document.getElementById('private-lobby-password').value;
    
    joinLobby(selectedLobbyId, password);
}

// Join a lobby
function joinLobby(lobbyId, password = null) {
    const requestData = password ? { password } : {};
    
    fetch(`/api/lobbies/${lobbyId}/join`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Incorrect password');
            } else if (response.status === 403) {
                throw new Error('Lobby is full or game already started');
            } else {
                throw new Error('Failed to join lobby');
            }
        }
        return response.json();
    })
    .then(data => {
        // Redirect to lobby page
        window.location.href = `/lobby.html?id=${lobbyId}`;
    })
    .catch(error => {
        console.error('Error joining lobby:', error);
        showMessage(error.message, 'error');
        hideLoading();
        
        // Close the join private modal if open
        joinPrivateModal.style.display = 'none';
        joinPrivateForm.reset();
        selectedLobbyId = null;
    });
}

// Show a message to the user
function showMessage(message, type = 'info') {
    menuMessageElement.textContent = message;
    menuMessageElement.className = `message ${type}`;
    menuMessageElement.style.display = 'block';
    
    // Hide the message after 3 seconds
    setTimeout(() => {
        menuMessageElement.style.display = 'none';
    }, 3000);
}

// Show loading overlay
function showLoading() {
    loadingOverlay.style.display = 'flex';
}

// Hide loading overlay
function hideLoading() {
    loadingOverlay.style.display = 'none';
}

// Initialize the menu when the page loads
document.addEventListener('DOMContentLoaded', initMenu); 
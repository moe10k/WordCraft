/**
 * Menu JavaScript
 * Handles menu functionality, lobby listing, and profile
 */

// DOM Elements
const usernameElement = document.getElementById('username');
const logoutBtn = document.getElementById('logout-btn');
const lobbiesListElement = document.getElementById('lobbies-list');
const refreshLobbiesBtn = document.getElementById('refresh-lobbies-btn');
const menuMessageElement = document.getElementById('menu-message');
const loadingOverlay = document.getElementById('loading-overlay');
const onlineCountElement = document.getElementById('online-count');

// Optional elements (from previous design)
const gamesPlayedElement = document.getElementById('games-played');
const winsElement = document.getElementById('wins');
const winRateElement = document.getElementById('win-rate');
const wordsCreatedElement = document.getElementById('words-created');
const privateLobbyCodeInput = document.getElementById('private-lobby-code');
const joinPrivateBtn = document.getElementById('join-private-btn');
const createLobbyBtn = document.getElementById('create-lobby-btn');

// Card elements
const createLobbyCard = document.getElementById('create-lobby-card');
const joinLobbyCard = document.getElementById('join-lobby-card');
const leaderboardCard = document.getElementById('leaderboard-card');
const settingsCard = document.getElementById('settings-card');

// Profile dropdown elements
const userProfile = document.getElementById('user-profile');
const profileDropdown = document.getElementById('profile-dropdown');
const viewProfileBtn = document.getElementById('view-profile');
const editProfileBtn = document.getElementById('edit-profile');
const logoutDropdownBtn = document.getElementById('logout-dropdown');

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

const settingsModal = document.getElementById('settings-modal');
const settingsForm = document.getElementById('settings-form');
const cancelSettingsBtn = document.getElementById('cancel-settings');

const leaderboardModal = document.getElementById('leaderboard-modal');
const leaderboardTabs = document.querySelectorAll('.leaderboard-tabs .tab-btn');
const leaderboardContent = document.querySelectorAll('.leaderboard-tab');

// User data
let userData = null;
let lobbies = [];
let selectedLobbyId = null;

/**
 * Get the socket instance safely with error handling
 */
function getSafeSocket() {
    try {
        if (typeof getSocket !== 'function') {
            console.error("getSocket function not found - socket.js may not be loaded");
            return null;
        }
        return getSocket();
    } catch (error) {
        console.error("Error getting socket:", error);
        return null;
    }
}

// Initialize the menu
function initMenu() {
    console.log("Initializing menu...");
    try {
        // Check for token before doing anything else
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            console.log("No token found at initialization, redirecting to login");
            window.location.href = '/index.html';
            return;
        }
        
        initParticles();
        checkAuthentication();
        setupEventListeners();
        fetchLobbies();
        setupSocketListeners();
    } catch (error) {
        console.error("Error initializing menu:", error);
        // If there's an initialization error, redirect to login
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        window.location.href = '/index.html';
    }
}

// Initialize particle background
function initParticles() {
    console.log("Initializing particles...");
    
    // Check if particlesJS is loaded
    if (typeof particlesJS === 'undefined') {
        console.error("particlesJS is not defined - library may not be loaded");
        return; // Skip initialization but continue with the rest of the page
    }
    
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
                random: true,
                anim: {
                    enable: true,
                    speed: 1,
                    opacity_min: 0.1,
                    sync: false
                }
            },
            size: {
                value: 3,
                random: true,
                anim: {
                    enable: true,
                    speed: 2,
                    size_min: 0.1,
                    sync: false
                }
            },
            line_linked: {
                enable: true,
                distance: 150,
                color: '#4a6fa5',
                opacity: 0.4,
                width: 1
            },
            move: {
                enable: true,
                speed: 1,
                direction: 'none',
                random: true,
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
                push: {
                    particles_nb: 4
                }
            }
        },
        retina_detect: true
    });
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
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
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
        // Handle different response formats
        if (data.success === false) {
            throw new Error(data.message || 'Authentication failed');
        }
        
        // Extract user data from various possible response formats
        let userInfo = null;
        if (data.user) {
            userInfo = data.user;
        } else if (data.username) {
            userInfo = data;
        } else if (data.success && data.data) {
            userInfo = data.data;
        }
        
        if (!userInfo) {
            throw new Error('Invalid user data format received');
        }
        
        userData = userInfo;
        updateUserInfo(userData);
    })
    .catch(error => {
        console.error('Error fetching user data:', error);
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        window.location.href = '/index.html';
    });
}

// Set up event listeners
function setupEventListeners() {
    // Logout button
    logoutBtn.addEventListener('click', handleLogout);
    logoutDropdownBtn.addEventListener('click', handleLogout);

    // Refresh lobbies button
    refreshLobbiesBtn.addEventListener('click', fetchLobbies);

    // User profile dropdown
    userProfile.addEventListener('click', toggleProfileDropdown);
    document.addEventListener('click', function(event) {
        if (!userProfile.contains(event.target) && !profileDropdown.contains(event.target)) {
            profileDropdown.classList.remove('active');
        }
    });

    // Menu cards
    createLobbyCard.addEventListener('click', () => openModal(createLobbyModal));
    joinLobbyCard.addEventListener('click', () => {
        // Show lobbies list by scrolling to it
        document.querySelector('.active-lobbies-section').scrollIntoView({ behavior: 'smooth' });
    });
    leaderboardCard.addEventListener('click', () => {
        openModal(leaderboardModal);
        fetchLeaderboard('wins');
    });
    settingsCard.addEventListener('click', () => {
        // Fill settings form with current values
        document.getElementById('username-setting').value = userData.username || '';
        openModal(settingsModal);
    });

    // Modal event listeners
    privateLobbyCheckbox.addEventListener('change', function() {
        passwordGroup.style.display = this.checked ? 'block' : 'none';
    });

    closeModalButtons.forEach(button => {
        button.addEventListener('click', () => {
            closeAllModals();
        });
    });

    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeAllModals();
        }
    });

    // Cancel buttons
    cancelCreateLobbyBtn.addEventListener('click', () => closeModal(createLobbyModal));
    cancelJoinPrivateBtn.addEventListener('click', () => closeModal(joinPrivateModal));
    cancelSettingsBtn.addEventListener('click', () => closeModal(settingsModal));

    // Form submissions
    createLobbyForm.addEventListener('submit', handleCreateLobby);
    joinPrivateForm.addEventListener('submit', handleJoinPrivate);
    settingsForm.addEventListener('submit', handleSaveSettings);

    // Leaderboard tabs
    leaderboardTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabType = tab.getAttribute('data-tab');
            
            // Update active tab
            leaderboardTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update active content
            leaderboardContent.forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`leaderboard-${tabType}`).classList.add('active');
            
            // Fetch leaderboard data
            fetchLeaderboard(tabType);
        });
    });
}

// Set up socket listeners
function setupSocketListeners() {
    // Get socket safely
    const socketInstance = getSafeSocket();
    if (!socketInstance) {
        console.error("Socket not available - skipping socket listeners");
        return;
    }
    
    // Listen for lobby updates
    socketInstance.on('lobbiesUpdate', function(updatedLobbies) {
        console.log('Received lobbies update:', updatedLobbies);
        lobbies = updatedLobbies;
        updateLobbiesList();
    });

    // Listen for online count updates
    socketInstance.on('onlineCount', function(count) {
        console.log('Received online count:', count);
        onlineCountElement.textContent = count;
    });

    // Listen for lobby join events
    socketInstance.on('joinLobbySuccess', function(lobbyData) {
        console.log('Successfully joined lobby:', lobbyData);
        // Redirect to lobby page
        window.location.href = `/lobby.html?id=${lobbyData.id}`;
    });

    // Listen for errors
    socketInstance.on('error', function(error) {
        console.error('Socket error:', error);
        showMessage(error.message || 'An error occurred', 'error');
    });
}

// Toggle profile dropdown
function toggleProfileDropdown(event) {
    event.stopPropagation();
    profileDropdown.classList.toggle('active');
}

// Open modal
function openModal(modal) {
    closeAllModals(); // Close any open modals
    modal.style.display = 'block';
}

// Close specific modal
function closeModal(modal) {
    modal.style.display = 'none';
}

// Close all modals
function closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}

// Handle logout
function handleLogout() {
    console.log("Logging out...");
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    window.location.href = '/index.html';
}

// Fetch lobbies
function fetchLobbies() {
    console.log("Fetching lobbies...");
    showLoading();
    
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    fetch('/api/lobby', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch lobbies');
        }
        return response.json();
    })
    .then(data => {
        console.log("Lobbies data received:", data);
        lobbies = data.lobbies || [];
        updateLobbiesList();
        hideLoading();
    })
    .catch(error => {
        console.error('Error fetching lobbies:', error);
        showMessage('Failed to load lobbies. Please try again.', 'error');
        hideLoading();
    });
}

// Fetch leaderboard data
function fetchLeaderboard(type) {
    const leaderboardContainer = document.getElementById(`leaderboard-${type}`);
    leaderboardContainer.innerHTML = '<div class="loading-spinner"></div>';
    
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    fetch(`/api/leaderboard/${type}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch leaderboard');
        }
        return response.json();
    })
    .then(data => {
        console.log(`Leaderboard data (${type}) received:`, data);
        updateLeaderboardDisplay(type, data.leaderboard || []);
    })
    .catch(error => {
        console.error('Error fetching leaderboard:', error);
        leaderboardContainer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>Failed to load leaderboard. Please try again.</p>
            </div>
        `;
    });
}

// Update leaderboard display
function updateLeaderboardDisplay(type, data) {
    const leaderboardContainer = document.getElementById(`leaderboard-${type}`);
    
    if (data.length === 0) {
        leaderboardContainer.innerHTML = `
            <div class="empty-message">
                <i class="fas fa-trophy"></i>
                <p>No leaderboard data available yet.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    data.forEach((player, index) => {
        const rankClass = index === 0 ? 'top1' : index === 1 ? 'top2' : index === 2 ? 'top3' : '';
        
        html += `
            <div class="leaderboard-item">
                <div class="leaderboard-rank ${rankClass}">${index + 1}</div>
                <div class="leaderboard-player">
                    <div class="leaderboard-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="leaderboard-name">${player.username}</div>
                </div>
                <div class="leaderboard-stats">
        `;
        
        if (type === 'wins') {
            html += `
                <div class="leaderboard-stat">
                    <div class="leaderboard-stat-value">${player.wins}</div>
                    <div class="leaderboard-stat-label">Wins</div>
                </div>
                <div class="leaderboard-stat">
                    <div class="leaderboard-stat-value">${player.gamesPlayed}</div>
                    <div class="leaderboard-stat-label">Games</div>
                </div>
            `;
        } else if (type === 'words') {
            html += `
                <div class="leaderboard-stat">
                    <div class="leaderboard-stat-value">${player.wordsCreated}</div>
                    <div class="leaderboard-stat-label">Words</div>
                </div>
            `;
        } else if (type === 'winrate') {
            const winRate = player.gamesPlayed > 0 
                ? Math.round((player.wins / player.gamesPlayed) * 100) 
                : 0;
            
            html += `
                <div class="leaderboard-stat">
                    <div class="leaderboard-stat-value">${winRate}%</div>
                    <div class="leaderboard-stat-label">Win Rate</div>
                </div>
                <div class="leaderboard-stat">
                    <div class="leaderboard-stat-value">${player.gamesPlayed}</div>
                    <div class="leaderboard-stat-label">Games</div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
    });
    
    leaderboardContainer.innerHTML = html;
}

// Update lobbies list
function updateLobbiesList() {
    if (lobbies.length === 0) {
        lobbiesListElement.innerHTML = `
            <div class="no-lobbies">
                <i class="fas fa-info-circle"></i>
                <p>No active lobbies. Create one to get started!</p>
            </div>
        `;
        return;
    }

    let html = '';
    lobbies.forEach(lobby => {
        const isPrivate = lobby.isPrivate;
        const isInGame = lobby.status === 'in-game';
        const statusText = isInGame ? 'In Progress' : 'Waiting';
        const statusClass = isInGame ? 'in-game' : 'waiting';
        const disabledClass = isInGame ? 'disabled' : '';
        
        html += `
            <div class="lobby-item">
                <div class="lobby-info">
                    <h3>${lobby.name}</h3>
                    <div class="lobby-details">
                        <div class="lobby-players">
                            <i class="fas fa-user-friends"></i> ${lobby.players.length}/${lobby.maxPlayers}
                        </div>
                        <div class="lobby-status ${statusClass}">
                            <i class="fas ${isInGame ? 'fa-gamepad' : 'fa-clock'}"></i> ${statusText}
                        </div>
                        ${isPrivate ? `
                            <div class="lobby-private">
                                <i class="fas fa-lock"></i> Private
                            </div>
                        ` : ''}
                        <div class="lobby-mode">
                            <i class="fas fa-dice"></i> ${lobby.gameMode || 'Standard'}
                        </div>
                    </div>
                </div>
                <div class="lobby-actions">
                    <button class="btn neon-btn join-btn ${disabledClass}" 
                            ${isInGame ? 'disabled' : ''} 
                            data-id="${lobby.id}" 
                            data-private="${isPrivate}">
                        ${isInGame ? 'In Progress' : 'Join'}
                    </button>
                </div>
            </div>
        `;
    });

    lobbiesListElement.innerHTML = html;

    // Add event listeners to join buttons
    document.querySelectorAll('.join-btn:not(.disabled)').forEach(button => {
        button.addEventListener('click', function() {
            const lobbyId = this.getAttribute('data-id');
            const isPrivate = this.getAttribute('data-private') === 'true';
            
            if (isPrivate) {
                selectedLobbyId = lobbyId;
                openModal(joinPrivateModal);
            } else {
                joinLobby(lobbyId);
            }
        });
    });
}

// Update user info
function updateUserInfo(user) {
    if (!user) return;
    
    usernameElement.textContent = user.username;
    
    // If there are profile fields to update, add them here
    const usernameSetting = document.getElementById('username-setting');
    if (usernameSetting) {
        usernameSetting.value = user.username;
    }

    // Update stats if we have the elements and data
    if (gamesPlayedElement && winsElement && winRateElement && wordsCreatedElement) {
        const stats = user.stats || {};
        
        if (gamesPlayedElement) gamesPlayedElement.textContent = stats.gamesPlayed || 0;
        if (winsElement) winsElement.textContent = stats.wins || 0;
        
        if (winRateElement) {
            const winRate = stats.gamesPlayed > 0 
                ? Math.round((stats.wins / stats.gamesPlayed) * 100) 
                : 0;
            winRateElement.textContent = `${winRate}%`;
        }
        
        if (wordsCreatedElement) wordsCreatedElement.textContent = stats.wordsCreated || 0;
    }
}

// Handle create lobby
function handleCreateLobby(event) {
    event.preventDefault();
    
    const formData = new FormData(createLobbyForm);
    const lobbyData = {
        name: formData.get('name'),
        maxPlayers: parseInt(formData.get('maxPlayers')),
        isPrivate: formData.get('isPrivate') === 'on',
        gameMode: formData.get('gameMode')
    };
    
    if (lobbyData.isPrivate) {
        const password = formData.get('password');
        if (!password) {
            showMessage('Password is required for private lobbies', 'error');
            return;
        }
        lobbyData.password = password;
    }
    
    console.log('Creating lobby:', lobbyData);
    showLoading();
    
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
        console.error("No token found when creating lobby");
        showMessage('Authentication error. Please log in again.', 'error');
        window.location.href = '/index.html';
        return;
    }
    
    fetch('/api/lobby', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(lobbyData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to create lobby');
        }
        return response.json();
    })
    .then(data => {
        console.log('Lobby created:', data);
        
        // Get the lobby ID from the response (handle different response formats)
        let lobbyId = null;
        if (data.lobby && data.lobby.id) {
            lobbyId = data.lobby.id;
        } else if (data.id) {
            lobbyId = data.id;
        } else if (data._id) {
            lobbyId = data._id;
        }
        
        if (!lobbyId) {
            console.error("Could not find lobby ID in response:", data);
            throw new Error('Invalid lobby data returned from server');
        }
        
        // Redirect to the new lobby
        window.location.href = `/lobby.html?id=${lobbyId}`;
    })
    .catch(error => {
        console.error('Error creating lobby:', error);
        showMessage('Failed to create lobby. Please try again.', 'error');
        hideLoading();
    });
}

// Handle join private
function handleJoinPrivate(event) {
    event.preventDefault();
    
    const formData = new FormData(joinPrivateForm);
    const lobbyId = formData.get('lobbyId') || selectedLobbyId;
    const password = formData.get('password');
    
    if (!lobbyId) {
        showMessage('Lobby ID is required', 'error');
        return;
    }
    
    if (!password) {
        showMessage('Password is required', 'error');
        return;
    }
    
    joinLobby(lobbyId, password);
}

// Handle save settings
function handleSaveSettings(event) {
    event.preventDefault();
    
    const formData = new FormData(settingsForm);
    const settings = {
        username: formData.get('username'),
        soundEnabled: formData.get('soundEnabled') === 'on',
        musicEnabled: formData.get('musicEnabled') === 'on',
        theme: formData.get('theme')
    };
    
    // Save settings to local storage
    localStorage.setItem('gameSettings', JSON.stringify({
        soundEnabled: settings.soundEnabled,
        musicEnabled: settings.musicEnabled,
        theme: settings.theme
    }));
    
    // Update username if changed
    if (settings.username && settings.username !== userData.username) {
        updateUsername(settings.username);
    } else {
        // Apply theme change immediately
        applyTheme(settings.theme);
        closeModal(settingsModal);
        showMessage('Settings saved successfully', 'success');
    }
}

// Update username
function updateUsername(newUsername) {
    showLoading();
    
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: newUsername })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to update username');
        }
        return response.json();
    })
    .then(data => {
        console.log('Username updated:', data);
        userData = data.user;
        updateUserInfo(userData);
        
        // Apply theme
        const settings = JSON.parse(localStorage.getItem('gameSettings') || '{}');
        applyTheme(settings.theme);
        
        closeModal(settingsModal);
        showMessage('Settings saved successfully', 'success');
        hideLoading();
    })
    .catch(error => {
        console.error('Error updating username:', error);
        showMessage('Failed to update username. Please try again.', 'error');
        hideLoading();
    });
}

// Apply theme
function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.remove('dark-theme');
    } else {
        document.body.classList.add('dark-theme');
    }
}

// Join lobby
function joinLobby(lobbyId, password = null) {
    console.log(`Joining lobby ${lobbyId}`, password ? 'with password' : '');
    
    if (!lobbyId) {
        showMessage('Invalid lobby ID', 'error');
        return;
    }
    
    showLoading();
    
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
        console.error("No token found when joining lobby");
        showMessage('Authentication error. Please log in again.', 'error');
        window.location.href = '/index.html';
        return;
    }
    
    const requestBody = password ? JSON.stringify({ password }) : '{}';
    
    fetch(`/api/lobby/${lobbyId}/join`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: requestBody
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Incorrect password');
            } else if (response.status === 404) {
                throw new Error('Lobby not found');
            } else {
                throw new Error('Failed to join lobby');
            }
        }
        return response.json();
    })
    .then(data => {
        console.log('Joined lobby:', data);
        // Redirect to the lobby
        window.location.href = `/lobby.html?id=${lobbyId}`;
    })
    .catch(error => {
        console.error('Error joining lobby:', error);
        showMessage(error.message || 'Failed to join lobby. Please try again.', 'error');
        hideLoading();
    });
}

// Show message
function showMessage(message, type = 'info') {
    menuMessageElement.textContent = message;
    menuMessageElement.className = `message ${type}`;
    menuMessageElement.style.display = 'block';
    
    setTimeout(() => {
        menuMessageElement.style.display = 'none';
    }, 5000);
}

// Show loading overlay
function showLoading() {
    loadingOverlay.style.display = 'flex';
}

// Hide loading overlay
function hideLoading() {
    loadingOverlay.style.display = 'none';
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initMenu); 
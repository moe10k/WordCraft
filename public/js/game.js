// Game.js - Handles the game functionality
// This file manages the game UI, socket events, and game logic for the word game

// DOM Elements
const gameContainer = document.getElementById('game-container');
const playersContainer = document.getElementById('players-container');
const currentLetterElement = document.getElementById('current-letter');
const wordInputElement = document.getElementById('word-input');
const submitWordBtn = document.getElementById('submit-word-btn');
const timerElement = document.getElementById('timer');
const gameMessageElement = document.getElementById('game-message');
const chatContainer = document.getElementById('game-chat-container');
const chatMessages = document.getElementById('game-chat-messages');
const chatInput = document.getElementById('game-chat-input');
const chatSendBtn = document.getElementById('game-chat-send-btn');
const powerUpsContainer = document.getElementById('power-ups-container');
const leaveGameBtn = document.getElementById('leave-game-btn');
const gameOverModal = document.getElementById('game-over-modal');
const gameOverMessage = document.getElementById('game-over-message');
const returnToLobbyBtn = document.getElementById('return-to-lobby-btn');

// Game state variables
let gameId = null;
let currentPlayer = null;
let currentLetter = '';
let players = [];
let isMyTurn = false;
let timeLeft = 0;
let timerInterval = null;
let gameOver = false;
let powerUps = [];

// Get the socket instance from socket.js
const socket = getSocket();

// Initialize the game
function initGame() {
    // Get the game ID from the URL
    const urlParams = new URLSearchParams(window.location.search);
    gameId = urlParams.get('id');
    
    if (!gameId) {
        showMessage('Game ID not found. Redirecting to menu...', 'error');
        setTimeout(() => {
            window.location.href = '/menu.html';
        }, 3000);
        return;
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Join the game room
    joinGame();
    
    // Load game state
    loadGameState();
}

// Set up event listeners
function setupEventListeners() {
    // Submit word button
    submitWordBtn.addEventListener('click', submitWord);
    
    // Word input - submit on Enter key
    wordInputElement.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitWord();
        }
    });
    
    // Word input - send typing updates
    wordInputElement.addEventListener('input', () => {
        if (isMyTurn) {
            socket.emit('game:typing', { 
                gameId, 
                word: wordInputElement.value 
            });
        }
    });
    
    // Chat send button
    chatSendBtn.addEventListener('click', sendChatMessage);
    
    // Chat input - send on Enter key
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
    
    // Leave game button
    leaveGameBtn.addEventListener('click', leaveGame);
    
    // Return to lobby button
    returnToLobbyBtn.addEventListener('click', () => {
        window.location.href = `/lobby.html?id=${gameId}`;
    });
}

// Join the game room
function joinGame() {
    socket.emit('game:join', gameId);
}

// Load game state from the server
function loadGameState() {
    fetch(`/api/game/${gameId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateGameState(data.game);
        } else {
            showMessage(data.message || 'Failed to load game state', 'error');
        }
    })
    .catch(error => {
        console.error('Error loading game state:', error);
        showMessage('Error loading game state. Please try again.', 'error');
    });
}

// Update the game state based on server data
function updateGameState(game) {
    // Update game variables
    players = game.players;
    currentLetter = game.currentLetter;
    currentPlayer = game.currentPlayer;
    gameOver = game.gameOver;
    
    // Update UI
    updatePlayersUI();
    updateCurrentLetterUI();
    updateTurnUI();
    updatePowerUpsUI();
    
    // Handle game over state
    if (gameOver) {
        handleGameOver(game);
    }
}

// Update the players UI
function updatePlayersUI() {
    playersContainer.innerHTML = '';
    
    players.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.className = `player-card ${player._id === currentPlayer ? 'current-turn' : ''}`;
        
        // Check if this is the current user
        const isCurrentUser = player._id === JSON.parse(localStorage.getItem('user'))._id;
        if (isCurrentUser) {
            playerElement.classList.add('current-user');
        }
        
        // Create player info HTML
        playerElement.innerHTML = `
            <div class="player-name">${player.username} ${isCurrentUser ? '(You)' : ''}</div>
            <div class="player-lives">
                ${'❤️'.repeat(player.lives)}${'🖤'.repeat(3 - player.lives)}
            </div>
            <div class="player-score">Score: ${player.score || 0}</div>
            ${player.typing ? `<div class="player-typing">Typing: ${player.typing}</div>` : ''}
        `;
        
        playersContainer.appendChild(playerElement);
    });
}

// Update the current letter UI
function updateCurrentLetterUI() {
    currentLetterElement.textContent = currentLetter;
}

// Update the turn UI based on whose turn it is
function updateTurnUI() {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    isMyTurn = currentPlayer === currentUser._id;
    
    if (isMyTurn) {
        wordInputElement.disabled = false;
        submitWordBtn.disabled = false;
        wordInputElement.focus();
        showMessage('It\'s your turn! Create a word containing the letter.', 'info');
    } else {
        wordInputElement.disabled = true;
        submitWordBtn.disabled = true;
        
        // Find the current player's username
        const currentPlayerObj = players.find(p => p._id === currentPlayer);
        if (currentPlayerObj) {
            showMessage(`It's ${currentPlayerObj.username}'s turn.`, 'info');
        }
    }
}

// Update power-ups UI
function updatePowerUpsUI() {
    // This would be populated based on the player's available power-ups
    powerUpsContainer.innerHTML = '';
    
    // Example power-ups (in a real implementation, these would come from the server)
    const availablePowerUps = [
        { type: 'extraTime', name: 'Extra Time', icon: '⏱️' },
        { type: 'skipTurn', name: 'Skip Turn', icon: '⏭️' },
        { type: 'extraLife', name: 'Extra Life', icon: '❤️' }
    ];
    
    availablePowerUps.forEach(powerUp => {
        const powerUpElement = document.createElement('button');
        powerUpElement.className = 'power-up-btn';
        powerUpElement.innerHTML = `${powerUp.icon} ${powerUp.name}`;
        powerUpElement.addEventListener('click', () => usePowerUp(powerUp.type));
        
        powerUpsContainer.appendChild(powerUpElement);
    });
}

// Start the timer for the current turn
function startTimer(duration) {
    clearInterval(timerInterval);
    timeLeft = duration;
    updateTimerUI();
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerUI();
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (isMyTurn) {
                handleTimeout();
            }
        }
    }, 1000);
}

// Update the timer UI
function updateTimerUI() {
    timerElement.textContent = timeLeft;
    
    // Add visual indication when time is running low
    if (timeLeft <= 3) {
        timerElement.classList.add('time-low');
    } else {
        timerElement.classList.remove('time-low');
    }
}

// Submit a word
function submitWord() {
    if (!isMyTurn || gameOver) return;
    
    const word = wordInputElement.value.trim();
    
    if (!word) {
        showMessage('Please enter a word', 'error');
        return;
    }
    
    // Check if the word contains the current letter
    if (!word.toLowerCase().includes(currentLetter.toLowerCase())) {
        showMessage(`Your word must contain the letter "${currentLetter}"`, 'error');
        return;
    }
    
    socket.emit('game:submit-word', { gameId, word });
    wordInputElement.value = '';
}

// Handle turn timeout
function handleTimeout() {
    socket.emit('game:timeout', { gameId });
}

// Use a power-up
function usePowerUp(powerUpType) {
    if (gameOver) return;
    
    socket.emit('game:use-power-up', { gameId, powerUpType });
}

// Send a chat message
function sendChatMessage() {
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    socket.emit('game:chat', { gameId, message });
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

// Handle game over
function handleGameOver(game) {
    clearInterval(timerInterval);
    gameOver = true;
    
    // Disable input
    wordInputElement.disabled = true;
    submitWordBtn.disabled = true;
    
    // Show game over modal
    const winner = game.winner ? players.find(p => p._id === game.winner) : null;
    
    if (winner) {
        gameOverMessage.textContent = `Game Over! ${winner.username} wins!`;
    } else {
        gameOverMessage.textContent = 'Game Over! It\'s a tie!';
    }
    
    gameOverModal.style.display = 'flex';
}

// Leave the game
function leaveGame() {
    if (confirm('Are you sure you want to leave the game?')) {
        socket.emit('game:leave', gameId);
        window.location.href = '/menu.html';
    }
}

// Show a message in the game message element
function showMessage(message, type = 'info') {
    gameMessageElement.textContent = message;
    gameMessageElement.className = `game-message ${type}`;
    
    // Clear the message after 5 seconds for non-error messages
    if (type !== 'error') {
        setTimeout(() => {
            gameMessageElement.textContent = '';
            gameMessageElement.className = 'game-message';
        }, 5000);
    }
}

// Socket event handlers
socket.on('game:started', (data) => {
    updateGameState(data.game);
    startTimer(10); // Start with 10 seconds for the first turn
    showMessage('Game started!', 'success');
});

socket.on('game:turn-change', (data) => {
    updateGameState(data.game);
    startTimer(10); // Reset timer for the new turn
});

socket.on('game:player-typing', (data) => {
    // Update the typing indicator for the player
    const playerIndex = players.findIndex(p => p._id === data.userId);
    if (playerIndex !== -1) {
        players[playerIndex].typing = data.word;
        updatePlayersUI();
    }
});

socket.on('game:word-submitted', (data) => {
    // Show the submitted word and whether it was valid
    const message = data.isValid 
        ? `${data.username} submitted "${data.word}" - Valid!` 
        : `${data.username} submitted "${data.word}" - Invalid!`;
    
    addChatMessage('System', message, true);
    
    // Clear typing for this player
    const playerIndex = players.findIndex(p => p._id === data.userId);
    if (playerIndex !== -1) {
        players[playerIndex].typing = '';
        updatePlayersUI();
    }
});

socket.on('game:power-up-used', (data) => {
    addChatMessage('System', `${data.username} used ${data.powerUpType} power-up!`, true);
    
    // Handle specific power-up effects
    if (data.powerUpType === 'extraTime' && isMyTurn) {
        timeLeft += 5; // Add 5 seconds
        updateTimerUI();
    }
});

socket.on('game:player-eliminated', (data) => {
    addChatMessage('System', `${data.username} has been eliminated!`, true);
});

socket.on('game:over', (data) => {
    updateGameState(data.game);
    handleGameOver(data.game);
});

socket.on('game:chat-message', (data) => {
    addChatMessage(data.username, data.message);
});

socket.on('game:error', (data) => {
    showMessage(data.message, 'error');
});

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', initGame);

// Handle page unload to leave the game properly
window.addEventListener('beforeunload', () => {
    socket.emit('game:leave', gameId);
}); 
/**
 * Socket.IO utility
 * Handles socket connection and authentication
 */

// Socket.io instance
let socket = null;

/**
 * Get the socket instance, creating it if it doesn't exist
 * @returns {Socket} The socket.io instance
 */
function getSocket() {
    if (!socket) {
        // Initialize socket connection
        socket = io({
            auth: {
                token: localStorage.getItem('token')
            },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        // Set up socket event listeners
        setupSocketEvents();
    }
    return socket;
}

/**
 * Set up socket event listeners
 */
function setupSocketEvents() {
    // Connection events
    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error.message);
        
        // If the error is due to authentication, redirect to login
        if (error.message === 'Authentication error') {
            localStorage.removeItem('token');
            window.location.href = '/index.html';
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        
        // If the server disconnected us, show a message
        if (reason === 'io server disconnect') {
            showDisconnectMessage();
        }
    });

    // Reconnection events
    socket.on('reconnect', (attemptNumber) => {
        console.log(`Reconnected to server after ${attemptNumber} attempts`);
        hideDisconnectMessage();
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`Reconnection attempt ${attemptNumber}`);
    });

    socket.on('reconnect_error', (error) => {
        console.error('Reconnection error:', error.message);
    });

    socket.on('reconnect_failed', () => {
        console.error('Failed to reconnect to server');
        showDisconnectMessage(true);
    });
}

/**
 * Show a disconnect message to the user
 * @param {boolean} failed - Whether reconnection failed
 */
function showDisconnectMessage(failed = false) {
    // Create disconnect overlay if it doesn't exist
    let disconnectOverlay = document.getElementById('disconnect-overlay');
    
    if (!disconnectOverlay) {
        disconnectOverlay = document.createElement('div');
        disconnectOverlay.id = 'disconnect-overlay';
        disconnectOverlay.className = 'disconnect-overlay';
        
        const content = document.createElement('div');
        content.className = 'disconnect-content';
        
        const icon = document.createElement('i');
        icon.className = 'fas fa-wifi disconnect-icon';
        
        const message = document.createElement('p');
        message.id = 'disconnect-message';
        message.className = 'disconnect-message';
        
        const button = document.createElement('button');
        button.id = 'disconnect-button';
        button.className = 'btn primary-btn';
        button.textContent = 'Reload Page';
        button.addEventListener('click', () => {
            window.location.reload();
        });
        
        content.appendChild(icon);
        content.appendChild(message);
        content.appendChild(button);
        disconnectOverlay.appendChild(content);
        
        document.body.appendChild(disconnectOverlay);
    }
    
    // Update message based on reconnection status
    const messageElement = document.getElementById('disconnect-message');
    if (failed) {
        messageElement.textContent = 'Connection to server lost. Please reload the page.';
    } else {
        messageElement.textContent = 'Connection to server lost. Attempting to reconnect...';
    }
    
    // Show the overlay
    disconnectOverlay.style.display = 'flex';
}

/**
 * Hide the disconnect message
 */
function hideDisconnectMessage() {
    const disconnectOverlay = document.getElementById('disconnect-overlay');
    if (disconnectOverlay) {
        disconnectOverlay.style.display = 'none';
    }
}

/**
 * Disconnect the socket
 */
function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

/**
 * Show an error message
 * @param {string} message - Error message
 */
function showErrorMessage(message) {
  // Find message element based on current page
  const messageElement = 
    document.getElementById('lobby-message') || 
    document.getElementById('game-message') || 
    document.getElementById('menu-message');
  
  if (messageElement) {
    messageElement.textContent = message;
    messageElement.className = 'message error';
    
    // Clear message after 5 seconds
    setTimeout(() => {
      messageElement.textContent = '';
      messageElement.className = 'message';
    }, 5000);
  }
} 
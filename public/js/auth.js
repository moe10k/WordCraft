/**
 * Authentication JavaScript
 * Handles login and registration functionality
 */

// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const authForms = document.querySelectorAll('.auth-form');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const forgotPasswordForm = document.getElementById('forgot-password-form');
const forgotPasswordLink = document.getElementById('forgot-password');
const forgotPasswordModal = document.getElementById('forgot-password-modal');
const closeModalBtn = document.querySelector('.close-modal');
const loginMessage = document.getElementById('login-message');
const registerMessage = document.getElementById('register-message');
const resetMessage = document.getElementById('reset-message');
const loadingOverlay = document.getElementById('loading-overlay');
const onlineCountElement = document.getElementById('online-count');

// Initialize authentication
function initAuth() {
    setupEventListeners();
    initParticles();
    checkExistingToken();
    setupSocketListeners();
}

// Set up event listeners
function setupEventListeners() {
    // Tab switching
    tabBtns.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and forms
            tabBtns.forEach(t => t.classList.remove('active'));
            authForms.forEach(f => f.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding form
            tab.classList.add('active');
            const formId = tab.getAttribute('data-tab');
            document.getElementById(`${formId}-form`).classList.add('active');
            
            // Clear messages
            loginMessage.textContent = '';
            loginMessage.className = 'message';
            registerMessage.textContent = '';
            registerMessage.className = 'message';
        });
    });
    
    // Login form submission
    loginForm.addEventListener('submit', handleLogin);
    
    // Register form submission
    registerForm.addEventListener('submit', handleRegister);
    
    // Forgot password link
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotPasswordModal.style.display = 'flex';
    });
    
    // Close modal
    closeModalBtn.addEventListener('click', () => {
        forgotPasswordModal.style.display = 'none';
        resetMessage.textContent = '';
        resetMessage.className = 'message';
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === forgotPasswordModal) {
            forgotPasswordModal.style.display = 'none';
            resetMessage.textContent = '';
            resetMessage.className = 'message';
        }
    });
    
    // Forgot password form submission
    forgotPasswordForm.addEventListener('submit', handleForgotPassword);
}

// Initialize particles.js
function initParticles() {
    particlesJS('particles-js', {
        particles: {
            number: {
                value: 80,
                density: {
                    enable: true,
                    value_area: 800
                }
            },
            color: {
                value: '#ffffff'
            },
            shape: {
                type: 'circle'
            },
            opacity: {
                value: 0.5,
                random: false
            },
            size: {
                value: 3,
                random: true
            },
            line_linked: {
                enable: true,
                distance: 150,
                color: '#ffffff',
                opacity: 0.4,
                width: 1
            },
            move: {
                enable: true,
                speed: 6,
                direction: 'none',
                random: false,
                straight: false,
                out_mode: 'out',
                bounce: false
            }
        },
        interactivity: {
            detect_on: 'canvas',
            events: {
                onhover: {
                    enable: true,
                    mode: 'repulse'
                },
                onclick: {
                    enable: true,
                    mode: 'push'
                },
                resize: true
            }
        },
        retina_detect: true
    });
}

// Set up Socket.IO event listeners
function setupSocketListeners() {
    const socket = getSocket();
    
    // Listen for online count updates
    socket.on('onlineCount', (count) => {
        if (onlineCountElement) {
            onlineCountElement.textContent = count;
        }
    });
}

// Check if user already has a token
function checkExistingToken() {
    // Only check for token if we're on the login/register page
    if (!window.location.pathname.includes('index.html') && 
        window.location.pathname !== '/' && 
        window.location.pathname !== '') {
        return; // Skip token check if not on login page
    }
    
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
        // Show loading overlay
        showLoading();
        
        // Validate token
        fetch('/api/auth/validate', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (response.ok) {
                // Token is valid, redirect to menu
                window.location.href = '/menu.html';
            } else {
                // Token is invalid, remove it
                localStorage.removeItem('token');
                sessionStorage.removeItem('token');
                hideLoading();
            }
        })
        .catch(error => {
            console.error('Error validating token:', error);
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            hideLoading();
        });
    } else {
        hideLoading();
    }
}

// Handle login form submission
function handleLogin(event) {
    event.preventDefault();
    
    // Get form data
    const email = loginForm.querySelector('input[name="email"]').value;
    const password = loginForm.querySelector('input[name="password"]').value;
    const rememberMe = loginForm.querySelector('input[name="remember"]').checked;
    
    // Validate form data
    if (!email || !password) {
        showMessage(loginMessage, 'Please fill in all fields', 'error');
        shakeForm(loginForm);
        return;
    }
    
    // Show loading overlay
    showLoading();
    
    // Send login request
    fetch('/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.token) {
            // Store token based on remember me option
            if (rememberMe) {
                localStorage.setItem('token', data.token);
            } else {
                sessionStorage.setItem('token', data.token);
            }
            
            // Emit user connected event using getSocket()
            const socket = getSocket();
            if (socket) {
                socket.emit('userConnected', { 
                    username: data.user.username 
                });
            }
            
            // Redirect to menu with fade out effect
            fadeOutAndRedirect('/menu.html');
        } else {
            // Show error message
            showMessage(loginMessage, data.message || 'Invalid credentials', 'error');
            shakeForm(loginForm);
            
            // Clear password field
            loginForm.querySelector('input[name="password"]').value = '';
            
            hideLoading();
        }
    })
    .catch(error => {
        console.error('Login error:', error);
        showMessage(loginMessage, 'An error occurred during login', 'error');
        shakeForm(loginForm);
        hideLoading();
    });
}

// Handle register form submission
function handleRegister(event) {
    event.preventDefault();
    
    // Get form data
    const username = registerForm.querySelector('input[name="username"]').value;
    const email = registerForm.querySelector('input[name="email"]').value;
    const password = registerForm.querySelector('input[name="password"]').value;
    const confirmPassword = registerForm.querySelector('input[name="confirmPassword"]').value;
    
    // Validate form data
    if (!username || !email || !password || !confirmPassword) {
        showMessage(registerMessage, 'Please fill in all fields', 'error');
        shakeForm(registerForm);
        return;
    }
    
    if (password !== confirmPassword) {
        showMessage(registerMessage, 'Passwords do not match', 'error');
        shakeForm(registerForm);
        return;
    }
    
    if (password.length < 6) {
        showMessage(registerMessage, 'Password must be at least 6 characters', 'error');
        shakeForm(registerForm);
        return;
    }
    
    // Show loading overlay
    showLoading();
    
    // Send register request
    fetch('/api/auth/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.token) {
            // Store token in session storage (not remembering by default for new registrations)
            sessionStorage.setItem('token', data.token);
            
            // Emit user connected event using getSocket()
            const socket = getSocket();
            if (socket) {
                socket.emit('userConnected', { 
                    username: data.user.username 
                });
            }
            
            // Redirect to menu with fade out effect
            fadeOutAndRedirect('/menu.html');
        } else {
            // Show error message
            showMessage(registerMessage, data.message || 'Registration failed', 'error');
            shakeForm(registerForm);
            hideLoading();
        }
    })
    .catch(error => {
        console.error('Register error:', error);
        showMessage(registerMessage, 'An error occurred during registration', 'error');
        shakeForm(registerForm);
        hideLoading();
    });
}

// Handle forgot password form submission
function handleForgotPassword(event) {
    event.preventDefault();
    
    // Get form data
    const email = forgotPasswordForm.querySelector('input[name="email"]').value;
    
    // Validate form data
    if (!email) {
        showMessage(resetMessage, 'Please enter your email', 'error');
        return;
    }
    
    // Show loading overlay
    showLoading();
    
    // Send forgot password request
    fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Show success message
            showMessage(resetMessage, 'Password reset link sent to your email', 'success');
            
            // Clear email field
            forgotPasswordForm.querySelector('input[name="email"]').value = '';
        } else {
            // Show error message
            showMessage(resetMessage, data.message || 'Failed to send reset link', 'error');
        }
        hideLoading();
    })
    .catch(error => {
        console.error('Forgot password error:', error);
        showMessage(resetMessage, 'An error occurred', 'error');
        hideLoading();
    });
}

// Show a message in the specified element
function showMessage(element, message, type = 'info') {
    element.textContent = message;
    element.className = `message ${type}`;
}

// Shake form on error
function shakeForm(form) {
    form.classList.add('shake');
    setTimeout(() => {
        form.classList.remove('shake');
    }, 500);
}

// Fade out and redirect
function fadeOutAndRedirect(url) {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
        window.location.href = url;
    }, 500);
}

// Show loading overlay
function showLoading() {
    loadingOverlay.style.display = 'flex';
}

// Hide loading overlay
function hideLoading() {
    loadingOverlay.style.display = 'none';
}

// Initialize when the document is ready
document.addEventListener('DOMContentLoaded', initAuth); 
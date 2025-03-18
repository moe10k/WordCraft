const jwt = require('jsonwebtoken');
const User = require('../models/User');
const lobbySocket = require('./lobbySocket');
const gameSocket = require('./gameSocket');

// Track online users
let onlineUsers = 0;

/**
 * Initialize all socket handlers
 * @param {Object} io - Socket.IO instance
 */
const initializeSockets = (io) => {
  // Authentication middleware for sockets
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        // Allow unauthenticated connections for the login page
        socket.isAuthenticated = false;
        return next();
      }
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from token
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      
      // Attach user to socket
      socket.user = {
        id: user._id,
        username: user.username
      };
      
      socket.isAuthenticated = true;
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      // Allow unauthenticated connections for the login page
      socket.isAuthenticated = false;
      next();
    }
  });

  // Connection event
  io.on('connection', (socket) => {
    // Increment online users count
    onlineUsers++;
    
    // Emit updated count to all clients
    io.emit('onlineCount', onlineUsers);
    
    if (socket.isAuthenticated) {
      console.log(`User connected: ${socket.user.username} (${socket.id})`);
      
      // Initialize socket handlers for authenticated users
      lobbySocket(io, socket);
      gameSocket(io, socket);
    } else {
      console.log(`Anonymous user connected (${socket.id})`);
      
      // Handle user login event
      socket.on('userConnected', (data) => {
        console.log(`User logged in: ${data.username} (${socket.id})`);
        socket.user = {
          username: data.username
        };
        socket.isAuthenticated = true;
      });
    }
    
    // Disconnect event
    socket.on('disconnect', () => {
      // Decrement online users count
      onlineUsers--;
      
      // Emit updated count to all clients
      io.emit('onlineCount', onlineUsers);
      
      if (socket.isAuthenticated && socket.user) {
        console.log(`User disconnected: ${socket.user.username} (${socket.id})`);
      } else {
        console.log(`Anonymous user disconnected (${socket.id})`);
      }
    });
  });
};

module.exports = initializeSockets; 
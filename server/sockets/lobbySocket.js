const Lobby = require('../models/Lobby');

/**
 * Handle lobby-related socket events
 * @param {Object} io - Socket.IO instance
 * @param {Object} socket - Socket instance
 */
const lobbySocket = (io, socket) => {
  // Join a lobby room
  socket.on('lobby:join', async (lobbyId) => {
    try {
      // Leave any previous lobby rooms
      const rooms = Array.from(socket.rooms);
      rooms.forEach(room => {
        if (room !== socket.id && room.startsWith('lobby:')) {
          socket.leave(room);
        }
      });
      
      // Join the new lobby room
      socket.join(`lobby:${lobbyId}`);
      
      // Notify other users in the lobby
      socket.to(`lobby:${lobbyId}`).emit('lobby:user-joined', {
        userId: socket.user.id,
        username: socket.user.username
      });
      
      console.log(`User ${socket.user.username} joined lobby room: ${lobbyId}`);
    } catch (error) {
      console.error('Error joining lobby room:', error);
      socket.emit('error', { message: 'Failed to join lobby room' });
    }
  });
  
  // Leave a lobby room
  socket.on('lobby:leave', async (lobbyId) => {
    try {
      socket.leave(`lobby:${lobbyId}`);
      
      // Notify other users in the lobby
      socket.to(`lobby:${lobbyId}`).emit('lobby:user-left', {
        userId: socket.user.id,
        username: socket.user.username
      });
      
      console.log(`User ${socket.user.username} left lobby room: ${lobbyId}`);
    } catch (error) {
      console.error('Error leaving lobby room:', error);
      socket.emit('error', { message: 'Failed to leave lobby room' });
    }
  });
  
  // Send a chat message in the lobby
  socket.on('lobby:chat', async ({ lobbyId, message }) => {
    try {
      // Validate message
      if (!message || typeof message !== 'string' || message.trim() === '') {
        return;
      }
      
      // Limit message length
      const trimmedMessage = message.trim().substring(0, 500);
      
      // Send message to all users in the lobby
      io.to(`lobby:${lobbyId}`).emit('lobby:chat-message', {
        userId: socket.user.id,
        username: socket.user.username,
        message: trimmedMessage,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error sending chat message:', error);
      socket.emit('error', { message: 'Failed to send chat message' });
    }
  });
  
  // Update lobby state (ready status, settings, etc.)
  socket.on('lobby:update', async ({ lobbyId }) => {
    try {
      // Get updated lobby data
      const lobby = await Lobby.findById(lobbyId)
        .populate('host', 'username')
        .populate('players.user', 'username');
      
      if (!lobby) {
        return socket.emit('error', { message: 'Lobby not found' });
      }
      
      // Send updated lobby data to all users in the lobby
      io.to(`lobby:${lobbyId}`).emit('lobby:updated', { lobby });
    } catch (error) {
      console.error('Error updating lobby state:', error);
      socket.emit('error', { message: 'Failed to update lobby state' });
    }
  });
};

module.exports = lobbySocket; 
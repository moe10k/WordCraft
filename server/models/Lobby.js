const mongoose = require('mongoose');

const LobbySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a lobby name'],
    trim: true,
    maxlength: [30, 'Lobby name cannot exceed 30 characters']
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  players: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isReady: {
      type: Boolean,
      default: false
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  maxPlayers: {
    type: Number,
    default: 8
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  password: {
    type: String,
    select: false // Don't return password in queries by default
  },
  status: {
    type: String,
    enum: ['waiting', 'starting', 'in-game', 'finished'],
    default: 'waiting'
  },
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameState',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
});

// Virtual for player count
LobbySchema.virtual('playerCount').get(function() {
  return this.players.length;
});

// Set JSON conversion to include virtuals
LobbySchema.set('toJSON', { virtuals: true });
LobbySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Lobby', LobbySchema); 
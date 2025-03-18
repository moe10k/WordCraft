const mongoose = require('mongoose');
const gameConfig = require('../config/gameConfig');

const GameStateSchema = new mongoose.Schema({
  lobbyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lobby',
    required: true
  },
  players: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    username: {
      type: String,
      required: true
    },
    lives: {
      type: Number,
      default: gameConfig.startingLives
    },
    score: {
      type: Number,
      default: 0
    },
    wordsCreated: {
      type: Number,
      default: 0
    },
    powerUps: [{
      type: {
        type: String,
        enum: Object.keys(gameConfig.powerUps)
      },
      used: {
        type: Boolean,
        default: false
      }
    }],
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  currentPlayerIndex: {
    type: Number,
    default: 0
  },
  currentLetters: {
    type: [String],
    default: []
  },
  currentWord: {
    type: String,
    default: ''
  },
  turnStartTime: {
    type: Date
  },
  turnTimeLimit: {
    type: Number,
    default: gameConfig.turnTimeLimit
  },
  round: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['starting', 'active', 'paused', 'finished'],
    default: 'starting'
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  gameHistory: [{
    round: Number,
    playerIndex: Number,
    username: String,
    letters: [String],
    word: String,
    isValid: Boolean,
    timeUsed: Number,
    powerUpUsed: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
GameStateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Get active players (players with lives > 0)
GameStateSchema.virtual('activePlayers').get(function() {
  return this.players.filter(player => player.lives > 0 && player.isActive);
});

// Get current player
GameStateSchema.virtual('currentPlayer').get(function() {
  return this.players[this.currentPlayerIndex];
});

// Set JSON conversion to include virtuals
GameStateSchema.set('toJSON', { virtuals: true });
GameStateSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('GameState', GameStateSchema); 
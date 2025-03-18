const Lobby = require('../models/Lobby');
const User = require('../models/User');
const gameConfig = require('../config/gameConfig');

/**
 * @desc    Create a new lobby
 * @route   POST /api/lobby
 * @access  Private
 */
exports.createLobby = async (req, res) => {
  try {
    const { name, maxPlayers, isPrivate, password } = req.body;
    
    // Validate max players
    if (maxPlayers && (maxPlayers < gameConfig.minPlayers || maxPlayers > gameConfig.maxPlayers)) {
      return res.status(400).json({
        success: false,
        message: `Players must be between ${gameConfig.minPlayers} and ${gameConfig.maxPlayers}`
      });
    }

    // Create new lobby
    const lobby = await Lobby.create({
      name,
      host: req.user.id,
      maxPlayers: maxPlayers || gameConfig.maxPlayers,
      isPrivate: isPrivate || false,
      password: password || null,
      players: [{ user: req.user.id, isReady: false }]
    });

    // Populate host and player details
    const populatedLobby = await Lobby.findById(lobby._id)
      .populate('host', 'username')
      .populate('players.user', 'username');

    res.status(201).json({
      success: true,
      lobby: populatedLobby
    });
  } catch (error) {
    console.error('Create lobby error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get all public lobbies
 * @route   GET /api/lobby
 * @access  Private
 */
exports.getLobbies = async (req, res) => {
  try {
    // Get all public lobbies that are waiting for players
    const lobbies = await Lobby.find({ 
      isPrivate: false,
      status: 'waiting'
    })
      .populate('host', 'username')
      .populate('players.user', 'username')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: lobbies.length,
      lobbies
    });
  } catch (error) {
    console.error('Get lobbies error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get a single lobby by ID
 * @route   GET /api/lobby/:id
 * @access  Private
 */
exports.getLobby = async (req, res) => {
  try {
    const lobby = await Lobby.findById(req.params.id)
      .populate('host', 'username')
      .populate('players.user', 'username');

    if (!lobby) {
      return res.status(404).json({
        success: false,
        message: 'Lobby not found'
      });
    }

    res.status(200).json({
      success: true,
      lobby
    });
  } catch (error) {
    console.error('Get lobby error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Join a lobby
 * @route   POST /api/lobby/:id/join
 * @access  Private
 */
exports.joinLobby = async (req, res) => {
  try {
    const { password } = req.body;
    
    // Find the lobby
    const lobby = await Lobby.findById(req.params.id).select('+password');
    
    if (!lobby) {
      return res.status(404).json({
        success: false,
        message: 'Lobby not found'
      });
    }
    
    // Check if lobby is full
    if (lobby.players.length >= lobby.maxPlayers) {
      return res.status(400).json({
        success: false,
        message: 'Lobby is full'
      });
    }
    
    // Check if lobby is in waiting status
    if (lobby.status !== 'waiting') {
      return res.status(400).json({
        success: false,
        message: 'Cannot join lobby - game already in progress'
      });
    }
    
    // Check if player is already in the lobby
    const playerExists = lobby.players.some(player => 
      player.user.toString() === req.user.id
    );
    
    if (playerExists) {
      return res.status(400).json({
        success: false,
        message: 'You are already in this lobby'
      });
    }
    
    // Check password for private lobbies
    if (lobby.isPrivate && lobby.password) {
      if (!password) {
        return res.status(401).json({
          success: false,
          message: 'Password required to join this lobby'
        });
      }
      
      if (password !== lobby.password) {
        return res.status(401).json({
          success: false,
          message: 'Incorrect password'
        });
      }
    }
    
    // Add player to lobby
    lobby.players.push({
      user: req.user.id,
      isReady: false,
      joinedAt: Date.now()
    });
    
    // Update last activity
    lobby.lastActivity = Date.now();
    
    await lobby.save();
    
    // Return populated lobby
    const populatedLobby = await Lobby.findById(lobby._id)
      .populate('host', 'username')
      .populate('players.user', 'username');
    
    res.status(200).json({
      success: true,
      lobby: populatedLobby
    });
  } catch (error) {
    console.error('Join lobby error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Leave a lobby
 * @route   POST /api/lobby/:id/leave
 * @access  Private
 */
exports.leaveLobby = async (req, res) => {
  try {
    const lobby = await Lobby.findById(req.params.id);
    
    if (!lobby) {
      return res.status(404).json({
        success: false,
        message: 'Lobby not found'
      });
    }
    
    // Check if player is in the lobby
    const playerIndex = lobby.players.findIndex(player => 
      player.user.toString() === req.user.id
    );
    
    if (playerIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'You are not in this lobby'
      });
    }
    
    // Remove player from lobby
    lobby.players.splice(playerIndex, 1);
    
    // If host is leaving, assign a new host or delete the lobby
    if (lobby.host.toString() === req.user.id) {
      if (lobby.players.length > 0) {
        // Assign the oldest player as the new host
        lobby.host = lobby.players[0].user;
      } else {
        // Delete the lobby if no players remain
        await Lobby.findByIdAndDelete(req.params.id);
        return res.status(200).json({
          success: true,
          message: 'Lobby deleted as no players remain'
        });
      }
    }
    
    // Update last activity
    lobby.lastActivity = Date.now();
    
    await lobby.save();
    
    // Return populated lobby
    const populatedLobby = await Lobby.findById(lobby._id)
      .populate('host', 'username')
      .populate('players.user', 'username');
    
    res.status(200).json({
      success: true,
      lobby: populatedLobby
    });
  } catch (error) {
    console.error('Leave lobby error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Set player ready status
 * @route   POST /api/lobby/:id/ready
 * @access  Private
 */
exports.setReady = async (req, res) => {
  try {
    const { isReady } = req.body;
    
    const lobby = await Lobby.findById(req.params.id);
    
    if (!lobby) {
      return res.status(404).json({
        success: false,
        message: 'Lobby not found'
      });
    }
    
    // Check if player is in the lobby
    const playerIndex = lobby.players.findIndex(player => 
      player.user.toString() === req.user.id
    );
    
    if (playerIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'You are not in this lobby'
      });
    }
    
    // Update player ready status
    lobby.players[playerIndex].isReady = isReady;
    
    // Update last activity
    lobby.lastActivity = Date.now();
    
    await lobby.save();
    
    // Return populated lobby
    const populatedLobby = await Lobby.findById(lobby._id)
      .populate('host', 'username')
      .populate('players.user', 'username');
    
    res.status(200).json({
      success: true,
      lobby: populatedLobby
    });
  } catch (error) {
    console.error('Set ready error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Update lobby settings (host only)
 * @route   PUT /api/lobby/:id
 * @access  Private
 */
exports.updateLobby = async (req, res) => {
  try {
    const { name, maxPlayers, isPrivate, password } = req.body;
    
    const lobby = await Lobby.findById(req.params.id);
    
    if (!lobby) {
      return res.status(404).json({
        success: false,
        message: 'Lobby not found'
      });
    }
    
    // Check if user is the host
    if (lobby.host.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can update lobby settings'
      });
    }
    
    // Validate max players
    if (maxPlayers && (maxPlayers < gameConfig.minPlayers || maxPlayers > gameConfig.maxPlayers)) {
      return res.status(400).json({
        success: false,
        message: `Players must be between ${gameConfig.minPlayers} and ${gameConfig.maxPlayers}`
      });
    }
    
    // Update fields if provided
    if (name) lobby.name = name;
    if (maxPlayers) lobby.maxPlayers = maxPlayers;
    if (typeof isPrivate !== 'undefined') lobby.isPrivate = isPrivate;
    if (typeof password !== 'undefined') lobby.password = password;
    
    // Update last activity
    lobby.lastActivity = Date.now();
    
    await lobby.save();
    
    // Return populated lobby
    const populatedLobby = await Lobby.findById(lobby._id)
      .populate('host', 'username')
      .populate('players.user', 'username');
    
    res.status(200).json({
      success: true,
      lobby: populatedLobby
    });
  } catch (error) {
    console.error('Update lobby error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
}; 
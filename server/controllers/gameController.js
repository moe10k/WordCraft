const GameState = require('../models/GameState');
const Lobby = require('../models/Lobby');
const User = require('../models/User');
const gameConfig = require('../config/gameConfig');
const { generateLetters } = require('../../utils/generateLetters');
const { isValidWord } = require('../../utils/wordValidator');
const { calculateTimeElapsed } = require('../../utils/timer');

/**
 * @desc    Start a new game from a lobby
 * @route   POST /api/game/start/:lobbyId
 * @access  Private
 */
exports.startGame = async (req, res) => {
  try {
    const lobby = await Lobby.findById(req.params.lobbyId)
      .populate('players.user', 'username');
    
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
        message: 'Only the host can start the game'
      });
    }
    
    // Check if there are enough players
    if (lobby.players.length < gameConfig.minPlayers) {
      return res.status(400).json({
        success: false,
        message: `Need at least ${gameConfig.minPlayers} players to start`
      });
    }
    
    // Check if all players are ready
    const allReady = lobby.players.every(player => player.isReady || player.user.toString() === req.user.id);
    if (!allReady) {
      return res.status(400).json({
        success: false,
        message: 'All players must be ready to start'
      });
    }
    
    // Create game state
    const gameState = await GameState.create({
      lobbyId: lobby._id,
      players: lobby.players.map(player => ({
        user: player.user._id,
        username: player.user.username,
        lives: gameConfig.startingLives,
        score: 0,
        wordsCreated: 0,
        powerUps: [],
        isActive: true
      })),
      currentPlayerIndex: 0,
      currentLetters: generateLetters(2),
      turnStartTime: new Date(),
      status: 'starting'
    });
    
    // Update lobby status
    lobby.status = 'in-game';
    lobby.gameId = gameState._id;
    await lobby.save();
    
    // Return game state
    res.status(201).json({
      success: true,
      game: gameState
    });
  } catch (error) {
    console.error('Start game error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get current game state
 * @route   GET /api/game/:id
 * @access  Private
 */
exports.getGameState = async (req, res) => {
  try {
    const gameState = await GameState.findById(req.params.id);
    
    if (!gameState) {
      return res.status(404).json({
        success: false,
        message: 'Game not found'
      });
    }
    
    // Check if user is a player in the game
    const isPlayer = gameState.players.some(player => 
      player.user.toString() === req.user.id
    );
    
    if (!isPlayer) {
      return res.status(403).json({
        success: false,
        message: 'You are not a player in this game'
      });
    }
    
    res.status(200).json({
      success: true,
      game: gameState
    });
  } catch (error) {
    console.error('Get game state error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Submit a word for the current turn
 * @route   POST /api/game/:id/submit
 * @access  Private
 */
exports.submitWord = async (req, res) => {
  try {
    const { word } = req.body;
    
    const gameState = await GameState.findById(req.params.id);
    
    if (!gameState) {
      return res.status(404).json({
        success: false,
        message: 'Game not found'
      });
    }
    
    // Check if game is active
    if (gameState.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Game is not active'
      });
    }
    
    // Check if it's the user's turn
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'It is not your turn'
      });
    }
    
    // Calculate time elapsed
    const timeElapsed = calculateTimeElapsed(gameState.turnStartTime);
    
    // Check if time is up
    if (timeElapsed > gameState.turnTimeLimit) {
      return res.status(400).json({
        success: false,
        message: 'Time is up'
      });
    }
    
    // Validate the word
    const isValid = isValidWord(word, gameState.currentLetters);
    
    // Record the word in game history
    gameState.gameHistory.push({
      round: gameState.round,
      playerIndex: gameState.currentPlayerIndex,
      username: currentPlayer.username,
      letters: gameState.currentLetters,
      word: word,
      isValid: isValid,
      timeUsed: timeElapsed,
      powerUpUsed: null
    });
    
    // Update current word
    gameState.currentWord = word;
    
    // If word is valid, update player stats
    if (isValid) {
      // Update player score (score = word length)
      currentPlayer.score += word.length;
      currentPlayer.wordsCreated += 1;
      
      // Move to next player
      await moveToNextPlayer(gameState);
      
      res.status(200).json({
        success: true,
        valid: true,
        game: gameState
      });
    } else {
      // Word is invalid, player loses a life
      currentPlayer.lives -= 1;
      
      // Check if player is eliminated
      if (currentPlayer.lives <= 0) {
        currentPlayer.isActive = false;
      }
      
      // Check if game is over (only one player left)
      const activePlayers = gameState.players.filter(player => player.lives > 0 && player.isActive);
      
      if (activePlayers.length <= 1) {
        // Game over, set winner
        gameState.status = 'finished';
        if (activePlayers.length === 1) {
          gameState.winner = activePlayers[0].user;
          
          // Update user stats
          await User.findByIdAndUpdate(activePlayers[0].user, {
            $inc: {
              'stats.gamesWon': 1,
              'stats.gamesPlayed': 1,
              'stats.totalScore': activePlayers[0].score,
              'stats.wordsCreated': activePlayers[0].wordsCreated
            }
          });
        }
        
        // Update stats for all other players
        for (const player of gameState.players) {
          if (player.user.toString() !== gameState.winner?.toString()) {
            await User.findByIdAndUpdate(player.user, {
              $inc: {
                'stats.gamesPlayed': 1,
                'stats.totalScore': player.score,
                'stats.wordsCreated': player.wordsCreated
              }
            });
          }
        }
        
        // Update lobby status
        await Lobby.findByIdAndUpdate(gameState.lobbyId, {
          status: 'finished'
        });
      } else {
        // Move to next player
        await moveToNextPlayer(gameState);
      }
      
      res.status(200).json({
        success: true,
        valid: false,
        game: gameState
      });
    }
  } catch (error) {
    console.error('Submit word error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Use a power-up
 * @route   POST /api/game/:id/power-up
 * @access  Private
 */
exports.usePowerUp = async (req, res) => {
  try {
    const { powerUpType } = req.body;
    
    const gameState = await GameState.findById(req.params.id);
    
    if (!gameState) {
      return res.status(404).json({
        success: false,
        message: 'Game not found'
      });
    }
    
    // Check if game is active
    if (gameState.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Game is not active'
      });
    }
    
    // Check if it's the user's turn
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'It is not your turn'
      });
    }
    
    // Check if player has the power-up
    const powerUpIndex = currentPlayer.powerUps.findIndex(
      p => p.type === powerUpType && !p.used
    );
    
    if (powerUpIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'You do not have this power-up'
      });
    }
    
    // Mark power-up as used
    currentPlayer.powerUps[powerUpIndex].used = true;
    
    // Apply power-up effect
    switch (powerUpType) {
      case 'extraTime':
        // Add extra time to the turn
        gameState.turnTimeLimit += gameConfig.powerUps.extraTime.effect;
        break;
        
      case 'skipTurn':
        // Skip turn without losing a life
        await moveToNextPlayer(gameState);
        break;
        
      case 'extraLife':
        // Add an extra life (max 3)
        if (currentPlayer.lives < gameConfig.startingLives) {
          currentPlayer.lives += gameConfig.powerUps.extraLife.effect;
        }
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid power-up type'
        });
    }
    
    await gameState.save();
    
    res.status(200).json({
      success: true,
      game: gameState
    });
  } catch (error) {
    console.error('Use power-up error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Handle turn timeout
 * @route   POST /api/game/:id/timeout
 * @access  Private
 */
exports.handleTimeout = async (req, res) => {
  try {
    const gameState = await GameState.findById(req.params.id);
    
    if (!gameState) {
      return res.status(404).json({
        success: false,
        message: 'Game not found'
      });
    }
    
    // Check if game is active
    if (gameState.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Game is not active'
      });
    }
    
    // Calculate time elapsed
    const timeElapsed = calculateTimeElapsed(gameState.turnStartTime);
    
    // Check if time is actually up
    if (timeElapsed <= gameState.turnTimeLimit) {
      return res.status(400).json({
        success: false,
        message: 'Turn time has not expired yet'
      });
    }
    
    // Current player loses a life
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    currentPlayer.lives -= 1;
    
    // Record the timeout in game history
    gameState.gameHistory.push({
      round: gameState.round,
      playerIndex: gameState.currentPlayerIndex,
      username: currentPlayer.username,
      letters: gameState.currentLetters,
      word: '',
      isValid: false,
      timeUsed: timeElapsed,
      powerUpUsed: null
    });
    
    // Check if player is eliminated
    if (currentPlayer.lives <= 0) {
      currentPlayer.isActive = false;
    }
    
    // Check if game is over (only one player left)
    const activePlayers = gameState.players.filter(player => player.lives > 0 && player.isActive);
    
    if (activePlayers.length <= 1) {
      // Game over, set winner
      gameState.status = 'finished';
      if (activePlayers.length === 1) {
        gameState.winner = activePlayers[0].user;
        
        // Update user stats
        await User.findByIdAndUpdate(activePlayers[0].user, {
          $inc: {
            'stats.gamesWon': 1,
            'stats.gamesPlayed': 1,
            'stats.totalScore': activePlayers[0].score,
            'stats.wordsCreated': activePlayers[0].wordsCreated
          }
        });
      }
      
      // Update stats for all other players
      for (const player of gameState.players) {
        if (player.user.toString() !== gameState.winner?.toString()) {
          await User.findByIdAndUpdate(player.user, {
            $inc: {
              'stats.gamesPlayed': 1,
              'stats.totalScore': player.score,
              'stats.wordsCreated': player.wordsCreated
            }
          });
        }
      }
      
      // Update lobby status
      await Lobby.findByIdAndUpdate(gameState.lobbyId, {
        status: 'finished'
      });
    } else {
      // Move to next player
      await moveToNextPlayer(gameState);
    }
    
    res.status(200).json({
      success: true,
      game: gameState
    });
  } catch (error) {
    console.error('Handle timeout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Helper function to move to the next player
 * @param {Object} gameState - The current game state
 */
const moveToNextPlayer = async (gameState) => {
  // Increment round
  gameState.round += 1;
  
  // Find next active player
  let nextPlayerIndex = gameState.currentPlayerIndex;
  let playerFound = false;
  
  // Loop through players until we find an active one
  for (let i = 0; i < gameState.players.length; i++) {
    // Move to next player
    nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
    
    // Check if player is active
    if (gameState.players[nextPlayerIndex].lives > 0 && gameState.players[nextPlayerIndex].isActive) {
      playerFound = true;
      break;
    }
  }
  
  // If no active player found, game is over
  if (!playerFound) {
    gameState.status = 'finished';
  } else {
    // Update current player
    gameState.currentPlayerIndex = nextPlayerIndex;
    
    // Generate new letters
    gameState.currentLetters = generateLetters(2);
    
    // Reset current word
    gameState.currentWord = '';
    
    // Reset turn time limit
    gameState.turnTimeLimit = gameConfig.turnTimeLimit;
    
    // Set new turn start time
    gameState.turnStartTime = new Date();
    
    // Randomly give power-up to player (20% chance)
    if (Math.random() < 0.2) {
      // Choose a random power-up based on probability
      const powerUpTypes = Object.keys(gameConfig.powerUps);
      const probabilities = powerUpTypes.map(type => gameConfig.powerUps[type].probability);
      
      // Normalize probabilities
      const totalProb = probabilities.reduce((sum, prob) => sum + prob, 0);
      const normalizedProbs = probabilities.map(prob => prob / totalProb);
      
      // Choose a power-up
      const rand = Math.random();
      let cumProb = 0;
      let chosenPowerUp = powerUpTypes[0];
      
      for (let i = 0; i < normalizedProbs.length; i++) {
        cumProb += normalizedProbs[i];
        if (rand <= cumProb) {
          chosenPowerUp = powerUpTypes[i];
          break;
        }
      }
      
      // Add power-up to player
      gameState.players[nextPlayerIndex].powerUps.push({
        type: chosenPowerUp,
        used: false
      });
    }
  }
  
  await gameState.save();
  return gameState;
}; 
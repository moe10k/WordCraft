const GameState = require('../models/GameState');
const { generateLetters } = require('../../utils/generateLetters');
const { isValidWord } = require('../../utils/wordValidator');
const { calculateTimeElapsed } = require('../../utils/timer');
const gameConfig = require('../config/gameConfig');

/**
 * Handle game-related socket events
 * @param {Object} io - Socket.IO instance
 * @param {Object} socket - Socket instance
 */
const gameSocket = (io, socket) => {
  // Join a game room
  socket.on('game:join', async (gameId) => {
    try {
      // Leave any previous game rooms
      const rooms = Array.from(socket.rooms);
      rooms.forEach(room => {
        if (room !== socket.id && room.startsWith('game:')) {
          socket.leave(room);
        }
      });
      
      // Join the new game room
      socket.join(`game:${gameId}`);
      
      // Get game state
      const gameState = await GameState.findById(gameId);
      
      if (!gameState) {
        return socket.emit('error', { message: 'Game not found' });
      }
      
      // Check if user is a player in the game
      const isPlayer = gameState.players.some(player => 
        player.user.toString() === socket.user.id
      );
      
      if (!isPlayer) {
        socket.leave(`game:${gameId}`);
        return socket.emit('error', { message: 'You are not a player in this game' });
      }
      
      // Notify other users in the game
      socket.to(`game:${gameId}`).emit('game:user-joined', {
        userId: socket.user.id,
        username: socket.user.username
      });
      
      console.log(`User ${socket.user.username} joined game room: ${gameId}`);
      
      // If game is in 'starting' status, update to 'active' when all players have joined
      if (gameState.status === 'starting') {
        const connectedSockets = await io.in(`game:${gameId}`).fetchSockets();
        const connectedUserIds = connectedSockets.map(s => s.user.id);
        
        // Check if all players are connected
        const allPlayersConnected = gameState.players.every(player => 
          connectedUserIds.includes(player.user.toString())
        );
        
        if (allPlayersConnected) {
          gameState.status = 'active';
          gameState.turnStartTime = new Date();
          await gameState.save();
          
          // Emit game start event
          io.to(`game:${gameId}`).emit('game:started', { game: gameState });
        }
      }
    } catch (error) {
      console.error('Error joining game room:', error);
      socket.emit('error', { message: 'Failed to join game room' });
    }
  });
  
  // Leave a game room
  socket.on('game:leave', async (gameId) => {
    try {
      socket.leave(`game:${gameId}`);
      
      // Notify other users in the game
      socket.to(`game:${gameId}`).emit('game:user-left', {
        userId: socket.user.id,
        username: socket.user.username
      });
      
      console.log(`User ${socket.user.username} left game room: ${gameId}`);
      
      // Get game state
      const gameState = await GameState.findById(gameId);
      
      if (!gameState) {
        return;
      }
      
      // If game is active, mark player as inactive
      if (gameState.status === 'active') {
        const playerIndex = gameState.players.findIndex(player => 
          player.user.toString() === socket.user.id
        );
        
        if (playerIndex !== -1) {
          gameState.players[playerIndex].isActive = false;
          
          // Check if it's the current player's turn
          if (gameState.currentPlayerIndex === playerIndex) {
            // Move to next player
            await moveToNextPlayer(gameState);
            
            // Emit turn change event
            io.to(`game:${gameId}`).emit('game:turn-change', { game: gameState });
          }
          
          // Check if game is over (only one player left)
          const activePlayers = gameState.players.filter(player => 
            player.lives > 0 && player.isActive
          );
          
          if (activePlayers.length <= 1) {
            // Game over, set winner
            gameState.status = 'finished';
            if (activePlayers.length === 1) {
              gameState.winner = activePlayers[0].user;
            }
            
            await gameState.save();
            
            // Emit game over event
            io.to(`game:${gameId}`).emit('game:over', { game: gameState });
          } else {
            await gameState.save();
          }
        }
      }
    } catch (error) {
      console.error('Error leaving game room:', error);
      socket.emit('error', { message: 'Failed to leave game room' });
    }
  });
  
  // Send current typing in real-time
  socket.on('game:typing', async ({ gameId, word }) => {
    try {
      // Get game state
      const gameState = await GameState.findById(gameId);
      
      if (!gameState || gameState.status !== 'active') {
        return;
      }
      
      // Check if it's the user's turn
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (currentPlayer.user.toString() !== socket.user.id) {
        return;
      }
      
      // Broadcast typing to other players
      socket.to(`game:${gameId}`).emit('game:player-typing', {
        userId: socket.user.id,
        username: socket.user.username,
        word
      });
    } catch (error) {
      console.error('Error broadcasting typing:', error);
    }
  });
  
  // Submit a word
  socket.on('game:submit-word', async ({ gameId, word }) => {
    try {
      // Get game state
      const gameState = await GameState.findById(gameId);
      
      if (!gameState) {
        return socket.emit('error', { message: 'Game not found' });
      }
      
      // Check if game is active
      if (gameState.status !== 'active') {
        return socket.emit('error', { message: 'Game is not active' });
      }
      
      // Check if it's the user's turn
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (currentPlayer.user.toString() !== socket.user.id) {
        return socket.emit('error', { message: 'It is not your turn' });
      }
      
      // Calculate time elapsed
      const timeElapsed = calculateTimeElapsed(gameState.turnStartTime);
      
      // Check if time is up
      if (timeElapsed > gameState.turnTimeLimit) {
        return socket.emit('error', { message: 'Time is up' });
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
        
        // Emit word submitted event
        io.to(`game:${gameId}`).emit('game:word-submitted', {
          userId: socket.user.id,
          username: socket.user.username,
          word,
          isValid,
          score: currentPlayer.score
        });
        
        // Move to next player
        await moveToNextPlayer(gameState);
        
        // Emit turn change event
        io.to(`game:${gameId}`).emit('game:turn-change', { game: gameState });
      } else {
        // Word is invalid, player loses a life
        currentPlayer.lives -= 1;
        
        // Emit word submitted event
        io.to(`game:${gameId}`).emit('game:word-submitted', {
          userId: socket.user.id,
          username: socket.user.username,
          word,
          isValid,
          livesRemaining: currentPlayer.lives
        });
        
        // Check if player is eliminated
        if (currentPlayer.lives <= 0) {
          currentPlayer.isActive = false;
          
          // Emit player eliminated event
          io.to(`game:${gameId}`).emit('game:player-eliminated', {
            userId: socket.user.id,
            username: socket.user.username
          });
        }
        
        // Check if game is over (only one player left)
        const activePlayers = gameState.players.filter(player => 
          player.lives > 0 && player.isActive
        );
        
        if (activePlayers.length <= 1) {
          // Game over, set winner
          gameState.status = 'finished';
          if (activePlayers.length === 1) {
            gameState.winner = activePlayers[0].user;
            
            // Emit game over event
            io.to(`game:${gameId}`).emit('game:over', { 
              game: gameState,
              winner: {
                userId: activePlayers[0].user,
                username: activePlayers[0].username,
                score: activePlayers[0].score
              }
            });
          } else {
            // No winner (all players eliminated)
            io.to(`game:${gameId}`).emit('game:over', { 
              game: gameState,
              winner: null
            });
          }
        } else {
          // Move to next player
          await moveToNextPlayer(gameState);
          
          // Emit turn change event
          io.to(`game:${gameId}`).emit('game:turn-change', { game: gameState });
        }
      }
    } catch (error) {
      console.error('Error submitting word:', error);
      socket.emit('error', { message: 'Failed to submit word' });
    }
  });
  
  // Use a power-up
  socket.on('game:use-power-up', async ({ gameId, powerUpType }) => {
    try {
      // Get game state
      const gameState = await GameState.findById(gameId);
      
      if (!gameState) {
        return socket.emit('error', { message: 'Game not found' });
      }
      
      // Check if game is active
      if (gameState.status !== 'active') {
        return socket.emit('error', { message: 'Game is not active' });
      }
      
      // Check if it's the user's turn
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (currentPlayer.user.toString() !== socket.user.id) {
        return socket.emit('error', { message: 'It is not your turn' });
      }
      
      // Check if player has the power-up
      const powerUpIndex = currentPlayer.powerUps.findIndex(
        p => p.type === powerUpType && !p.used
      );
      
      if (powerUpIndex === -1) {
        return socket.emit('error', { message: 'You do not have this power-up' });
      }
      
      // Mark power-up as used
      currentPlayer.powerUps[powerUpIndex].used = true;
      
      // Apply power-up effect
      let powerUpEffect = null;
      
      switch (powerUpType) {
        case 'extraTime':
          // Add extra time to the turn
          gameState.turnTimeLimit += gameConfig.powerUps.extraTime.effect;
          powerUpEffect = `+${gameConfig.powerUps.extraTime.effect} seconds`;
          break;
          
        case 'skipTurn':
          // Skip turn without losing a life
          powerUpEffect = 'Skip turn';
          await moveToNextPlayer(gameState);
          break;
          
        case 'extraLife':
          // Add an extra life (max 3)
          if (currentPlayer.lives < gameConfig.startingLives) {
            currentPlayer.lives += gameConfig.powerUps.extraLife.effect;
            powerUpEffect = `+${gameConfig.powerUps.extraLife.effect} life`;
          }
          break;
          
        default:
          return socket.emit('error', { message: 'Invalid power-up type' });
      }
      
      await gameState.save();
      
      // Emit power-up used event
      io.to(`game:${gameId}`).emit('game:power-up-used', {
        userId: socket.user.id,
        username: socket.user.username,
        powerUpType,
        effect: powerUpEffect
      });
      
      // If power-up was skip turn, emit turn change event
      if (powerUpType === 'skipTurn') {
        io.to(`game:${gameId}`).emit('game:turn-change', { game: gameState });
      }
    } catch (error) {
      console.error('Error using power-up:', error);
      socket.emit('error', { message: 'Failed to use power-up' });
    }
  });
  
  // Handle turn timeout
  socket.on('game:timeout', async ({ gameId }) => {
    try {
      // Get game state
      const gameState = await GameState.findById(gameId);
      
      if (!gameState) {
        return socket.emit('error', { message: 'Game not found' });
      }
      
      // Check if game is active
      if (gameState.status !== 'active') {
        return socket.emit('error', { message: 'Game is not active' });
      }
      
      // Calculate time elapsed
      const timeElapsed = calculateTimeElapsed(gameState.turnStartTime);
      
      // Check if time is actually up
      if (timeElapsed <= gameState.turnTimeLimit) {
        return socket.emit('error', { message: 'Turn time has not expired yet' });
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
      
      // Emit timeout event
      io.to(`game:${gameId}`).emit('game:timeout', {
        userId: currentPlayer.user,
        username: currentPlayer.username,
        livesRemaining: currentPlayer.lives
      });
      
      // Check if player is eliminated
      if (currentPlayer.lives <= 0) {
        currentPlayer.isActive = false;
        
        // Emit player eliminated event
        io.to(`game:${gameId}`).emit('game:player-eliminated', {
          userId: currentPlayer.user,
          username: currentPlayer.username
        });
      }
      
      // Check if game is over (only one player left)
      const activePlayers = gameState.players.filter(player => 
        player.lives > 0 && player.isActive
      );
      
      if (activePlayers.length <= 1) {
        // Game over, set winner
        gameState.status = 'finished';
        if (activePlayers.length === 1) {
          gameState.winner = activePlayers[0].user;
          
          // Emit game over event
          io.to(`game:${gameId}`).emit('game:over', { 
            game: gameState,
            winner: {
              userId: activePlayers[0].user,
              username: activePlayers[0].username,
              score: activePlayers[0].score
            }
          });
        } else {
          // No winner (all players eliminated)
          io.to(`game:${gameId}`).emit('game:over', { 
            game: gameState,
            winner: null
          });
        }
      } else {
        // Move to next player
        await moveToNextPlayer(gameState);
        
        // Emit turn change event
        io.to(`game:${gameId}`).emit('game:turn-change', { game: gameState });
      }
    } catch (error) {
      console.error('Error handling timeout:', error);
      socket.emit('error', { message: 'Failed to handle timeout' });
    }
  });
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

module.exports = gameSocket; 
const express = require('express');
const router = express.Router();
const { 
  startGame,
  getGameState,
  submitWord,
  usePowerUp,
  handleTimeout
} = require('../controllers/gameController');
const { protect } = require('../middleware/auth');

// All game routes are protected
router.use(protect);

// Start a new game from a lobby
router.post('/start/:lobbyId', startGame);

// Get game state
router.get('/:id', getGameState);

// Game actions
router.post('/:id/submit', submitWord);
router.post('/:id/power-up', usePowerUp);
router.post('/:id/timeout', handleTimeout);

module.exports = router; 
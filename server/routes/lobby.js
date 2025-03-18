const express = require('express');
const router = express.Router();
const { 
  createLobby,
  getLobbies,
  getLobby,
  joinLobby,
  leaveLobby,
  setReady,
  updateLobby
} = require('../controllers/lobbyController');
const { protect } = require('../middleware/auth');

// All lobby routes are protected
router.use(protect);

// Get all lobbies and create new lobby
router.route('/')
  .get(getLobbies)
  .post(createLobby);

// Get, update, join, leave specific lobby
router.route('/:id')
  .get(getLobby)
  .put(updateLobby);

// Join, leave, set ready status
router.post('/:id/join', joinLobby);
router.post('/:id/leave', leaveLobby);
router.post('/:id/ready', setReady);

module.exports = router; 
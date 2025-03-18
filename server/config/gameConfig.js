/**
 * Game configuration settings
 */
module.exports = {
  // Time limit for each turn in seconds
  turnTimeLimit: 10,
  
  // Maximum number of players per game
  maxPlayers: 8,
  
  // Minimum number of players required to start a game
  minPlayers: 2,
  
  // Number of lives each player starts with
  startingLives: 3,
  
  // Power-ups configuration
  powerUps: {
    extraTime: {
      name: 'Extra Time',
      description: 'Adds 5 seconds to your turn',
      effect: 5, // seconds to add
      probability: 0.2 // 20% chance to get this power-up
    },
    skipTurn: {
      name: 'Skip Turn',
      description: 'Skip your turn without losing a life',
      effect: 'skip',
      probability: 0.1 // 10% chance to get this power-up
    },
    extraLife: {
      name: 'Extra Life',
      description: 'Gain an extra life (max 3)',
      effect: 1, // life to add
      probability: 0.05 // 5% chance to get this power-up
    }
  },
  
  // Lobby settings
  lobby: {
    // Time in seconds before an inactive lobby is automatically closed
    inactivityTimeout: 300, // 5 minutes
    
    // Maximum time a lobby can exist without starting a game
    maxLobbyLifetime: 1800 // 30 minutes
  }
}; 
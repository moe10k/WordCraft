# Word Game - Multiplayer Online Game

A real-time multiplayer word game built with Node.js, Express, MongoDB, and Socket.IO.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Setup and Installation](#setup-and-installation)
- [User Interface](#user-interface)
- [API Routes](#api-routes)
- [Socket.IO Events](#socketio-events)
- [Game Rules](#game-rules)
- [Changelog](#changelog)
- [Troubleshooting](#troubleshooting)

## Overview

Word Game is a real-time multiplayer game where players create words from random letters. Players can create or join lobbies, chat with other players, and compete to create the most words in a timed round.

## Features

- **User Authentication**
  - Register and login with email/password
  - JWT-based authentication
  - "Remember me" functionality
  - Password reset via email
  - Session management

- **Lobby System**
  - Create public or private lobbies
  - Join existing lobbies
  - Real-time chat in lobbies
  - Ready/unready system

- **Game Mechanics**
  - Timed rounds
  - Random letter generation
  - Word validation
  - Scoring system
  - Power-ups

- **Real-time Features**
  - Live player status updates
  - Game state synchronization
  - Online player counter

- **User Interface**
  - Dark-themed futuristic/neon aesthetic
  - Responsive design for all screen sizes
  - Interactive menu system
  - Leaderboards
  - Settings customization

## Project Structure

```
word-game/
├── public/                  # Frontend assets
│   ├── css/                 # CSS stylesheets
│   │   └── styles.css       # Main stylesheet
│   ├── js/                  # Client-side JavaScript
│   │   ├── auth.js          # Authentication logic
│   │   ├── game.js          # Game logic
│   │   ├── lobby.js         # Lobby logic
│   │   ├── menu.js          # Menu logic
│   │   └── socket.js        # Socket.IO client setup
│   ├── index.html           # Login/Register page
│   ├── menu.html            # Main menu page
│   ├── lobby.html           # Lobby page
│   └── game.html            # Game page
├── server/                  # Backend code
│   ├── config/              # Configuration files
│   │   ├── db.js            # Database connection
│   │   └── gameConfig.js    # Game settings
│   ├── controllers/         # Route controllers
│   │   ├── authController.js # Authentication controller
│   │   ├── lobbyController.js # Lobby controller
│   │   └── gameController.js # Game controller
│   ├── middleware/          # Express middleware
│   │   └── auth.js          # Authentication middleware
│   ├── models/              # Mongoose models
│   │   ├── User.js          # User model
│   │   ├── Lobby.js         # Lobby model
│   │   └── GameState.js     # Game state model
│   ├── routes/              # Express routes
│   │   ├── auth.js          # Authentication routes
│   │   ├── lobby.js         # Lobby routes
│   │   └── game.js          # Game routes
│   ├── sockets/             # Socket.IO handlers
│   │   ├── index.js         # Socket.IO initialization
│   │   ├── lobbySocket.js   # Lobby socket handlers
│   │   └── gameSocket.js    # Game socket handlers
│   └── server.js            # Main server file
├── utils/                   # Utility functions
├── .env                     # Environment variables
├── package.json             # Project dependencies
└── README.md                # Project documentation
```

## Setup and Installation

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/word-game.git
   cd word-game
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/wordgame
   JWT_SECRET=your_jwt_secret_key_change_in_production
   NODE_ENV=development
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000`

## User Interface

### Authentication Screen
- Dark-themed login/register form with particle animation background
- Toggle between login and registration
- "Remember me" option
- Password reset functionality

### Menu Screen
- Dark-themed with futuristic/neon aesthetic
- Top navigation bar with username, avatar, and dropdown menu
- Four main menu options displayed as interactive cards:
  - Create Lobby: Opens the lobby creation modal
  - Join Lobby: Scrolls to active lobbies list
  - Leaderboard: Shows the leaderboard modal
  - Settings: Opens the settings modal
- Active lobbies list with refresh button
- Online player counter

### Lobby Creation Modal
- Lobby name input field (required)
- Max players dropdown (2-10 players)
- Private lobby toggle
- Password field (shown only for private lobbies)
- Game mode selection (Standard/Hardcore)

### Leaderboard Screen
- Tabs for different ranking categories:
  - Most Wins
  - Most Words
  - Best Win Rate
- Player ranking display with position, avatar, username, and stats
- Highlighted top 3 players

### Settings Modal
- Username change option
- Sound toggle
- Music toggle
- Theme selection (Dark/Light/Neon)

### Lobby Waiting Room
- Chat functionality
- Player list with status indicators
- Ready/Unready toggle
- Lobby information display
- Start game button (host only)

### Game Screen
- Current letter display
- Word input field
- Game board with created words
- Player scores
- Timer countdown
- Power-ups section

## API Routes

### Authentication Routes

- `POST /api/auth/register` - Register a new user
  - Request: `{ username, email, password }`
  - Response: `{ success, user, token }`

- `POST /api/auth/login` - Login a user
  - Request: `{ email, password }`
  - Response: `{ success, user, token }`

- `POST /api/auth/forgot-password` - Request password reset
  - Request: `{ email }`
  - Response: `{ success, message }`

- `POST /api/auth/reset-password` - Reset password with token
  - Request: `{ token, password }`
  - Response: `{ success, message }`

- `GET /api/auth/validate` - Validate JWT token
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ success, user }`

- `GET /api/auth/profile` - Get user profile
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ success, user }`

- `PUT /api/auth/profile` - Update user profile
  - Headers: `Authorization: Bearer <token>`
  - Request: `{ username, email, password }`
  - Response: `{ success, user }`

### Lobby Routes

- `GET /api/lobby` - Get all public lobbies
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ success, lobbies }`

- `POST /api/lobby` - Create a new lobby
  - Headers: `Authorization: Bearer <token>`
  - Request: `{ name, isPrivate, maxPlayers, password, gameMode }`
  - Response: `{ success, lobby }`

- `GET /api/lobby/:id` - Get a specific lobby
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ success, lobby }`

- `POST /api/lobby/:id/join` - Join a lobby
  - Headers: `Authorization: Bearer <token>`
  - Request: `{ password }` (if private)
  - Response: `{ success, message }`

### Leaderboard Routes

- `GET /api/leaderboard/wins` - Get leaderboard by wins
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ success, leaderboard }`

- `GET /api/leaderboard/words` - Get leaderboard by words created
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ success, leaderboard }`

- `GET /api/leaderboard/winrate` - Get leaderboard by win rate
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ success, leaderboard }`

### Game Routes

- `GET /api/game/:id` - Get game state
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ success, game }`

- `POST /api/game/:id/word` - Submit a word
  - Headers: `Authorization: Bearer <token>`
  - Request: `{ word }`
  - Response: `{ success, valid, points }`

## Socket.IO Events

### Global Events

- `connection` - Client connects to server
- `disconnect` - Client disconnects from server
- `onlineCount` - Server sends online player count
- `userConnected` - User logs in

### Lobby Events

- `joinLobby` - User joins a lobby
- `leaveLobby` - User leaves a lobby
- `lobbyUpdate` - Lobby state changes
- `lobbiesUpdate` - List of lobbies updates
- `lobbyChat` - User sends a chat message
- `playerReady` - Player marks as ready
- `playerUnready` - Player marks as not ready
- `startGame` - Host starts the game

### Game Events

- `gameState` - Game state update
- `submitWord` - Player submits a word
- `wordResult` - Server validates a word
- `roundEnd` - Round ends
- `gameEnd` - Game ends
- `usePowerup` - Player uses a power-up

## Game Rules

1. Each game consists of multiple rounds.
2. In each round, players are given a set of random letters.
3. Players must create valid words using these letters.
4. Words are scored based on length and letter values.
5. The player with the highest score at the end wins.

## Changelog

### v1.0.0 (2023-06-01)
- Initial release with basic functionality

### v1.1.0 (2023-07-15)
- Added private lobbies
- Improved word validation
- Fixed various bugs

### v1.2.0 (2023-08-30)
- Added power-ups system
- Enhanced UI/UX
- Performance improvements

### v1.3.0 (2023-10-20)
- Added "Remember me" functionality
- Implemented password reset
- Added real-time online player counter
- Dark theme UI redesign 

### v1.4.0 (2023-12-15)
- Fixed authentication redirect loop issue
- Updated API endpoints for better consistency
- Improved error handling and debugging
- Enhanced token validation logic

### v1.5.0 (2024-03-18)
- Complete UI redesign with dark futuristic/neon aesthetic
- Added particle animation background
- Implemented user profile dropdown
- Added comprehensive leaderboard system
- Enhanced lobby creation with game mode selection
- Improved responsive design for all screen sizes
- Added theme customization in settings

## Troubleshooting

### Authentication Issues

#### Redirect Loop
If you experience a redirect loop during login:
1. Clear your browser cache and cookies
2. Try using an incognito/private browsing window
3. Check that your JWT_SECRET is properly set in the .env file
4. Ensure the server is running on the correct port

#### JWT Authentication Errors
If you see "JWT malformed" errors in the console:
1. Check that your token is being correctly stored and retrieved
2. Verify that all API calls include the proper Authorization header format: `Bearer <token>`
3. Make sure tokens are being retrieved from both localStorage and sessionStorage
4. Try logging out and logging back in to get a fresh token
5. Clear browser cache and cookies if problems persist

#### Server Already Running
If you see "Error: listen EADDRINUSE: address already in use" when starting the server:
1. Find the process using the port: `netstat -ano | findstr :<PORT>`
2. Kill the process: `taskkill /F /PID <PID>`
3. Restart the server: `npm run dev`

### API Endpoint Issues

#### Error Fetching Lobbies
If you see "SyntaxError: Unexpected token < in JSON at position 0":
1. This typically indicates an HTML response instead of JSON
2. Verify API endpoints are correctly configured
3. Check for server-side route handling issues
4. Ensure proper CORS configuration if accessing from a different domain

### API Endpoint Changes
Note that some API endpoints have been updated:
- User profile: `/api/auth/profile` (previously `/api/users/me`)
- Token validation: `/api/auth/validate`
- Lobby endpoints: All lobby endpoints use `/api/lobby/` format
- Leaderboard endpoints: `/api/leaderboard/<category>`

For developers, remember to check the browser console for debug logs when troubleshooting issues.
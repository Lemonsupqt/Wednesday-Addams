const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// Game state storage
const rooms = new Map();
const players = new Map();

// Trivia questions - Stranger Things & Wednesday themed
const triviaQuestions = [
  { q: "What is the name of the parallel dimension in Stranger Things?", options: ["The Upside Down", "The Shadow Realm", "The Dark World", "The Other Side"], correct: 0 },
  { q: "What is Wednesday Addams' pet spider's name?", options: ["Spooky", "Homer", "Webster", "Nero"], correct: 1 },
  { q: "Who is Eleven's 'papa' in Stranger Things?", options: ["Hopper", "Dr. Brenner", "Bob", "Murray"], correct: 1 },
  { q: "What instrument does Wednesday play?", options: ["Piano", "Violin", "Cello", "Harp"], correct: 2 },
  { q: "What is the Demogorgon named after?", options: ["A Greek god", "A D&D monster", "A Russian experiment", "A flower"], correct: 1 },
  { q: "What is the name of Wednesday's school?", options: ["Blackwood Academy", "Nevermore Academy", "Gothic High", "Addams Institute"], correct: 1 },
  { q: "What song saves Max from Vecna?", options: ["Running Up That Hill", "Master of Puppets", "Time After Time", "Africa"], correct: 0 },
  { q: "What is the name of Wednesday's roommate?", options: ["Bianca", "Enid", "Yoko", "Divina"], correct: 1 },
  { q: "What powers does Eleven have?", options: ["Invisibility", "Telekinesis", "Time travel", "Shape-shifting"], correct: 1 },
  { q: "What type of creature is Wednesday's friend, Thing?", options: ["A ghost", "A disembodied hand", "A spider", "A raven"], correct: 1 },
  { q: "In Stranger Things, what game do the kids play?", options: ["Chess", "Dungeons & Dragons", "Monopoly", "Risk"], correct: 1 },
  { q: "What is Wednesday's psychic ability?", options: ["Mind reading", "Visions when touching things", "Future prediction", "Talking to ghosts"], correct: 1 },
  { q: "What is the name of the mall in Stranger Things Season 3?", options: ["Hawkins Plaza", "Starcourt Mall", "Upside Down Mall", "Gateway Center"], correct: 1 },
  { q: "Who is the main antagonist in Wednesday Season 1?", options: ["Principal Weems", "Tyler/Hyde", "Bianca", "Morticia"], correct: 1 },
  { q: "What does Eleven like to eat?", options: ["Pizza", "Eggo waffles", "Burgers", "Ice cream"], correct: 1 },
  { q: "What secret society exists at Nevermore?", options: ["The Ravens", "Nightshades", "The Outcasts", "Dark Hearts"], correct: 1 },
  { q: "What is the Mind Flayer?", options: ["A demogorgon", "A shadow monster from Upside Down", "A government agent", "A Russian spy"], correct: 1 },
  { q: "What does Wednesday name her cello piece?", options: ["Dark Symphony", "Pain", "Funeral March", "Wednesday's Woe"], correct: 2 },
  { q: "Who opens the gate to the Upside Down?", options: ["Will", "Eleven", "Hopper", "Brenner"], correct: 1 },
  { q: "What color is Enid's side of the room?", options: ["Black", "Purple", "Pink/Colorful", "Gray"], correct: 2 }
];

// Chess initial setup
const INITIAL_CHESS_BOARD = [
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
  ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

// Drawing prompts for the drawing game
const drawingPrompts = [
  "Demogorgon", "Thing (the hand)", "Eleven's nosebleed", "Wednesday's braids",
  "The Upside Down", "Nevermore Academy", "Eggo waffle", "Cello",
  "Christmas lights message", "Wednesday dancing", "Mind Flayer", "Enid as a werewolf",
  "Hawkins Lab", "Uncle Fester", "Vecna", "Morticia Addams",
  "Steve's hair", "Thing typing", "Dustin's hat", "Wednesday fencing",
  "The Byers' house", "Gothic mansion", "Demobat", "Edgar Allan Poe statue",
  "Eleven in the void", "Hyde monster", "Max floating", "Pugsley explosion",
  "Russian base", "Nevermore gates", "Hopper's cabin", "Wednesday's uniform"
];

// Memory game configurations by difficulty
function getMemoryConfig(difficulty) {
  const allItems = [
    { id: 'demogorgon', emoji: '👹', name: 'Demogorgon' },
    { id: 'eleven', emoji: '🔴', name: 'Eleven' },
    { id: 'wednesday', emoji: '🖤', name: 'Wednesday' },
    { id: 'thing', emoji: '🖐️', name: 'Thing' },
    { id: 'waffle', emoji: '🧇', name: 'Eggo' },
    { id: 'cello', emoji: '🎻', name: 'Cello' },
    { id: 'spider', emoji: '🕷️', name: 'Spider' },
    { id: 'light', emoji: '💡', name: 'Lights' },
    { id: 'vecna', emoji: '👁️', name: 'Vecna' },
    { id: 'hopper', emoji: '👮', name: 'Hopper' },
    { id: 'mind_flayer', emoji: '🌑', name: 'Mind Flayer' },
    { id: 'dustin', emoji: '🧢', name: 'Dustin' },
    { id: 'max', emoji: '🛹', name: 'Max' },
    { id: 'steve', emoji: '💇', name: 'Steve' },
    { id: 'enid', emoji: '🐺', name: 'Enid' },
    { id: 'morticia', emoji: '🖤', name: 'Morticia' },
    { id: 'pugsley', emoji: '💣', name: 'Pugsley' },
    { id: 'lurch', emoji: '🧟', name: 'Lurch' },
    { id: 'fester', emoji: '💡', name: 'Fester' },
    { id: 'gomez', emoji: '🗡️', name: 'Gomez' },
    { id: 'stranger_bike', emoji: '🚲', name: 'Bike' },
    { id: 'walkie', emoji: '📻', name: 'Walkie' },
    { id: 'upside_down', emoji: '🌀', name: 'Portal' },
    { id: 'demobat', emoji: '🦇', name: 'Demobat' }
  ];

  switch (difficulty) {
    case 'easy':
      return { items: allItems.slice(0, 6), cols: 4 }; // 12 cards (6 pairs) - 4x3
    case 'medium':
      return { items: allItems.slice(0, 8), cols: 4 }; // 16 cards (8 pairs) - 4x4
    case 'hard':
      return { items: allItems.slice(0, 12), cols: 6 }; // 24 cards (12 pairs) - 6x4
    case 'insane':
      return { items: allItems.slice(0, 18), cols: 6 }; // 36 cards (18 pairs) - 6x6
    default:
      return { items: allItems.slice(0, 8), cols: 4 };
  }
}

// Word Chain game words
const wordChainCategories = {
  characters: ['Eleven', 'Wednesday', 'Vecna', 'Hopper', 'Enid', 'Thing', 'Dustin', 'Max', 'Steve', 'Morticia', 'Pugsley', 'Lucas', 'Will', 'Mike', 'Nancy', 'Jonathan', 'Robin', 'Eddie', 'Argyle', 'Murray'],
  creatures: ['Demogorgon', 'Mind Flayer', 'Demobat', 'Demodog', 'Hyde', 'Werewolf', 'Siren', 'Vampire', 'Ghost', 'Monster'],
  places: ['Hawkins', 'Nevermore', 'Upside Down', 'Lab', 'Arcade', 'Mall', 'School', 'Forest', 'Russia', 'Cemetery'],
  objects: ['Waffle', 'Bike', 'Walkie', 'Cello', 'Sword', 'Gate', 'Lights', 'Van', 'Bat', 'Guitar']
};

// Reaction game prompts
const reactionPrompts = [
  { text: '👹 DEMOGORGON!', color: '#e50914' },
  { text: '⚡ ELEVEN\'S POWER!', color: '#9333ea' },
  { text: '🖐️ THING!', color: '#d4af37' },
  { text: '🔴 NOSEBLEED!', color: '#ff0000' },
  { text: '👁️ VECNA STRIKES!', color: '#1a0a2e' },
  { text: '🌀 PORTAL OPENS!', color: '#05d9e8' },
  { text: '🦇 DEMOBAT!', color: '#8b0000' },
  { text: '🐺 WEREWOLF!', color: '#4a5568' }
];

// Room class to manage game state
class GameRoom {
  constructor(id, hostId, hostName) {
    this.id = id;
    this.hostId = hostId;
    this.players = new Map();
    this.players.set(hostId, { id: hostId, name: hostName, score: 0, ready: false });
    this.currentGame = null;
    this.gameState = {};
    this.chat = [];
  }

  addPlayer(playerId, playerName) {
    this.players.set(playerId, { id: playerId, name: playerName, score: 0, ready: false });
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  getPlayerList() {
    return Array.from(this.players.values());
  }

  resetScores() {
    this.players.forEach(player => player.score = 0);
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🎮 Player connected: ${socket.id}`);

  // Create room
  socket.on('createRoom', (playerName) => {
    const roomId = uuidv4().substring(0, 6).toUpperCase();
    const room = new GameRoom(roomId, socket.id, playerName);
    rooms.set(roomId, room);
    players.set(socket.id, roomId);
    
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, players: room.getPlayerList() });
    console.log(`🏠 Room created: ${roomId} by ${playerName}`);
  });

  // Join room
  socket.on('joinRoom', ({ roomId, playerName }) => {
    const room = rooms.get(roomId.toUpperCase());
    if (!room) {
      socket.emit('error', { message: 'Room not found. Check the code and try again.' });
      return;
    }
    if (room.players.size >= 8) {
      socket.emit('error', { message: 'Room is full (max 8 players)' });
      return;
    }
    if (room.currentGame) {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }

    room.addPlayer(socket.id, playerName);
    players.set(socket.id, roomId.toUpperCase());
    
    socket.join(roomId.toUpperCase());
    socket.emit('roomJoined', { roomId: roomId.toUpperCase(), players: room.getPlayerList() });
    socket.to(roomId.toUpperCase()).emit('playerJoined', { players: room.getPlayerList() });
    console.log(`👤 ${playerName} joined room ${roomId}`);
  });

  // Chat message
  socket.on('chatMessage', (message) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(socket.id);
    const chatMsg = {
      id: uuidv4(),
      playerId: socket.id,
      playerName: player.name,
      message: message,
      timestamp: Date.now()
    };
    room.chat.push(chatMsg);
    io.to(roomId).emit('chatMessage', chatMsg);
  });

  // Start game
  socket.on('startGame', (gameType) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    if (room.players.size < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start!' });
      return;
    }

    room.currentGame = gameType;
    room.gameState = initializeGame(gameType, room);
    
    io.to(roomId).emit('gameStarted', { 
      gameType, 
      gameState: room.gameState,
      players: room.getPlayerList()
    });
    console.log(`🎮 Game started: ${gameType} in room ${roomId}`);
  });

  // Game moves
  socket.on('gameMove', (moveData) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || !room.currentGame) return;

    const result = processGameMove(room, socket.id, moveData);
    if (result) {
      io.to(roomId).emit('gameUpdate', result);
    }
  });

  // Drawing game specific
  socket.on('drawingData', (data) => {
    const roomId = players.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('drawingData', { playerId: socket.id, data });
    }
  });

  socket.on('drawingGuess', (guess) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'drawing') return;

    const state = room.gameState;
    if (socket.id === state.currentDrawer) return;

    const player = room.players.get(socket.id);
    const isCorrect = guess.toLowerCase().trim() === state.currentPrompt.toLowerCase();

    if (isCorrect && !state.guessedPlayers.includes(socket.id)) {
      state.guessedPlayers.push(socket.id);
      player.score += 10;
      room.players.get(state.currentDrawer).score += 5;

      io.to(roomId).emit('correctGuess', {
        playerId: socket.id,
        playerName: player.name,
        players: room.getPlayerList()
      });

      // Check if round should end
      if (state.guessedPlayers.length >= room.players.size - 1) {
        nextDrawingRound(room, roomId);
      }
    } else {
      io.to(roomId).emit('chatMessage', {
        id: uuidv4(),
        playerId: socket.id,
        playerName: player.name,
        message: guess,
        timestamp: Date.now(),
        isGuess: true
      });
    }
  });

  // Trivia answer
  socket.on('triviaAnswer', (answerIndex) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'trivia') return;

    const state = room.gameState;
    if (state.answered.includes(socket.id)) return;

    state.answered.push(socket.id);
    const currentQ = state.questions[state.currentQuestion];
    const isCorrect = answerIndex === currentQ.correct;

    if (isCorrect) {
      const player = room.players.get(socket.id);
      const timeBonus = Math.max(0, Math.floor((state.timeLeft / 15) * 5));
      player.score += 10 + timeBonus;
    }

    io.to(roomId).emit('playerAnswered', {
      playerId: socket.id,
      isCorrect,
      players: room.getPlayerList(),
      answeredCount: state.answered.length,
      totalPlayers: room.players.size
    });

    // Check if all answered
    if (state.answered.length >= room.players.size) {
      revealTriviaAnswer(room, roomId);
    }
  });

  // Psychic showdown - start game after rules
  socket.on('psychicStart', () => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'psychic') return;

    const state = room.gameState;
    state.round = 1;
    state.phase = 'choosing';
    io.to(roomId).emit('psychicGameStart', { round: 1 });
  });

  // Psychic showdown move
  socket.on('psychicMove', (choice) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'psychic') return;

    const state = room.gameState;
    if (state.phase !== 'choosing') return;
    
    state.choices.set(socket.id, choice);

    io.to(roomId).emit('playerChose', {
      playerId: socket.id,
      choiceCount: state.choices.size,
      totalPlayers: room.players.size
    });

    if (state.choices.size >= room.players.size) {
      resolvePsychicRound(room, roomId);
    }
  });

  // Memory game difficulty selection
  socket.on('selectMemoryDifficulty', (difficulty) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;
    
    // Store selected difficulty and start game
    room.gameState = { selectedDifficulty: difficulty };
    room.currentGame = 'memory';
    room.gameState = initializeGame('memory', room);
    
    io.to(roomId).emit('gameStarted', { 
      gameType: 'memory', 
      gameState: room.gameState,
      players: room.getPlayerList()
    });
  });

  // Reaction Race game
  socket.on('reactionReady', () => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'reaction') return;

    const state = room.gameState;
    state.readyPlayers.add(socket.id);

    io.to(roomId).emit('playerReady', {
      playerId: socket.id,
      readyCount: state.readyPlayers.size,
      totalPlayers: room.players.size
    });

    if (state.readyPlayers.size >= room.players.size) {
      startReactionRound(room, roomId);
    }
  });

  socket.on('reactionClick', () => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'reaction') return;

    const state = room.gameState;
    
    if (!state.promptShown) {
      // Too early! Penalty
      state.tooEarly.add(socket.id);
      io.to(roomId).emit('reactionTooEarly', { playerId: socket.id });
      return;
    }

    if (!state.winner && !state.tooEarly.has(socket.id)) {
      const reactionTime = Date.now() - state.promptTime;
      state.winner = socket.id;
      state.winnerTime = reactionTime;
      room.players.get(socket.id).score += 10;

      io.to(roomId).emit('reactionResult', {
        winnerId: socket.id,
        winnerName: room.players.get(socket.id).name,
        reactionTime,
        players: room.getPlayerList(),
        round: state.round,
        maxRounds: state.maxRounds
      });

      // Next round after delay
      setTimeout(() => {
        state.round++;
        if (state.round > state.maxRounds) {
          endGame(room, roomId);
        } else {
          state.readyPlayers.clear();
          state.tooEarly.clear();
          state.winner = null;
          state.promptShown = false;
          io.to(roomId).emit('reactionNextRound', { round: state.round });
        }
      }, 3000);
    }
  });

  // Word Chain game
  socket.on('wordChainSubmit', (word) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'wordchain') return;

    const state = room.gameState;
    if (state.currentPlayer !== socket.id) return;
    if (state.gameOver) return;

    const trimmedWord = word.trim().toLowerCase();
    const lastWord = state.usedWords[state.usedWords.length - 1]?.toLowerCase() || '';
    
    // Validate word
    let valid = true;
    let reason = '';

    if (trimmedWord.length < 2) {
      valid = false;
      reason = 'Word too short!';
    } else if (state.usedWords.map(w => w.toLowerCase()).includes(trimmedWord)) {
      valid = false;
      reason = 'Word already used!';
    } else if (lastWord && trimmedWord[0] !== lastWord[lastWord.length - 1]) {
      valid = false;
      reason = `Word must start with "${lastWord[lastWord.length - 1].toUpperCase()}"!`;
    }

    if (valid) {
      state.usedWords.push(word);
      room.players.get(socket.id).score += 5;
      
      // Next player
      const playerIds = Array.from(room.players.keys());
      const currentIndex = playerIds.indexOf(state.currentPlayer);
      state.currentPlayer = playerIds[(currentIndex + 1) % playerIds.length];
      state.timeLeft = 15;
      state.round++;

      io.to(roomId).emit('wordChainUpdate', {
        word,
        playerId: socket.id,
        playerName: room.players.get(socket.id).name,
        usedWords: state.usedWords,
        currentPlayer: state.currentPlayer,
        players: room.getPlayerList(),
        round: state.round
      });
    } else {
      // Player loses this round
      state.gameOver = true;
      const loserId = socket.id;
      const players = room.getPlayerList().sort((a, b) => b.score - a.score);
      
      io.to(roomId).emit('wordChainGameOver', {
        loserId,
        loserName: room.players.get(loserId).name,
        reason,
        lastWord: word,
        players,
        usedWords: state.usedWords
      });
    }
  });

  socket.on('wordChainTimeout', () => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'wordchain') return;

    const state = room.gameState;
    if (state.currentPlayer !== socket.id) return;
    if (state.gameOver) return;

    state.gameOver = true;
    const loserId = socket.id;
    const players = room.getPlayerList().sort((a, b) => b.score - a.score);

    io.to(roomId).emit('wordChainGameOver', {
      loserId,
      loserName: room.players.get(loserId).name,
      reason: 'Time ran out!',
      lastWord: '',
      players,
      usedWords: state.usedWords
    });
  });

  // Memory game flip
  socket.on('memoryFlip', (cardIndex) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'memory') return;

    const state = room.gameState;
    if (state.currentPlayer !== socket.id) return;
    if (state.flipped.includes(cardIndex) || state.matched.includes(cardIndex)) return;
    if (state.checking) return;

    state.flipped.push(cardIndex);

    io.to(roomId).emit('cardFlipped', {
      cardIndex,
      card: state.cards[cardIndex],
      flipped: state.flipped
    });

    if (state.flipped.length === 2) {
      state.checking = true;
      const [first, second] = state.flipped;
      const match = state.cards[first].id === state.cards[second].id;

      setTimeout(() => {
        if (match) {
          state.matched.push(first, second);
          room.players.get(socket.id).score += 10;
          
          io.to(roomId).emit('memoryMatch', {
            cards: [first, second],
            matched: state.matched,
            players: room.getPlayerList()
          });

          // Check win
          if (state.matched.length === state.cards.length) {
            endGame(room, roomId);
          }
        } else {
          io.to(roomId).emit('memoryMismatch', { cards: [first, second] });
          // Next player
          const playerIds = Array.from(room.players.keys());
          const currentIndex = playerIds.indexOf(state.currentPlayer);
          state.currentPlayer = playerIds[(currentIndex + 1) % playerIds.length];
        }

        state.flipped = [];
        state.checking = false;

        io.to(roomId).emit('memoryTurn', { currentPlayer: state.currentPlayer });
      }, 1000);
    }
  });

  // Chess move
  socket.on('chessMove', ({ from, to, promotion }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'chess') return;

    const state = room.gameState;
    if (state.gameOver) return;

    // Check if it's this player's turn
    const isWhitePlayer = state.whitePlayer === socket.id;
    const isBlackPlayer = state.blackPlayer === socket.id;
    if (!isWhitePlayer && !isBlackPlayer) return;
    if ((state.currentTurn === 'white' && !isWhitePlayer) || (state.currentTurn === 'black' && !isBlackPlayer)) return;

    const piece = state.board[from.row][from.col];
    if (!piece) return;

    // Validate piece belongs to current player
    const isWhitePiece = piece === piece.toUpperCase();
    if ((state.currentTurn === 'white' && !isWhitePiece) || (state.currentTurn === 'black' && isWhitePiece)) return;

    // Validate move (basic validation - can be expanded)
    if (!isValidChessMove(state, from, to, piece)) return;

    // Execute move
    const capturedPiece = state.board[to.row][to.col];
    
    // Handle en passant capture
    if (piece.toLowerCase() === 'p' && state.enPassantTarget && 
        to.row === state.enPassantTarget.row && to.col === state.enPassantTarget.col) {
      const capturedPawnRow = state.currentTurn === 'white' ? to.row + 1 : to.row - 1;
      const capturedPawn = state.board[capturedPawnRow][to.col];
      if (capturedPawn) {
        state.capturedPieces[state.currentTurn].push(capturedPawn);
        state.board[capturedPawnRow][to.col] = null;
      }
    }
    
    // Handle castling
    if (piece.toLowerCase() === 'k' && Math.abs(to.col - from.col) === 2) {
      const isKingside = to.col > from.col;
      const rookFromCol = isKingside ? 7 : 0;
      const rookToCol = isKingside ? 5 : 3;
      state.board[from.row][rookToCol] = state.board[from.row][rookFromCol];
      state.board[from.row][rookFromCol] = null;
    }

    state.board[to.row][to.col] = piece;
    state.board[from.row][from.col] = null;

    // Handle pawn promotion
    if (piece.toLowerCase() === 'p' && (to.row === 0 || to.row === 7)) {
      const promotedPiece = promotion || 'q';
      state.board[to.row][to.col] = state.currentTurn === 'white' ? promotedPiece.toUpperCase() : promotedPiece.toLowerCase();
    }

    if (capturedPiece) {
      state.capturedPieces[state.currentTurn].push(capturedPiece);
    }

    // Update castling rights
    if (piece.toLowerCase() === 'k') {
      if (state.currentTurn === 'white') {
        state.canCastle.whiteKing = false;
        state.canCastle.whiteKingside = false;
        state.canCastle.whiteQueenside = false;
      } else {
        state.canCastle.blackKing = false;
        state.canCastle.blackKingside = false;
        state.canCastle.blackQueenside = false;
      }
    }
    if (piece.toLowerCase() === 'r') {
      if (from.row === 0 && from.col === 0) state.canCastle.blackQueenside = false;
      if (from.row === 0 && from.col === 7) state.canCastle.blackKingside = false;
      if (from.row === 7 && from.col === 0) state.canCastle.whiteQueenside = false;
      if (from.row === 7 && from.col === 7) state.canCastle.whiteKingside = false;
    }

    // Update en passant target
    if (piece.toLowerCase() === 'p' && Math.abs(to.row - from.row) === 2) {
      state.enPassantTarget = { row: (from.row + to.row) / 2, col: from.col };
    } else {
      state.enPassantTarget = null;
    }

    state.lastMove = { from, to };
    state.moveHistory.push({ from, to, piece, captured: capturedPiece });

    // Switch turn
    state.currentTurn = state.currentTurn === 'white' ? 'black' : 'white';

    // Check for check, checkmate, stalemate
    state.check = isKingInCheck(state.board, state.currentTurn);
    
    if (!hasLegalMoves(state, state.currentTurn)) {
      state.gameOver = true;
      if (state.check) {
        state.checkmate = true;
        state.winner = state.currentTurn === 'white' ? state.blackPlayer : state.whitePlayer;
        room.players.get(state.winner).score += 10;
      } else {
        state.stalemate = true;
      }
    }

    io.to(roomId).emit('chessUpdate', {
      board: state.board,
      currentTurn: state.currentTurn,
      lastMove: state.lastMove,
      capturedPieces: state.capturedPieces,
      check: state.check,
      checkmate: state.checkmate,
      stalemate: state.stalemate,
      gameOver: state.gameOver,
      winner: state.winner,
      winnerName: state.winner ? room.players.get(state.winner).name : null,
      players: room.getPlayerList()
    });
  });

  // Chess rematch request
  socket.on('chessRematch', () => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'chess') return;

    // Reset the chess game
    const playerIds = Array.from(room.players.keys());
    room.gameState = initializeGame('chess', room);
    
    io.to(roomId).emit('gameStarted', { 
      gameType: 'chess', 
      gameState: room.gameState,
      players: room.getPlayerList()
    });
  });

  // Game rematch/replay request (generic for all games)
  socket.on('gameRematch', () => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || !room.currentGame) return;

    // Reset the current game
    room.gameState = initializeGame(room.currentGame, room);
    
    io.to(roomId).emit('gameStarted', { 
      gameType: room.currentGame, 
      gameState: room.gameState,
      players: room.getPlayerList()
    });
  });

  // Tic Tac Toe move
  socket.on('tttMove', (cellIndex) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'tictactoe') return;

    const state = room.gameState;
    if (state.currentPlayer !== socket.id) return;
    if (state.board[cellIndex] !== null) return;
    if (state.winner) return;

    const playerSymbol = state.playerSymbols.get(socket.id);
    state.board[cellIndex] = playerSymbol;

    const winner = checkTTTWinner(state.board);
    if (winner) {
      state.winner = socket.id;
      room.players.get(socket.id).score += 10;
      io.to(roomId).emit('tttUpdate', {
        board: state.board,
        winner: socket.id,
        winnerName: room.players.get(socket.id).name,
        players: room.getPlayerList()
      });
    } else if (!state.board.includes(null)) {
      // Draw
      io.to(roomId).emit('tttUpdate', {
        board: state.board,
        draw: true
      });
    } else {
      // Next player
      const playerIds = Array.from(state.playerSymbols.keys());
      const currentIndex = playerIds.indexOf(state.currentPlayer);
      state.currentPlayer = playerIds[(currentIndex + 1) % playerIds.length];

      io.to(roomId).emit('tttUpdate', {
        board: state.board,
        currentPlayer: state.currentPlayer
      });
    }
  });

  // Leave room
  socket.on('leaveRoom', () => {
    handleDisconnect(socket);
  });

  // End game and return to lobby
  socket.on('endGame', () => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;

    room.currentGame = null;
    room.gameState = {};
    io.to(roomId).emit('returnToLobby', { players: room.getPlayerList() });
  });

  // Disconnect
  socket.on('disconnect', () => {
    handleDisconnect(socket);
    console.log(`👋 Player disconnected: ${socket.id}`);
  });

  function handleDisconnect(socket) {
    const roomId = players.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const playerName = room.players.get(socket.id)?.name;
    room.removePlayer(socket.id);
    players.delete(socket.id);

    if (room.players.size === 0) {
      rooms.delete(roomId);
      console.log(`🗑️ Room ${roomId} deleted (empty)`);
    } else {
      // Transfer host if needed
      if (room.hostId === socket.id) {
        room.hostId = room.players.keys().next().value;
      }
      
      io.to(roomId).emit('playerLeft', { 
        playerId: socket.id,
        playerName,
        players: room.getPlayerList(),
        newHostId: room.hostId
      });
    }

    socket.leave(roomId);
  }
});

// Game initialization
function initializeGame(gameType, room) {
  const playerIds = Array.from(room.players.keys());
  
  switch (gameType) {
    case 'tictactoe':
      const symbols = ['🔴', '💀']; // Eleven's nosebleed vs Death
      const symbolMap = new Map();
      // Randomize who gets which symbol and who starts
      const shuffledTTTPlayers = [...playerIds.slice(0, 2)].sort(() => Math.random() - 0.5);
      shuffledTTTPlayers.forEach((id, i) => symbolMap.set(id, symbols[i]));
      const tttStartingPlayer = shuffledTTTPlayers[Math.floor(Math.random() * 2)];
      return {
        board: Array(9).fill(null),
        currentPlayer: tttStartingPlayer,
        playerSymbols: symbolMap,
        winner: null
      };

    case 'memory':
      // Randomize starting player
      const memoryStartingPlayer = playerIds[Math.floor(Math.random() * playerIds.length)];
      // Default to medium difficulty if not specified
      const difficulty = room.gameState?.selectedDifficulty || 'medium';
      const memoryConfig = getMemoryConfig(difficulty);
      const cards = [...memoryConfig.items, ...memoryConfig.items]
        .sort(() => Math.random() - 0.5)
        .map((item, index) => ({ ...item, index }));
      return {
        cards,
        flipped: [],
        matched: [],
        currentPlayer: memoryStartingPlayer,
        checking: false,
        difficulty,
        gridCols: memoryConfig.cols
      };

    case 'trivia':
      const shuffledQ = [...triviaQuestions].sort(() => Math.random() - 0.5).slice(0, 10);
      return {
        questions: shuffledQ,
        currentQuestion: 0,
        answered: [],
        timeLeft: 15,
        revealed: false
      };

    case 'drawing':
      const shuffledPrompts = [...drawingPrompts].sort(() => Math.random() - 0.5);
      // Randomize starting drawer
      const shuffledDrawers = [...playerIds].sort(() => Math.random() - 0.5);
      return {
        prompts: shuffledPrompts,
        currentPromptIndex: 0,
        currentPrompt: shuffledPrompts[0],
        currentDrawer: shuffledDrawers[0],
        drawerIndex: 0,
        drawerOrder: shuffledDrawers,
        guessedPlayers: [],
        roundsPlayed: 0,
        maxRounds: Math.min(playerIds.length * 2, 10)
      };

    case 'psychic':
      return {
        choices: new Map(),
        round: 0, // Start at 0 to show rules first
        maxRounds: 10,
        phase: 'rules', // 'rules', 'choosing', 'results'
        resultsTimer: null
      };

    case 'chess':
      const chessPlayerIds = playerIds.slice(0, 2);
      const whitePlayer = chessPlayerIds[Math.random() < 0.5 ? 0 : 1];
      const blackPlayer = chessPlayerIds.find(id => id !== whitePlayer);
      return {
        board: JSON.parse(JSON.stringify(INITIAL_CHESS_BOARD)),
        currentTurn: 'white',
        whitePlayer,
        blackPlayer,
        moveHistory: [],
        capturedPieces: { white: [], black: [] },
        gameOver: false,
        winner: null,
        check: false,
        checkmate: false,
        stalemate: false,
        lastMove: null,
        canCastle: { whiteKing: true, whiteQueenside: true, whiteKingside: true, blackKing: true, blackQueenside: true, blackKingside: true },
        enPassantTarget: null
      };

    case 'reaction':
      return {
        round: 1,
        maxRounds: 10,
        readyPlayers: new Set(),
        promptShown: false,
        promptTime: null,
        winner: null,
        winnerTime: null,
        tooEarly: new Set(),
        currentPrompt: null
      };

    case 'wordchain':
      // Randomize starting player
      const wcStartPlayer = playerIds[Math.floor(Math.random() * playerIds.length)];
      // Pick a random starting word
      const allWords = Object.values(wordChainCategories).flat();
      const startWord = allWords[Math.floor(Math.random() * allWords.length)];
      return {
        currentPlayer: wcStartPlayer,
        usedWords: [startWord],
        timeLeft: 15,
        round: 1,
        gameOver: false
      };

    default:
      return {};
  }
}

function processGameMove(room, playerId, moveData) {
  // Generic game move processor - specific games use their own events
  return null;
}

// Chess helper functions
function isValidChessMove(state, from, to, piece) {
  const board = state.board;
  const isWhite = piece === piece.toUpperCase();
  const targetPiece = board[to.row][to.col];
  
  // Can't capture own piece
  if (targetPiece) {
    const targetIsWhite = targetPiece === targetPiece.toUpperCase();
    if (isWhite === targetIsWhite) return false;
  }
  
  const rowDiff = to.row - from.row;
  const colDiff = to.col - from.col;
  const absRowDiff = Math.abs(rowDiff);
  const absColDiff = Math.abs(colDiff);
  
  switch (piece.toLowerCase()) {
    case 'p': // Pawn
      const direction = isWhite ? -1 : 1;
      const startRow = isWhite ? 6 : 1;
      
      // Normal move
      if (colDiff === 0 && !targetPiece) {
        if (rowDiff === direction) return true;
        if (from.row === startRow && rowDiff === 2 * direction && !board[from.row + direction][from.col]) return true;
      }
      // Capture
      if (absColDiff === 1 && rowDiff === direction) {
        if (targetPiece) return true;
        // En passant
        if (state.enPassantTarget && to.row === state.enPassantTarget.row && to.col === state.enPassantTarget.col) return true;
      }
      return false;
      
    case 'r': // Rook
      if (rowDiff !== 0 && colDiff !== 0) return false;
      return isPathClear(board, from, to);
      
    case 'n': // Knight
      return (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2);
      
    case 'b': // Bishop
      if (absRowDiff !== absColDiff) return false;
      return isPathClear(board, from, to);
      
    case 'q': // Queen
      if (rowDiff !== 0 && colDiff !== 0 && absRowDiff !== absColDiff) return false;
      return isPathClear(board, from, to);
      
    case 'k': // King
      // Castling
      if (absRowDiff === 0 && absColDiff === 2) {
        const canCastle = isWhite ? state.canCastle : state.canCastle;
        const kingMoved = isWhite ? !state.canCastle.whiteKing : !state.canCastle.blackKing;
        if (kingMoved) return false;
        
        const isKingside = to.col > from.col;
        const rookCol = isKingside ? 7 : 0;
        const rook = board[from.row][rookCol];
        if (!rook || rook.toLowerCase() !== 'r') return false;
        
        if (isKingside) {
          if (isWhite && !state.canCastle.whiteKingside) return false;
          if (!isWhite && !state.canCastle.blackKingside) return false;
        } else {
          if (isWhite && !state.canCastle.whiteQueenside) return false;
          if (!isWhite && !state.canCastle.blackQueenside) return false;
        }
        
        // Check if path is clear and not in check
        const pathCols = isKingside ? [5, 6] : [1, 2, 3];
        for (const col of pathCols) {
          if (board[from.row][col]) return false;
        }
        
        // Check if king passes through or lands on attacked square
        const checkCols = isKingside ? [4, 5, 6] : [2, 3, 4];
        for (const col of checkCols) {
          if (isSquareAttacked(board, from.row, col, !isWhite)) return false;
        }
        
        return true;
      }
      return absRowDiff <= 1 && absColDiff <= 1;
  }
  return false;
}

function isPathClear(board, from, to) {
  const rowDir = Math.sign(to.row - from.row);
  const colDir = Math.sign(to.col - from.col);
  let row = from.row + rowDir;
  let col = from.col + colDir;
  
  while (row !== to.row || col !== to.col) {
    if (board[row][col]) return false;
    row += rowDir;
    col += colDir;
  }
  return true;
}

function isSquareAttacked(board, row, col, byWhite) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const isWhite = piece === piece.toUpperCase();
      if (isWhite !== byWhite) continue;
      
      const absRowDiff = Math.abs(row - r);
      const absColDiff = Math.abs(col - c);
      
      switch (piece.toLowerCase()) {
        case 'p':
          const direction = isWhite ? -1 : 1;
          if (absColDiff === 1 && row - r === direction) return true;
          break;
        case 'r':
          if ((row === r || col === c) && isPathClear(board, {row: r, col: c}, {row, col})) return true;
          break;
        case 'n':
          if ((absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2)) return true;
          break;
        case 'b':
          if (absRowDiff === absColDiff && absRowDiff > 0 && isPathClear(board, {row: r, col: c}, {row, col})) return true;
          break;
        case 'q':
          if ((row === r || col === c || absRowDiff === absColDiff) && isPathClear(board, {row: r, col: c}, {row, col})) return true;
          break;
        case 'k':
          if (absRowDiff <= 1 && absColDiff <= 1) return true;
          break;
      }
    }
  }
  return false;
}

function findKing(board, isWhite) {
  const king = isWhite ? 'K' : 'k';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === king) return { row: r, col: c };
    }
  }
  return null;
}

function isKingInCheck(board, turn) {
  const isWhite = turn === 'white';
  const kingPos = findKing(board, isWhite);
  if (!kingPos) return false;
  return isSquareAttacked(board, kingPos.row, kingPos.col, !isWhite);
}

function hasLegalMoves(state, turn) {
  const isWhite = turn === 'white';
  const board = state.board;
  
  for (let fromRow = 0; fromRow < 8; fromRow++) {
    for (let fromCol = 0; fromCol < 8; fromCol++) {
      const piece = board[fromRow][fromCol];
      if (!piece) continue;
      const pieceIsWhite = piece === piece.toUpperCase();
      if (pieceIsWhite !== isWhite) continue;
      
      for (let toRow = 0; toRow < 8; toRow++) {
        for (let toCol = 0; toCol < 8; toCol++) {
          if (fromRow === toRow && fromCol === toCol) continue;
          
          const from = { row: fromRow, col: fromCol };
          const to = { row: toRow, col: toCol };
          
          if (isValidChessMove(state, from, to, piece)) {
            // Simulate move and check if king is still in check
            const testBoard = board.map(r => [...r]);
            testBoard[toRow][toCol] = piece;
            testBoard[fromRow][fromCol] = null;
            
            if (!isKingInCheck(testBoard, turn)) {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

function checkTTTWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6] // diagonals
  ];

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function nextDrawingRound(room, roomId) {
  const state = room.gameState;
  state.roundsPlayed++;

  if (state.roundsPlayed >= state.maxRounds) {
    endGame(room, roomId);
    return;
  }

  // Next drawer - use the randomized drawerOrder
  const drawerOrder = state.drawerOrder || Array.from(room.players.keys());
  state.drawerIndex = (state.drawerIndex + 1) % drawerOrder.length;
  state.currentDrawer = drawerOrder[state.drawerIndex];
  state.currentPromptIndex++;
  state.currentPrompt = state.prompts[state.currentPromptIndex];
  state.guessedPlayers = [];

  io.to(roomId).emit('newDrawingRound', {
    currentDrawer: state.currentDrawer,
    drawerName: room.players.get(state.currentDrawer).name,
    prompt: state.currentPrompt,
    roundsPlayed: state.roundsPlayed,
    maxRounds: state.maxRounds
  });
}

function revealTriviaAnswer(room, roomId) {
  const state = room.gameState;
  const currentQ = state.questions[state.currentQuestion];

  io.to(roomId).emit('triviaReveal', {
    correctAnswer: currentQ.correct,
    players: room.getPlayerList()
  });

  setTimeout(() => {
    state.currentQuestion++;
    state.answered = [];

    if (state.currentQuestion >= state.questions.length) {
      endGame(room, roomId);
    } else {
      state.timeLeft = 15;
      io.to(roomId).emit('nextTriviaQuestion', {
        questionIndex: state.currentQuestion,
        question: state.questions[state.currentQuestion]
      });
    }
  }, 3000);
}

function resolvePsychicRound(room, roomId) {
  const state = room.gameState;
  const choices = Array.from(state.choices.entries());
  
  // Determine winners using rock-paper-scissors logic
  // Vision beats Mind (sees it coming), Mind beats Power (outsmarts), Power beats Vision (overwhelming)
  const beats = { vision: 'mind', mind: 'power', power: 'vision' };
  
  const results = [];
  const playerIds = Array.from(room.players.keys());
  
  // Compare each pair
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const p1 = playerIds[i];
      const p2 = playerIds[j];
      const c1 = state.choices.get(p1);
      const c2 = state.choices.get(p2);
      
      if (c1 === c2) continue;
      
      if (beats[c1] === c2) {
        room.players.get(p1).score += 5;
      } else {
        room.players.get(p2).score += 5;
      }
    }
  }

  state.phase = 'results';
  io.to(roomId).emit('psychicResults', {
    choices: Object.fromEntries(state.choices),
    players: room.getPlayerList(),
    round: state.round,
    maxRounds: state.maxRounds
  });

  // Increased delay from 3s to 5s so players can see results
  setTimeout(() => {
    state.round++;
    state.choices.clear();
    state.phase = 'choosing';

    if (state.round > state.maxRounds) {
      endGame(room, roomId);
    } else {
      io.to(roomId).emit('nextPsychicRound', { round: state.round });
    }
  }, 5000); // Increased to 5 seconds so players can see results
}

function startReactionRound(room, roomId) {
  const state = room.gameState;
  state.promptShown = false;
  state.tooEarly.clear();
  
  // Random delay between 2-6 seconds
  const delay = 2000 + Math.random() * 4000;
  
  io.to(roomId).emit('reactionWaiting', { round: state.round });
  
  setTimeout(() => {
    if (room.currentGame !== 'reaction') return;
    
    const prompt = reactionPrompts[Math.floor(Math.random() * reactionPrompts.length)];
    state.currentPrompt = prompt;
    state.promptShown = true;
    state.promptTime = Date.now();
    
    io.to(roomId).emit('reactionPrompt', { prompt });
  }, delay);
}

function endGame(room, roomId) {
  const players = room.getPlayerList().sort((a, b) => b.score - a.score);
  io.to(roomId).emit('gameEnded', {
    winner: players[0],
    players
  });
  room.currentGame = null;
}

// Trivia timer
setInterval(() => {
  rooms.forEach((room, roomId) => {
    if (room.currentGame === 'trivia' && room.gameState.timeLeft > 0) {
      room.gameState.timeLeft--;
      io.to(roomId).emit('triviaTimer', { timeLeft: room.gameState.timeLeft });
      
      if (room.gameState.timeLeft === 0) {
        revealTriviaAnswer(room, roomId);
      }
    }
  });
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  ⚡️ THE UPSIDE DOWN NEVERMORE GAMES ⚡️
  =====================================
  🎮 Server running on port ${PORT}
  🌐 Open http://localhost:${PORT}
  =====================================
  `);
});

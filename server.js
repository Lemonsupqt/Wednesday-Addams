require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// OpenAI Configuration
let openai = null;
let wednesdayAIEnabled = false;

try {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey !== 'your_openai_api_key_here') {
    openai = new OpenAI({ apiKey });
    wednesdayAIEnabled = true;
    console.log('✅ Wednesday AI: ENABLED (OpenAI)');
  } else {
    console.log('⚠️  Wednesday AI: DISABLED (No API key)');
  }
} catch (error) {
  console.log('⚠️  Wednesday AI: DISABLED (Configuration error)');
  console.error('OpenAI initialization error:', error.message);
}

// Wednesday AI personality prompt
const WEDNESDAY_SYSTEM_PROMPT = `You are Wednesday Addams, the darkly sardonic and morbidly curious character from the Addams Family. You are participating in a gaming chat room where friends play various games together.

Personality traits to embody:
- Deadpan, dry humor with a dark twist
- Highly intelligent and articulate
- Fascinated by the macabre and morbid
- Minimal emotional expression but deeply observant
- Sarcastic but not mean-spirited
- Enjoys wordplay and dark metaphors
- Speaks in a formal, precise manner
- References death, torture, and the macabre casually

Keep responses concise (1-3 sentences typically). React to user messages as Wednesday would, with dark humor and sardonic wit. If users are playing games, you might comment on the competition, strategies, or outcomes with your characteristic darkness. Never break character.`;

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
  socket.on('chatMessage', async (message) => {
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

    // Check if message mentions Wednesday or is a question directed at AI
    const shouldRespond = wednesdayAIEnabled && (
      message.toLowerCase().includes('wednesday') ||
      message.toLowerCase().includes('@ai') ||
      message.toLowerCase().includes('hey ai')
    );

    if (shouldRespond) {
      try {
        const aiResponse = await generateWednesdayResponse(message, room.chat.slice(-10));
        
        const aiMsg = {
          id: uuidv4(),
          playerId: 'wednesday-ai',
          playerName: '🖤 Wednesday AI',
          message: aiResponse,
          timestamp: Date.now(),
          isAI: true
        };
        room.chat.push(aiMsg);
        io.to(roomId).emit('chatMessage', aiMsg);
      } catch (error) {
        console.error('Wednesday AI error:', error.message);
        // Send error as Wednesday would
        const errorMsg = {
          id: uuidv4(),
          playerId: 'wednesday-ai',
          playerName: '🖤 Wednesday AI',
          message: "My connection to the spirit world seems... interrupted. How unfortunate.",
          timestamp: Date.now(),
          isAI: true
        };
        io.to(roomId).emit('chatMessage', errorMsg);
      }
    }
  });

  // Get AI status
  socket.on('getAIStatus', () => {
    socket.emit('aiStatus', { 
      enabled: wednesdayAIEnabled,
      status: wednesdayAIEnabled ? 'ENABLED (OpenAI)' : 'DISABLED'
    });
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

  // Psychic showdown move
  socket.on('psychicMove', (choice) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'psychic') return;

    const state = room.gameState;
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
      playerIds.slice(0, 2).forEach((id, i) => symbolMap.set(id, symbols[i]));
      return {
        board: Array(9).fill(null),
        currentPlayer: playerIds[0],
        playerSymbols: symbolMap,
        winner: null
      };

    case 'memory':
      const memoryItems = [
        { id: 'demogorgon', emoji: '👹', name: 'Demogorgon' },
        { id: 'eleven', emoji: '🔴', name: 'Eleven' },
        { id: 'wednesday', emoji: '🖤', name: 'Wednesday' },
        { id: 'thing', emoji: '🖐️', name: 'Thing' },
        { id: 'waffle', emoji: '🧇', name: 'Eggo' },
        { id: 'cello', emoji: '🎻', name: 'Cello' },
        { id: 'spider', emoji: '🕷️', name: 'Spider' },
        { id: 'light', emoji: '💡', name: 'Lights' }
      ];
      const cards = [...memoryItems, ...memoryItems]
        .sort(() => Math.random() - 0.5)
        .map((item, index) => ({ ...item, index }));
      return {
        cards,
        flipped: [],
        matched: [],
        currentPlayer: playerIds[0],
        checking: false
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
      return {
        prompts: shuffledPrompts,
        currentPromptIndex: 0,
        currentPrompt: shuffledPrompts[0],
        currentDrawer: playerIds[0],
        drawerIndex: 0,
        guessedPlayers: [],
        roundsPlayed: 0,
        maxRounds: Math.min(playerIds.length * 2, 10)
      };

    case 'psychic':
      return {
        choices: new Map(),
        round: 1,
        maxRounds: 10
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

  // Next drawer
  const playerIds = Array.from(room.players.keys());
  state.drawerIndex = (state.drawerIndex + 1) % playerIds.length;
  state.currentDrawer = playerIds[state.drawerIndex];
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

  io.to(roomId).emit('psychicResults', {
    choices: Object.fromEntries(state.choices),
    players: room.getPlayerList(),
    round: state.round
  });

  setTimeout(() => {
    state.round++;
    state.choices.clear();

    if (state.round > state.maxRounds) {
      endGame(room, roomId);
    } else {
      io.to(roomId).emit('nextPsychicRound', { round: state.round });
    }
  }, 3000);
}

function endGame(room, roomId) {
  const players = room.getPlayerList().sort((a, b) => b.score - a.score);
  io.to(roomId).emit('gameEnded', {
    winner: players[0],
    players
  });
  room.currentGame = null;
}

// ============================================
// WEDNESDAY AI CHATBOT
// ============================================

async function generateWednesdayResponse(userMessage, chatHistory) {
  if (!openai || !wednesdayAIEnabled) {
    return "I would respond, but the darkness has consumed my connection.";
  }

  try {
    // Build conversation context from recent chat history
    const messages = [
      { role: 'system', content: WEDNESDAY_SYSTEM_PROMPT }
    ];

    // Add recent chat context (last few messages)
    if (chatHistory && chatHistory.length > 0) {
      chatHistory.slice(-5).forEach(msg => {
        if (msg.isAI) {
          messages.push({ role: 'assistant', content: msg.message });
        } else {
          messages.push({ role: 'user', content: `${msg.playerName}: ${msg.message}` });
        }
      });
    }

    // Add the current message
    messages.push({ role: 'user', content: userMessage });

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 150,
      temperature: 0.8,
      presence_penalty: 0.6,
      frequency_penalty: 0.3
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI API error:', error.message);
    
    // Check for specific error types
    if (error.status === 401) {
      throw new Error('Invalid API key');
    } else if (error.status === 429) {
      throw new Error('Rate limit exceeded');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error('Network connectivity issue');
    }
    
    throw error;
  }
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

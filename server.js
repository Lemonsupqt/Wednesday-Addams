const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();

// CORS for GitHub Pages frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://lemonsupqt.github.io');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["https://lemonsupqt.github.io", "http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(express.static(path.join(__dirname)));

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

// Chess helper functions
function getInitialChessBoard() {
  return [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
  ];
}

function isWhitePiece(piece) {
  return piece && piece === piece.toUpperCase();
}

function isBlackPiece(piece) {
  return piece && piece === piece.toLowerCase();
}

function isValidChessMove(board, from, to, isWhiteTurn) {
  const [fromRow, fromCol] = from;
  const [toRow, toCol] = to;
  const piece = board[fromRow][fromCol];
  const target = board[toRow][toCol];
  
  if (!piece) return false;
  
  // Check if moving own piece
  if (isWhiteTurn && !isWhitePiece(piece)) return false;
  if (!isWhiteTurn && !isBlackPiece(piece)) return false;
  
  // Can't capture own piece
  if (target) {
    if (isWhiteTurn && isWhitePiece(target)) return false;
    if (!isWhiteTurn && isBlackPiece(target)) return false;
  }
  
  const pieceType = piece.toLowerCase();
  const rowDiff = toRow - fromRow;
  const colDiff = toCol - fromCol;
  const absRowDiff = Math.abs(rowDiff);
  const absColDiff = Math.abs(colDiff);
  
  switch (pieceType) {
    case 'p': // Pawn
      const direction = isWhitePiece(piece) ? -1 : 1;
      const startRow = isWhitePiece(piece) ? 6 : 1;
      
      // Move forward
      if (colDiff === 0 && !target) {
        if (rowDiff === direction) return true;
        if (fromRow === startRow && rowDiff === 2 * direction && !board[fromRow + direction][fromCol]) return true;
      }
      // Capture diagonally
      if (absColDiff === 1 && rowDiff === direction && target) return true;
      return false;
      
    case 'r': // Rook
      if (fromRow !== toRow && fromCol !== toCol) return false;
      return isPathClear(board, from, to);
      
    case 'n': // Knight
      return (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2);
      
    case 'b': // Bishop
      if (absRowDiff !== absColDiff) return false;
      return isPathClear(board, from, to);
      
    case 'q': // Queen
      if (fromRow !== toRow && fromCol !== toCol && absRowDiff !== absColDiff) return false;
      return isPathClear(board, from, to);
      
    case 'k': // King
      return absRowDiff <= 1 && absColDiff <= 1;
      
    default:
      return false;
  }
}

function isPathClear(board, from, to) {
  const [fromRow, fromCol] = from;
  const [toRow, toCol] = to;
  
  const rowStep = toRow > fromRow ? 1 : (toRow < fromRow ? -1 : 0);
  const colStep = toCol > fromCol ? 1 : (toCol < fromCol ? -1 : 0);
  
  let row = fromRow + rowStep;
  let col = fromCol + colStep;
  
  while (row !== toRow || col !== toCol) {
    if (board[row][col]) return false;
    row += rowStep;
    col += colStep;
  }
  
  return true;
}

function findKing(board, isWhite) {
  const king = isWhite ? 'K' : 'k';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (board[row][col] === king) return [row, col];
    }
  }
  return null;
}

function isInCheck(board, isWhiteKing) {
  const kingPos = findKing(board, isWhiteKing);
  if (!kingPos) return false;
  
  // Check if any opponent piece can capture the king
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && isWhitePiece(piece) !== isWhiteKing) {
        if (isValidChessMove(board, [row, col], kingPos, !isWhiteKing)) {
          return true;
        }
      }
    }
  }
  return false;
}

function makeMove(board, from, to) {
  const newBoard = board.map(row => [...row]);
  newBoard[to[0]][to[1]] = newBoard[from[0]][from[1]];
  newBoard[from[0]][from[1]] = null;
  
  // Pawn promotion (auto-queen)
  const piece = newBoard[to[0]][to[1]];
  if (piece === 'P' && to[0] === 0) newBoard[to[0]][to[1]] = 'Q';
  if (piece === 'p' && to[0] === 7) newBoard[to[0]][to[1]] = 'q';
  
  return newBoard;
}

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

  // Chess game
  socket.on('chessMove', ({ from, to }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'chess') return;

    const state = room.gameState;
    if (state.gameOver) return;
    if (socket.id !== state.currentPlayer) return;

    const isWhiteTurn = state.isWhiteTurn;
    
    // Validate the move
    if (!isValidChessMove(state.board, from, to, isWhiteTurn)) {
      socket.emit('invalidMove', { message: 'Invalid move' });
      return;
    }

    // Make the move
    const newBoard = makeMove(state.board, from, to);
    
    // Check if this move puts own king in check (illegal)
    if (isInCheck(newBoard, isWhiteTurn)) {
      socket.emit('invalidMove', { message: 'Cannot move into check' });
      return;
    }

    // Update state
    state.board = newBoard;
    state.moveHistory.push({ from, to, piece: state.board[to[0]][to[1]] });
    state.isWhiteTurn = !isWhiteTurn;
    state.currentPlayer = isWhiteTurn ? state.blackPlayer : state.whitePlayer;
    
    // Check if opponent is in check
    state.inCheck = isInCheck(state.board, !isWhiteTurn);
    
    // Check for king capture (simplified win condition)
    const opponentKing = findKing(state.board, !isWhiteTurn);
    if (!opponentKing) {
      state.gameOver = true;
      state.winner = socket.id;
      room.players.get(socket.id).score += 10;
    }

    io.to(roomId).emit('chessUpdate', {
      board: state.board,
      currentPlayer: state.currentPlayer,
      isWhiteTurn: state.isWhiteTurn,
      inCheck: state.inCheck,
      gameOver: state.gameOver,
      winner: state.winner,
      winnerName: state.winner ? room.players.get(state.winner).name : null,
      lastMove: { from, to },
      players: room.getPlayerList()
    });

    if (state.gameOver) {
      setTimeout(() => endGame(room, roomId), 2000);
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

    case 'chess':
      const chessPlayers = playerIds.slice(0, 2);
      return {
        board: getInitialChessBoard(),
        currentPlayer: chessPlayers[0],
        whitePlayer: chessPlayers[0],
        blackPlayer: chessPlayers[1],
        isWhiteTurn: true,
        selectedPiece: null,
        moveHistory: [],
        gameOver: false,
        winner: null,
        inCheck: false
      };

    case 'psychic':
      return {
        choices: new Map(),
        round: 1,
        maxRounds: 10
      };

    default:
      return {};
  }
}

function processGameMove(room, playerId, moveData) {
  // Generic game move processor - specific games use their own events
  return null;
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

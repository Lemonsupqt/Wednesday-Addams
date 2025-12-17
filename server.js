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

function isValidChessMove(board, from, to, isWhiteTurn, castlingRights = null) {
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
      // Normal king move
      if (absRowDiff <= 1 && absColDiff <= 1) return true;
      
      // Castling
      if (castlingRights && absRowDiff === 0 && absColDiff === 2) {
        const row = isWhiteTurn ? 7 : 0;
        if (fromRow !== row || fromCol !== 4) return false;
        
        // Kingside castling
        if (colDiff === 2) {
          if (isWhiteTurn && !castlingRights.whiteKingside) return false;
          if (!isWhiteTurn && !castlingRights.blackKingside) return false;
          // Check path is clear
          if (board[row][5] || board[row][6]) return false;
          // Check not in check, passing through check, or into check
          if (isInCheck(board, isWhiteTurn)) return false;
          const throughBoard = makeMove(board, from, [row, 5]);
          if (isInCheck(throughBoard, isWhiteTurn)) return false;
          return true;
        }
        
        // Queenside castling
        if (colDiff === -2) {
          if (isWhiteTurn && !castlingRights.whiteQueenside) return false;
          if (!isWhiteTurn && !castlingRights.blackQueenside) return false;
          // Check path is clear
          if (board[row][1] || board[row][2] || board[row][3]) return false;
          // Check not in check, passing through check, or into check
          if (isInCheck(board, isWhiteTurn)) return false;
          const throughBoard = makeMove(board, from, [row, 3]);
          if (isInCheck(throughBoard, isWhiteTurn)) return false;
          return true;
        }
      }
      return false;
      
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
  const piece = newBoard[from[0]][from[1]];
  newBoard[to[0]][to[1]] = piece;
  newBoard[from[0]][from[1]] = null;
  
  // Handle castling - move the rook
  if (piece && piece.toLowerCase() === 'k') {
    const colDiff = to[1] - from[1];
    if (Math.abs(colDiff) === 2) {
      const row = from[0];
      if (colDiff === 2) {
        // Kingside castling
        newBoard[row][5] = newBoard[row][7];
        newBoard[row][7] = null;
      } else {
        // Queenside castling
        newBoard[row][3] = newBoard[row][0];
        newBoard[row][0] = null;
      }
    }
  }
  
  // Pawn promotion (auto-queen)
  if (piece === 'P' && to[0] === 0) newBoard[to[0]][to[1]] = 'Q';
  if (piece === 'p' && to[0] === 7) newBoard[to[0]][to[1]] = 'q';
  
  return newBoard;
}

// Check if player has any legal moves
function hasLegalMoves(board, isWhiteTurn, castlingRights) {
  for (let fromRow = 0; fromRow < 8; fromRow++) {
    for (let fromCol = 0; fromCol < 8; fromCol++) {
      const piece = board[fromRow][fromCol];
      if (!piece) continue;
      if (isWhiteTurn && !isWhitePiece(piece)) continue;
      if (!isWhiteTurn && !isBlackPiece(piece)) continue;
      
      // Try all possible destinations
      for (let toRow = 0; toRow < 8; toRow++) {
        for (let toCol = 0; toCol < 8; toCol++) {
          if (fromRow === toRow && fromCol === toCol) continue;
          
          if (isValidChessMove(board, [fromRow, fromCol], [toRow, toCol], isWhiteTurn, castlingRights)) {
            // Check if move would leave king in check
            const testBoard = makeMove(board, [fromRow, fromCol], [toRow, toCol]);
            if (!isInCheck(testBoard, isWhiteTurn)) {
              return true; // Found at least one legal move
            }
          }
        }
      }
    }
  }
  return false;
}

// Check for checkmate or stalemate
function getGameEndState(board, isWhiteTurn, castlingRights) {
  const inCheck = isInCheck(board, isWhiteTurn);
  const hasMovesLeft = hasLegalMoves(board, isWhiteTurn, castlingRights);
  
  if (!hasMovesLeft) {
    if (inCheck) {
      return 'checkmate';
    } else {
      return 'stalemate';
    }
  }
  return null;
}

// Player colors
const PLAYER_COLORS = [
  '#e50914', // Red
  '#05d9e8', // Cyan
  '#22c55e', // Green
  '#f59e0b', // Orange
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#06b6d4', // Teal
  '#eab308'  // Yellow
];

// Room class to manage game state
class GameRoom {
  constructor(id, hostId, hostName) {
    this.id = id;
    this.hostId = hostId;
    this.players = new Map();
    this.players.set(hostId, { id: hostId, name: hostName, score: 0, ready: false, color: PLAYER_COLORS[0] });
    this.currentGame = null;
    this.gameState = {};
    this.chat = [];
    this.colorIndex = 1;
  }

  addPlayer(playerId, playerName) {
    const color = PLAYER_COLORS[this.colorIndex % PLAYER_COLORS.length];
    this.colorIndex++;
    this.players.set(playerId, { id: playerId, name: playerName, score: 0, ready: false, color });
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
  socket.on('startGame', (gameData) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    if (room.players.size < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start!' });
      return;
    }

    // Support both old format (string) and new format (object with options)
    const gameType = typeof gameData === 'string' ? gameData : gameData.type;
    const options = typeof gameData === 'object' ? gameData.options || {} : {};

    room.currentGame = gameType;
    room.gameState = initializeGame(gameType, room, options);
    
    // Save memory difficulty for future restarts
    if (gameType === 'memory' && options.difficulty) {
      room.lastMemoryDifficulty = options.difficulty;
    }
    // Save sudoku difficulty for future restarts
    if (gameType === 'sudoku' && options.difficulty) {
      room.lastSudokuDifficulty = options.difficulty;
    }
    
    io.to(roomId).emit('gameStarted', { 
      gameType, 
      gameState: room.gameState,
      players: room.getPlayerList()
    });
    console.log(`🎮 Game started: ${gameType} in room ${roomId}`);
    
    // Start mole whack game
    if (gameType === 'molewhack') {
      startMoleWhackRound(room, roomId);
    }
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
    const piece = state.board[from[0]][from[1]];
    
    // Validate the move (with castling rights)
    if (!isValidChessMove(state.board, from, to, isWhiteTurn, state.castlingRights)) {
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

    // Update castling rights based on piece moved
    if (piece) {
      const pieceType = piece.toLowerCase();
      if (pieceType === 'k') {
        if (isWhiteTurn) {
          state.castlingRights.whiteKingside = false;
          state.castlingRights.whiteQueenside = false;
        } else {
          state.castlingRights.blackKingside = false;
          state.castlingRights.blackQueenside = false;
        }
      } else if (pieceType === 'r') {
        if (isWhiteTurn) {
          if (from[0] === 7 && from[1] === 0) state.castlingRights.whiteQueenside = false;
          if (from[0] === 7 && from[1] === 7) state.castlingRights.whiteKingside = false;
        } else {
          if (from[0] === 0 && from[1] === 0) state.castlingRights.blackQueenside = false;
          if (from[0] === 0 && from[1] === 7) state.castlingRights.blackKingside = false;
        }
      }
    }

    // Update state
    state.board = newBoard;
    state.moveHistory.push({ from, to, piece: state.board[to[0]][to[1]] });
    state.isWhiteTurn = !isWhiteTurn;
    state.currentPlayer = isWhiteTurn ? state.blackPlayer : state.whitePlayer;
    
    // Check if opponent is in check
    state.inCheck = isInCheck(state.board, !isWhiteTurn);
    
    // Check for checkmate or stalemate
    const gameEndState = getGameEndState(state.board, !isWhiteTurn, state.castlingRights);
    if (gameEndState === 'checkmate') {
      state.gameOver = true;
      state.isCheckmate = true;
      state.winner = socket.id;
      room.players.get(socket.id).score += 10;
    } else if (gameEndState === 'stalemate') {
      state.gameOver = true;
      state.isStalemate = true;
      // No winner in stalemate
    }

    io.to(roomId).emit('chessUpdate', {
      board: state.board,
      currentPlayer: state.currentPlayer,
      isWhiteTurn: state.isWhiteTurn,
      inCheck: state.inCheck,
      gameOver: state.gameOver,
      winner: state.winner,
      winnerName: state.winner ? room.players.get(state.winner).name : null,
      isCheckmate: state.isCheckmate,
      isStalemate: state.isStalemate,
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

  // Restart game (play again)
  socket.on('restartGame', (gameData) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    
    // Support both old format (string) and new format (object with options)
    const gameType = typeof gameData === 'string' ? gameData : gameData.type;
    let options = typeof gameData === 'object' ? gameData.options || {} : {};
    
    // For memory game, preserve the difficulty from the previous game if not specified
    if (gameType === 'memory' && !options.difficulty && room.lastMemoryDifficulty) {
      options.difficulty = room.lastMemoryDifficulty;
    }
    // For sudoku game, preserve the difficulty from the previous game if not specified
    if (gameType === 'sudoku' && !options.difficulty && room.lastSudokuDifficulty) {
      options.difficulty = room.lastSudokuDifficulty;
    }
    
    // Re-initialize the game
    room.currentGame = gameType;
    room.gameState = initializeGame(gameType, room, options);
    
    // Save memory difficulty for future restarts
    if (gameType === 'memory' && options.difficulty) {
      room.lastMemoryDifficulty = options.difficulty;
    }
    // Save sudoku difficulty for future restarts
    if (gameType === 'sudoku' && options.difficulty) {
      room.lastSudokuDifficulty = options.difficulty;
    }
    
    io.to(roomId).emit('gameRestarted', {
      gameType,
      gameState: room.gameState,
      players: room.getPlayerList()
    });
    console.log(`🔄 Game restarted: ${gameType} in room ${roomId}`);
    
    // Start mole whack game
    if (gameType === 'molewhack') {
      startMoleWhackRound(room, roomId);
    }
  });

  // Sudoku move
  socket.on('sudokuMove', ({ row, col, value }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'sudoku') return;

    const state = room.gameState;
    if (state.completed) return;
    
    // Can't modify original puzzle cells
    if (state.puzzle[row][col] !== 0) return;
    
    // Update the board
    const previousValue = state.currentBoard[row][col];
    state.currentBoard[row][col] = value;
    
    // Track who made the move
    const cellKey = `${row}-${col}`;
    if (value !== 0) {
      state.playerMoves[cellKey] = socket.id;
    } else {
      delete state.playerMoves[cellKey];
    }
    
    // Check if correct
    const isCorrect = value === 0 || value === state.solution[row][col];
    
    // Award/deduct points
    const player = room.players.get(socket.id);
    if (value !== 0) {
      if (isCorrect) {
        player.score += 5;
      } else {
        player.score = Math.max(0, player.score - 2);
      }
    }
    
    // Check if puzzle is complete
    let isComplete = true;
    for (let i = 0; i < 9 && isComplete; i++) {
      for (let j = 0; j < 9 && isComplete; j++) {
        if (state.currentBoard[i][j] !== state.solution[i][j]) {
          isComplete = false;
        }
      }
    }
    
    if (isComplete) {
      state.completed = true;
      const completionTime = Math.floor((Date.now() - state.startTime) / 1000);
      
      // Bonus points for completion
      room.players.forEach(p => p.score += 20);
      
      io.to(roomId).emit('sudokuComplete', {
        completionTime,
        players: room.getPlayerList()
      });
    }
    
    io.to(roomId).emit('sudokuUpdate', {
      row,
      col,
      value,
      playerId: socket.id,
      playerName: player.name,
      isCorrect,
      currentBoard: state.currentBoard,
      playerMoves: state.playerMoves,
      players: room.getPlayerList()
    });
  });

  // Connect 4 move
  socket.on('connect4Move', (col) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'connect4') return;

    const state = room.gameState;
    if (state.winner || state.currentPlayer !== socket.id) return;
    
    // Find the lowest empty row in the column
    let row = -1;
    for (let r = 5; r >= 0; r--) {
      if (!state.board[r][col]) {
        row = r;
        break;
      }
    }
    
    if (row === -1) return; // Column is full
    
    // Place the piece
    const piece = socket.id === state.player1 ? '🔴' : '🟡';
    state.board[row][col] = piece;
    
    // Check for winner
    const winner = checkConnect4Winner(state.board, row, col, piece);
    if (winner) {
      state.winner = socket.id;
      state.winningCells = winner;
      room.players.get(socket.id).score += 10;
    }
    
    // Check for draw
    const isDraw = !state.winner && state.board[0].every(cell => cell !== null);
    
    // Switch turns
    if (!state.winner && !isDraw) {
      state.currentPlayer = state.currentPlayer === state.player1 ? state.player2 : state.player1;
    }
    
    io.to(roomId).emit('connect4Update', {
      board: state.board,
      currentPlayer: state.currentPlayer,
      winner: state.winner,
      winnerName: state.winner ? room.players.get(state.winner).name : null,
      winningCells: state.winningCells,
      isDraw,
      players: room.getPlayerList()
    });
  });

  // Mole whack
  socket.on('whackMole', (moleIndex) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'molewhack') return;

    const state = room.gameState;
    if (!state.roundActive) return;
    
    const moleIdx = state.molePositions.indexOf(moleIndex);
    if (moleIdx !== -1) {
      state.molePositions.splice(moleIdx, 1);
      if (!state.scores[socket.id]) state.scores[socket.id] = 0;
      state.scores[socket.id] += 10;
      room.players.get(socket.id).score += 10;
      
      io.to(roomId).emit('moleWhacked', {
        moleIndex,
        playerId: socket.id,
        playerName: room.players.get(socket.id).name,
        scores: state.scores,
        players: room.getPlayerList()
      });
    }
  });

  // Math quiz answer
  socket.on('mathAnswer', (answerIndex) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'mathquiz') return;

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

    io.to(roomId).emit('mathPlayerAnswered', {
      playerId: socket.id,
      isCorrect,
      players: room.getPlayerList(),
      answeredCount: state.answered.length,
      totalPlayers: room.players.size
    });

    if (state.answered.length >= room.players.size) {
      revealMathAnswer(room, roomId);
    }
  });

  // Ludo - Roll dice
  socket.on('ludoRollDice', () => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'ludo') return;

    const state = room.gameState;
    if (state.currentPlayer !== socket.id || state.diceRolled || state.winner) return;
    
    // Roll dice (1-6)
    const diceValue = Math.floor(Math.random() * 6) + 1;
    state.lastDice = diceValue;
    state.diceRolled = true;
    
    // Calculate valid moves
    const playerTokens = state.tokens[socket.id];
    const validMoves = [];
    const playerIndex = state.playerOrder.indexOf(socket.id);
    const startPosition = playerIndex * 13; // Each player starts at different point
    
    playerTokens.forEach((token, idx) => {
      if (token.position === 'home') {
        // Can only leave home with a 6
        if (diceValue === 6) {
          validMoves.push({ tokenIndex: idx, newPosition: startPosition });
        }
      } else if (token.position === 'finished') {
        // Already finished, can't move
      } else {
        // Calculate new position
        const newPos = (token.position + diceValue) % 52;
        // Check if would reach finish (simplified: after going around the board once)
        const distanceTraveled = token.distanceTraveled || 0;
        if (distanceTraveled + diceValue >= 51) {
          // Exact roll to finish
          if (distanceTraveled + diceValue === 51) {
            validMoves.push({ tokenIndex: idx, newPosition: 'finished' });
          }
        } else {
          validMoves.push({ tokenIndex: idx, newPosition: newPos });
        }
      }
    });
    
    state.validMoves = validMoves;
    
    io.to(roomId).emit('ludoDiceRoll', {
      playerId: socket.id,
      value: diceValue,
      validMoves: validMoves
    });
    
    // If no valid moves, auto-pass turn after delay
    if (validMoves.length === 0) {
      setTimeout(() => {
        if (room.currentGame === 'ludo' && state.currentPlayer === socket.id) {
          passTurnLudo(room, roomId, diceValue !== 6);
        }
      }, 1500);
    }
  });

  // Ludo - Move token
  socket.on('ludoMoveToken', (tokenIndex) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'ludo') return;

    const state = room.gameState;
    if (state.currentPlayer !== socket.id || !state.diceRolled || state.winner) return;
    
    // Validate move
    const validMove = state.validMoves.find(m => m.tokenIndex === tokenIndex);
    if (!validMove) return;
    
    const playerTokens = state.tokens[socket.id];
    const token = playerTokens[tokenIndex];
    const playerIndex = state.playerOrder.indexOf(socket.id);
    
    // Move the token
    let captured = false;
    if (validMove.newPosition === 'finished') {
      token.position = 'finished';
      room.players.get(socket.id).score += 25;
    } else {
      // Check for capture
      const safeSquares = [0, 8, 13, 21, 26, 34, 39, 47];
      if (!safeSquares.includes(validMove.newPosition)) {
        state.playerOrder.forEach(otherId => {
          if (otherId !== socket.id) {
            state.tokens[otherId].forEach(otherToken => {
              if (otherToken.position === validMove.newPosition) {
                otherToken.position = 'home';
                otherToken.distanceTraveled = 0;
                captured = true;
                room.players.get(socket.id).score += 10;
              }
            });
          }
        });
      }
      
      token.distanceTraveled = (token.distanceTraveled || 0) + state.lastDice;
      token.position = validMove.newPosition;
    }
    
    io.to(roomId).emit('ludoTokenMoved', {
      playerId: socket.id,
      playerName: room.players.get(socket.id).name,
      tokenIndex,
      newPosition: validMove.newPosition,
      tokens: state.tokens,
      captured
    });
    
    // Check for winner (all 4 tokens finished)
    const allFinished = playerTokens.every(t => t.position === 'finished');
    if (allFinished) {
      state.winner = socket.id;
      room.players.get(socket.id).score += 50;
      
      io.to(roomId).emit('ludoUpdate', {
        winner: socket.id,
        tokens: state.tokens,
        players: room.getPlayerList()
      });
      
      setTimeout(() => endGame(room, roomId), 2000);
      return;
    }
    
    // Pass turn (get another turn if rolled 6 or captured)
    const extraTurn = state.lastDice === 6 || captured;
    setTimeout(() => {
      if (room.currentGame === 'ludo') {
        passTurnLudo(room, roomId, !extraTurn);
      }
    }, 1000);
  });

  // Player color change
  socket.on('changePlayerColor', ({ targetPlayerId, color }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    
    const player = room.players.get(targetPlayerId);
    if (player) {
      player.color = color;
      io.to(roomId).emit('playerColorChanged', {
        playerId: targetPlayerId,
        color,
        players: room.getPlayerList()
      });
    }
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
function initializeGame(gameType, room, options = {}) {
  const playerIds = Array.from(room.players.keys());
  
  // Helper to get a random starting player
  const getRandomStartingPlayer = (ids) => ids[Math.floor(Math.random() * ids.length)];
  
  switch (gameType) {
    case 'tictactoe':
      const symbols = ['🔴', '💀']; // Eleven's nosebleed vs Death
      const symbolMap = new Map();
      const tttPlayers = playerIds.slice(0, 2);
      // Shuffle to randomize who gets which symbol
      const shuffledTttPlayers = [...tttPlayers].sort(() => Math.random() - 0.5);
      shuffledTttPlayers.forEach((id, i) => symbolMap.set(id, symbols[i]));
      // Random starting player
      const tttStartingPlayer = getRandomStartingPlayer(shuffledTttPlayers);
      return {
        board: Array(9).fill(null),
        currentPlayer: tttStartingPlayer,
        playerSymbols: symbolMap,
        winner: null
      };

    case 'memory':
      // Difficulty levels: easy (6 pairs), hard (8 pairs), insane (12 pairs), impossible (25 pairs = 50 cards)
      const difficulty = options.difficulty || 'easy';
      const memoryItemsAll = [
        // Original items
        { id: 'demogorgon', emoji: '👹', name: 'Demogorgon' },
        { id: 'eleven', emoji: '🔴', name: 'Eleven' },
        { id: 'wednesday', emoji: '🖤', name: 'Wednesday' },
        { id: 'thing', emoji: '🖐️', name: 'Thing' },
        { id: 'waffle', emoji: '🧇', name: 'Eggo' },
        { id: 'cello', emoji: '🎻', name: 'Cello' },
        { id: 'spider', emoji: '🕷️', name: 'Spider' },
        { id: 'light', emoji: '💡', name: 'Lights' },
        { id: 'vecna', emoji: '👁️', name: 'Vecna' },
        { id: 'mindflayer', emoji: '🌑', name: 'Mind Flayer' },
        { id: 'hopper', emoji: '🚔', name: 'Hopper' },
        { id: 'enid', emoji: '🐺', name: 'Enid' },
        { id: 'upside', emoji: '🙃', name: 'Upside Down' },
        { id: 'raven', emoji: '🐦‍⬛', name: 'Raven' },
        { id: 'gate', emoji: '🚪', name: 'Gate' },
        { id: 'lab', emoji: '🔬', name: 'Hawkins Lab' },
        // Additional items for impossible mode
        { id: 'dustin', emoji: '🧢', name: 'Dustin' },
        { id: 'mike', emoji: '🚲', name: 'Mike' },
        { id: 'lucas', emoji: '🏹', name: 'Lucas' },
        { id: 'will', emoji: '🎨', name: 'Will' },
        { id: 'max', emoji: '🛹', name: 'Max' },
        { id: 'steve', emoji: '🦇', name: 'Steve' },
        { id: 'nancy', emoji: '📰', name: 'Nancy' },
        { id: 'jonathan', emoji: '📷', name: 'Jonathan' },
        { id: 'joyce', emoji: '🎄', name: 'Joyce' },
        { id: 'murray', emoji: '📡', name: 'Murray' },
        { id: 'robin', emoji: '🎬', name: 'Robin' },
        { id: 'eddie', emoji: '🎸', name: 'Eddie' },
        { id: 'morticia', emoji: '🥀', name: 'Morticia' },
        { id: 'gomez', emoji: '⚔️', name: 'Gomez' },
        { id: 'pugsley', emoji: '💣', name: 'Pugsley' },
        { id: 'lurch', emoji: '🚪', name: 'Lurch' },
        { id: 'fester', emoji: '💡', name: 'Fester' },
        { id: 'bianca', emoji: '🧜‍♀️', name: 'Bianca' },
        { id: 'xavier', emoji: '🎨', name: 'Xavier' },
        { id: 'tyler', emoji: '☕', name: 'Tyler' },
        { id: 'weems', emoji: '👩‍💼', name: 'Weems' },
        { id: 'demodogs', emoji: '🐕', name: 'Demodogs' },
        { id: 'demobats', emoji: '🦇', name: 'Demobats' },
        { id: 'clock', emoji: '🕰️', name: 'Vecna Clock' },
        { id: 'walkie', emoji: '📻', name: 'Walkie' },
        { id: 'christmas', emoji: '🎅', name: 'Christmas' },
        { id: 'arcade', emoji: '🕹️', name: 'Arcade' },
        { id: 'pool', emoji: '🏊', name: 'Pool' },
        { id: 'mall', emoji: '🛒', name: 'Starcourt' },
        { id: 'russia', emoji: '🇷🇺', name: 'Russia' }
      ];
      
      let pairCount;
      let gridCols;
      switch (difficulty) {
        case 'easy':
          pairCount = 6;
          gridCols = 4; // 4x3 grid
          break;
        case 'hard':
          pairCount = 8;
          gridCols = 4; // 4x4 grid
          break;
        case 'insane':
          pairCount = 12;
          gridCols = 6; // 6x4 grid
          break;
        case 'impossible':
          pairCount = 25;
          gridCols = 10; // 10x5 grid = 50 cards
          break;
        default:
          pairCount = 6;
          gridCols = 4;
      }
      
      const memoryItems = memoryItemsAll.slice(0, pairCount);
      const cards = [...memoryItems, ...memoryItems]
        .sort(() => Math.random() - 0.5)
        .map((item, index) => ({ ...item, index }));
      
      // Random starting player
      const memoryStartingPlayer = getRandomStartingPlayer(playerIds);
      return {
        cards,
        flipped: [],
        matched: [],
        currentPlayer: memoryStartingPlayer,
        checking: false,
        difficulty,
        gridCols
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
      // Randomly assign white/black
      const shuffledChessPlayers = [...chessPlayers].sort(() => Math.random() - 0.5);
      return {
        board: getInitialChessBoard(),
        currentPlayer: shuffledChessPlayers[0], // White always starts, but who is white is random
        whitePlayer: shuffledChessPlayers[0],
        blackPlayer: shuffledChessPlayers[1],
        isWhiteTurn: true,
        selectedPiece: null,
        moveHistory: [],
        gameOver: false,
        winner: null,
        inCheck: false,
        isCheckmate: false,
        isStalemate: false,
        castlingRights: {
          whiteKingside: true,
          whiteQueenside: true,
          blackKingside: true,
          blackQueenside: true
        }
      };

    case 'psychic':
      return {
        choices: new Map(),
        round: 1,
        maxRounds: 10
      };

    case 'sudoku':
      const sudokuDifficulty = options.difficulty || 'medium';
      const { puzzle, solution } = generateSudoku(sudokuDifficulty);
      return {
        puzzle: puzzle,
        solution: solution,
        currentBoard: puzzle.map(row => [...row]),
        playerMoves: {}, // Track which player filled which cell
        difficulty: sudokuDifficulty,
        startTime: Date.now(),
        completed: false
      };

    case 'connect4':
      const c4Players = playerIds.slice(0, 2);
      const shuffledC4 = [...c4Players].sort(() => Math.random() - 0.5);
      return {
        board: Array(6).fill(null).map(() => Array(7).fill(null)),
        currentPlayer: shuffledC4[0],
        player1: shuffledC4[0],
        player2: shuffledC4[1],
        winner: null,
        winningCells: []
      };

    case 'molewhack':
      return {
        round: 1,
        maxRounds: 10,
        molePositions: [],
        scores: {},
        roundActive: false,
        roundStartTime: null
      };

    case 'mathquiz':
      return {
        currentQuestion: 0,
        questions: generateMathQuestions(10),
        answered: [],
        timeLeft: 15,
        scores: {}
      };

    case 'ludo':
      // Limit to 4 players for Ludo
      const ludoPlayers = playerIds.slice(0, 4);
      const tokens = {};
      ludoPlayers.forEach(playerId => {
        tokens[playerId] = [
          { position: 'home' },
          { position: 'home' },
          { position: 'home' },
          { position: 'home' }
        ];
      });
      return {
        playerOrder: ludoPlayers,
        tokens: tokens,
        currentPlayer: ludoPlayers[0],
        diceRolled: false,
        lastDice: null,
        validMoves: [],
        winner: null
      };

    default:
      return {};
  }
}

// Generate math questions
function generateMathQuestions(count) {
  const questions = [];
  const operations = ['+', '-', '×', '÷'];
  
  for (let i = 0; i < count; i++) {
    const op = operations[Math.floor(Math.random() * operations.length)];
    let a, b, answer;
    
    switch (op) {
      case '+':
        a = Math.floor(Math.random() * 50) + 1;
        b = Math.floor(Math.random() * 50) + 1;
        answer = a + b;
        break;
      case '-':
        a = Math.floor(Math.random() * 50) + 20;
        b = Math.floor(Math.random() * 20) + 1;
        answer = a - b;
        break;
      case '×':
        a = Math.floor(Math.random() * 12) + 1;
        b = Math.floor(Math.random() * 12) + 1;
        answer = a * b;
        break;
      case '÷':
        b = Math.floor(Math.random() * 10) + 1;
        answer = Math.floor(Math.random() * 10) + 1;
        a = b * answer;
        break;
    }
    
    // Generate wrong options
    const options = [answer];
    while (options.length < 4) {
      const wrong = answer + (Math.floor(Math.random() * 20) - 10);
      if (wrong !== answer && wrong > 0 && !options.includes(wrong)) {
        options.push(wrong);
      }
    }
    options.sort(() => Math.random() - 0.5);
    
    questions.push({
      question: `${a} ${op} ${b} = ?`,
      options,
      correct: options.indexOf(answer)
    });
  }
  
  return questions;
}

// Sudoku generator
function generateSudoku(difficulty) {
  // Generate a complete valid sudoku
  const solution = generateCompleteSudoku();
  const puzzle = solution.map(row => [...row]);
  
  // Remove numbers based on difficulty
  let cellsToRemove;
  switch (difficulty) {
    case 'easy': cellsToRemove = 35; break;
    case 'medium': cellsToRemove = 45; break;
    case 'hard': cellsToRemove = 55; break;
    case 'evil': cellsToRemove = 60; break;
    default: cellsToRemove = 45;
  }
  
  const positions = [];
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      positions.push([i, j]);
    }
  }
  
  // Shuffle positions and remove cells
  positions.sort(() => Math.random() - 0.5);
  for (let i = 0; i < cellsToRemove && i < positions.length; i++) {
    const [row, col] = positions[i];
    puzzle[row][col] = 0;
  }
  
  return { puzzle, solution };
}

function generateCompleteSudoku() {
  const board = Array(9).fill(null).map(() => Array(9).fill(0));
  fillSudoku(board);
  return board;
}

function fillSudoku(board) {
  const empty = findEmpty(board);
  if (!empty) return true;
  
  const [row, col] = empty;
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
  
  for (const num of numbers) {
    if (isValidSudokuPlacement(board, row, col, num)) {
      board[row][col] = num;
      if (fillSudoku(board)) return true;
      board[row][col] = 0;
    }
  }
  return false;
}

function findEmpty(board) {
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (board[i][j] === 0) return [i, j];
    }
  }
  return null;
}

function isValidSudokuPlacement(board, row, col, num) {
  // Check row
  for (let j = 0; j < 9; j++) {
    if (board[row][j] === num) return false;
  }
  
  // Check column
  for (let i = 0; i < 9; i++) {
    if (board[i][col] === num) return false;
  }
  
  // Check 3x3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let i = boxRow; i < boxRow + 3; i++) {
    for (let j = boxCol; j < boxCol + 3; j++) {
      if (board[i][j] === num) return false;
    }
  }
  
  return true;
}

// Connect 4 winner check
function checkConnect4Winner(board, row, col, piece) {
  const directions = [
    [0, 1],  // horizontal
    [1, 0],  // vertical
    [1, 1],  // diagonal down-right
    [1, -1]  // diagonal down-left
  ];
  
  for (const [dr, dc] of directions) {
    const cells = [[row, col]];
    
    // Check positive direction
    for (let i = 1; i < 4; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === piece) {
        cells.push([r, c]);
      } else break;
    }
    
    // Check negative direction
    for (let i = 1; i < 4; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === piece) {
        cells.push([r, c]);
      } else break;
    }
    
    if (cells.length >= 4) return cells;
  }
  
  return null;
}

// Math quiz reveal
function revealMathAnswer(room, roomId) {
  const state = room.gameState;
  const currentQ = state.questions[state.currentQuestion];

  io.to(roomId).emit('mathReveal', {
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
      io.to(roomId).emit('mathNextQuestion', {
        questionIndex: state.currentQuestion,
        question: state.questions[state.currentQuestion]
      });
    }
  }, 3000);
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
  
  // Calculate round results for each player
  const roundResults = {};
  playerIds.forEach(id => roundResults[id] = { wins: 0, losses: 0 });
  
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
        roundResults[p1].wins++;
        roundResults[p2].losses++;
      } else {
        room.players.get(p2).score += 5;
        roundResults[p2].wins++;
        roundResults[p1].losses++;
      }
    }
  }

  io.to(roomId).emit('psychicResults', {
    choices: Object.fromEntries(state.choices),
    players: room.getPlayerList(),
    round: state.round,
    roundResults
  });

  // Increased delay to 5 seconds so players can see results properly
  setTimeout(() => {
    state.round++;
    state.choices.clear();

    if (state.round > state.maxRounds) {
      endGame(room, roomId);
    } else {
      io.to(roomId).emit('nextPsychicRound', { round: state.round });
    }
  }, 5000);
}

function endGame(room, roomId) {
  const players = room.getPlayerList().sort((a, b) => b.score - a.score);
  io.to(roomId).emit('gameEnded', {
    winner: players[0],
    players
  });
  room.currentGame = null;
}

// Ludo helper - pass turn to next player
function passTurnLudo(room, roomId, changePlayer = true) {
  const state = room.gameState;
  
  if (changePlayer) {
    const currentIdx = state.playerOrder.indexOf(state.currentPlayer);
    const nextIdx = (currentIdx + 1) % state.playerOrder.length;
    state.currentPlayer = state.playerOrder[nextIdx];
  }
  
  state.diceRolled = false;
  state.lastDice = null;
  state.validMoves = [];
  
  io.to(roomId).emit('ludoTurnChange', {
    currentPlayer: state.currentPlayer
  });
}

function startMoleWhackRound(room, roomId) {
  const state = room.gameState;
  state.roundActive = true;
  state.molePositions = [];
  state.roundStartTime = Date.now();
  
  io.to(roomId).emit('moleRoundStart', { round: state.round });
  
  // Spawn moles during the round
  const moleSpawner = setInterval(() => {
    if (!room.currentGame || room.currentGame !== 'molewhack' || !state.roundActive) {
      clearInterval(moleSpawner);
      return;
    }
    
    // Spawn a mole at random position (0-8)
    const moleIndex = Math.floor(Math.random() * 9);
    
    // Don't spawn at same position if already there
    if (!state.molePositions.includes(moleIndex)) {
      state.molePositions.push(moleIndex);
      io.to(roomId).emit('moleSpawned', { moleIndex });
      
      // Hide mole after 1-2 seconds if not whacked
      const hideDelay = 1000 + Math.random() * 1000;
      setTimeout(() => {
        const idx = state.molePositions.indexOf(moleIndex);
        if (idx !== -1) {
          state.molePositions.splice(idx, 1);
          io.to(roomId).emit('moleHidden', { moleIndex });
        }
      }, hideDelay);
    }
  }, 600); // Spawn every 600ms
  
  // End round after 10 seconds
  setTimeout(() => {
    clearInterval(moleSpawner);
    
    if (room.currentGame === 'molewhack') {
      state.roundActive = false;
      state.molePositions = [];
      
      io.to(roomId).emit('moleRoundEnd', {
        round: state.round,
        scores: state.scores,
        players: room.getPlayerList()
      });
      
      state.round++;
      
      if (state.round > state.maxRounds) {
        endGame(room, roomId);
      } else {
        // Start next round after 3 seconds
        setTimeout(() => {
          if (room.currentGame === 'molewhack') {
            startMoleWhackRound(room, roomId);
          }
        }, 3000);
      }
    }
  }, 10000);
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
    
    // Math quiz timer
    if (room.currentGame === 'mathquiz' && room.gameState.timeLeft > 0) {
      room.gameState.timeLeft--;
      io.to(roomId).emit('mathTimer', { timeLeft: room.gameState.timeLeft });
      
      if (room.gameState.timeLeft === 0) {
        revealMathAnswer(room, roomId);
      }
    }
    
    // Mole whack game - spawn moles
    if (room.currentGame === 'molewhack' && room.gameState.roundActive) {
      // Randomly spawn moles
      if (Math.random() < 0.3 && room.gameState.molePositions.length < 3) {
        const newMole = Math.floor(Math.random() * 9);
        if (!room.gameState.molePositions.includes(newMole)) {
          room.gameState.molePositions.push(newMole);
          io.to(roomId).emit('moleSpawned', { moleIndex: newMole });
          
          // Auto-hide mole after 1.5 seconds
          setTimeout(() => {
            const idx = room.gameState.molePositions.indexOf(newMole);
            if (idx !== -1) {
              room.gameState.molePositions.splice(idx, 1);
              io.to(roomId).emit('moleHidden', { moleIndex: newMole });
            }
          }, 1500);
        }
      }
    }
  });
}, 1000);

// Air hockey physics update (60fps)
setInterval(() => {
  rooms.forEach((room, roomId) => {
    if (room.currentGame === 'airhockey' && room.gameState.gameActive) {
      const state = room.gameState;
      
      // Update puck position
      state.puckPosition.x += state.puckVelocity.x;
      state.puckPosition.y += state.puckVelocity.y;
      
      // Apply friction
      state.puckVelocity.x *= 0.99;
      state.puckVelocity.y *= 0.99;
      
      // Wall collisions
      if (state.puckPosition.y <= 20 || state.puckPosition.y >= 580) {
        state.puckVelocity.y *= -0.9;
        state.puckPosition.y = Math.max(20, Math.min(580, state.puckPosition.y));
      }
      
      // Goal detection
      if (state.puckPosition.x <= 20) {
        if (state.puckPosition.y > 200 && state.puckPosition.y < 400) {
          // Player 2 scores
          state.score2++;
          resetPuck(state, 1);
          io.to(roomId).emit('goalScored', { scorer: state.player2, score1: state.score1, score2: state.score2 });
          
          if (state.score2 >= state.maxScore) {
            state.winner = state.player2;
            state.gameActive = false;
            room.players.get(state.player2).score += 20;
            endGame(room, roomId);
          }
        } else {
          state.puckVelocity.x *= -0.9;
          state.puckPosition.x = 20;
        }
      }
      
      if (state.puckPosition.x >= 780) {
        if (state.puckPosition.y > 200 && state.puckPosition.y < 400) {
          // Player 1 scores
          state.score1++;
          resetPuck(state, 2);
          io.to(roomId).emit('goalScored', { scorer: state.player1, score1: state.score1, score2: state.score2 });
          
          if (state.score1 >= state.maxScore) {
            state.winner = state.player1;
            state.gameActive = false;
            room.players.get(state.player1).score += 20;
            endGame(room, roomId);
          }
        } else {
          state.puckVelocity.x *= -0.9;
          state.puckPosition.x = 780;
        }
      }
      
      // Paddle collisions
      const paddles = [state.paddle1, state.paddle2];
      for (const paddle of paddles) {
        const dx = state.puckPosition.x - paddle.x;
        const dy = state.puckPosition.y - paddle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 40) {
          const angle = Math.atan2(dy, dx);
          state.puckVelocity.x = Math.cos(angle) * 10;
          state.puckVelocity.y = Math.sin(angle) * 10;
          state.puckPosition.x = paddle.x + Math.cos(angle) * 45;
          state.puckPosition.y = paddle.y + Math.sin(angle) * 45;
        }
      }
      
      io.to(roomId).emit('puckUpdate', {
        position: state.puckPosition,
        velocity: state.puckVelocity
      });
    }
  });
}, 16);

function resetPuck(state, direction) {
  state.puckPosition = { x: 400, y: 300 };
  state.puckVelocity = { x: direction === 1 ? 5 : -5, y: (Math.random() - 0.5) * 4 };
}

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

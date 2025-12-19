const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();

// CORS for GitHub Pages frontend
const ALLOWED_ORIGINS = [
  'https://lemonsupqt.github.io',
  'https://wednesday-addams-production.up.railway.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.header('Access-Control-Allow-Origin', 'https://lemonsupqt.github.io');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(express.static(path.join(__dirname)));

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// ============================================
// USER ACCOUNTS & LEADERBOARD (The Nevermore Archives)
// ============================================

// NOTE: For Railway/cloud deployment, file storage is ephemeral.
// For persistent storage, consider using Railway's PostgreSQL or Redis.
// For now, we use file storage with environment variable backup.

const USERS_FILE = path.join(__dirname, 'nevermore_archives.json');

// Hash password using crypto (no external dependency)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'upsidedown_salt_2024').digest('hex');
}

// Load users from file or environment variable
function loadUsers() {
  // Try loading from environment variable first (for Railway persistence)
  if (process.env.USER_DATA) {
    try {
      console.log('📦 Loading user data from environment variable');
      return JSON.parse(Buffer.from(process.env.USER_DATA, 'base64').toString('utf8'));
    } catch (err) {
      console.error('Error loading from env:', err);
    }
  }
  
  // Try loading from file
  try {
    if (fs.existsSync(USERS_FILE)) {
      console.log('📦 Loading user data from file');
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading users from file:', err);
  }
  
  console.log('📦 Starting with empty user database');
  return {};
}

// Save users to file
function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    
    // Log base64 encoded data for manual backup (can copy to Railway env var)
    if (Object.keys(users).length > 0 && Object.keys(users).length <= 5) {
      const encoded = Buffer.from(JSON.stringify(users)).toString('base64');
      console.log('💾 User data backup (set as USER_DATA env var for persistence):');
      console.log(encoded.substring(0, 100) + '...');
    }
  } catch (err) {
    console.error('Error saving users:', err);
  }
}

// User accounts storage
let userAccounts = loadUsers();
console.log(`👥 Loaded ${Object.keys(userAccounts).length} user accounts`);

// Get leaderboard data
function getLeaderboard() {
  const users = Object.values(userAccounts);
  return users
    .map(u => ({
      username: u.username,
      displayName: u.displayName,
      trophies: u.trophies || 0,
      totalWins: u.totalWins || 0,
      gamesPlayed: u.gamesPlayed || 0,
      title: getUserTitle(u.trophies || 0)
    }))
    .sort((a, b) => {
      if (b.trophies !== a.trophies) return b.trophies - a.trophies;
      return b.totalWins - a.totalWins;
    })
    .slice(0, 50); // Top 50
}

// Get themed title based on trophies
function getUserTitle(trophies) {
  if (trophies >= 100) return '🖤 Supreme Overlord';
  if (trophies >= 75) return '⚡ Vecna\'s Nemesis';
  if (trophies >= 50) return '🦇 Nevermore Legend';
  if (trophies >= 35) return '🕷️ Shadow Walker';
  if (trophies >= 25) return '🌙 Nightshade Elite';
  if (trophies >= 15) return '☠️ Upside Down Survivor';
  if (trophies >= 10) return '🔮 Psychic Adept';
  if (trophies >= 5) return '🎭 Outcast Initiate';
  if (trophies >= 1) return '🕯️ Fresh Arrival';
  return '👻 Unknown Entity';
}

// Update user stats after game
function updateUserStats(username, won, earnedTrophy) {
  if (!userAccounts[username]) return;
  
  userAccounts[username].gamesPlayed = (userAccounts[username].gamesPlayed || 0) + 1;
  if (won) {
    userAccounts[username].totalWins = (userAccounts[username].totalWins || 0) + 1;
  }
  if (earnedTrophy) {
    userAccounts[username].trophies = (userAccounts[username].trophies || 0) + 1;
  }
  userAccounts[username].lastPlayed = Date.now();
  
  saveUsers(userAccounts);
}

// REST API for leaderboard
app.get('/api/leaderboard', (req, res) => {
  res.json(getLeaderboard());
});

// Game state storage
const rooms = new Map();
const players = new Map();
const authenticatedSockets = new Map(); // socket.id -> username

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
  constructor(id, creatorId, creatorName, creatorUsername = null) {
    this.id = id;
    this.creatorId = creatorId; // Original creator (for reference)
    this.players = new Map();
    this.players.set(creatorId, { 
      id: creatorId, 
      name: creatorName,
      username: creatorUsername,  // Linked account username
      trophies: 0,        // Trophies earned in this room session
      sessionWins: 0,     // Wins in current game session  
      points: 0,          // In-game points (resets each round)
      ready: false, 
      color: PLAYER_COLORS[0] 
    });
    this.currentGame = null;
    this.gameState = {};
    this.chat = [];
    this.colorIndex = 1;
    
    // Game voting system
    this.gameVotes = new Map(); // playerId -> gameType
    this.votingActive = false;
  }

  addPlayer(playerId, playerName, username = null) {
    const color = PLAYER_COLORS[this.colorIndex % PLAYER_COLORS.length];
    this.colorIndex++;
    this.players.set(playerId, { 
      id: playerId, 
      name: playerName,
      username: username,
      trophies: 0,
      sessionWins: 0,
      points: 0,
      ready: false, 
      color 
    });
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    this.gameVotes.delete(playerId);
  }

  getPlayerList() {
    return Array.from(this.players.values());
  }

  resetPoints() {
    this.players.forEach(player => player.points = 0);
  }

  resetSessionWins() {
    this.players.forEach(player => player.sessionWins = 0);
  }

  // Start voting for game selection
  startVoting() {
    this.gameVotes.clear();
    this.votingActive = true;
  }

  // Cast a vote
  castVote(playerId, gameType) {
    if (!this.votingActive) return false;
    this.gameVotes.set(playerId, gameType);
    return true;
  }

  // Get vote counts
  getVoteCounts() {
    const counts = {};
    this.gameVotes.forEach(game => {
      counts[game] = (counts[game] || 0) + 1;
    });
    return counts;
  }

  // Check if all players voted
  allVoted() {
    return this.gameVotes.size >= this.players.size;
  }

  // Get winning game (most votes, random on tie)
  getWinningGame() {
    const counts = this.getVoteCounts();
    if (Object.keys(counts).length === 0) return null;
    
    const maxVotes = Math.max(...Object.values(counts));
    const winners = Object.keys(counts).filter(g => counts[g] === maxVotes);
    
    // Random selection on tie
    return winners[Math.floor(Math.random() * winners.length)];
  }

  // End voting
  endVoting() {
    this.votingActive = false;
    const winner = this.getWinningGame();
    this.gameVotes.clear();
    return winner;
  }

  // Award trophy to the player with most session wins
  awardTrophy() {
    const playerList = this.getPlayerList();
    if (playerList.length < 2) return null;
    
    // Find player(s) with most session wins
    const maxWins = Math.max(...playerList.map(p => p.sessionWins));
    if (maxWins === 0) return null; // No wins at all
    
    const winners = playerList.filter(p => p.sessionWins === maxWins);
    
    // Only award if there's a single winner (not a tie)
    if (winners.length === 1) {
      const winner = this.players.get(winners[0].id);
      winner.trophies += 1;
      
      // Update global account stats
      if (winner.username && userAccounts[winner.username]) {
        updateUserStats(winner.username, false, true);
      }
      
      return winners[0];
    }
    
    return null; // Tie - no trophy awarded
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🎮 Player connected: ${socket.id}`);

  // ============================================
  // AUTHENTICATION (The Nevermore Archives)
  // ============================================
  
  socket.on('register', ({ username, password, displayName }) => {
    if (!username || !password) {
      socket.emit('authError', { message: 'Username and password required' });
      return;
    }
    
    if (username.length < 3 || username.length > 20) {
      socket.emit('authError', { message: 'Username must be 3-20 characters' });
      return;
    }
    
    if (password.length < 4) {
      socket.emit('authError', { message: 'Password must be at least 4 characters' });
      return;
    }
    
    const cleanUsername = username.toLowerCase().trim();
    
    if (userAccounts[cleanUsername]) {
      socket.emit('authError', { message: 'Username already taken. Try another.' });
      return;
    }
    
    // Create new account
    userAccounts[cleanUsername] = {
      username: cleanUsername,
      displayName: displayName || username,
      passwordHash: hashPassword(password),
      trophies: 0,
      totalWins: 0,
      gamesPlayed: 0,
      createdAt: Date.now(),
      lastPlayed: null
    };
    
    saveUsers(userAccounts);
    
    authenticatedSockets.set(socket.id, cleanUsername);
    
    socket.emit('authSuccess', { 
      username: cleanUsername,
      displayName: userAccounts[cleanUsername].displayName,
      trophies: 0,
      totalWins: 0,
      gamesPlayed: 0,
      title: getUserTitle(0)
    });
    
    console.log(`📝 New account registered: ${cleanUsername}`);
  });
  
  socket.on('login', ({ username, password }) => {
    if (!username || !password) {
      socket.emit('authError', { message: 'Username and password required' });
      return;
    }
    
    const cleanUsername = username.toLowerCase().trim();
    const user = userAccounts[cleanUsername];
    
    if (!user) {
      socket.emit('authError', { message: 'Account not found. Register first!' });
      return;
    }
    
    if (user.passwordHash !== hashPassword(password)) {
      socket.emit('authError', { message: 'Incorrect password' });
      return;
    }
    
    authenticatedSockets.set(socket.id, cleanUsername);
    
    socket.emit('authSuccess', {
      username: cleanUsername,
      displayName: user.displayName,
      trophies: user.trophies || 0,
      totalWins: user.totalWins || 0,
      gamesPlayed: user.gamesPlayed || 0,
      title: getUserTitle(user.trophies || 0)
    });
    
    console.log(`🔓 User logged in: ${cleanUsername}`);
  });
  
  socket.on('logout', () => {
    const username = authenticatedSockets.get(socket.id);
    if (username) {
      authenticatedSockets.delete(socket.id);
      console.log(`🔒 User logged out: ${username}`);
    }
    socket.emit('loggedOut');
  });
  
  socket.on('getLeaderboard', () => {
    socket.emit('leaderboardData', getLeaderboard());
  });

  // ============================================
  // ROOM MANAGEMENT
  // ============================================

  // Create room
  socket.on('createRoom', (playerName) => {
    const username = authenticatedSockets.get(socket.id);
    const roomId = uuidv4().substring(0, 6).toUpperCase();
    const room = new GameRoom(roomId, socket.id, playerName, username);
    rooms.set(roomId, room);
    players.set(socket.id, roomId);
    
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, players: room.getPlayerList() });
    console.log(`🏠 Room created: ${roomId} by ${playerName}${username ? ` (@${username})` : ''}`);
  });

  // Join room
  socket.on('joinRoom', ({ roomId, playerName }) => {
    const username = authenticatedSockets.get(socket.id);
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

    room.addPlayer(socket.id, playerName, username);
    players.set(socket.id, roomId.toUpperCase());
    
    socket.join(roomId.toUpperCase());
    socket.emit('roomJoined', { roomId: roomId.toUpperCase(), players: room.getPlayerList() });
    socket.to(roomId.toUpperCase()).emit('playerJoined', { players: room.getPlayerList() });
    console.log(`👤 ${playerName}${username ? ` (@${username})` : ''} joined room ${roomId}`);
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
      playerColor: player.color,  // Include player color
      message: message,
      timestamp: Date.now()
    };
    room.chat.push(chatMsg);
    io.to(roomId).emit('chatMessage', chatMsg);
  });

  // ============================================
  // GAME VOTING SYSTEM (The Séance Circle)
  // ============================================
  
  // Start voting phase
  socket.on('startVoting', () => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.players.size < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start!' });
      return;
    }
    
    room.startVoting();
    io.to(roomId).emit('votingStarted', { 
      players: room.getPlayerList(),
      voteCounts: room.getVoteCounts()
    });
    console.log(`🗳️ Voting started in room ${roomId}`);
  });
  
  // Cast vote for a game
  socket.on('voteGame', ({ gameType, options }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;
    
    room.castVote(socket.id, gameType);
    room.lastVoteOptions = room.lastVoteOptions || {};
    room.lastVoteOptions[gameType] = options || {};
    
    const voteCounts = room.getVoteCounts();
    const voterCount = room.gameVotes.size;
    const totalPlayers = room.players.size;
    
    io.to(roomId).emit('voteUpdate', { 
      voteCounts,
      voterCount,
      totalPlayers,
      voters: Array.from(room.gameVotes.keys())
    });
    
    // Auto-start when all voted
    if (room.allVoted()) {
      const winningGame = room.endVoting();
      const options = room.lastVoteOptions[winningGame] || {};
      
      // Reset session wins when starting a new game
      room.resetSessionWins();
      room.resetPoints();
      
      room.currentGame = winningGame;
      room.gameState = initializeGame(winningGame, room, options);
      
      // Save difficulty for future restarts
      if (winningGame === 'memory' && options.difficulty) {
        room.lastMemoryDifficulty = options.difficulty;
      }
      if (winningGame === 'sudoku' && options.difficulty) {
        room.lastSudokuDifficulty = options.difficulty;
      }
      
      io.to(roomId).emit('gameStarted', { 
        gameType: winningGame, 
        gameState: room.gameState,
        players: room.getPlayerList(),
        voteCounts
      });
      console.log(`🎮 Game started via vote: ${winningGame} in room ${roomId}`);
      
      if (winningGame === 'molewhack') {
        startMoleWhackRound(room, roomId);
      }
    }
  });

  // Force start (if waiting too long) - any player can trigger after 10 seconds
  socket.on('forceStartGame', () => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || !room.votingActive) return;
    if (room.gameVotes.size === 0) {
      socket.emit('error', { message: 'At least one vote needed to start!' });
      return;
    }
    
    const winningGame = room.endVoting();
    const options = room.lastVoteOptions?.[winningGame] || {};
    
    room.resetSessionWins();
    room.resetPoints();
    
    room.currentGame = winningGame;
    room.gameState = initializeGame(winningGame, room, options);
    
    if (winningGame === 'memory' && options.difficulty) {
      room.lastMemoryDifficulty = options.difficulty;
    }
    if (winningGame === 'sudoku' && options.difficulty) {
      room.lastSudokuDifficulty = options.difficulty;
    }
    
    io.to(roomId).emit('gameStarted', { 
      gameType: winningGame, 
      gameState: room.gameState,
      players: room.getPlayerList()
    });
    console.log(`🎮 Game force-started: ${winningGame} in room ${roomId}`);
    
    if (winningGame === 'molewhack') {
      startMoleWhackRound(room, roomId);
    }
  });

  // Legacy startGame handler (for backward compatibility)
  socket.on('startGame', (gameData) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.players.size < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start!' });
      return;
    }

    // Support both old format (string) and new format (object with options)
    const gameType = typeof gameData === 'string' ? gameData : gameData.type;
    const options = typeof gameData === 'object' ? gameData.options || {} : {};

    // Reset session wins when starting a new game from lobby
    room.resetSessionWins();
    room.resetPoints();
    
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
      room.players.get(socket.id).sessionWins += 1;  // Track session win
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
      // Track correct answers per player
      if (!state.correctAnswers) state.correctAnswers = {};
      state.correctAnswers[socket.id] = (state.correctAnswers[socket.id] || 0) + 1;
      
      // Award in-game points with time bonus
      const timeBonus = Math.max(0, Math.floor((state.timeLeft / 15) * 5));
      room.players.get(socket.id).points += 10 + timeBonus;
    }

    io.to(roomId).emit('playerAnswered', {
      playerId: socket.id,
      isCorrect,
      correctAnswers: state.correctAnswers || {},
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
          // Track matches per player for this round
          if (!state.matchesPerPlayer) state.matchesPerPlayer = {};
          state.matchesPerPlayer[socket.id] = (state.matchesPerPlayer[socket.id] || 0) + 1;
          
          // Award in-game points (10 per match)
          room.players.get(socket.id).points += 10;
          
          io.to(roomId).emit('memoryMatch', {
            cards: [first, second],
            matched: state.matched,
            matcherId: socket.id,
            matcherName: room.players.get(socket.id).name,
            matchesPerPlayer: state.matchesPerPlayer,
            players: room.getPlayerList()
          });

          // Check win - award session win to player with most matches
          if (state.matched.length === state.cards.length) {
            const maxMatches = Math.max(...Object.values(state.matchesPerPlayer));
            const winners = Object.entries(state.matchesPerPlayer)
              .filter(([id, matches]) => matches === maxMatches);
            
            if (winners.length === 1) {
              room.players.get(winners[0][0]).sessionWins += 1;
            }
            // If tie, no session win awarded
            
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
      room.players.get(socket.id).sessionWins += 1;  // Track session win
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

  // Restart game (play again) - any player can trigger
  socket.on('restartGame', (gameData) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;
    
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
    
    // Reset points but keep session wins (accumulating for trophy)
    room.resetPoints();
    
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
      
      // Sudoku is collaborative - no individual winner
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
    
    // Check for winner (using winCondition from game state, default to 4)
    const winCondition = state.winCondition || 4;
    const winner = checkConnect4Winner(state.board, row, col, piece, winCondition);
    if (winner) {
      state.winner = socket.id;
      state.winningCells = winner;
      room.players.get(socket.id).sessionWins += 1;  // Track session win
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
    
    // Find the mole at this position
    const moleData = state.molePositions.find(m => m.position === moleIndex);
    if (moleData) {
      // Remove mole from active positions
      const moleIdx = state.molePositions.indexOf(moleData);
      state.molePositions.splice(moleIdx, 1);
      
      if (!state.scores[socket.id]) state.scores[socket.id] = 0;
      
      // Check if player hit their own mole or someone else's
      const isOwnMole = moleData.playerId === socket.id;
      let pointsChange = 0;
      
      if (isOwnMole) {
        // Hit own mole: +10 points
        pointsChange = 10;
        state.scores[socket.id] = (state.scores[socket.id] || 0) + 10;
      } else {
        // Hit someone else's mole: -5 points
        pointsChange = -5;
        state.scores[socket.id] = Math.max(0, (state.scores[socket.id] || 0) - 5);
      }
      
      io.to(roomId).emit('moleWhacked', {
        moleIndex,
        moleOwnerId: moleData.playerId,
        moleOwnerName: moleData.playerName,
        moleColor: moleData.color,
        whackerId: socket.id,
        whackerName: room.players.get(socket.id).name,
        isOwnMole,
        pointsChange,
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
      // Track correct answers per player
      if (!state.correctAnswers) state.correctAnswers = {};
      state.correctAnswers[socket.id] = (state.correctAnswers[socket.id] || 0) + 1;
      
      // Award in-game points with time bonus
      const timeBonus = Math.max(0, Math.floor((state.timeLeft / 15) * 5));
      room.players.get(socket.id).points += 10 + timeBonus;
    }

    io.to(roomId).emit('mathPlayerAnswered', {
      playerId: socket.id,
      isCorrect,
      correctAnswers: state.correctAnswers || {},
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
      room.players.get(socket.id).sessionWins += 1;  // Track session win
      
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

    // Award trophy to session winner before returning to lobby
    const trophyWinner = room.awardTrophy();
    
    // Update all players' global stats (games played, wins)
    room.getPlayerList().forEach(player => {
      if (player.username && userAccounts[player.username]) {
        const won = player.sessionWins > 0;
        // Update games played (trophy already handled in awardTrophy)
        userAccounts[player.username].gamesPlayed = (userAccounts[player.username].gamesPlayed || 0) + 1;
        if (won) {
          userAccounts[player.username].totalWins = (userAccounts[player.username].totalWins || 0) + player.sessionWins;
        }
        userAccounts[player.username].lastPlayed = Date.now();
      }
    });
    saveUsers(userAccounts);
    
    // Reset session wins for next game
    room.resetSessionWins();
    room.resetPoints();
    
    room.currentGame = null;
    room.gameState = {};
    
    io.to(roomId).emit('returnToLobby', { 
      players: room.getPlayerList(),
      trophyWinner: trophyWinner ? { 
        id: trophyWinner.id, 
        name: trophyWinner.name,
        totalTrophies: trophyWinner.username ? (userAccounts[trophyWinner.username]?.trophies || 0) : trophyWinner.trophies
      } : null
    });
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
      // Difficulty levels: easy (6 pairs), hard (8 pairs), insane (12 pairs)
      const difficulty = options.difficulty || 'easy';
      const memoryItemsAll = [
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
        { id: 'enid', emoji: '🐺', name: 'Enid' }
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
      // Support 4 or 5 in a row mode (default to 4)
      const winCondition = options.winCondition || 4;
      return {
        board: Array(6).fill(null).map(() => Array(7).fill(null)),
        currentPlayer: shuffledC4[0],
        player1: shuffledC4[0],
        player2: shuffledC4[1],
        winner: null,
        winningCells: [],
        winCondition: winCondition
      };

    case 'molewhack':
      // Create player list with colors for mole assignment
      const molePlayerList = playerIds.map((id, idx) => ({
        id,
        color: room.players.get(id).color || PLAYER_COLORS[idx % PLAYER_COLORS.length],
        name: room.players.get(id).name
      }));
      return {
        round: 1,
        maxRounds: 5,
        molePositions: [],  // Now stores { position, playerId, color, playerName }
        scores: {},
        roundActive: false,
        roundStartTime: null,
        playerList: molePlayerList,  // List of players with colors
        spawnInterval: 1000,  // Starting spawn interval (ms) - gets faster each round
        moleLifetime: 2000   // How long mole stays up (ms) - gets shorter each round
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
  const operations = ['+', '-', '×'];  // Removed division to simplify
  
  for (let i = 0; i < count; i++) {
    const op = operations[Math.floor(Math.random() * operations.length)];
    let a, b, answer;
    
    switch (op) {
      case '+':
        a = Math.floor(Math.random() * 50) + 10;
        b = Math.floor(Math.random() * 50) + 10;
        answer = a + b;
        break;
      case '-':
        a = Math.floor(Math.random() * 50) + 30;
        b = Math.floor(Math.random() * 25) + 5;
        answer = a - b;
        break;
      case '×':
        a = Math.floor(Math.random() * 10) + 2;
        b = Math.floor(Math.random() * 10) + 2;
        answer = a * b;
        break;
    }
    
    // Generate wrong options - ensure we always get 3 unique wrongs
    const options = [answer];
    const wrongOffsets = [-15, -10, -5, -3, -2, -1, 1, 2, 3, 5, 10, 15];
    let attempts = 0;
    while (options.length < 4 && attempts < 50) {
      attempts++;
      const offset = wrongOffsets[Math.floor(Math.random() * wrongOffsets.length)];
      const wrong = answer + offset;
      if (wrong !== answer && wrong > 0 && !options.includes(wrong)) {
        options.push(wrong);
      }
    }
    // Fallback if we couldn't generate enough options
    while (options.length < 4) {
      options.push(answer + options.length * 7);
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
  
  // Remove numbers based on difficulty (simplified)
  let cellsToRemove;
  switch (difficulty) {
    case 'easy': cellsToRemove = 30; break;
    case 'medium': cellsToRemove = 40; break;
    case 'hard': cellsToRemove = 50; break;
    default: cellsToRemove = 35;
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

// Connect 4/5 winner check
function checkConnect4Winner(board, row, col, piece, winCondition = 4) {
  const directions = [
    [0, 1],  // horizontal
    [1, 0],  // vertical
    [1, 1],  // diagonal down-right
    [1, -1]  // diagonal down-left
  ];
  
  for (const [dr, dc] of directions) {
    const cells = [[row, col]];
    
    // Check positive direction (search up to winCondition - 1 in each direction)
    for (let i = 1; i < winCondition; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === piece) {
        cells.push([r, c]);
      } else break;
    }
    
    // Check negative direction
    for (let i = 1; i < winCondition; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === piece) {
        cells.push([r, c]);
      } else break;
    }
    
    if (cells.length >= winCondition) return cells;
  }
  
  return null;
}

// Math quiz reveal
function revealMathAnswer(room, roomId) {
  const state = room.gameState;
  const currentQ = state.questions[state.currentQuestion];

  io.to(roomId).emit('mathReveal', {
    correctAnswer: currentQ.correct,
    correctAnswers: state.correctAnswers || {},
    players: room.getPlayerList()
  });

  setTimeout(() => {
    state.currentQuestion++;
    state.answered = [];

    if (state.currentQuestion >= state.questions.length) {
      // Award session win to player with most correct answers
      const correctAnswers = state.correctAnswers || {};
      if (Object.keys(correctAnswers).length > 0) {
        const maxCorrect = Math.max(...Object.values(correctAnswers));
        const winners = Object.entries(correctAnswers)
          .filter(([id, count]) => count === maxCorrect);
        
        if (winners.length === 1) {
          room.players.get(winners[0][0]).sessionWins += 1;
        }
      }
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
    correctAnswers: state.correctAnswers || {},
    players: room.getPlayerList()
  });

  setTimeout(() => {
    state.currentQuestion++;
    state.answered = [];

    if (state.currentQuestion >= state.questions.length) {
      // Award session win to player with most correct answers
      const correctAnswers = state.correctAnswers || {};
      if (Object.keys(correctAnswers).length > 0) {
        const maxCorrect = Math.max(...Object.values(correctAnswers));
        const winners = Object.entries(correctAnswers)
          .filter(([id, count]) => count === maxCorrect);
        
        if (winners.length === 1) {
          room.players.get(winners[0][0]).sessionWins += 1;
        }
      }
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
      
      // Track total wins across all rounds
      if (!state.totalWins) state.totalWins = {};
      
      if (beats[c1] === c2) {
        state.totalWins[p1] = (state.totalWins[p1] || 0) + 1;
        roundResults[p1].wins++;
        roundResults[p2].losses++;
        // Award in-game points
        room.players.get(p1).points += 5;
      } else {
        state.totalWins[p2] = (state.totalWins[p2] || 0) + 1;
        roundResults[p2].wins++;
        roundResults[p1].losses++;
        // Award in-game points
        room.players.get(p2).points += 5;
      }
    }
  }

  io.to(roomId).emit('psychicResults', {
    choices: Object.fromEntries(state.choices),
    players: room.getPlayerList(),
    round: state.round,
    roundResults,
    totalWins: state.totalWins || {}
  });

  // Increased delay to 5 seconds so players can see results properly
  setTimeout(() => {
    state.round++;
    state.choices.clear();

    if (state.round > state.maxRounds) {
      // Award session win to player with most total wins
      const totalWins = state.totalWins || {};
      if (Object.keys(totalWins).length > 0) {
        const maxWins = Math.max(...Object.values(totalWins));
        const winners = Object.entries(totalWins)
          .filter(([id, wins]) => wins === maxWins);
        
        if (winners.length === 1) {
          room.players.get(winners[0][0]).sessionWins += 1;
        }
      }
      endGame(room, roomId);
    } else {
      io.to(roomId).emit('nextPsychicRound', { round: state.round });
    }
  }, 5000);
}

function endGame(room, roomId) {
  const playerList = room.getPlayerList();
  
  // Find the winner of this round (most session wins in current session)
  const sortedBySessionWins = [...playerList].sort((a, b) => b.sessionWins - a.sessionWins);
  const roundWinner = sortedBySessionWins[0];
  
  // Sort by trophies for display
  const sortedByTrophies = [...playerList].sort((a, b) => b.trophies - a.trophies);
  
  io.to(roomId).emit('gameEnded', {
    sessionWinner: roundWinner,
    players: sortedByTrophies
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
  
  // Intensity progression: each round gets faster
  // Round 1: spawn every 1000ms, mole stays 2000ms
  // Round 5: spawn every 500ms, mole stays 1200ms
  const roundProgress = (state.round - 1) / (state.maxRounds - 1); // 0 to 1
  const spawnInterval = Math.max(500, 1000 - (roundProgress * 500)); // 1000ms -> 500ms
  const moleLifetime = Math.max(1200, 2000 - (roundProgress * 800)); // 2000ms -> 1200ms
  
  state.spawnInterval = spawnInterval;
  state.moleLifetime = moleLifetime;
  
  io.to(roomId).emit('moleRoundStart', { 
    round: state.round,
    intensity: Math.round((1 - roundProgress) * 100), // 100% = slow, 0% = fast
    spawnInterval,
    moleLifetime
  });
  
  // Helper function to spawn a mole assigned to a random player
  const spawnMole = () => {
    if (!room.currentGame || room.currentGame !== 'molewhack' || !state.roundActive) {
      return;
    }
    
    // Find an available position
    const occupiedPositions = state.molePositions.map(m => m.position);
    const availablePositions = [0,1,2,3,4,5,6,7,8].filter(i => !occupiedPositions.includes(i));
    if (availablePositions.length === 0) return;
    
    const molePosition = availablePositions[Math.floor(Math.random() * availablePositions.length)];
    
    // Assign mole to a random player
    const playerList = state.playerList || [];
    if (playerList.length === 0) return;
    const assignedPlayer = playerList[Math.floor(Math.random() * playerList.length)];
    
    const moleData = {
      position: molePosition,
      playerId: assignedPlayer.id,
      color: assignedPlayer.color,
      playerName: assignedPlayer.name
    };
    
    state.molePositions.push(moleData);
    io.to(roomId).emit('moleSpawned', { 
      moleIndex: molePosition,
      playerId: assignedPlayer.id,
      color: assignedPlayer.color,
      playerName: assignedPlayer.name
    });
    
    // Hide mole after lifetime if not whacked
    const hideDelay = moleLifetime + (Math.random() * 300);
    setTimeout(() => {
      if (room.currentGame === 'molewhack' && state.roundActive) {
        const idx = state.molePositions.findIndex(m => m.position === molePosition);
        if (idx !== -1) {
          state.molePositions.splice(idx, 1);
          io.to(roomId).emit('moleHidden', { moleIndex: molePosition });
        }
      }
    }, hideDelay);
  };
  
  // Spawn first mole immediately after a short delay (let UI render)
  setTimeout(() => spawnMole(), 500);
  
  // Then spawn more moles at the current interval rate
  const moleSpawner = setInterval(() => {
    if (!room.currentGame || room.currentGame !== 'molewhack' || !state.roundActive) {
      clearInterval(moleSpawner);
      return;
    }
    spawnMole();
  }, spawnInterval);
  
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
        // Award session win to player with highest score
        const scores = state.scores || {};
        if (Object.keys(scores).length > 0) {
          const maxScore = Math.max(...Object.values(scores));
          const winners = Object.entries(scores)
            .filter(([id, score]) => score === maxScore);
          
          if (winners.length === 1) {
            room.players.get(winners[0][0]).sessionWins += 1;
          }
        }
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

// Trivia and Math quiz timer only (mole spawning handled separately)
setInterval(() => {
  rooms.forEach((room, roomId) => {
    // Safety check - ensure room and gameState exist
    if (!room || !room.gameState) return;
    
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
    // NOTE: Mole spawning is handled ONLY in startMoleWhackRound - no duplicate here
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
            room.players.get(state.player2).sessionWins += 1;  // Track session win
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
            room.players.get(state.player1).sessionWins += 1;  // Track session win
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

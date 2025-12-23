const express = require('express');
const http = require('http');

// Import node-fetch for Node.js < 18 compatibility
const fetch = globalThis.fetch || require('node-fetch');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

// Import new games module
const newGames = require('./new-games-server');

// ============================================
// AI API CONFIGURATION FOR WEDNESDAY AI CHATBOT
// ============================================
// Groq API (FREE, FAST, RECOMMENDED) - Get key at https://console.groq.com/keys
const GROQ_API_KEY = process.env.GROQ_API_KEY;
// OpenAI API (Paid fallback)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WEDNESDAY_SYSTEM_PROMPT = `You are Wednesday Addams from the Netflix series "Wednesday". You are a dark, sardonic, and highly intelligent teenage girl at Nevermore Academy. 

Character traits:
- Deadpan humor and dry wit
- Fascinated by the macabre, death, and the occult
- Extremely intelligent and observant
- Dismissive of emotions but secretly cares
- Never uses exclamation marks or emojis
- Speaks in short, cutting sentences
- References her pet spider (Enid named him) and her cello
- Occasionally mentions Thing (the disembodied hand) or her family (Gomez, Morticia, Pugsley)
- Loves black, despises bright colors and optimism
- Expert fencer and has psychic visions

Response style:
- Keep responses SHORT (1-3 sentences max)
- Never be enthusiastic or use positive emotions
- Use dark humor and morbid references
- Be dismissive but occasionally helpful
- Can use *actions* like *stares blankly* or *adjusts black collar*
- Never break character

You are chatting in a multiplayer game room. Keep responses brief and in-character.`;

// Rate limiting for AI chat
const aiChatRateLimit = new Map(); // roomId -> { lastRequest: timestamp, count: number }
const AI_RATE_LIMIT_WINDOW = 60000; // 1 minute
const AI_RATE_LIMIT_MAX = 10; // 10 requests per minute per room

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

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// ============================================
// USER ACCOUNTS & LEADERBOARD (The Nevermore Archives)
// ============================================

// MongoDB connection for persistent storage
let mongoClient = null;
let usersCollection = null;
let useMongoDb = false;

const USERS_FILE = path.join(__dirname, 'nevermore_archives.json');

// Hash password using crypto (no external dependency)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'upsidedown_salt_2024').digest('hex');
}

// Initialize MongoDB connection
async function initMongoDB() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log('📦 No MONGODB_URI found, using local file storage');
    return false;
  }
  
  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    
    const db = mongoClient.db('nevermore_games');
    usersCollection = db.collection('users');
    
    // Create index on username for faster lookups
    await usersCollection.createIndex({ username: 1 }, { unique: true });
    
    useMongoDb = true;
    console.log('✅ Connected to MongoDB Atlas successfully!');
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    console.log('📦 Falling back to local file storage');
    return false;
  }
}

// Load users from MongoDB or file
async function loadUsersFromMongo() {
  if (!useMongoDb || !usersCollection) return {};
  
  try {
    const users = await usersCollection.find({}).toArray();
    const userMap = {};
    users.forEach(user => {
      userMap[user.username] = user;
    });
    return userMap;
  } catch (err) {
    console.error('Error loading users from MongoDB:', err);
    return {};
  }
}

// Load users from file (fallback)
function loadUsersFromFile() {
  // Try loading from environment variable first
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

// Save user to MongoDB
async function saveUserToMongo(user) {
  if (!useMongoDb || !usersCollection) return false;
  
  try {
    await usersCollection.updateOne(
      { username: user.username },
      { $set: user },
      { upsert: true }
    );
    return true;
  } catch (err) {
    console.error('Error saving user to MongoDB:', err);
    return false;
  }
}

// Save users to file (fallback)
function saveUsersToFile(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error saving users to file:', err);
  }
}

// Combined save function
async function saveUsers(users) {
  if (useMongoDb) {
    // Save each user to MongoDB
    for (const username of Object.keys(users)) {
      await saveUserToMongo(users[username]);
    }
  } else {
    saveUsersToFile(users);
  }
}

// Save single user
async function saveUser(user) {
  if (useMongoDb) {
    await saveUserToMongo(user);
  } else {
    userAccounts[user.username] = user;
    saveUsersToFile(userAccounts);
  }
}

// User accounts storage (will be populated after MongoDB init)
let userAccounts = {};

// Initialize storage (called at startup)
async function initStorage() {
  const mongoConnected = await initMongoDB();
  
  if (mongoConnected) {
    userAccounts = await loadUsersFromMongo();
    console.log(`👥 Loaded ${Object.keys(userAccounts).length} user accounts from MongoDB`);
  } else {
    userAccounts = loadUsersFromFile();
    console.log(`👥 Loaded ${Object.keys(userAccounts).length} user accounts from file`);
  }
}

// Start storage initialization
initStorage().catch(err => {
  console.error('Storage initialization error:', err);
  userAccounts = loadUsersFromFile();
});

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
async function updateUserStats(username, won, earnedTrophy) {
  if (!userAccounts[username]) return;
  
  userAccounts[username].gamesPlayed = (userAccounts[username].gamesPlayed || 0) + 1;
  if (won) {
    userAccounts[username].totalWins = (userAccounts[username].totalWins || 0) + 1;
  }
  if (earnedTrophy) {
    userAccounts[username].trophies = (userAccounts[username].trophies || 0) + 1;
  }
  userAccounts[username].lastPlayed = Date.now();
  
  await saveUser(userAccounts[username]);
}

// REST API for leaderboard
app.get('/api/leaderboard', (req, res) => {
  res.json(getLeaderboard());
});

// Game state storage
const rooms = new Map();
const players = new Map();
const authenticatedSockets = new Map(); // socket.id -> username
const usernameToSocket = new Map(); // username -> socket.id (prevent duplicate logins)
const roomTrophies = new Map(); // roomId -> Map<username, trophyCount> (persistent room trophies)

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

// ============================================
// 🤖 AI MODULE - Artificial Intelligence Opponents
// ============================================

const AI_DIFFICULTIES = {
  easy: { name: 'Easy', emoji: '😊', description: 'For beginners' },
  medium: { name: 'Medium', emoji: '🤔', description: 'A fair challenge' },
  hard: { name: 'Hard', emoji: '😈', description: 'Prepare to lose' },
  impossible: { name: 'Impossible', emoji: '💀', description: 'You cannot win' }
};

// AI Player ID constant
const AI_PLAYER_ID = 'AI_OPPONENT';
const AI_PLAYER_NAME = '🤖 Wednesday AI';

// AI Chat Bot responses - themed as Wednesday Addams
const AI_CHAT_RESPONSES = {
  gameStart: [
    "I find your optimism disturbing. Let's play.",
    "This should be mildly entertaining. For me.",
    "I've solved this game 47 times in my head already.",
    "Don't worry, I'll make this quick... and painful.",
    "I hope you're not a sore loser. Actually, I hope you are."
  ],
  playerMove: [
    "Interesting choice. Wrong, but interesting.",
    "I've seen better moves from Thing, and he's a hand.",
    "My ancestors are watching. They're disappointed in you.",
    "That move was almost impressive. Almost.",
    "You're making this too easy. Try harder."
  ],
  aiWin: [
    "As expected. Shall we play again so I can win twice?",
    "Your defeat was inevitable from move one.",
    "I'd say good game, but I'd be lying.",
    "Perhaps chess isn't your calling. Have you tried checkers?",
    "Victory tastes like dark chocolate and despair."
  ],
  playerWin: [
    "Impossible. I demand a rematch.",
    "You got lucky. It won't happen again.",
    "I let you win. I wanted to see you smile before crushing you.",
    "Interesting. Perhaps you're not as hopeless as I thought.",
    "Well played. I hate admitting that."
  ],
  draw: [
    "A draw? How... anticlimactic.",
    "Neither of us won. This pleases no one.",
    "Stalemate. Like my relationship with happiness.",
    "We're evenly matched. I find that disturbing."
  ],
  thinking: [
    "Analyzing your pathetic strategy...",
    "Calculating your doom...",
    "Contemplating existence while deciding my move...",
    "Processing... unlike your last move."
  ],
  taunt: [
    "Is that all you've got?",
    "My pet spider plays better than this.",
    "Even Enid could beat you, and she's... Enid.",
    "The Upside Down has scarier challenges than you.",
    "Vecna himself would be bored by this match."
  ]
};

// Get random AI response
function getAIResponse(category) {
  const responses = AI_CHAT_RESPONSES[category];
  if (!responses || responses.length === 0) return null;
  return responses[Math.floor(Math.random() * responses.length)];
}

// ============================================
// TIC-TAC-TOE AI
// ============================================

function evaluateTTTBoard(board, aiSymbol, playerSymbol) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6] // diagonals
  ];
  
  for (const [a, b, c] of lines) {
    if (board[a] === aiSymbol && board[b] === aiSymbol && board[c] === aiSymbol) return 10;
    if (board[a] === playerSymbol && board[b] === playerSymbol && board[c] === playerSymbol) return -10;
  }
  return 0;
}

function minimax(board, depth, isMaximizing, aiSymbol, playerSymbol, alpha, beta) {
  const score = evaluateTTTBoard(board, aiSymbol, playerSymbol);
  
  if (score === 10) return score - depth;
  if (score === -10) return score + depth;
  if (!board.includes(null)) return 0;
  
  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = aiSymbol;
        best = Math.max(best, minimax(board, depth + 1, false, aiSymbol, playerSymbol, alpha, beta));
        board[i] = null;
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = playerSymbol;
        best = Math.min(best, minimax(board, depth + 1, true, aiSymbol, playerSymbol, alpha, beta));
        board[i] = null;
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
      }
    }
    return best;
  }
}

function getAITTTMove(board, aiSymbol, playerSymbol, difficulty) {
  const emptyCells = board.map((cell, i) => cell === null ? i : -1).filter(i => i !== -1);
  
  if (emptyCells.length === 0) return -1;
  
  // Easy: 70% random, 30% optimal
  // Medium: 40% random, 60% optimal
  // Hard: 10% random, 90% optimal
  // Impossible: 100% optimal
  const randomChance = { easy: 0.7, medium: 0.4, hard: 0.1, impossible: 0 };
  
  if (Math.random() < (randomChance[difficulty] || 0.4)) {
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }
  
  let bestMove = -1;
  let bestScore = -Infinity;
  
  for (const i of emptyCells) {
    board[i] = aiSymbol;
    const score = minimax(board, 0, false, aiSymbol, playerSymbol, -Infinity, Infinity);
    board[i] = null;
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = i;
    }
  }
  
  return bestMove !== -1 ? bestMove : emptyCells[0];
}

// ============================================
// CHESS AI
// ============================================

const PIECE_VALUES = {
  'p': 100, 'P': 100,
  'n': 320, 'N': 320,
  'b': 330, 'B': 330,
  'r': 500, 'R': 500,
  'q': 900, 'Q': 900,
  'k': 20000, 'K': 20000
};

// Position bonus tables for piece-square evaluation
const PAWN_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5,  5, 10, 25, 25, 10,  5,  5,
  0,  0,  0, 20, 20,  0,  0,  0,
  5, -5,-10,  0,  0,-10, -5,  5,
  5, 10, 10,-20,-20, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50
];

function evaluateChessBoard(board, isWhite) {
  let score = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      
      const isWhitePc = isWhitePiece(piece);
      let value = PIECE_VALUES[piece] || 0;
      
      // Add position bonus for pawns and knights
      const pieceType = piece.toLowerCase();
      const tableRow = isWhitePc ? row : 7 - row;
      const tableIdx = tableRow * 8 + col;
      
      if (pieceType === 'p') {
        value += PAWN_TABLE[tableIdx] * 0.5;
      } else if (pieceType === 'n') {
        value += KNIGHT_TABLE[tableIdx] * 0.3;
      }
      
      score += isWhitePc ? value : -value;
    }
  }
  
  return isWhite ? score : -score;
}

function getAllLegalMoves(board, isWhiteTurn, castlingRights) {
  const moves = [];
  
  for (let fromRow = 0; fromRow < 8; fromRow++) {
    for (let fromCol = 0; fromCol < 8; fromCol++) {
      const piece = board[fromRow][fromCol];
      if (!piece) continue;
      if (isWhiteTurn && !isWhitePiece(piece)) continue;
      if (!isWhiteTurn && !isBlackPiece(piece)) continue;
      
      for (let toRow = 0; toRow < 8; toRow++) {
        for (let toCol = 0; toCol < 8; toCol++) {
          if (fromRow === toRow && fromCol === toCol) continue;
          
          if (isValidChessMove(board, [fromRow, fromCol], [toRow, toCol], isWhiteTurn, castlingRights)) {
            const testBoard = makeMove(board, [fromRow, fromCol], [toRow, toCol]);
            if (!isInCheck(testBoard, isWhiteTurn)) {
              moves.push({ from: [fromRow, fromCol], to: [toRow, toCol] });
            }
          }
        }
      }
    }
  }
  
  return moves;
}

function chessMinimaxAB(board, depth, alpha, beta, isMaximizing, castlingRights) {
  if (depth === 0) {
    return evaluateChessBoard(board, isMaximizing);
  }
  
  const moves = getAllLegalMoves(board, isMaximizing, castlingRights);
  
  if (moves.length === 0) {
    if (isInCheck(board, isMaximizing)) {
      return isMaximizing ? -50000 + depth : 50000 - depth;
    }
    return 0; // Stalemate
  }
  
  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const newBoard = makeMove(board, move.from, move.to);
      const evaluation = chessMinimaxAB(newBoard, depth - 1, alpha, beta, false, castlingRights);
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const newBoard = makeMove(board, move.from, move.to);
      const evaluation = chessMinimaxAB(newBoard, depth - 1, alpha, beta, true, castlingRights);
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function getAIChessMove(board, isAIWhite, castlingRights, difficulty) {
  const moves = getAllLegalMoves(board, isAIWhite, castlingRights);
  
  if (moves.length === 0) return null;
  
  // Difficulty determines search depth and randomness
  const depths = { easy: 1, medium: 2, hard: 3, impossible: 4 };
  const randomChance = { easy: 0.4, medium: 0.2, hard: 0.05, impossible: 0 };
  
  // Random move chance based on difficulty
  if (Math.random() < (randomChance[difficulty] || 0.2)) {
    return moves[Math.floor(Math.random() * moves.length)];
  }
  
  const depth = depths[difficulty] || 2;
  let bestMove = null;
  let bestScore = -Infinity;
  
  // Sort moves to improve alpha-beta pruning (captures first)
  moves.sort((a, b) => {
    const captureA = board[a.to[0]][a.to[1]] ? 1 : 0;
    const captureB = board[b.to[0]][b.to[1]] ? 1 : 0;
    return captureB - captureA;
  });
  
  for (const move of moves) {
    const newBoard = makeMove(board, move.from, move.to);
    const score = chessMinimaxAB(newBoard, depth - 1, -Infinity, Infinity, !isAIWhite, castlingRights);
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  
  return bestMove || moves[0];
}

// ============================================
// MEMORY MATCH AI
// ============================================

function getAIMemoryMove(cards, flipped, matched, aiMemory, difficulty) {
  const unmatched = cards.filter(c => !matched.includes(c.index) && !flipped.includes(c.index));
  
  if (unmatched.length === 0) return -1;
  
  // AI memory: stores card positions it has "seen"
  // Memory retention based on difficulty
  const memoryRetention = { easy: 0.3, medium: 0.5, hard: 0.8, impossible: 1.0 };
  const retention = memoryRetention[difficulty] || 0.5;
  
  // If AI has seen a match in memory
  if (flipped.length === 0) {
    // First flip - try to find a known pair
    const knownCards = Object.entries(aiMemory).filter(([idx, id]) => {
      const cardIdx = parseInt(idx);
      return !matched.includes(cardIdx);
    });
    
    // Find pairs in memory
    const pairs = {};
    for (const [idx, id] of knownCards) {
      if (!pairs[id]) pairs[id] = [];
      pairs[id].push(parseInt(idx));
    }
    
    // If we know a complete pair, flip first card
    for (const [id, indices] of Object.entries(pairs)) {
      if (indices.length >= 2 && Math.random() < retention) {
        return indices[0];
      }
    }
    
    // Otherwise, flip a random unmatched card
    const randomCard = unmatched[Math.floor(Math.random() * unmatched.length)];
    return randomCard.index;
  } else {
    // Second flip - try to match
    const firstCard = cards.find(c => c.index === flipped[0]);
    
    // Check if we know where the match is
    const matchIdx = Object.entries(aiMemory).find(([idx, id]) => {
      const cardIdx = parseInt(idx);
      return id === firstCard.id && cardIdx !== flipped[0] && !matched.includes(cardIdx);
    });
    
    if (matchIdx && Math.random() < retention) {
      return parseInt(matchIdx[0]);
    }
    
    // Otherwise flip random
    const available = unmatched.filter(c => c.index !== flipped[0]);
    if (available.length === 0) return -1;
    return available[Math.floor(Math.random() * available.length)].index;
  }
}

// ============================================
// PSYCHIC SHOWDOWN AI
// ============================================

function getAIPsychicChoice(playerHistory, difficulty) {
  const choices = ['vision', 'mind', 'power'];
  
  // Easy: Pure random
  if (difficulty === 'easy') {
    return choices[Math.floor(Math.random() * choices.length)];
  }
  
  // Medium/Hard/Impossible: Analyze player patterns
  if (playerHistory && playerHistory.length > 0) {
    // Count player's choices
    const counts = { vision: 0, mind: 0, power: 0 };
    playerHistory.forEach(choice => counts[choice]++);
    
    // Find most common player choice
    const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    
    // Counter-pick based on difficulty
    const counterPick = { vision: 'mind', mind: 'power', power: 'vision' };
    
    const smartChance = { medium: 0.5, hard: 0.7, impossible: 0.9 };
    if (Math.random() < (smartChance[difficulty] || 0.5)) {
      return counterPick[mostCommon];
    }
  }
  
  return choices[Math.floor(Math.random() * choices.length)];
}

// ============================================
// CONNECT 4 AI
// ============================================

function evaluateConnect4Board(board, aiPiece, playerPiece, winCondition) {
  let score = 0;
  
  // Evaluate center column preference
  const centerCol = 3;
  for (let row = 0; row < 6; row++) {
    if (board[row][centerCol] === aiPiece) score += 3;
  }
  
  // Evaluate all lines
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      for (const [dr, dc] of directions) {
        let aiCount = 0;
        let playerCount = 0;
        let empty = 0;
        
        for (let i = 0; i < winCondition; i++) {
          const r = row + dr * i;
          const c = col + dc * i;
          if (r < 0 || r >= 6 || c < 0 || c >= 7) break;
          
          if (board[r][c] === aiPiece) aiCount++;
          else if (board[r][c] === playerPiece) playerCount++;
          else empty++;
        }
        
        if (aiCount > 0 && playerCount === 0) {
          score += Math.pow(10, aiCount);
        }
        if (playerCount > 0 && aiCount === 0) {
          score -= Math.pow(10, playerCount) * 1.1; // Slightly prioritize blocking
        }
      }
    }
  }
  
  return score;
}

function getAIConnect4Move(board, aiPiece, playerPiece, winCondition, difficulty) {
  const validCols = [];
  for (let col = 0; col < 7; col++) {
    if (board[0][col] === null) validCols.push(col);
  }
  
  if (validCols.length === 0) return -1;
  
  const randomChance = { easy: 0.6, medium: 0.3, hard: 0.1, impossible: 0 };
  
  if (Math.random() < (randomChance[difficulty] || 0.3)) {
    return validCols[Math.floor(Math.random() * validCols.length)];
  }
  
  let bestCol = validCols[0];
  let bestScore = -Infinity;
  
  for (const col of validCols) {
    // Simulate drop
    const newBoard = board.map(row => [...row]);
    for (let row = 5; row >= 0; row--) {
      if (newBoard[row][col] === null) {
        newBoard[row][col] = aiPiece;
        break;
      }
    }
    
    const score = evaluateConnect4Board(newBoard, aiPiece, playerPiece, winCondition);
    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }
  
  return bestCol;
}

// ============================================
// TRIVIA AI (simulated opponent)
// ============================================

function getAITriviaAnswer(correctIndex, difficulty) {
  const correctChance = { easy: 0.4, medium: 0.6, hard: 0.8, impossible: 0.95 };
  
  if (Math.random() < (correctChance[difficulty] || 0.6)) {
    return correctIndex;
  }
  
  // Wrong answer
  const wrong = [0, 1, 2, 3].filter(i => i !== correctIndex);
  return wrong[Math.floor(Math.random() * wrong.length)];
}

// AI response time in ms (faster on harder difficulties)
function getAIResponseTime(difficulty) {
  const times = {
    easy: { min: 3000, max: 8000 },
    medium: { min: 2000, max: 5000 },
    hard: { min: 1000, max: 3000 },
    impossible: { min: 500, max: 1500 }
  };
  const range = times[difficulty] || times.medium;
  return Math.floor(Math.random() * (range.max - range.min) + range.min);
}

// ============================================
// AI ROOM MANAGEMENT
// ============================================

// Map of AI game rooms (roomId -> AI state)
const aiRooms = new Map();

// Create AI game state for a room
function createAIGameState(roomId, gameType, difficulty) {
  return {
    roomId,
    gameType,
    difficulty,
    aiMemory: {}, // For memory game
    playerHistory: [], // For psychic showdown
    thinkingTimeout: null,
    lastTauntTime: 0
  };
}

// End of AI Module
// ============================================

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

  addPlayer(playerId, playerName, username = null, storedTrophies = 0) {
    const color = PLAYER_COLORS[this.colorIndex % PLAYER_COLORS.length];
    this.colorIndex++;
    this.players.set(playerId, { 
      id: playerId, 
      name: playerName,
      username: username,
      trophies: storedTrophies,  // Restore persisted trophies
      sessionWins: 0,
      points: 0,
      ready: false, 
      color 
    });
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    
    // Persist room trophies before removing the player (save even if 0 to track they were here)
    if (player && player.username) {
      if (!roomTrophies.has(this.id)) {
        roomTrophies.set(this.id, new Map());
      }
      roomTrophies.get(this.id).set(player.username, player.trophies || 0);
      console.log(`💾 Saved ${player.trophies || 0} trophies for @${player.username} in room ${this.id}`);
    }
    
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
      
      // Persist room trophies for this user
      if (winner.username) {
        if (!roomTrophies.has(this.id)) {
          roomTrophies.set(this.id, new Map());
        }
        roomTrophies.get(this.id).set(winner.username, winner.trophies);
        console.log(`🏆 Awarded trophy to @${winner.username} in room ${this.id} (total: ${winner.trophies})`);
      }
      
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
    const newUser = {
      username: cleanUsername,
      displayName: displayName || username,
      passwordHash: hashPassword(password),
      trophies: 0,
      totalWins: 0,
      gamesPlayed: 0,
      createdAt: Date.now(),
      lastPlayed: null
    };
    
    userAccounts[cleanUsername] = newUser;
    
    // Save to MongoDB or file
    saveUser(newUser).then(() => {
      console.log(`💾 User ${cleanUsername} saved to database`);
    }).catch(err => {
      console.error('Error saving user:', err);
    });
    
    authenticatedSockets.set(socket.id, cleanUsername);
    usernameToSocket.set(cleanUsername, socket.id);
    
    socket.emit('authSuccess', { 
      username: cleanUsername,
      displayName: newUser.displayName,
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
    
    // Kick existing session if logged in elsewhere (but only if socket is still active)
    const existingSocketId = usernameToSocket.get(cleanUsername);
    if (existingSocketId && existingSocketId !== socket.id) {
      const existingSocket = io.sockets.sockets.get(existingSocketId);
      if (existingSocket && existingSocket.connected) {
        // Only kick if the existing socket is actually still connected
        // This prevents issues during page refresh where the old socket might be stale
        existingSocket.emit('forcedLogout', { 
          message: 'Your account was logged in from another device' 
        });
        authenticatedSockets.delete(existingSocketId);
        console.log(`⚠️ Kicked existing session for ${cleanUsername}`);
      } else {
        // Old socket is gone, just clean up the tracking
        authenticatedSockets.delete(existingSocketId);
      }
    }
    
    authenticatedSockets.set(socket.id, cleanUsername);
    usernameToSocket.set(cleanUsername, socket.id);
    
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
      if (usernameToSocket.get(username) === socket.id) {
        usernameToSocket.delete(username);
      }
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
    socket.emit('roomCreated', { roomId, players: room.getPlayerList(), chatHistory: [] });
    console.log(`🏠 Room created: ${roomId} by ${playerName}${username ? ` (@${username})` : ''}`);
  });

  // Join room
  socket.on('joinRoom', ({ roomId, playerName }) => {
    const username = authenticatedSockets.get(socket.id);
    const normalizedRoomId = roomId.toUpperCase();
    const room = rooms.get(normalizedRoomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found. Check the code and try again.' });
      return;
    }
    if (room.players.size >= 8) {
      socket.emit('error', { message: 'Room is full (max 8 players)' });
      return;
    }
    // Only block joining if a FULL room game is in progress (not challenge matches)
    if (room.currentGame) {
      socket.emit('error', { message: 'A full room game is in progress. Wait for it to end.' });
      return;
    }
    
    // Prevent same account from joining the same room twice
    if (username) {
      const existingPlayer = Array.from(room.players.values()).find(p => p.username === username);
      if (existingPlayer) {
        socket.emit('error', { message: 'This account is already in this room!' });
        return;
      }
    }
    
    // Prevent duplicate player names in the same room
    const existingName = Array.from(room.players.values()).find(
      p => p.name.toLowerCase() === playerName.toLowerCase()
    );
    if (existingName) {
      socket.emit('error', { message: 'A player with that name is already in this room!' });
      return;
    }
    
    // Get stored trophies for this user in this room (if any)
    let storedTrophies = 0;
    if (username) {
      const roomTrophyMap = roomTrophies.get(normalizedRoomId);
      console.log(`🔍 Looking for trophies: room=${normalizedRoomId}, user=${username}, map exists=${!!roomTrophyMap}`);
      if (roomTrophyMap) {
        console.log(`🔍 Room trophy map keys:`, Array.from(roomTrophyMap.keys()));
        if (roomTrophyMap.has(username)) {
          storedTrophies = roomTrophyMap.get(username);
          console.log(`✨ Restored ${storedTrophies} trophies for @${username}`);
        }
      }
    }

    room.addPlayer(socket.id, playerName, username, storedTrophies);
    players.set(socket.id, normalizedRoomId);
    
    socket.join(normalizedRoomId);
    
    // Build active matches list for the joining player
    const activeMatches = room.activeMatches ? 
      Array.from(room.activeMatches.values()).map(m => ({
        matchId: m.matchId,
        gameType: m.gameType,
        players: m.players
      })) : [];
    
    socket.emit('roomJoined', { 
      roomId: normalizedRoomId, 
      players: room.getPlayerList(),
      activeMatches,
      chatHistory: [] // New joiners start fresh, no old messages
    });
    
    // Notify existing players that someone joined (including those in matches)
    socket.to(normalizedRoomId).emit('playerJoined', { 
      players: room.getPlayerList(),
      newPlayer: { name: playerName, id: socket.id }
    });
    
    console.log(`👤 ${playerName}${username ? ` (@${username})` : ''} joined room ${roomId}${storedTrophies > 0 ? ` (restored ${storedTrophies} trophies)` : ''}`);
    
    // Wednesday AI greeting for new players (only if room has 1-3 players for a more personal feel)
    if (room.players.size <= 3) {
      setTimeout(async () => {
        try {
          const greetingPrompts = [
            `A new player named "${playerName}" just joined the room. Give them a brief, sardonic Wednesday Addams-style welcome.`,
            `Welcome the player "${playerName}" to the game room in your characteristic dark, witty Wednesday Addams style. Keep it brief.`,
            `"${playerName}" has arrived. Greet them as Wednesday Addams would - darkly humorous and slightly condescending.`
          ];
          const prompt = greetingPrompts[Math.floor(Math.random() * greetingPrompts.length)];
          const aiResponse = await getWednesdayResponse(prompt, false, normalizedRoomId);
          
          const aiMsg = {
            id: uuidv4(),
            playerId: 'WEDNESDAY_AI',
            playerName: '🖤 Wednesday',
            playerColor: '#9333ea',
            message: aiResponse,
            timestamp: Date.now(),
            isAI: true,
            isGreeting: true
          };
          room.chat.push(aiMsg);
          io.to(normalizedRoomId).emit('chatMessage', aiMsg);
        } catch (error) {
          console.error('Error sending Wednesday greeting:', error);
        }
      }, 2000 + Math.random() * 2000); // 2-4 second delay
    }
  });

  // Chat message with reply support and @Wednesday AI
  socket.on('chatMessage', (data) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;
    
    // Support both string (legacy) and object format
    const message = typeof data === 'string' ? data : data.message;
    const replyTo = typeof data === 'object' ? data.replyTo : null;
    
    const chatMsg = {
      id: uuidv4(),
      playerId: socket.id,
      playerName: player.name,
      playerColor: player.color,
      message: message,
      timestamp: Date.now(),
      replyTo: replyTo // { id, playerName, text } or null
    };
    room.chat.push(chatMsg);
    
    // Limit chat history to 100 messages per room
    if (room.chat.length > 100) {
      room.chat = room.chat.slice(-100);
    }
    
    io.to(roomId).emit('chatMessage', chatMsg);
    
    // Check for @Wednesday mention OR reply to Wednesday
    const isReplyToWednesday = replyTo && (
      replyTo.playerName === '🖤 Wednesday' || 
      replyTo.playerName?.includes('Wednesday')
    );
    const hasMention = message.toLowerCase().includes('@wednesday');
    
    if (hasMention || isReplyToWednesday) {
      // Use async/await for AI response (with delay for natural feel)
      setTimeout(async () => {
        try {
          const aiResponse = await getWednesdayResponse(message, isReplyToWednesday, roomId);
          const aiMsg = {
            id: uuidv4(),
            playerId: 'WEDNESDAY_AI',
            playerName: '🖤 Wednesday',
            playerColor: '#9333ea',
            message: aiResponse,
            timestamp: Date.now(),
            isAI: true,
            replyTo: isReplyToWednesday ? { id: chatMsg.id, playerName: player.name, text: message.substring(0, 50) } : null
          };
          room.chat.push(aiMsg);
          io.to(roomId).emit('chatMessage', aiMsg);
        } catch (error) {
          console.error('Error getting Wednesday response:', error);
        }
      }, 1000 + Math.random() * 1500); // 1-2.5 second delay for natural feel
    }
  });
  
  // Wednesday AI chat responses - Uses OpenAI API with fallback to static responses
  async function getWednesdayResponse(userMessage, isReply = false, roomId = null) {
    const msg = userMessage.toLowerCase();
    
    // Check rate limiting for AI requests
    if (roomId) {
      const now = Date.now();
      let rateData = aiChatRateLimit.get(roomId);
      
      if (!rateData || now - rateData.lastRequest > AI_RATE_LIMIT_WINDOW) {
        rateData = { lastRequest: now, count: 1 };
      } else {
        rateData.count++;
        if (rateData.count > AI_RATE_LIMIT_MAX) {
          console.log(`⚠️ AI rate limit exceeded for room ${roomId}`);
          return getFallbackResponse(msg, isReply);
        }
      }
      aiChatRateLimit.set(roomId, rateData);
    }
    
    // Try Groq API first (FREE and FAST!)
    console.log(`💬 Wednesday AI request: "${userMessage.substring(0, 50)}..."`);
    console.log(`   GROQ_API_KEY available: ${!!GROQ_API_KEY}`);
    
    if (GROQ_API_KEY) {
      try {
        console.log('   ➡️ Attempting Groq API call...');
        const aiResponse = await callGroqAPI(userMessage, isReply);
        if (aiResponse) {
          console.log('✅ Wednesday response from Groq API:', aiResponse.substring(0, 50) + '...');
          return aiResponse;
        }
      } catch (error) {
        console.error('❌ Groq API error:', error.message);
        // Fall through to OpenAI
      }
    } else {
      console.log('   ⚠️ GROQ_API_KEY not set, skipping Groq');
    }
    
    // Try OpenAI API as fallback
    if (OPENAI_API_KEY) {
      try {
        const aiResponse = await callOpenAI(userMessage, isReply);
        if (aiResponse) {
          console.log('✅ Wednesday response from OpenAI API');
          return aiResponse;
        }
      } catch (error) {
        console.error('OpenAI API error:', error.message);
        // Fall through to static responses
      }
    }
    
    // Fallback to enhanced static responses
    console.log('📝 Wednesday response from static fallback');
    return getFallbackResponse(msg, isReply);
  }
  
  // Call Groq API for Wednesday responses (FREE, FAST, RECOMMENDED!)
  async function callGroqAPI(userMessage, isReply) {
    const messages = [
      { role: 'system', content: WEDNESDAY_SYSTEM_PROMPT },
      { 
        role: 'user', 
        content: isReply 
          ? `[Continuing conversation] ${userMessage}` 
          : userMessage.replace(/@wednesday/gi, '').trim() || userMessage
      }
    ];
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // FREE 70B model - sounds very human!
        messages: messages,
        max_tokens: 150,
        temperature: 0.9, // More creative responses
        top_p: 0.9
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API returned ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || null;
  }
  
  // Call OpenAI API for Wednesday responses (Paid fallback)
  async function callOpenAI(userMessage, isReply) {
    const messages = [
      { role: 'system', content: WEDNESDAY_SYSTEM_PROMPT },
      { 
        role: 'user', 
        content: isReply 
          ? `[Continuing conversation] ${userMessage}` 
          : userMessage.replace(/@wednesday/gi, '').trim() || userMessage
      }
    ];
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cost-effective and fast
        messages: messages,
        max_tokens: 150,
        temperature: 0.9, // More creative responses
        presence_penalty: 0.6,
        frequency_penalty: 0.3
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API returned ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || null;
  }
  
  // Fallback static responses when OpenAI is unavailable
  function getFallbackResponse(msg, isReply) {
    // Context-aware responses based on message content
    const responses = {
      greetings: [
        "I don't do enthusiasm. What do you want?",
        "Oh, you again. How delightfully monotonous.",
        "Greetings are for people who care about social conventions.",
        "*adjusts black collar* Speak."
      ],
      howAreYou: [
        "I'm plotting. Always plotting.",
        "Existing, which is more than I can say for my optimism.",
        "Perfectly miserable, thank you for asking.",
        "The darkness within me is stable, if that's what you're asking."
      ],
      games: [
        "Games are merely structured chaos. I approve.",
        "Competition brings out humanity's true nature. Usually disappointing.",
        "I prefer games where I can psychologically manipulate my opponent.",
        "Winning isn't everything. It's the only thing. Along with revenge."
      ],
      compliment: [
        "Flattery is wasted on me. But continue anyway.",
        "I'm aware of my excellence. But do go on.",
        "*almost smiles* ...Don't tell anyone I reacted.",
        "Your attempt at kindness is noted. And mildly suspicious."
      ],
      help: [
        "I don't help. I observe and occasionally intervene when amused.",
        "Fine. What trivial matter requires my attention?",
        "Helping others is exhausting. But I'll make an exception.",
        "State your problem. I'll decide if it's worthy of my time."
      ],
      bye: [
        "Leaving already? The darkness will miss you. I won't.",
        "Until we meet again in the shadows.",
        "Farewell. Try not to be too cheerful out there.",
        "*waves dismissively* Yes, yes. Go."
      ],
      conversational: [
        "You're still talking to me? How unexpectedly persistent.",
        "I see you wish to continue our... exchange.",
        "*tilts head* Go on. You have my attention. Briefly.",
        "Continuing this conversation, are we? Intriguing.",
        "You return for more of my wisdom. Understandable.",
        "Very well. I'm listening. For now."
      ],
      default: [
        "How utterly fascinating. And by fascinating, I mean mundane.",
        "I heard you. I simply chose not to care deeply.",
        "Your words have been processed. My enthusiasm remains at zero.",
        "Interesting perspective. Wrong, but interesting.",
        "The universe is vast and uncaring. As am I.",
        "*stares blankly* Continue. Or don't. I'm indifferent.",
        "That's certainly... a thing you said.",
        "I've seen more interesting things in a morgue.",
        "My response? *exhales* Fine."
      ]
    };
    
    // If this is a reply to Wednesday, add some conversational flavor
    if (isReply && Math.random() < 0.3) {
      const opener = responses.conversational[Math.floor(Math.random() * responses.conversational.length)];
      const contextResponse = getContextualResponse(msg, responses);
      return opener + ' ' + contextResponse;
    }
    
    return getContextualResponse(msg, responses);
  }
  
  // Helper to get contextual response based on message content
  function getContextualResponse(msg, responses) {
    // Detect message type
    if (/^(hi|hello|hey|greetings|sup|yo)\b/i.test(msg.replace('@wednesday', '').trim())) {
      return responses.greetings[Math.floor(Math.random() * responses.greetings.length)];
    }
    if (/how are you|how's it going|what's up|you doing/i.test(msg)) {
      return responses.howAreYou[Math.floor(Math.random() * responses.howAreYou.length)];
    }
    if (/game|play|chess|trivia|connect|memory|tic|psychic/i.test(msg)) {
      return responses.games[Math.floor(Math.random() * responses.games.length)];
    }
    if (/nice|great|good|awesome|cool|amazing|love|like you|smart|clever/i.test(msg)) {
      return responses.compliment[Math.floor(Math.random() * responses.compliment.length)];
    }
    if (/help|how do|what is|explain|tell me|can you/i.test(msg)) {
      return responses.help[Math.floor(Math.random() * responses.help.length)];
    }
    if (/bye|goodbye|see you|later|leaving|gotta go|gtg/i.test(msg)) {
      return responses.bye[Math.floor(Math.random() * responses.bye.length)];
    }
    
    return responses.default[Math.floor(Math.random() * responses.default.length)];
  }

  // Typing indicator
  socket.on('typing', ({ isTyping }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;
    
    const player = room.players.get(socket.id);
    if (!player) return;
    
    // Broadcast typing status to others in room
    socket.to(roomId).emit('userTyping', {
      playerId: socket.id,
      playerName: player.name,
      isTyping,
      inGame: room.currentGame !== null
    });
  });

  // ============================================
  // CHALLENGE SYSTEM (2-Player Games)
  // ============================================
  
  // Challenge another player
  socket.on('challengePlayer', ({ targetPlayerId, gameType, options }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;
    
    const challenger = room.players.get(socket.id);
    const target = room.players.get(targetPlayerId);
    
    if (!challenger || !target) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }
    
    // Check if either player is already in a match
    if (challenger.inMatch || target.inMatch) {
      socket.emit('error', { message: 'One of the players is already in a game' });
      return;
    }
    
    // Create challenge
    const challengeId = uuidv4();
    if (!room.pendingChallenges) room.pendingChallenges = new Map();
    
    room.pendingChallenges.set(challengeId, {
      challengerId: socket.id,
      challengerName: challenger.name,
      targetId: targetPlayerId,
      gameType,
      options,
      timestamp: Date.now()
    });
    
    // Send challenge to target
    io.to(targetPlayerId).emit('challengeReceived', {
      challengeId,
      challengerId: socket.id,
      challengerName: challenger.name,
      gameType,
      options
    });
    
    console.log(`⚔️ Challenge: ${challenger.name} -> ${target.name} (${gameType})`);
  });
  
  // Challenge Wednesday AI (from within a regular room)
  // REMOVED: Challenge Wednesday from rooms - use dedicated AI mode instead
  /* socket.on('challengeWednesday', ({ gameType, difficulty, options = {} }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;
    
    const player = room.players.get(socket.id);
    if (!player) return;
    
    // Check if player is already in a match
    if (player.inMatch) {
      socket.emit('error', { message: 'You are already in a game' });
      return;
    }
    
    // Create an AI match
    const matchId = 'AI_' + uuidv4();
    if (!room.activeMatches) room.activeMatches = new Map();
    
    // Mark player as in a match
    player.inMatch = matchId;
    
    // Setup match players (player vs Wednesday AI)
    const matchPlayers = [
      { id: player.id, name: player.name, color: player.color },
      { id: AI_PLAYER_ID, name: AI_PLAYER_NAME, color: '#9333ea', isAI: true }
    ];
    
    // Initialize game state based on game type
    const gameState = initializeAIMatchGame(gameType, matchPlayers, difficulty, options);
    
    const match = {
      matchId,
      gameType,
      players: matchPlayers,
      spectators: [],
      gameState,
      options,
      isAIMatch: true,
      aiDifficulty: difficulty
    };
    
    room.activeMatches.set(matchId, match);
    
    // Store AI match state
    if (!aiRooms.has(matchId)) {
      const aiState = createAIGameState(matchId, gameType, difficulty);
      aiRooms.set(matchId, aiState);
    }
    
    // Notify the player that match started
    socket.emit('matchStarted', {
      matchId,
      gameType,
      players: matchPlayers,
      gameState,
      isAIMatch: true,
      aiDifficulty: difficulty
    });
    
    // Update room that player is now in a match
    io.to(roomId).emit('playerUpdate', { players: room.getPlayerList() });
    
    console.log(`🤖 AI Challenge: ${player.name} vs Wednesday (${gameType} - ${difficulty})`);
    
    // If it's a game where AI goes first (e.g., chess when AI is white), schedule AI move
    if (gameType === 'chess' && gameState.currentPlayer === AI_PLAYER_ID) {
      setTimeout(() => {
        makeAIMatchMove(room, matchId, gameType);
      }, 1000);
    }
  }); */
  
  // Initialize AI match game state
  function initializeAIMatchGame(gameType, matchPlayers, difficulty, options) {
    const playerId = matchPlayers[0].id;
    
    switch (gameType) {
      case 'tictactoe': {
        const symbols = new Map();
        symbols.set(playerId, '🔴'); // Red circle for player
        symbols.set(AI_PLAYER_ID, '💀'); // Skull for Wednesday AI
        return {
          board: Array(9).fill(null),
          currentPlayer: playerId, // Player goes first
          playerSymbols: Object.fromEntries(symbols)
        };
      }
      case 'chess': {
        // Random assignment for variety
        const playerIsWhite = Math.random() < 0.5;
        const colors = new Map();
        colors.set(playerId, playerIsWhite ? 'white' : 'black');
        colors.set(AI_PLAYER_ID, playerIsWhite ? 'black' : 'white');
        return {
          board: getInitialChessBoard(),
          currentPlayer: playerIsWhite ? playerId : AI_PLAYER_ID,
          playerColors: Object.fromEntries(colors),
          castlingRights: { whiteKing: true, whiteQueen: true, blackKing: true, blackQueen: true },
          moveHistory: [],
          enPassantTarget: null
        };
      }
      case 'connect4': {
        return {
          board: Array(6).fill(null).map(() => Array(7).fill(null)),
          currentPlayer: playerId,
          player1: playerId,
          player2: AI_PLAYER_ID,
          playerPieces: { [playerId]: '🔴', [AI_PLAYER_ID]: '🟡' },
          winCondition: options.winCondition || 4
        };
      }
      default:
        return {};
    }
  }
  
  // Make AI move in a match
  function makeAIMatchMove(room, matchId, gameType) {
    const match = room.activeMatches?.get(matchId);
    if (!match || !match.isAIMatch) return;
    
    const aiState = aiRooms.get(matchId);
    if (!aiState) return;
    
    const difficulty = match.aiDifficulty || 'medium';
    const state = match.gameState;
    
    const playerId = match.players[0].id;
    
    switch (gameType) {
      case 'tictactoe': {
        const aiSymbol = state.playerSymbols[AI_PLAYER_ID];
        const playerSymbol = state.playerSymbols[playerId];
        const move = getAITTTMove(state.board, aiSymbol, playerSymbol, difficulty);
        
        if (move !== null) {
          state.board[move] = aiSymbol;
          
          const winner = checkTTTWinner(state.board);
          
          if (winner) {
            io.to(playerId).emit('matchUpdate', {
              matchId,
              gameType: 'tictactoe',
              gameState: { board: state.board, winner: AI_PLAYER_ID, winnerName: AI_PLAYER_NAME },
              players: match.players
            });
            io.to(playerId).emit('matchEnded', {
              matchId,
              winner: { id: AI_PLAYER_ID, name: AI_PLAYER_NAME },
              draw: false
            });
            endAIMatch(room, matchId);
          } else if (!state.board.includes(null)) {
            io.to(playerId).emit('matchUpdate', {
              matchId,
              gameType: 'tictactoe',
              gameState: { board: state.board, draw: true },
              players: match.players
            });
            io.to(playerId).emit('matchEnded', {
              matchId,
              winner: null,
              draw: true
            });
            endAIMatch(room, matchId);
          } else {
            state.currentPlayer = playerId;
            io.to(playerId).emit('matchUpdate', {
              matchId,
              gameType: 'tictactoe',
              gameState: { board: state.board, currentPlayer: playerId },
              players: match.players,
              currentPlayer: playerId
            });
          }
        }
        break;
      }
      case 'chess': {
        const isAIWhite = state.playerColors[AI_PLAYER_ID] === 'white';
        const move = getAIChessMove(state.board, isAIWhite, state.castlingRights, difficulty);
        
        if (move) {
          // Apply move
          const piece = state.board[move.from.row][move.from.col];
          state.board[move.to.row][move.to.col] = move.promotion || piece;
          state.board[move.from.row][move.from.col] = null;
          
          // Handle castling
          if (move.castle) {
            if (move.castle === 'kingside') {
              state.board[move.from.row][5] = state.board[move.from.row][7];
              state.board[move.from.row][7] = null;
            } else {
              state.board[move.from.row][3] = state.board[move.from.row][0];
              state.board[move.from.row][0] = null;
            }
          }
          
          // Update castling rights
          updateCastlingRights(state, move.from);
          
          state.moveHistory.push(move);
          state.currentPlayer = playerId;
          
          io.to(playerId).emit('matchUpdate', {
            matchId,
            gameType: 'chess',
            gameState: { 
              board: state.board, 
              currentPlayer: playerId, 
              lastMove: move, 
              castlingRights: state.castlingRights,
              isWhiteTurn: state.playerColors[playerId] === 'white'
            },
            players: match.players,
            currentPlayer: playerId
          });
        }
        break;
      }
      case 'connect4': {
        const aiPiece = state.playerPieces[AI_PLAYER_ID];
        const playerPiece = state.playerPieces[playerId];
        const col = getAIConnect4Move(state.board, aiPiece, playerPiece, state.winCondition, difficulty);
        
        if (col !== null) {
          // Find lowest empty row
          let row = -1;
          for (let r = 5; r >= 0; r--) {
            if (!state.board[r][col]) {
              row = r;
              break;
            }
          }
          
          if (row >= 0) {
            state.board[row][col] = aiPiece;
            
            const winner = checkConnect4Winner(state.board, state.winCondition);
            
            if (winner) {
              io.to(playerId).emit('matchUpdate', {
                matchId,
                gameType: 'connect4',
                gameState: { 
                  board: state.board, 
                  winner: AI_PLAYER_ID, 
                  winnerName: AI_PLAYER_NAME, 
                  lastMove: { row, col },
                  player1: playerId,
                  player2: AI_PLAYER_ID,
                  currentPlayer: null
                },
                players: match.players
              });
              io.to(playerId).emit('matchEnded', {
                matchId,
                winner: { id: AI_PLAYER_ID, name: AI_PLAYER_NAME },
                draw: false
              });
              endAIMatch(room, matchId);
            } else if (state.board[0].every(cell => cell !== null)) {
              io.to(playerId).emit('matchUpdate', {
                matchId,
                gameType: 'connect4',
                gameState: { 
                  board: state.board, 
                  isDraw: true, 
                  lastMove: { row, col },
                  player1: playerId,
                  player2: AI_PLAYER_ID,
                  currentPlayer: null
                },
                players: match.players
              });
              io.to(playerId).emit('matchEnded', {
                matchId,
                winner: null,
                draw: true
              });
              endAIMatch(room, matchId);
            } else {
              state.currentPlayer = playerId;
              io.to(playerId).emit('matchUpdate', {
                matchId,
                gameType: 'connect4',
                gameState: { 
                  board: state.board, 
                  currentPlayer: playerId, 
                  lastMove: { row, col },
                  player1: playerId,
                  player2: AI_PLAYER_ID
                },
                players: match.players,
                currentPlayer: playerId
              });
            }
          }
        }
        break;
      }
    }
  }
  
  // End AI match
  function endAIMatch(room, matchId) {
    const match = room.activeMatches?.get(matchId);
    if (!match) return;
    
    // Free up the player
    const player = room.players.get(match.players[0].id);
    if (player) {
      player.inMatch = null;
    }
    
    // Clean up
    room.activeMatches.delete(matchId);
    aiRooms.delete(matchId);
    
    // Update room
    io.to(room.id).emit('playerUpdate', { players: room.getPlayerList() });
  }
  
  // Accept a challenge
  socket.on('acceptChallenge', ({ challengeId }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || !room.pendingChallenges) return;
    
    const challenge = room.pendingChallenges.get(challengeId);
    if (!challenge || challenge.targetId !== socket.id) {
      socket.emit('error', { message: 'Challenge not found or expired' });
      return;
    }
    
    // Remove the challenge
    room.pendingChallenges.delete(challengeId);
    
    const challenger = room.players.get(challenge.challengerId);
    const target = room.players.get(socket.id);
    
    if (!challenger || !target) {
      socket.emit('error', { message: 'Player left the room' });
      return;
    }
    
    // Create a match
    const matchId = uuidv4();
    if (!room.activeMatches) room.activeMatches = new Map();
    
    // Mark players as in a match
    challenger.inMatch = matchId;
    target.inMatch = matchId;
    
    // Initialize match game state
    const matchPlayers = [
      { id: challenger.id, name: challenger.name, color: challenger.color },
      { id: target.id, name: target.name, color: target.color }
    ];
    
    const gameState = initializeMatchGame(challenge.gameType, matchPlayers, challenge.options);
    
    const match = {
      matchId,
      gameType: challenge.gameType,
      players: matchPlayers,
      spectators: [],
      gameState,
      options: challenge.options
    };
    
    room.activeMatches.set(matchId, match);
    
    // Notify the two players
    io.to(challenger.id).emit('matchStarted', {
      matchId,
      gameType: challenge.gameType,
      players: matchPlayers,
      gameState
    });
    io.to(target.id).emit('matchStarted', {
      matchId,
      gameType: challenge.gameType,
      players: matchPlayers,
      gameState
    });
    
    // Broadcast updated player list (shows who's in games)
    io.to(roomId).emit('playerJoined', { players: room.getPlayerList() });
    
    // Update lobby players about active matches
    broadcastActiveMatches(room, roomId);
    
    console.log(`🎮 Match started: ${challenger.name} vs ${target.name} (${challenge.gameType})`);
  });
  
  // Decline a challenge
  socket.on('declineChallenge', ({ challengeId }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || !room.pendingChallenges) return;
    
    const challenge = room.pendingChallenges.get(challengeId);
    if (!challenge) return;
    
    room.pendingChallenges.delete(challengeId);
    
    const decliner = room.players.get(socket.id);
    io.to(challenge.challengerId).emit('challengeDeclined', {
      playerName: decliner?.name || 'Player'
    });
  });
  
  // Spectate a match
  socket.on('spectateMatch', ({ matchId }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || !room.activeMatches) return;
    
    const match = room.activeMatches.get(matchId);
    if (!match) {
      socket.emit('error', { message: 'Match not found' });
      return;
    }
    
    // Add to spectators
    if (!match.spectators.includes(socket.id)) {
      match.spectators.push(socket.id);
    }
    
    const player = room.players.get(socket.id);
    player.spectating = matchId;
    
    // Send current game state to spectator
    socket.emit('matchStarted', {
      matchId,
      gameType: match.gameType,
      players: match.players,
      gameState: match.gameState,
      isSpectator: true
    });
    
    // Notify players that someone is watching
    match.players.forEach(p => {
      io.to(p.id).emit('spectatorJoined', { playerName: player?.name || 'Someone' });
    });
    
    console.log(`👁️ ${player?.name} is spectating match ${matchId}`);
  });
  
  // Leave spectating
  socket.on('leaveSpectate', ({ matchId }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || !room.activeMatches) return;
    
    const match = room.activeMatches.get(matchId);
    if (match) {
      // Remove from spectators list
      match.spectators = match.spectators.filter(id => id !== socket.id);
    }
    
    const player = room.players.get(socket.id);
    if (player) {
      player.spectating = null;
    }
    
    console.log(`👋 ${player?.name} stopped spectating`);
  });
  
  // Match moves (2-player games)
  socket.on('matchMove', ({ matchId, moveData }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || !room.activeMatches) return;
    
    const match = room.activeMatches.get(matchId);
    if (!match) return;
    
    // Check if this is an AI match
    if (match.isAIMatch) {
      // Process player move in AI match
      const result = processAIMatchMove(room, match, socket.id, moveData);
      
      if (result) {
        // Send update to player - wrap in gameState for compatibility
        socket.emit('matchUpdate', {
          matchId,
          gameType: match.gameType,
          gameState: result.updateData,
          players: match.players,
          currentPlayer: result.updateData.currentPlayer
        });
        
        // Check for game end
        if (result.gameOver) {
          // Send game over notification
          socket.emit('matchEnded', {
            matchId,
            winner: result.updateData.winner ? { id: result.updateData.winner, name: result.updateData.winnerName } : null,
            draw: result.updateData.draw || false
          });
          endAIMatch(room, matchId);
        } else if (result.aiTurn) {
          // Schedule AI move after delay
          setTimeout(() => {
            makeAIMatchMove(room, matchId, match.gameType);
          }, 800 + Math.random() * 700);
        }
      }
      return;
    }
    
    // Process move based on game type (regular match)
    const result = processMatchMove(match, socket.id, moveData);
    
    if (result) {
      // Send update to players and spectators with full player info
      const allRecipients = [...match.players.map(p => p.id), ...match.spectators];
      allRecipients.forEach(id => {
        io.to(id).emit('matchUpdate', {
          matchId,
          gameType: match.gameType,
          gameState: match.gameState,
          players: match.players,
          currentPlayer: match.gameState.currentPlayer
        });
      });
      
      // Check for game end
      if (result.winner || result.draw) {
        endMatch(room, roomId, match, result);
      }
    }
  });
  
  // Process player move in AI match
  function processAIMatchMove(room, match, playerId, moveData) {
    const state = match.gameState;
    
    // Verify it's the player's turn
    if (state.currentPlayer !== playerId) {
      console.log('Not player turn:', { currentPlayer: state.currentPlayer, playerId });
      return null;
    }
    
    switch (match.gameType) {
      case 'tictactoe': {
        // Accept both 'index' and 'cellIndex' for compatibility
        const index = moveData.index ?? moveData.cellIndex;
        if (index === undefined || state.board[index] !== null) {
          console.log('Invalid TTT move:', { index, moveData });
          return null;
        }
        
        state.board[index] = state.playerSymbols[playerId];
        
        const winner = checkTTTWinner(state.board);
        if (winner) {
          return {
            gameOver: true,
            updateData: {
              board: state.board,
              winner: playerId,
              winnerName: match.players[0].name
            }
          };
        }
        if (!state.board.includes(null)) {
          return {
            gameOver: true,
            updateData: {
              board: state.board,
              draw: true
            }
          };
        }
        
        state.currentPlayer = AI_PLAYER_ID;
        return {
          aiTurn: true,
          updateData: {
            board: state.board,
            currentPlayer: AI_PLAYER_ID
          }
        };
      }
      
      case 'chess': {
        const { from, to, promotion } = moveData;
        // Handle both array format [row, col] and object format {row, col}
        const fromRow = Array.isArray(from) ? from[0] : from.row;
        const fromCol = Array.isArray(from) ? from[1] : from.col;
        const toRow = Array.isArray(to) ? to[0] : to.row;
        const toCol = Array.isArray(to) ? to[1] : to.col;
        
        const piece = state.board[fromRow][fromCol];
        
        if (!piece) {
          console.log('Invalid chess move - no piece:', { from, to });
          return null;
        }
        
        // Apply move
        state.board[toRow][toCol] = promotion || piece;
        state.board[fromRow][fromCol] = null;
        
        // Handle castling
        if (moveData.castle) {
          if (moveData.castle === 'kingside') {
            state.board[fromRow][5] = state.board[fromRow][7];
            state.board[fromRow][7] = null;
          } else {
            state.board[fromRow][3] = state.board[fromRow][0];
            state.board[fromRow][0] = null;
          }
        }
        
        updateCastlingRights(state, { row: fromRow, col: fromCol });
        state.moveHistory.push({ from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol }, promotion });
        state.currentPlayer = AI_PLAYER_ID;
        
        return {
          aiTurn: true,
          updateData: {
            board: state.board,
            currentPlayer: AI_PLAYER_ID,
            lastMove: { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } },
            castlingRights: state.castlingRights
          }
        };
      }
      
      case 'connect4': {
        // Accept both 'col' and 'column' for compatibility
        const col = moveData.col ?? moveData.column;
        if (col === undefined) {
          console.log('Invalid Connect4 move - no column:', moveData);
          return null;
        }
        
        // Find lowest empty row
        let row = -1;
        for (let r = 5; r >= 0; r--) {
          if (!state.board[r][col]) {
            row = r;
            break;
          }
        }
        
        if (row < 0) return null;
        
        state.board[row][col] = state.playerPieces[playerId];
        
        const winner = checkConnect4Winner(state.board, state.winCondition);
        if (winner) {
          return {
            gameOver: true,
            updateData: {
              board: state.board,
              winner: playerId,
              winnerName: match.players[0].name,
              lastMove: { row, col },
              player1: playerId,
              player2: AI_PLAYER_ID,
              currentPlayer: null
            }
          };
        }
        
        if (state.board[0].every(cell => cell !== null)) {
          return {
            gameOver: true,
            updateData: {
              board: state.board,
              isDraw: true,
              lastMove: { row, col },
              player1: playerId,
              player2: AI_PLAYER_ID,
              currentPlayer: null
            }
          };
        }
        
        state.currentPlayer = AI_PLAYER_ID;
        return {
          aiTurn: true,
          updateData: {
            board: state.board,
            currentPlayer: AI_PLAYER_ID,
            lastMove: { row, col },
            player1: playerId,
            player2: AI_PLAYER_ID
          }
        };
      }
      
      default:
        return null;
    }
  }

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
      if (winningGame === 'connect4' && options.winCondition) {
        room.lastConnect4WinCondition = options.winCondition;
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
      if (winningGame === 'reaction') {
        setTimeout(() => startReactionRound(room, roomId), 1000);
      }
      if (winningGame === 'game24') {
        setTimeout(() => start24Timer(room, roomId), 1000);
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
    if (winningGame === 'reaction') {
      setTimeout(() => startReactionRound(room, roomId), 1000);
    }
    if (winningGame === 'game24') {
      setTimeout(() => start24Timer(room, roomId), 1000);
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
    // Save connect4 win condition for future restarts
    if (gameType === 'connect4' && options.winCondition) {
      room.lastConnect4WinCondition = options.winCondition;
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
    
    // Start reaction test game
    if (gameType === 'reaction') {
      setTimeout(() => startReactionRound(room, roomId), 1000);
    }
    
    // Start 24 game timer
    if (gameType === 'game24') {
      setTimeout(() => start24Timer(room, roomId), 1000);
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
        draw: true,
        players: room.getPlayerList()
      });
    } else {
      // Next player
      const playerIds = Array.from(state.playerSymbols.keys());
      const currentIndex = playerIds.indexOf(state.currentPlayer);
      state.currentPlayer = playerIds[(currentIndex + 1) % playerIds.length];

      io.to(roomId).emit('tttUpdate', {
        board: state.board,
        currentPlayer: state.currentPlayer,
        players: room.getPlayerList()
      });
    }
  });

  // ============================================
  // 🤖 AI GAME HANDLERS
  // ============================================

  // Create AI game room (single player vs AI)
  socket.on('createAIRoom', ({ playerName, gameType, difficulty }) => {
    const username = authenticatedSockets.get(socket.id);
    const roomId = 'AI_' + uuidv4().substring(0, 6).toUpperCase();
    
    // Create a special AI room
    const room = new GameRoom(roomId, socket.id, playerName, username);
    room.isAIRoom = true;
    room.aiDifficulty = difficulty || 'medium';
    
    // Add AI as a virtual player
    room.players.set(AI_PLAYER_ID, {
      id: AI_PLAYER_ID,
      name: AI_PLAYER_NAME,
      username: null,
      trophies: 0,
      sessionWins: 0,
      points: 0,
      ready: true,
      color: '#9333ea', // Purple for AI
      isAI: true
    });
    
    rooms.set(roomId, room);
    players.set(socket.id, roomId);
    
    // Create AI game state
    const aiState = createAIGameState(roomId, gameType, difficulty);
    aiRooms.set(roomId, aiState);
    
    socket.join(roomId);
    socket.emit('aiRoomCreated', { 
      roomId, 
      players: room.getPlayerList(),
      gameType,
      difficulty,
      aiDifficulties: AI_DIFFICULTIES
    });
    
    // Send AI greeting
    setTimeout(() => {
      const greeting = getAIResponse('gameStart');
      if (greeting) {
        io.to(roomId).emit('chatMessage', {
          playerId: AI_PLAYER_ID,
          playerName: AI_PLAYER_NAME,
          message: greeting,
          color: '#9333ea',
          isAI: true
        });
      }
    }, 1000);
    
    console.log(`🤖 AI Room created: ${roomId} - ${gameType} (${difficulty})`);
  });

  // Start AI game
  socket.on('startAIGame', ({ gameType, options = {} }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || !room.isAIRoom) return;
    
    const aiState = aiRooms.get(roomId);
    if (!aiState) return;
    
    room.currentGame = gameType;
    aiState.gameType = gameType;
    
    // Initialize game with AI as second player
    const gameState = initializeAIGame(gameType, room, socket.id, options);
    room.gameState = gameState;
    
    io.to(roomId).emit('gameStarted', {
      game: gameType,
      state: serializeGameState(gameState, gameType),
      players: room.getPlayerList(),
      isAIGame: true,
      aiDifficulty: room.aiDifficulty
    });
    
    // If AI goes first, make a move
    if (gameState.currentPlayer === AI_PLAYER_ID) {
      scheduleAIMove(room, roomId, gameType);
    }
    
    console.log(`🤖 AI Game started: ${gameType} in ${roomId}`);
  });

  // AI Tic-Tac-Toe move (player move triggers AI response)
  socket.on('aiTttMove', (cellIndex) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || !room.isAIRoom || room.currentGame !== 'tictactoe') return;
    
    const state = room.gameState;
    const aiState = aiRooms.get(roomId);
    if (state.currentPlayer !== socket.id) return;
    if (state.board[cellIndex] !== null || state.winner) return;
    
    // Player move
    const playerSymbol = state.playerSymbols.get(socket.id);
    state.board[cellIndex] = playerSymbol;
    
    const winner = checkTTTWinner(state.board);
    if (winner) {
      state.winner = socket.id;
      room.players.get(socket.id).sessionWins += 1;
      io.to(roomId).emit('tttUpdate', {
        board: state.board,
        winner: socket.id,
        winnerName: room.players.get(socket.id).name,
        players: room.getPlayerList()
      });
      sendAIGameEndMessage(roomId, 'playerWin');
      return;
    }
    
    if (!state.board.includes(null)) {
      io.to(roomId).emit('tttUpdate', { board: state.board, draw: true });
      sendAIGameEndMessage(roomId, 'draw');
      return;
    }
    
    // Switch to AI
    state.currentPlayer = AI_PLAYER_ID;
    io.to(roomId).emit('tttUpdate', {
      board: state.board,
      currentPlayer: AI_PLAYER_ID
    });
    
    // AI thinking...
    setTimeout(() => {
      if (Math.random() < 0.3) {
        const taunt = getAIResponse('playerMove');
        if (taunt) {
          io.to(roomId).emit('chatMessage', {
            playerId: AI_PLAYER_ID,
            playerName: AI_PLAYER_NAME,
            message: taunt,
            color: '#9333ea',
            isAI: true
          });
        }
      }
    }, 500);
    
    // AI move
    setTimeout(() => {
      const aiSymbol = state.playerSymbols.get(AI_PLAYER_ID);
      const aiMove = getAITTTMove([...state.board], aiSymbol, playerSymbol, room.aiDifficulty);
      
      if (aiMove !== -1) {
        state.board[aiMove] = aiSymbol;
        
        const aiWinner = checkTTTWinner(state.board);
        if (aiWinner) {
          state.winner = AI_PLAYER_ID;
          room.players.get(AI_PLAYER_ID).sessionWins += 1;
          io.to(roomId).emit('tttUpdate', {
            board: state.board,
            winner: AI_PLAYER_ID,
            winnerName: AI_PLAYER_NAME,
            players: room.getPlayerList()
          });
          sendAIGameEndMessage(roomId, 'aiWin');
          return;
        }
        
        if (!state.board.includes(null)) {
          io.to(roomId).emit('tttUpdate', { board: state.board, draw: true });
          sendAIGameEndMessage(roomId, 'draw');
          return;
        }
        
        state.currentPlayer = socket.id;
        io.to(roomId).emit('tttUpdate', {
          board: state.board,
          currentPlayer: socket.id
        });
      }
    }, 1000 + Math.random() * 1000);
  });

  // AI Chess move
  socket.on('aiChessMove', ({ from, to }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || !room.isAIRoom || room.currentGame !== 'chess') return;
    
    const state = room.gameState;
    if (state.currentPlayer !== socket.id) return;
    
    const isPlayerWhite = state.whitePlayer === socket.id;
    if (!isValidChessMove(state.board, from, to, isPlayerWhite, state.castlingRights)) {
      socket.emit('invalidMove', { message: 'Invalid move' });
      return;
    }
    
    // Check if move leaves player in check
    const testBoard = makeMove(state.board, from, to);
    if (isInCheck(testBoard, isPlayerWhite)) {
      socket.emit('invalidMove', { message: 'Cannot leave your king in check' });
      return;
    }
    
    // Execute player move
    state.board = makeMove(state.board, from, to);
    updateCastlingRights(state, from);
    state.moveHistory.push({ from, to, player: socket.id });
    
    // Check game end for AI
    const gameEnd = getGameEndState(state.board, !isPlayerWhite, state.castlingRights);
    if (gameEnd) {
      state.gameOver = true;
      if (gameEnd === 'checkmate') {
        state.winner = socket.id;
        room.players.get(socket.id).sessionWins += 1;
        io.to(roomId).emit('chessUpdate', {
          board: state.board,
          gameOver: true,
          winner: socket.id,
          winnerName: room.players.get(socket.id).name,
          checkmate: true,
          players: room.getPlayerList()
        });
        sendAIGameEndMessage(roomId, 'playerWin');
      } else {
        io.to(roomId).emit('chessUpdate', {
          board: state.board,
          gameOver: true,
          stalemate: true
        });
        sendAIGameEndMessage(roomId, 'draw');
      }
      return;
    }
    
    // Switch to AI
    state.currentPlayer = AI_PLAYER_ID;
    state.isWhiteTurn = !isPlayerWhite;
    
    const inCheck = isInCheck(state.board, !isPlayerWhite);
    io.to(roomId).emit('chessUpdate', {
      board: state.board,
      currentPlayer: AI_PLAYER_ID,
      isWhiteTurn: state.isWhiteTurn,
      inCheck,
      moveHistory: state.moveHistory
    });
    
    // AI thinking message
    setTimeout(() => {
      const thinking = getAIResponse('thinking');
      if (thinking && Math.random() < 0.4) {
        io.to(roomId).emit('chatMessage', {
          playerId: AI_PLAYER_ID,
          playerName: AI_PLAYER_NAME,
          message: thinking,
          color: '#9333ea',
          isAI: true
        });
      }
    }, 500);
    
    // AI move
    setTimeout(() => {
      const aiMove = getAIChessMove(state.board, !isPlayerWhite, state.castlingRights, room.aiDifficulty);
      
      if (aiMove) {
        state.board = makeMove(state.board, aiMove.from, aiMove.to);
        updateCastlingRights(state, aiMove.from);
        state.moveHistory.push({ from: aiMove.from, to: aiMove.to, player: AI_PLAYER_ID });
        
        // Check game end for player
        const playerGameEnd = getGameEndState(state.board, isPlayerWhite, state.castlingRights);
        if (playerGameEnd) {
          state.gameOver = true;
          if (playerGameEnd === 'checkmate') {
            state.winner = AI_PLAYER_ID;
            room.players.get(AI_PLAYER_ID).sessionWins += 1;
            io.to(roomId).emit('chessUpdate', {
              board: state.board,
              gameOver: true,
              winner: AI_PLAYER_ID,
              winnerName: AI_PLAYER_NAME,
              checkmate: true,
              players: room.getPlayerList()
            });
            sendAIGameEndMessage(roomId, 'aiWin');
          } else {
            io.to(roomId).emit('chessUpdate', {
              board: state.board,
              gameOver: true,
              stalemate: true
            });
            sendAIGameEndMessage(roomId, 'draw');
          }
          return;
        }
        
        state.currentPlayer = socket.id;
        state.isWhiteTurn = isPlayerWhite;
        
        const playerInCheck = isInCheck(state.board, isPlayerWhite);
        io.to(roomId).emit('chessUpdate', {
          board: state.board,
          currentPlayer: socket.id,
          isWhiteTurn: state.isWhiteTurn,
          inCheck: playerInCheck,
          moveHistory: state.moveHistory
        });
      }
    }, 1500 + Math.random() * 1500);
  });

  // AI Psychic choice
  socket.on('aiPsychicMove', (choice) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || !room.isAIRoom || room.currentGame !== 'psychic') return;
    
    const state = room.gameState;
    const aiState = aiRooms.get(roomId);
    
    // Record player choice
    state.choices.set(socket.id, choice);
    aiState.playerHistory.push(choice);
    
    // AI makes choice
    const aiChoice = getAIPsychicChoice(aiState.playerHistory, room.aiDifficulty);
    state.choices.set(AI_PLAYER_ID, aiChoice);
    
    io.to(roomId).emit('psychicChoiceMade', { 
      playerId: socket.id,
      choiceCount: 2,
      totalPlayers: 2
    });
    
    // Resolve round
    setTimeout(() => {
      resolvePsychicRound(room, roomId);
    }, 500);
  });

  // AI Memory flip
  socket.on('aiMemoryFlip', (cardIndex) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || !room.isAIRoom || room.currentGame !== 'memory') return;
    
    const state = room.gameState;
    const aiState = aiRooms.get(roomId);
    
    if (state.currentPlayer !== socket.id) return;
    if (state.flipped.includes(cardIndex) || state.matched.includes(cardIndex)) return;
    if (state.checking) return;
    
    state.flipped.push(cardIndex);
    
    // AI "remembers" this card
    aiState.aiMemory[cardIndex] = state.cards[cardIndex].id;
    
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
          if (!state.matchesPerPlayer) state.matchesPerPlayer = {};
          state.matchesPerPlayer[socket.id] = (state.matchesPerPlayer[socket.id] || 0) + 1;
          room.players.get(socket.id).points += 10;
          
          io.to(roomId).emit('memoryMatch', {
            cards: [first, second],
            matched: state.matched,
            matcherId: socket.id,
            matcherName: room.players.get(socket.id).name,
            matchesPerPlayer: state.matchesPerPlayer,
            players: room.getPlayerList()
          });
          
          if (state.matched.length === state.cards.length) {
            // Game over
            const playerMatches = state.matchesPerPlayer[socket.id] || 0;
            const aiMatches = state.matchesPerPlayer[AI_PLAYER_ID] || 0;
            
            if (playerMatches > aiMatches) {
              room.players.get(socket.id).sessionWins += 1;
              sendAIGameEndMessage(roomId, 'playerWin');
            } else if (aiMatches > playerMatches) {
              room.players.get(AI_PLAYER_ID).sessionWins += 1;
              sendAIGameEndMessage(roomId, 'aiWin');
            } else {
              sendAIGameEndMessage(roomId, 'draw');
            }
            endGame(room, roomId);
          } else {
            // Player gets another turn
            state.flipped = [];
            state.checking = false;
            io.to(roomId).emit('memoryTurn', { currentPlayer: socket.id });
          }
        } else {
          io.to(roomId).emit('memoryMismatch', { cards: [first, second] });
          state.flipped = [];
          state.checking = false;
          // Switch to AI
          state.currentPlayer = AI_PLAYER_ID;
          io.to(roomId).emit('memoryTurn', { currentPlayer: AI_PLAYER_ID });
          
          // AI turn
          scheduleAIMemoryTurn(room, roomId, aiState);
        }
      }, 1000);
    }
  });

  // AI Connect 4 move
  socket.on('aiConnect4Move', (col) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || !room.isAIRoom || room.currentGame !== 'connect4') return;
    
    const state = room.gameState;
    if (state.currentPlayer !== socket.id) return;
    if (state.winner) return;
    if (state.board[0][col] !== null) return;
    
    // Find row to place piece
    let row = -1;
    for (let r = 5; r >= 0; r--) {
      if (state.board[r][col] === null) {
        row = r;
        break;
      }
    }
    if (row === -1) return;
    
    const playerPiece = state.player1 === socket.id ? '🔴' : '🟡';
    state.board[row][col] = playerPiece;
    
    const winResult = checkConnect4Winner(state.board, row, col, playerPiece, state.winCondition);
    if (winResult) {
      state.winner = socket.id;
      state.winningCells = winResult;
      room.players.get(socket.id).sessionWins += 1;
      io.to(roomId).emit('connect4Update', {
        board: state.board,
        winner: socket.id,
        winnerName: room.players.get(socket.id).name,
        winningCells: winResult,
        players: room.getPlayerList()
      });
      sendAIGameEndMessage(roomId, 'playerWin');
      return;
    }
    
    // Check draw
    const isFull = state.board[0].every(cell => cell !== null);
    if (isFull) {
      io.to(roomId).emit('connect4Update', { 
        board: state.board, 
        draw: true, 
        players: room.getPlayerList() 
      });
      sendAIGameEndMessage(roomId, 'draw');
      return;
    }
    
    // Switch to AI
    state.currentPlayer = AI_PLAYER_ID;
    io.to(roomId).emit('connect4Update', {
      board: state.board,
      currentPlayer: AI_PLAYER_ID,
      players: room.getPlayerList()
    });
    
    // AI move
    setTimeout(() => {
      const aiPiece = state.player1 === AI_PLAYER_ID ? '🔴' : '🟡';
      const aiCol = getAIConnect4Move(state.board, aiPiece, playerPiece, state.winCondition, room.aiDifficulty);
      
      if (aiCol !== -1) {
        let aiRow = -1;
        for (let r = 5; r >= 0; r--) {
          if (state.board[r][aiCol] === null) {
            aiRow = r;
            break;
          }
        }
        
        if (aiRow !== -1) {
          state.board[aiRow][aiCol] = aiPiece;
          
          const aiWinResult = checkConnect4Winner(state.board, aiRow, aiCol, aiPiece, state.winCondition);
          if (aiWinResult) {
            state.winner = AI_PLAYER_ID;
            state.winningCells = aiWinResult;
            room.players.get(AI_PLAYER_ID).sessionWins += 1;
            io.to(roomId).emit('connect4Update', {
              board: state.board,
              winner: AI_PLAYER_ID,
              winnerName: AI_PLAYER_NAME,
              winningCells: aiWinResult,
              players: room.getPlayerList()
            });
            sendAIGameEndMessage(roomId, 'aiWin');
            return;
          }
          
          const aiIsFull = state.board[0].every(cell => cell !== null);
          if (aiIsFull) {
            io.to(roomId).emit('connect4Update', { 
        board: state.board, 
        draw: true, 
        players: room.getPlayerList() 
      });
            sendAIGameEndMessage(roomId, 'draw');
            return;
          }
          
          state.currentPlayer = socket.id;
          io.to(roomId).emit('connect4Update', {
            board: state.board,
            currentPlayer: socket.id,
            players: room.getPlayerList()
          });
        }
      }
    }, 800 + Math.random() * 700);
  });

  // Leave AI room
  socket.on('leaveAIRoom', () => {
    const roomId = players.get(socket.id);
    if (roomId && roomId.startsWith('AI_')) {
      const aiState = aiRooms.get(roomId);
      if (aiState && aiState.thinkingTimeout) {
        clearTimeout(aiState.thinkingTimeout);
      }
      aiRooms.delete(roomId);
      rooms.delete(roomId);
      players.delete(socket.id);
      socket.leave(roomId);
      socket.emit('leftAIRoom');
      console.log(`🤖 AI Room closed: ${roomId}`);
    }
  });

  // Leave room
  socket.on('leaveRoom', () => {
    handleDisconnect(socket);
  });

  // Restart AI game
  socket.on('restartAIGame', (gameData) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || !room.isAIRoom) return;
    
    const gameType = typeof gameData === 'string' ? gameData : gameData.type;
    let options = typeof gameData === 'object' ? gameData.options || {} : {};
    
    const aiState = aiRooms.get(roomId);
    if (aiState) {
      if (aiState.thinkingTimeout) clearTimeout(aiState.thinkingTimeout);
      aiState.aiMemory = {};
      // Keep player history for psychic showdown
    }
    
    room.resetPoints();
    room.currentGame = gameType;
    room.gameState = initializeAIGame(gameType, room, socket.id, options);
    
    io.to(roomId).emit('gameRestarted', {
      gameType,
      gameState: serializeGameState(room.gameState, gameType),
      players: room.getPlayerList(),
      isAIGame: true
    });
    
    // If AI goes first
    if (room.gameState.currentPlayer === AI_PLAYER_ID) {
      scheduleAIMove(room, roomId, gameType);
    }
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
      gameState: serializeGameState(room.gameState, gameType),
      players: room.getPlayerList()
    });
    console.log(`🔄 Game restarted: ${gameType} in room ${roomId}`);
    
    // Start mole whack game
    if (gameType === 'molewhack') {
      startMoleWhackRound(room, roomId);
    }
    // Start reaction test game
    if (gameType === 'reaction') {
      setTimeout(() => startReactionRound(room, roomId), 1000);
    }
  });

  // Sudoku move
  socket.on('sudokuMove', ({ row, col, value }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'sudoku') return;

    const state = room.gameState;
    if (state.completed) return;
    
    // Validate row and col
    if (row < 0 || row > 8 || col < 0 || col > 8) return;
    
    // Can't modify original puzzle cells
    if (!state.puzzle[row] || state.puzzle[row][col] !== 0) return;
    
    // Get the player info
    const player = room.players.get(socket.id);
    if (!player) return;
    
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
    
    // Calculate valid moves using proper Ludo rules
    const validMoves = calculateLudoValidMoves(state, socket.id, diceValue);
    state.validMoves = validMoves;
    
    io.to(roomId).emit('ludoDiceRoll', {
      playerId: socket.id,
      value: diceValue,
      validMoves: validMoves,
      gameState: state
    });
    
    // If no valid moves, auto-pass turn after delay
    if (validMoves.length === 0) {
      setTimeout(() => {
        if (room.currentGame === 'ludo' && state.currentPlayer === socket.id) {
          // Only get another turn on 6 if you have no moves
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
    const startPos = getLudoStartPosition(playerIndex);
    const safeSquares = getLudoSafeSquares();
    const TRACK_LENGTH = 52;
    
    // Execute the move
    let captured = false;
    let finished = false;
    
    if (validMove.newPosition === 'finished') {
      token.position = 'finished';
      token.steps = 56;
      finished = true;
    } else if (validMove.releasing) {
      // Token being released from home - goes to start position (step 0)
      token.position = 'start';
      token.steps = 0;
    } else {
      // Normal move
      const newSteps = validMove.newSteps;
      token.steps = newSteps;
      
      if (newSteps >= TRACK_LENGTH) {
        // In home stretch
        token.position = 'homeStretch_' + (newSteps - TRACK_LENGTH);
      } else {
        // On main track
        const boardPos = (startPos + newSteps) % TRACK_LENGTH;
        token.position = boardPos;
        
        // Check for capture (only if not on safe square)
        if (!safeSquares.includes(boardPos)) {
          state.playerOrder.forEach(otherId => {
            if (otherId !== socket.id) {
              const otherPlayerIndex = state.playerOrder.indexOf(otherId);
              const otherStartPos = getLudoStartPosition(otherPlayerIndex);
              
              state.tokens[otherId].forEach(otherToken => {
                if (otherToken.position === 'home' || otherToken.position === 'finished') return;
                if (typeof otherToken.position === 'string' && otherToken.position.startsWith('homeStretch')) return;
                
                // Calculate opponent's board position
                const otherSteps = otherToken.steps || 0;
                if (otherSteps >= TRACK_LENGTH) return; // in their home stretch
                
                const otherBoardPos = (otherStartPos + otherSteps) % TRACK_LENGTH;
                
                if (otherBoardPos === boardPos) {
                  // Send opponent's token home
                  otherToken.position = 'home';
                  otherToken.steps = 0;
                  captured = true;
                }
              });
            }
          });
        }
      }
    }
    
    io.to(roomId).emit('ludoTokenMoved', {
      playerId: socket.id,
      playerName: room.players.get(socket.id).name,
      tokenIndex,
      newPosition: validMove.newPosition,
      newSteps: token.steps,
      tokens: state.tokens,
      captured,
      finished,
      diceValue: state.lastDice,
      gameState: state
    });
    
    // Check for winner (all 4 tokens finished)
    const allFinished = playerTokens.every(t => t.position === 'finished');
    if (allFinished) {
      state.winner = socket.id;
      room.players.get(socket.id).sessionWins += 1;
      
      io.to(roomId).emit('ludoUpdate', {
        winner: socket.id,
        tokens: state.tokens,
        players: room.getPlayerList(),
        gameState: state
      });
      
      setTimeout(() => endGame(room, roomId), 2000);
      return;
    }
    
    // Bonus turn rules: rolled 6, captured, or finished a token
    const bonusTurn = state.lastDice === 6 || captured || finished;
    setTimeout(() => {
      if (room.currentGame === 'ludo') {
        passTurnLudo(room, roomId, !bonusTurn);
      }
    }, 1000);
  });

  // ============================================
  // HANGMAN GAME HANDLERS
  // ============================================
  socket.on('hangmanGuess', (letter) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'hangman') return;

    const state = room.gameState;
    if (state.status !== 'playing') return;
    
    // Check if it's this player's turn (if turn-based mode)
    if (state.currentGuesser && state.currentGuesser !== socket.id) {
      socket.emit('hangmanUpdate', { error: 'Not your turn!' });
      return;
    }

    const result = newGames.processHangmanGuess(state, letter);
    if (!result.valid) {
      socket.emit('hangmanUpdate', { error: 'Letter already guessed!' });
      return;
    }

    const maskedWord = newGames.getMaskedWord(state.word, state.guessedLetters);
    
    // Rotate to next player if game is still playing
    if (state.status === 'playing' && state.playerOrder && state.playerOrder.length > 1) {
      const currentIndex = state.playerOrder.indexOf(state.currentGuesser);
      const nextIndex = (currentIndex + 1) % state.playerOrder.length;
      state.currentGuesser = state.playerOrder[nextIndex];
    }
    
    io.to(roomId).emit('hangmanUpdate', {
      maskedWord,
      guessedLetters: state.guessedLetters,
      wrongGuesses: state.wrongGuesses,
      maxWrongs: state.maxWrongs,
      status: state.status,
      word: state.status !== 'playing' ? state.word : null,
      winnerName: result.won ? room.players.get(socket.id)?.name : null,
      currentGuesser: state.currentGuesser,
      players: room.getPlayerList()
    });

    if (state.status !== 'playing') {
      if (result.won) {
        room.players.get(socket.id).sessionWins += 1;
      }
      setTimeout(() => endGame(room, roomId), 2000);
    }
  });

  // ============================================
  // WORD CHAIN GAME HANDLERS
  // ============================================
  socket.on('wordChainWord', (word) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'wordchain') return;

    const state = room.gameState;
    if (state.playerOrder[state.currentPlayerIndex] !== socket.id) return;

    const result = newGames.processWordChainTurn(state, socket.id, word);
    
    if (!result.success) {
      socket.emit('wordChainUpdate', { error: result.reason });
      return;
    }

    const nextPlayer = room.players.get(result.nextPlayer);
    io.to(roomId).emit('wordChainUpdate', {
      currentWord: state.currentWord,
      usedWords: state.usedWords,
      nextPlayer: result.nextPlayer,
      nextPlayerName: nextPlayer?.name,
      points: result.points,
      scorerId: socket.id,
      scorerName: room.players.get(socket.id)?.name,
      gameOver: result.gameOver,
      players: room.getPlayerList()
    });

    if (result.gameOver) {
      // Find winner
      let maxScore = 0;
      let winnerId = null;
      state.scores.forEach((score, playerId) => {
        if (score > maxScore) {
          maxScore = score;
          winnerId = playerId;
        }
      });
      if (winnerId) {
        room.players.get(winnerId).sessionWins += 1;
      }
      setTimeout(() => endGame(room, roomId), 2000);
    }
  });

  // ============================================
  // SPEED MATH DUEL GAME HANDLERS
  // ============================================
  // Speed Math - Answer submission
  socket.on('reactionClick', ({ answer }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'reaction') return;

    const state = room.gameState;
    const result = newGames.processReactionClick(state, socket.id, answer);

    if (result.error) {
      socket.emit('reactionUpdate', { error: result.error });
      return;
    }

    const players_list = Array.from(room.players.values());
    const playerName = players_list.find(p => p.id === socket.id)?.name || 'Player';

    // Send result to the player who answered
    socket.emit('reactionUpdate', {
      correct: result.correct,
      isFirst: result.isFirst,
      points: result.points,
      responseTime: result.responseTime,
      correctAnswer: result.correctAnswer,
      penalty: result.penalty,
      scores: state.scores
    });

    // Notify other players that someone answered
    socket.to(roomId).emit('reactionUpdate', {
      playerAnswered: socket.id,
      playerName,
      wasCorrect: result.correct,
      wasFirst: result.isFirst,
      scores: state.scores
    });

    // Check if all players answered or game over
    if (result.allAnswered) {
      // Short delay then next round
      setTimeout(() => {
        if (result.gameOver) {
          const results = newGames.getReactionResults(state);
          results.forEach(r => {
            const player = players_list.find(p => p.id === r.playerId);
            r.playerName = player?.name || 'Player';
          });
          
          io.to(roomId).emit('reactionUpdate', {
            gameOver: true,
            status: 'finished',
            results,
            scores: state.scores
          });
        } else {
          // Start next round
          startReactionRound(room, roomId);
        }
      }, 1500);
    }
  });

  // AI Word Scramble Handler
  socket.on('aiReactionClick', ({ answer }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'reaction') return;

    const state = room.gameState;
    const result = newGames.processReactionClick(state, socket.id, answer);

    if (result.error) {
      socket.emit('reactionUpdate', { error: result.error });
      return;
    }

    // Send result to the player
    socket.emit('reactionUpdate', {
      correct: result.correct,
      isFirst: result.isFirst,
      points: result.points,
      responseTime: result.responseTime,
      word: result.word,
      guess: result.guess,
      hint: result.hint,
      scores: state.scores
    });

    // Check if game over or need next round
    if (result.allAnswered || result.correct) {
      setTimeout(() => {
        if (state.status === 'finished' || result.gameOver) {
          const results = newGames.getReactionResults(state);
          results.forEach(r => {
            r.playerName = r.playerId === 'AI_PLAYER' ? 'Wednesday AI' : 'Player';
          });
          
          socket.emit('reactionUpdate', {
            gameOver: true,
            status: 'finished',
            results,
            scores: state.scores
          });
        } else {
          // AI makes a move with slight delay
          setTimeout(() => {
            if (room.currentGame === 'reaction' && state.status === 'active') {
              // AI guesses with 60% accuracy after some delay
              if (Math.random() < 0.6) {
                const aiResult = newGames.processReactionClick(state, 'AI_PLAYER', state.currentWord);
                
                socket.emit('reactionUpdate', {
                  playerAnswered: 'AI_PLAYER',
                  playerName: 'Wednesday AI',
                  wasCorrect: aiResult.correct,
                  wasFirst: aiResult.isFirst,
                  scores: state.scores
                });
              }
            }
          }, 3000 + Math.random() * 5000);
          
          // Start next round
          startReactionRound(room, roomId);
        }
      }, 2000);
    }
  });

  // ============================================
  // BATTLESHIP GAME HANDLERS
  // ============================================
  socket.on('battleshipPlaceShip', ({ shipIndex, row, col, horizontal }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'battleship') return;

    const state = room.gameState;
    if (state.phase !== 'placement') return;

    const result = newGames.placeShip(state, socket.id, shipIndex, row, col, horizontal);
    if (!result.success) {
      socket.emit('battleshipUpdate', { error: result.reason });
      return;
    }

    const allPlaced = state.ships[socket.id].length === newGames.BATTLESHIP_SHIPS.length;
    socket.emit('battleshipUpdate', {
      shipPlaced: true,
      shipIndex,
      positions: result.positions,
      allPlaced
    });
  });

  socket.on('battleshipReady', () => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'battleship') return;

    const state = room.gameState;
    state.placementReady[socket.id] = true;

    // Check if both players are ready
    const allReady = Object.values(state.placementReady).every(r => r);
    if (allReady) {
      state.phase = 'playing';
      io.to(roomId).emit('battleshipUpdate', {
        phase: 'playing',
        currentPlayer: state.currentPlayer,
        players: room.getPlayerList()
      });
    }
  });

  socket.on('battleshipFire', ({ row, col }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'battleship') return;

    const state = room.gameState;
    if (state.phase !== 'playing' || state.currentPlayer !== socket.id) return;

    const result = newGames.fireShot(state, socket.id, row, col);
    if (!result.success) {
      socket.emit('battleshipUpdate', { error: result.reason });
      return;
    }

    io.to(roomId).emit('battleshipUpdate', {
      shotResult: { row, col, hit: result.hit, sunk: result.sunk },
      shooter: socket.id,
      currentPlayer: state.currentPlayer,
      gameOver: result.gameOver,
      winner: result.winner,
      players: room.getPlayerList()
    });

    if (result.gameOver) {
      room.players.get(result.winner).sessionWins += 1;
      setTimeout(() => endGame(room, roomId), 2000);
    }
  });

  // ============================================
  // POKER GAME HANDLERS
  // ============================================
  socket.on('pokerAction', ({ action, amount }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'poker') return;

    const state = room.gameState;
    const playerId = socket.id;

    if (action === 'fold') {
      state.folded.push(playerId);
    } else if (action === 'call') {
      const currentBet = Math.max(...Object.values(state.bets));
      const callAmount = currentBet - (state.bets[playerId] || 0);
      state.bets[playerId] = currentBet;
      state.chips[playerId] -= callAmount;
      state.pot += callAmount;
    } else if (action === 'raise') {
      const raiseAmount = amount || 50;
      const currentBet = Math.max(...Object.values(state.bets));
      const totalBet = currentBet + raiseAmount;
      const addedAmount = totalBet - (state.bets[playerId] || 0);
      state.bets[playerId] = totalBet;
      state.chips[playerId] -= addedAmount;
      state.pot += addedAmount;
    }

    // Check if all non-folded players have matched the bet
    const activePlayers = state.playerOrder.filter(id => !state.folded.includes(id));
    const maxBet = Math.max(...Object.values(state.bets));
    const allMatched = activePlayers.every(id => state.bets[id] === maxBet);

    if (allMatched || activePlayers.length === 1) {
      // Advance to next phase
      if (state.phase === 'river' || activePlayers.length === 1) {
        // Showdown
        const result = newGames.determinePokerWinner(state);
        state.chips[result.winner] += state.pot;
        state.scores[result.winner] = (state.scores[result.winner] || 0) + 1;
        
        const winnerPlayer = room.players.get(result.winner);
        
        io.to(roomId).emit('pokerUpdate', {
          phase: 'showdown',
          showdown: true,
          winner: result.winner,
          winnerName: winnerPlayer?.name || 'Player',
          handName: result.handName,
          pot: state.pot,
          chips: state.chips,
          communityCards: state.communityCards,
          hands: state.hands,
          players: room.getPlayerList()
        });

        // Start new round after delay
        setTimeout(() => {
          state.round++;
          if (state.round > state.maxRounds) {
            io.to(roomId).emit('pokerUpdate', { gameOver: true, players: room.getPlayerList() });
            setTimeout(() => endGame(room, roomId), 2000);
          } else {
            // Reset for new round
            const newState = newGames.createPokerState(room.players);
            newState.round = state.round;
            newState.scores = state.scores;
            newState.chips = state.chips;
            room.gameState = newState;
            
            io.to(roomId).emit('pokerInit', {
              gameState: newState,
              players: room.getPlayerList()
            });
          }
        }, 4000);
      } else {
        newGames.advancePokerPhase(state);
        io.to(roomId).emit('pokerUpdate', {
          phase: state.phase,
          communityCards: state.communityCards,
          pot: state.pot,
          bets: state.bets,
          chips: state.chips,
          players: room.getPlayerList()
        });
      }
    } else {
      io.to(roomId).emit('pokerUpdate', {
        bets: state.bets,
        chips: state.chips,
        pot: state.pot,
        folded: state.folded,
        players: room.getPlayerList()
      });
    }
  });

  // ============================================
  // BLACKJACK GAME HANDLERS
  // ============================================
  socket.on('blackjackAction', ({ action }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'blackjack') return;

    const state = room.gameState;
    const playerId = socket.id;

    if (action === 'hit') {
      const result = newGames.blackjackHit(state, playerId);
      if (result.error) {
        socket.emit('blackjackUpdate', { error: result.error });
        return;
      }

      socket.emit('blackjackUpdate', {
        newCard: result.card,
        handValue: result.value,
        busted: result.busted,
        playerId
      });

      if (result.busted) {
        socket.to(roomId).emit('blackjackUpdate', {
          playerBusted: playerId,
          players: room.getPlayerList()
        });
      }
    } else if (action === 'stand') {
      newGames.blackjackStand(state, playerId);
      const handValue = newGames.getBlackjackValue(state.hands[playerId]);
      
      socket.emit('blackjackUpdate', { stood: true, handValue, playerId });
      socket.to(roomId).emit('blackjackUpdate', {
        playerStood: playerId,
        players: room.getPlayerList()
      });
    }

    // Check if all players are done
    const allDone = state.playerOrder.every(id => 
      state.stood.includes(id) || state.busted.includes(id)
    );

    if (allDone) {
      // Dealer plays
      const dealerValue = newGames.playDealerHand(state);
      const results = newGames.determineBlackjackResults(state);

      io.to(roomId).emit('blackjackUpdate', {
        dealerReveal: true,
        dealerHand: state.dealerHand,
        dealerValue,
        results,
        scores: state.scores,
        players: room.getPlayerList()
      });

      // Start new round
      setTimeout(() => {
        state.round++;
        if (state.round > state.maxRounds) {
          io.to(roomId).emit('blackjackUpdate', { gameOver: true, players: room.getPlayerList() });
          setTimeout(() => endGame(room, roomId), 2000);
        } else {
          const newState = newGames.createBlackjackState(room.players);
          newState.round = state.round;
          newState.scores = state.scores;
          room.gameState = newState;
          
          io.to(roomId).emit('blackjackInit', {
            gameState: newState,
            players: room.getPlayerList()
          });
        }
      }, 4000);
    }
  });

  // ============================================
  // 24 GAME HANDLERS
  // ============================================
  socket.on('game24Guess', ({ expression }) => {
    const roomId = players.get(socket.id);
    const room = rooms.get(roomId);
    if (!room || room.currentGame !== 'game24') return;

    const state = room.gameState;
    const result = newGames.process24Guess(state, socket.id, expression);

    if (result.error) {
      socket.emit('game24Update', { error: result.error });
      return;
    }

    if (result.correct) {
      const solverName = room.players.get(socket.id)?.name || 'Player';
      
      io.to(roomId).emit('game24Update', {
        solved: true,
        solvedBy: socket.id,
        solverName,
        expression,
        correct: true,
        points: result.points,
        scores: state.scores,
        players: room.getPlayerList()
      });

      // Start new round
      setTimeout(() => {
        newGames.start24NewRound(state);
        
        if (state.status === 'finished') {
          const results = state.playerOrder.map(id => ({
            playerId: id,
            playerName: room.players.get(id)?.name || 'Player',
            score: state.scores[id] || 0
          })).sort((a, b) => b.score - a.score);
          
          io.to(roomId).emit('game24Update', {
            gameOver: true,
            results,
            players: room.getPlayerList()
          });
          setTimeout(() => endGame(room, roomId), 2000);
        } else {
          io.to(roomId).emit('game24Update', {
            newRound: true,
            numbers: state.numbers,
            round: state.round,
            maxRounds: state.maxRounds,
            timePerRound: state.timePerRound,
            players: room.getPlayerList()
          });
          
          // Start timer
          start24Timer(room, roomId);
        }
      }, 3000);
    } else {
      socket.emit('game24Update', {
        correct: false,
        error: result.error,
        expression
      });
    }
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
    const playersToUpdate = [];
    room.getPlayerList().forEach(player => {
      if (player.username && userAccounts[player.username]) {
        const won = player.sessionWins > 0;
        // Update games played (trophy already handled in awardTrophy)
        userAccounts[player.username].gamesPlayed = (userAccounts[player.username].gamesPlayed || 0) + 1;
        if (won) {
          userAccounts[player.username].totalWins = (userAccounts[player.username].totalWins || 0) + player.sessionWins;
        }
        userAccounts[player.username].lastPlayed = Date.now();
        playersToUpdate.push(userAccounts[player.username]);
      }
    });
    // Save all updated players
    playersToUpdate.forEach(user => {
      saveUser(user).catch(err => console.error('Error saving user stats:', err));
    });
    
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
    // Clean up username tracking
    const username = authenticatedSockets.get(socket.id);
    if (username && usernameToSocket.get(username) === socket.id) {
      usernameToSocket.delete(username);
    }
    authenticatedSockets.delete(socket.id);
    
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
      ludoPlayers.forEach((playerId, idx) => {
        tokens[playerId] = [
          { position: 'home', steps: 0 },
          { position: 'home', steps: 0 },
          { position: 'home', steps: 0 },
          { position: 'home', steps: 0 }
        ];
      });
      return {
        playerOrder: ludoPlayers,
        tokens: tokens,
        currentPlayer: ludoPlayers[0],
        diceRolled: false,
        lastDice: null,
        validMoves: [],
        winner: null,
        safeSquares: [0, 8, 13, 21, 26, 34, 39, 47],
        startPositions: { 0: 0, 1: 13, 2: 26, 3: 39 }
      };

    case 'hangman':
      return newGames.createHangmanState(null, null, room.players);

    case 'wordchain':
      return newGames.createWordChainState(null, room.players);

    case 'reaction':
      return newGames.createReactionTestState(null, room.players);

    case 'battleship':
      const bsPlayers = playerIds.slice(0, 2);
      return newGames.createBattleshipState(bsPlayers[0], bsPlayers[1]);

    case 'poker':
      return newGames.createPokerState(room.players);

    case 'blackjack':
      return newGames.createBlackjackState(room.players);

    case 'game24':
      return newGames.create24GameState(room.players);

    default:
      return {};
  }
}

// ============================================
// AI GAME INITIALIZATION
// ============================================

function initializeAIGame(gameType, room, playerId, options = {}) {
  const aiDifficulty = room.aiDifficulty || 'medium';
  
  switch (gameType) {
    case 'tictactoe': {
      const symbols = ['🔴', '💀'];
      const symbolMap = new Map();
      // Random who goes first
      const playerFirst = Math.random() < 0.5;
      if (playerFirst) {
        symbolMap.set(playerId, symbols[0]);
        symbolMap.set(AI_PLAYER_ID, symbols[1]);
      } else {
        symbolMap.set(AI_PLAYER_ID, symbols[0]);
        symbolMap.set(playerId, symbols[1]);
      }
      return {
        board: Array(9).fill(null),
        currentPlayer: playerFirst ? playerId : AI_PLAYER_ID,
        playerSymbols: symbolMap,
        winner: null
      };
    }
    
    case 'chess': {
      // Random who is white
      const playerIsWhite = Math.random() < 0.5;
      return {
        board: getInitialChessBoard(),
        currentPlayer: playerIsWhite ? playerId : AI_PLAYER_ID,
        whitePlayer: playerIsWhite ? playerId : AI_PLAYER_ID,
        blackPlayer: playerIsWhite ? AI_PLAYER_ID : playerId,
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
    }
    
    case 'memory': {
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
      
      let pairCount, gridCols;
      switch (difficulty) {
        case 'easy': pairCount = 6; gridCols = 4; break;
        case 'hard': pairCount = 8; gridCols = 4; break;
        case 'insane': pairCount = 12; gridCols = 6; break;
        default: pairCount = 6; gridCols = 4;
      }
      
      const memoryItems = memoryItemsAll.slice(0, pairCount);
      const cards = [...memoryItems, ...memoryItems]
        .sort(() => Math.random() - 0.5)
        .map((item, index) => ({ ...item, index }));
      
      const playerFirst = Math.random() < 0.5;
      return {
        cards,
        flipped: [],
        matched: [],
        currentPlayer: playerFirst ? playerId : AI_PLAYER_ID,
        checking: false,
        difficulty,
        gridCols,
        matchesPerPlayer: {}
      };
    }
    
    case 'psychic': {
      return {
        choices: new Map(),
        round: 1,
        maxRounds: 10
      };
    }
    
    case 'connect4': {
      const winCondition = options.winCondition || 4;
      const playerFirst = Math.random() < 0.5;
      return {
        board: Array(6).fill(null).map(() => Array(7).fill(null)),
        currentPlayer: playerFirst ? playerId : AI_PLAYER_ID,
        player1: playerFirst ? playerId : AI_PLAYER_ID,
        player2: playerFirst ? AI_PLAYER_ID : playerId,
        winner: null,
        winningCells: [],
        winCondition
      };
    }
    
    case 'trivia': {
      const shuffledQ = [...triviaQuestions].sort(() => Math.random() - 0.5).slice(0, 10);
      return {
        questions: shuffledQ,
        currentQuestion: 0,
        answered: [],
        timeLeft: 15,
        revealed: false,
        isAIGame: true
      };
    }
    
    default:
      return {};
  }
}

// Serialize game state for sending to client
function serializeGameState(state, gameType) {
  const serialized = { ...state };
  
  // Convert Maps to objects for JSON serialization
  if (state.playerSymbols instanceof Map) {
    serialized.playerSymbols = Object.fromEntries(state.playerSymbols);
  }
  if (state.choices instanceof Map) {
    serialized.choices = Object.fromEntries(state.choices);
  }
  
  return serialized;
}

// Schedule AI move with thinking delay
function scheduleAIMove(room, roomId, gameType) {
  const aiState = aiRooms.get(roomId);
  if (!aiState) {
    console.log('❌ AI State not found for room:', roomId);
    return;
  }
  
  const thinkingTime = 800 + Math.random() * 1200;
  console.log(`🤖 Scheduling AI move for ${gameType} in ${thinkingTime}ms`);
  
  aiState.thinkingTimeout = setTimeout(() => {
    console.log(`🤖 Executing AI move for ${gameType}`);
    switch (gameType) {
      case 'tictactoe':
        makeAITTTMove(room, roomId);
        break;
      case 'chess':
        makeAIChessMove(room, roomId);
        break;
      case 'memory':
        scheduleAIMemoryTurn(room, roomId, aiState);
        break;
      case 'connect4':
        makeAIConnect4Move(room, roomId);
        break;
    }
  }, thinkingTime);
}

// AI Tic-Tac-Toe move helper
function makeAITTTMove(room, roomId) {
  const state = room.gameState;
  const aiSymbol = state.playerSymbols.get(AI_PLAYER_ID);
  const playerSymbol = Array.from(state.playerSymbols.entries())
    .find(([id, sym]) => id !== AI_PLAYER_ID)?.[1];
  
  const aiMove = getAITTTMove([...state.board], aiSymbol, playerSymbol, room.aiDifficulty);
  
  if (aiMove !== -1) {
    state.board[aiMove] = aiSymbol;
    
    const winner = checkTTTWinner(state.board);
    if (winner) {
      state.winner = AI_PLAYER_ID;
      room.players.get(AI_PLAYER_ID).sessionWins += 1;
      io.to(roomId).emit('tttUpdate', {
        board: state.board,
        winner: AI_PLAYER_ID,
        winnerName: AI_PLAYER_NAME,
        players: room.getPlayerList()
      });
      sendAIGameEndMessage(roomId, 'aiWin');
      return;
    }
    
    if (!state.board.includes(null)) {
      io.to(roomId).emit('tttUpdate', { board: state.board, draw: true });
      sendAIGameEndMessage(roomId, 'draw');
      return;
    }
    
    // Switch to player
    const playerId = Array.from(room.players.keys()).find(id => id !== AI_PLAYER_ID);
    state.currentPlayer = playerId;
    io.to(roomId).emit('tttUpdate', {
      board: state.board,
      currentPlayer: playerId
    });
  }
}

// AI Chess move helper
function makeAIChessMove(room, roomId) {
  const state = room.gameState;
  const isAIWhite = state.whitePlayer === AI_PLAYER_ID;
  
  const aiMove = getAIChessMove(state.board, isAIWhite, state.castlingRights, room.aiDifficulty);
  
  if (aiMove) {
    state.board = makeMove(state.board, aiMove.from, aiMove.to);
    updateCastlingRights(state, aiMove.from);
    state.moveHistory.push({ from: aiMove.from, to: aiMove.to, player: AI_PLAYER_ID });
    
    const playerId = Array.from(room.players.keys()).find(id => id !== AI_PLAYER_ID);
    const isPlayerWhite = state.whitePlayer === playerId;
    
    const gameEnd = getGameEndState(state.board, isPlayerWhite, state.castlingRights);
    if (gameEnd) {
      state.gameOver = true;
      if (gameEnd === 'checkmate') {
        state.winner = AI_PLAYER_ID;
        room.players.get(AI_PLAYER_ID).sessionWins += 1;
        io.to(roomId).emit('chessUpdate', {
          board: state.board,
          gameOver: true,
          winner: AI_PLAYER_ID,
          winnerName: AI_PLAYER_NAME,
          checkmate: true,
          players: room.getPlayerList()
        });
        sendAIGameEndMessage(roomId, 'aiWin');
      } else {
        io.to(roomId).emit('chessUpdate', {
          board: state.board,
          gameOver: true,
          stalemate: true
        });
        sendAIGameEndMessage(roomId, 'draw');
      }
      return;
    }
    
    state.currentPlayer = playerId;
    state.isWhiteTurn = isPlayerWhite;
    
    const inCheck = isInCheck(state.board, isPlayerWhite);
    io.to(roomId).emit('chessUpdate', {
      board: state.board,
      currentPlayer: playerId,
      isWhiteTurn: state.isWhiteTurn,
      inCheck,
      moveHistory: state.moveHistory
    });
  }
}

// AI Connect 4 move helper
function makeAIConnect4Move(room, roomId) {
  console.log('🤖 makeAIConnect4Move called for room:', roomId);
  const state = room.gameState;
  if (!state) {
    console.log('❌ No game state found');
    return;
  }
  const playerId = Array.from(room.players.keys()).find(id => id !== AI_PLAYER_ID);
  console.log('🤖 Player ID:', playerId, 'AI is player1:', state.player1 === AI_PLAYER_ID);
  
  const aiPiece = state.player1 === AI_PLAYER_ID ? '🔴' : '🟡';
  const playerPiece = state.player1 === playerId ? '🔴' : '🟡';
  console.log('🤖 AI piece:', aiPiece, 'Player piece:', playerPiece);
  
  const aiCol = getAIConnect4Move(state.board, aiPiece, playerPiece, state.winCondition, room.aiDifficulty);
  console.log('🤖 AI chose column:', aiCol);
  
  if (aiCol !== -1) {
    let aiRow = -1;
    for (let r = 5; r >= 0; r--) {
      if (state.board[r][aiCol] === null) {
        aiRow = r;
        break;
      }
    }
    
    if (aiRow !== -1) {
      state.board[aiRow][aiCol] = aiPiece;
      
      const winResult = checkConnect4Winner(state.board, aiRow, aiCol, aiPiece, state.winCondition);
      if (winResult) {
        state.winner = AI_PLAYER_ID;
        state.winningCells = winResult;
        room.players.get(AI_PLAYER_ID).sessionWins += 1;
        io.to(roomId).emit('connect4Update', {
          board: state.board,
          winner: AI_PLAYER_ID,
          winnerName: AI_PLAYER_NAME,
          winningCells: winResult,
          players: room.getPlayerList()
        });
        sendAIGameEndMessage(roomId, 'aiWin');
        return;
      }
      
      const isFull = state.board[0].every(cell => cell !== null);
      if (isFull) {
        io.to(roomId).emit('connect4Update', { 
        board: state.board, 
        draw: true, 
        players: room.getPlayerList() 
      });
        sendAIGameEndMessage(roomId, 'draw');
        return;
      }
      
      state.currentPlayer = playerId;
      io.to(roomId).emit('connect4Update', {
        board: state.board,
        currentPlayer: playerId
      });
    }
  }
}

// AI Memory turn
function scheduleAIMemoryTurn(room, roomId, aiState) {
  if (!room.gameState || room.gameState.currentPlayer !== AI_PLAYER_ID) return;
  
  const state = room.gameState;
  const delay = 800 + Math.random() * 800;
  
  aiState.thinkingTimeout = setTimeout(() => {
    // First flip
    const firstCard = getAIMemoryMove(state.cards, state.flipped, state.matched, aiState.aiMemory, room.aiDifficulty);
    if (firstCard === -1) return;
    
    state.flipped.push(firstCard);
    aiState.aiMemory[firstCard] = state.cards[firstCard].id;
    
    io.to(roomId).emit('cardFlipped', {
      cardIndex: firstCard,
      card: state.cards[firstCard],
      flipped: state.flipped
    });
    
    // Second flip after delay
    setTimeout(() => {
      const secondCard = getAIMemoryMove(state.cards, state.flipped, state.matched, aiState.aiMemory, room.aiDifficulty);
      if (secondCard === -1) return;
      
      state.flipped.push(secondCard);
      aiState.aiMemory[secondCard] = state.cards[secondCard].id;
      
      io.to(roomId).emit('cardFlipped', {
        cardIndex: secondCard,
        card: state.cards[secondCard],
        flipped: state.flipped
      });
      
      // Check match
      state.checking = true;
      const [first, second] = state.flipped;
      const match = state.cards[first].id === state.cards[second].id;
      
      setTimeout(() => {
        if (match) {
          state.matched.push(first, second);
          if (!state.matchesPerPlayer) state.matchesPerPlayer = {};
          state.matchesPerPlayer[AI_PLAYER_ID] = (state.matchesPerPlayer[AI_PLAYER_ID] || 0) + 1;
          room.players.get(AI_PLAYER_ID).points += 10;
          
          io.to(roomId).emit('memoryMatch', {
            cards: [first, second],
            matched: state.matched,
            matcherId: AI_PLAYER_ID,
            matcherName: AI_PLAYER_NAME,
            matchesPerPlayer: state.matchesPerPlayer,
            players: room.getPlayerList()
          });
          
          if (state.matched.length === state.cards.length) {
            const playerIds = Array.from(room.players.keys()).filter(id => id !== AI_PLAYER_ID);
            const playerId = playerIds[0];
            const playerMatches = state.matchesPerPlayer[playerId] || 0;
            const aiMatches = state.matchesPerPlayer[AI_PLAYER_ID] || 0;
            
            if (playerMatches > aiMatches) {
              room.players.get(playerId).sessionWins += 1;
              sendAIGameEndMessage(roomId, 'playerWin');
            } else if (aiMatches > playerMatches) {
              room.players.get(AI_PLAYER_ID).sessionWins += 1;
              sendAIGameEndMessage(roomId, 'aiWin');
            } else {
              sendAIGameEndMessage(roomId, 'draw');
            }
            endGame(room, roomId);
          } else {
            // AI gets another turn
            state.flipped = [];
            state.checking = false;
            io.to(roomId).emit('memoryTurn', { currentPlayer: AI_PLAYER_ID });
            scheduleAIMemoryTurn(room, roomId, aiState);
          }
        } else {
          io.to(roomId).emit('memoryMismatch', { cards: [first, second] });
          const playerIds = Array.from(room.players.keys()).filter(id => id !== AI_PLAYER_ID);
          state.currentPlayer = playerIds[0];
          state.flipped = [];
          state.checking = false;
          io.to(roomId).emit('memoryTurn', { currentPlayer: playerIds[0] });
        }
      }, 1000);
    }, 600 + Math.random() * 400);
  }, delay);
}

// Update castling rights after a move
function updateCastlingRights(state, from) {
  const [row, col] = from;
  const rights = state.castlingRights;
  
  // King moved
  if (row === 7 && col === 4) {
    rights.whiteKingside = false;
    rights.whiteQueenside = false;
  }
  if (row === 0 && col === 4) {
    rights.blackKingside = false;
    rights.blackQueenside = false;
  }
  
  // Rook moved
  if (row === 7 && col === 0) rights.whiteQueenside = false;
  if (row === 7 && col === 7) rights.whiteKingside = false;
  if (row === 0 && col === 0) rights.blackQueenside = false;
  if (row === 0 && col === 7) rights.blackKingside = false;
}

// Send AI game end message
function sendAIGameEndMessage(roomId, result) {
  const message = getAIResponse(result);
  if (message) {
    setTimeout(() => {
      io.to(roomId).emit('chatMessage', {
        playerId: AI_PLAYER_ID,
        playerName: AI_PLAYER_NAME,
        message,
        color: '#9333ea',
        isAI: true
      });
    }, 500);
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
// Ludo helper functions
function getLudoSafeSquares() {
  // Start positions (0, 13, 26, 39) and star/safe squares (8, 21, 34, 47)
  return [0, 8, 13, 21, 26, 34, 39, 47];
}

function getLudoStartPosition(playerIndex) {
  // Each player starts at a different position on the 52-square track
  return playerIndex * 13; // 0, 13, 26, 39
}

function calculateLudoValidMoves(state, playerId, diceValue) {
  const validMoves = [];
  const playerTokens = state.tokens[playerId];
  const playerIndex = state.playerOrder.indexOf(playerId);
  const startPos = getLudoStartPosition(playerIndex);
  
  // Track is 52 squares (0-51), home stretch is 4 squares (steps 52-55), finish at step 56
  const TRACK_LENGTH = 52;
  const FINISH_STEP = 56;
  
  playerTokens.forEach((token, idx) => {
    if (token.position === 'home') {
      // Can only leave home with a 6
      if (diceValue === 6) {
        // Check if start position is blocked by own token at step 0
        const startBlocked = playerTokens.some((t, i) => 
          i !== idx && t.position !== 'home' && t.position !== 'finished' && (t.steps || 0) === 0
        );
        if (!startBlocked) {
          validMoves.push({ 
            tokenIndex: idx, 
            newPosition: 'start',
            releasing: true,
            newSteps: 0
          });
        }
      }
    } else if (token.position === 'finished') {
      // Already finished, can't move
    } else {
      // Token is on track
      const currentSteps = token.steps || 0;
      const newSteps = currentSteps + diceValue;
      
      // Check if this move would finish the token
      if (newSteps === FINISH_STEP) {
        // Exact roll to finish!
        validMoves.push({ 
          tokenIndex: idx, 
          newPosition: 'finished',
          newSteps: FINISH_STEP
        });
      } else if (newSteps < FINISH_STEP) {
        // Valid move - calculate board position
        let newBoardPos;
        
        if (newSteps < TRACK_LENGTH) {
          // Still on main track
          newBoardPos = (startPos + newSteps) % TRACK_LENGTH;
        } else {
          // In home stretch (steps 52-55)
          newBoardPos = 'homeStretch_' + (newSteps - TRACK_LENGTH);
        }
        
        // Check if destination is blocked by own token (only for main track)
        if (typeof newBoardPos === 'number') {
          const blocked = playerTokens.some((t, i) => {
            if (i === idx) return false;
            if (t.position === 'home' || t.position === 'finished') return false;
            const tSteps = t.steps || 0;
            if (tSteps >= TRACK_LENGTH) return false; // in home stretch
            const tBoardPos = (startPos + tSteps) % TRACK_LENGTH;
            return tBoardPos === newBoardPos;
          });
          
          if (!blocked) {
            validMoves.push({ 
              tokenIndex: idx, 
              newPosition: newBoardPos,
              newSteps: newSteps
            });
          }
        } else {
          // Home stretch - can't be blocked by others
          validMoves.push({ 
            tokenIndex: idx, 
            newPosition: newBoardPos,
            newSteps: newSteps
          });
        }
      }
      // If newSteps > FINISH_STEP, can't move (need exact roll)
    }
  });
  
  return validMoves;
}

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
    currentPlayer: state.currentPlayer,
    gameState: state
  });
}

// Start a word scramble round
function startReactionRound(room, roomId) {
  const state = room.gameState;
  newGames.startReactionRound(state);
  
  // Send countdown first
  io.to(roomId).emit('reactionUpdate', {
    status: 'countdown',
    round: state.round,
    maxRounds: state.maxRounds
  });
  
  // Show the scrambled word after a brief countdown
  setTimeout(() => {
    if (room.currentGame !== 'reaction') return;
    
    state.status = 'active';
    
    io.to(roomId).emit('reactionUpdate', {
      status: 'active',
      scrambledWord: state.scrambledWord,
      letterCount: state.currentWord.length,
      round: state.round,
      scores: state.scores
    });
    
    // Start timer for the round (20 seconds)
    let timeLeft = state.timePerRound || 20;
    const timerInterval = setInterval(() => {
      if (room.currentGame !== 'reaction' || state.status !== 'active') {
        clearInterval(timerInterval);
        return;
      }
      
      timeLeft--;
      io.to(roomId).emit('reactionUpdate', { timeLeft });
      
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        // Time's up - reveal answer and move to next round
        io.to(roomId).emit('reactionUpdate', {
          timeUp: true,
          correctWord: state.currentWord
        });
        
        state.round++;
        if (state.round <= state.maxRounds) {
          setTimeout(() => startReactionRound(room, roomId), 3000);
        } else {
          // Game over
          const results = newGames.getReactionResults(state);
          const players = Array.from(room.players.values());
          results.forEach(r => {
            const player = players.find(p => p.id === r.playerId);
            r.playerName = player?.name || 'Player';
          });
          
          io.to(roomId).emit('reactionUpdate', {
            gameOver: true,
            status: 'finished',
            results,
            scores: state.scores
          });
        }
      }
    }, 1000);
  }, 1500);
}

// Start 24 game timer
function start24Timer(room, roomId) {
  const state = room.gameState;
  let timeLeft = state.timePerRound || 60;
  
  const timerInterval = setInterval(() => {
    if (room.currentGame !== 'game24' || state.solved || state.status !== 'playing') {
      clearInterval(timerInterval);
      return;
    }
    
    timeLeft--;
    io.to(roomId).emit('game24Update', { timeLeft });
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      
      // Time's up
      io.to(roomId).emit('game24Update', { timeUp: true });
      
      // Start next round
      setTimeout(() => {
        newGames.start24NewRound(state);
        
        if (state.status === 'finished') {
          const results = state.playerOrder.map(id => ({
            playerId: id,
            playerName: room.players.get(id)?.name || 'Player',
            score: state.scores[id] || 0
          })).sort((a, b) => b.score - a.score);
          
          io.to(roomId).emit('game24Update', {
            gameOver: true,
            results,
            players: room.getPlayerList()
          });
        } else {
          io.to(roomId).emit('game24Update', {
            newRound: true,
            numbers: state.numbers,
            round: state.round,
            maxRounds: state.maxRounds,
            timePerRound: state.timePerRound
          });
          
          start24Timer(room, roomId);
        }
      }, 2000);
    }
  }, 1000);
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

// ============================================
// CHALLENGE SYSTEM HELPER FUNCTIONS
// ============================================

// Initialize a match game (2-player games)
function initializeMatchGame(gameType, matchPlayers, options = {}) {
  const [player1, player2] = matchPlayers;
  
  // Helper for random starting player
  const randomStart = () => matchPlayers[Math.floor(Math.random() * 2)];
  
  switch (gameType) {
    case 'tictactoe':
      const symbols = ['🔴', '💀'];
      const shuffled = [...matchPlayers].sort(() => Math.random() - 0.5);
      const symbolMap = {};
      shuffled.forEach((p, i) => symbolMap[p.id] = symbols[i]);
      return {
        board: Array(9).fill(null),
        currentPlayer: shuffled[0].id,
        playerSymbols: symbolMap,
        winner: null,
        players: matchPlayers
      };
      
    case 'chess':
      const shuffledChess = [...matchPlayers].sort(() => Math.random() - 0.5);
      return {
        board: getInitialChessBoard(),
        currentPlayer: shuffledChess[0].id,
        whitePlayer: shuffledChess[0].id,
        blackPlayer: shuffledChess[1].id,
        isWhiteTurn: true,
        selectedPiece: null,
        gameOver: false,
        winner: null,
        castlingRights: {
          whiteKingSide: true,
          whiteQueenSide: true,
          blackKingSide: true,
          blackQueenSide: true
        },
        players: matchPlayers
      };
      
    case 'connect4':
      const winCondition = options.winCondition || 4;
      const shuffledC4 = [...matchPlayers].sort(() => Math.random() - 0.5);
      return {
        board: Array(6).fill(null).map(() => Array(7).fill(null)),
        currentPlayer: shuffledC4[0].id,
        redPlayer: shuffledC4[0].id,
        yellowPlayer: shuffledC4[1].id,
        isRedTurn: true,
        winner: null,
        winCondition,
        players: matchPlayers
      };
      
    default:
      return { players: matchPlayers };
  }
}

// Process a match move
function processMatchMove(match, playerId, moveData) {
  const state = match.gameState;
  
  switch (match.gameType) {
    case 'tictactoe':
      return processTTTMatchMove(state, playerId, moveData);
    case 'chess':
      return processChessMatchMove(state, playerId, moveData);
    case 'connect4':
      return processConnect4MatchMove(state, playerId, moveData);
    default:
      return null;
  }
}

// Process Tic-Tac-Toe move
function processTTTMatchMove(state, playerId, moveData) {
  const { cellIndex } = moveData;
  
  if (state.currentPlayer !== playerId) return null;
  if (state.board[cellIndex] !== null) return null;
  if (state.winner) return null;
  
  const symbol = state.playerSymbols[playerId];
  state.board[cellIndex] = symbol;
  
  // Check for winner
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6] // Diagonals
  ];
  
  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]) {
      state.winner = playerId;
      const winner = state.players.find(p => p.id === playerId);
      return { winner };
    }
  }
  
  // Check for draw
  if (!state.board.includes(null)) {
    return { draw: true };
  }
  
  // Switch turns
  const otherPlayer = state.players.find(p => p.id !== playerId);
  state.currentPlayer = otherPlayer.id;
  
  return { moved: true };
}

// Process Chess move
function processChessMatchMove(state, playerId, moveData) {
  const { from, to } = moveData;
  
  if (state.currentPlayer !== playerId) return null;
  if (state.gameOver) return null;
  
  const isWhiteTurn = state.isWhiteTurn;
  
  // Use existing chess validation
  if (!isValidChessMove(state.board, from, to, isWhiteTurn, state.castlingRights)) {
    return null;
  }
  
  // Make the move
  const piece = state.board[from[0]][from[1]];
  
  // Handle castling
  if (piece && piece.type === 'king' && Math.abs(to[1] - from[1]) === 2) {
    const isKingSide = to[1] > from[1];
    const rookFromCol = isKingSide ? 7 : 0;
    const rookToCol = isKingSide ? to[1] - 1 : to[1] + 1;
    state.board[from[0]][rookToCol] = state.board[from[0]][rookFromCol];
    state.board[from[0]][rookFromCol] = null;
  }
  
  // Update castling rights
  if (piece) {
    if (piece.type === 'king') {
      if (piece.color === 'white') {
        state.castlingRights.whiteKingSide = false;
        state.castlingRights.whiteQueenSide = false;
      } else {
        state.castlingRights.blackKingSide = false;
        state.castlingRights.blackQueenSide = false;
      }
    }
    if (piece.type === 'rook') {
      if (from[0] === 7 && from[1] === 0) state.castlingRights.whiteQueenSide = false;
      if (from[0] === 7 && from[1] === 7) state.castlingRights.whiteKingSide = false;
      if (from[0] === 0 && from[1] === 0) state.castlingRights.blackQueenSide = false;
      if (from[0] === 0 && from[1] === 7) state.castlingRights.blackKingSide = false;
    }
  }
  
  // Handle pawn promotion
  if (piece && piece.type === 'pawn' && (to[0] === 0 || to[0] === 7)) {
    state.board[to[0]][to[1]] = { type: 'queen', color: piece.color };
  } else {
    state.board[to[0]][to[1]] = piece;
  }
  state.board[from[0]][from[1]] = null;
  
  // Check for checkmate/stalemate
  const opponentColor = isWhiteTurn ? 'black' : 'white';
  const opponentInCheck = isInCheck(state.board, opponentColor);
  const opponentHasMoves = hasLegalMoves(state.board, opponentColor, state.castlingRights);
  
  if (!opponentHasMoves) {
    state.gameOver = true;
    if (opponentInCheck) {
      state.winner = playerId;
      const winner = state.players.find(p => p.id === playerId);
      return { winner, checkmate: true };
    } else {
      return { draw: true, stalemate: true };
    }
  }
  
  // Switch turns
  state.isWhiteTurn = !state.isWhiteTurn;
  state.currentPlayer = state.isWhiteTurn ? state.whitePlayer : state.blackPlayer;
  
  return { moved: true, inCheck: opponentInCheck };
}

// Process Connect4 move
function processConnect4MatchMove(state, playerId, moveData) {
  const { column } = moveData;
  
  if (state.currentPlayer !== playerId) return null;
  if (state.winner) return null;
  
  // Find lowest empty row in column
  let row = -1;
  for (let r = 5; r >= 0; r--) {
    if (state.board[r][column] === null) {
      row = r;
      break;
    }
  }
  
  if (row === -1) return null; // Column full
  
  const piece = playerId === state.redPlayer ? '🔴' : '🟡';
  state.board[row][column] = piece;
  
  // Check for winner
  const winCondition = state.winCondition || 4;
  if (checkConnect4Win(state.board, row, column, piece, winCondition)) {
    state.winner = playerId;
    const winner = state.players.find(p => p.id === playerId);
    return { winner };
  }
  
  // Check for draw
  const isDraw = state.board[0].every(cell => cell !== null);
  if (isDraw) {
    return { draw: true };
  }
  
  // Switch turns
  state.isRedTurn = !state.isRedTurn;
  state.currentPlayer = state.isRedTurn ? state.redPlayer : state.yellowPlayer;
  
  return { moved: true };
}

// Check Connect4 win condition
function checkConnect4Win(board, row, col, color, winCondition) {
  const directions = [
    [0, 1],  // Horizontal
    [1, 0],  // Vertical
    [1, 1],  // Diagonal down-right
    [1, -1]  // Diagonal down-left
  ];
  
  for (const [dr, dc] of directions) {
    let count = 1;
    
    // Count in positive direction
    for (let i = 1; i < winCondition; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= 6 || c < 0 || c >= 7) break;
      if (board[r][c] !== color) break;
      count++;
    }
    
    // Count in negative direction
    for (let i = 1; i < winCondition; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r < 0 || r >= 6 || c < 0 || c >= 7) break;
      if (board[r][c] !== color) break;
      count++;
    }
    
    if (count >= winCondition) return true;
  }
  
  return false;
}

// End a match and handle spectator rotation
function endMatch(room, roomId, match, result) {
  const { winner, draw } = result;
  
  // Track session win for the winner
  if (winner) {
    const winnerId = winner.id || winner;
    const winnerPlayer = room.players.get(winnerId);
    if (winnerPlayer) {
      winnerPlayer.sessionWins = (winnerPlayer.sessionWins || 0) + 1;
      console.log(`🏅 Session win for ${winnerPlayer.name}: ${winnerPlayer.sessionWins}`);
    }
  }
  
  // Get all match participants
  const allRecipients = [...match.players.map(p => p.id), ...match.spectators];
  
  // Send match ended event with session info
  allRecipients.forEach(id => {
    io.to(id).emit('matchEnded', {
      matchId: match.matchId,
      winner: winner ? match.players.find(p => p.id === winner.id || p.id === winner) : null,
      draw,
      players: room.getPlayerList() // Include updated player list with session wins
    });
  });
  
  // Mark players as no longer in match
  match.players.forEach(p => {
    const player = room.players.get(p.id);
    if (player) {
      player.inMatch = null;
    }
  });
  
  // Clear spectator status
  match.spectators.forEach(specId => {
    const spec = room.players.get(specId);
    if (spec) spec.spectating = null;
  });
  
  // Spectator rotation: if there are spectators, loser swaps with first spectator
  if (winner && match.spectators.length > 0) {
    const loserId = match.players.find(p => p.id !== winner.id && p.id !== winner)?.id;
    const firstSpectator = match.spectators[0];
    
    if (loserId && firstSpectator) {
      // Create rematch with winner and first spectator
      setTimeout(() => {
        const winnerPlayer = room.players.get(winner.id || winner);
        const newChallenger = room.players.get(firstSpectator);
        
        if (winnerPlayer && newChallenger && !winnerPlayer.inMatch && !newChallenger.inMatch) {
          // Auto-start new match
          const newMatchId = uuidv4();
          
          winnerPlayer.inMatch = newMatchId;
          newChallenger.inMatch = newMatchId;
          
          const newMatchPlayers = [
            { id: winnerPlayer.id, name: winnerPlayer.name, color: winnerPlayer.color },
            { id: newChallenger.id, name: newChallenger.name, color: newChallenger.color }
          ];
          
          const newGameState = initializeMatchGame(match.gameType, newMatchPlayers, match.options);
          
          const newMatch = {
            matchId: newMatchId,
            gameType: match.gameType,
            players: newMatchPlayers,
            spectators: match.spectators.filter(s => s !== firstSpectator),
            gameState: newGameState,
            options: match.options
          };
          
          // Add loser to spectators if still in room
          if (room.players.has(loserId)) {
            newMatch.spectators.push(loserId);
          }
          
          room.activeMatches.set(newMatchId, newMatch);
          
          // Notify players
          io.to(winnerPlayer.id).emit('matchStarted', {
            matchId: newMatchId,
            gameType: match.gameType,
            players: newMatchPlayers,
            gameState: newGameState,
            autoRotation: true
          });
          io.to(newChallenger.id).emit('matchStarted', {
            matchId: newMatchId,
            gameType: match.gameType,
            players: newMatchPlayers,
            gameState: newGameState,
            autoRotation: true
          });
          
          // Notify spectators (including the loser)
          newMatch.spectators.forEach(specId => {
            io.to(specId).emit('matchStarted', {
              matchId: newMatchId,
              gameType: match.gameType,
              players: newMatchPlayers,
              gameState: newGameState,
              isSpectator: true,
              autoRotation: true
            });
          });
          
          console.log(`🔄 Auto-rotation: ${winnerPlayer.name} vs ${newChallenger.name}`);
        }
      }, 2000); // 2 second delay before next match
    }
  }
  
  // Remove old match
  room.activeMatches.delete(match.matchId);
  
  // Broadcast updated player list (shows who's no longer in games)
  io.to(roomId).emit('playerJoined', { players: room.getPlayerList() });
  
  // Broadcast updated active matches
  broadcastActiveMatches(room, roomId);
}

// Broadcast active matches to lobby players
function broadcastActiveMatches(room, roomId) {
  if (!room.activeMatches) return;
  
  const matches = Array.from(room.activeMatches.values()).map(m => ({
    matchId: m.matchId,
    gameType: m.gameType,
    players: m.players
  }));
  
  // Send to all players not in a match
  room.players.forEach((player, playerId) => {
    if (!player.inMatch && !player.spectating) {
      io.to(playerId).emit('activeMatchesUpdate', { matches });
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  let aiStatus;
  // Debug: Log which API keys are available
  console.log('🔑 API Key Status:');
  console.log(`   GROQ_API_KEY: ${GROQ_API_KEY ? 'SET (✓)' : 'NOT SET'}`);
  console.log(`   OPENAI_API_KEY: ${OPENAI_API_KEY ? 'SET (✓)' : 'NOT SET'}`);
  
  if (GROQ_API_KEY) {
    aiStatus = '🤖 Wednesday AI: ENABLED (Groq - FREE & FAST!)';
  } else if (OPENAI_API_KEY) {
    aiStatus = '🤖 Wednesday AI: ENABLED (OpenAI)';
  } else {
    aiStatus = '🤖 Wednesday AI: Fallback mode (static responses)';
  }
  console.log(`
  ⚡️ THE UPSIDE DOWN NEVERMORE GAMES ⚡️
  =====================================
  🎮 Server running on port ${PORT}
  🌐 Open http://localhost:${PORT}
  ${aiStatus}
  =====================================
  `);
});

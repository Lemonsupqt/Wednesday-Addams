// ============================================
// UPSIDE DOWN NEVERMORE GAMES
// Client-side game logic
// ============================================

// ============================================
// 🔧 BACKEND SERVER URL - UPDATE THIS! 🔧
// ============================================
// After deploying to Render, replace the URL below with your Render URL
// Example: 'https://upside-down-nevermore-games.onrender.com'
// ============================================
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? window.location.origin  // Local development
  : 'https://upside-down-nevermore-games.onrender.com'; // ← UPDATE THIS after Render deploy!

const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling']
});

// DOM Elements
const screens = {
  mainMenu: document.getElementById('mainMenu'),
  lobby: document.getElementById('lobby'),
  gameScreen: document.getElementById('gameScreen')
};

const elements = {
  // Main menu
  playerName: document.getElementById('playerName'),
  createRoomBtn: document.getElementById('createRoomBtn'),
  roomCode: document.getElementById('roomCode'),
  joinRoomBtn: document.getElementById('joinRoomBtn'),
  
  // Lobby
  displayRoomCode: document.getElementById('displayRoomCode'),
  copyCodeBtn: document.getElementById('copyCodeBtn'),
  playersList: document.getElementById('playersList'),
  chatMessages: document.getElementById('chatMessages'),
  chatInput: document.getElementById('chatInput'),
  sendChatBtn: document.getElementById('sendChatBtn'),
  gameSelection: document.getElementById('gameSelection'),
  leaveRoomBtn: document.getElementById('leaveRoomBtn'),
  
  // Game screen
  gameTitle: document.getElementById('gameTitle'),
  scoreBoard: document.getElementById('scoreBoard'),
  gameContent: document.getElementById('gameContent'),
  backToLobbyBtn: document.getElementById('backToLobbyBtn'),
  gameChatMessages: document.getElementById('gameChatMessages'),
  gameChatInput: document.getElementById('gameChatInput'),
  sendGameChatBtn: document.getElementById('sendGameChatBtn'),
  
  // Modal
  resultsModal: document.getElementById('resultsModal'),
  resultsTitle: document.getElementById('resultsTitle'),
  resultsContent: document.getElementById('resultsContent'),
  closeResultsBtn: document.getElementById('closeResultsBtn'),
  
  // Toast
  errorToast: document.getElementById('errorToast')
};

// State
let state = {
  playerId: null,
  playerName: '',
  roomId: null,
  isHost: false,
  players: [],
  currentGame: null,
  gameState: {}
};

// Chess state
let chessState = {
  selectedSquare: null,
  validMoves: [],
  isMyTurn: false,
  myColor: null
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  setupEventListeners();
  
  // Load saved name
  const savedName = localStorage.getItem('playerName');
  if (savedName) {
    elements.playerName.value = savedName;
  }
});

function initParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 15 + 's';
    particle.style.animationDuration = (10 + Math.random() * 20) + 's';
    
    // Alternate colors
    if (Math.random() > 0.5) {
      particle.style.background = '#9333ea';
      particle.style.boxShadow = '0 0 10px #9333ea';
    }
    
    container.appendChild(particle);
  }
}

function setupEventListeners() {
  // Main menu
  elements.createRoomBtn.addEventListener('click', createRoom);
  elements.joinRoomBtn.addEventListener('click', joinRoom);
  elements.playerName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createRoom();
  });
  elements.roomCode.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoom();
  });
  
  // Lobby
  elements.copyCodeBtn.addEventListener('click', copyRoomCode);
  elements.sendChatBtn.addEventListener('click', sendChat);
  elements.chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat();
  });
  elements.leaveRoomBtn.addEventListener('click', leaveRoom);
  
  // Game selection
  document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => startGame(card.dataset.game));
  });
  
  // Game screen
  elements.backToLobbyBtn.addEventListener('click', endGame);
  elements.sendGameChatBtn.addEventListener('click', sendGameChat);
  elements.gameChatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendGameChat();
  });
  
  // Modal
  elements.closeResultsBtn.addEventListener('click', closeResults);
}

// ============================================
// SCREEN MANAGEMENT
// ============================================

function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
}

function showError(message) {
  elements.errorToast.textContent = message;
  elements.errorToast.classList.add('active');
  setTimeout(() => {
    elements.errorToast.classList.remove('active');
  }, 4000);
}

// ============================================
// ROOM MANAGEMENT
// ============================================

function createRoom() {
  const name = elements.playerName.value.trim();
  if (!name) {
    showError('Please enter your name first!');
    return;
  }
  state.playerName = name;
  localStorage.setItem('playerName', name);
  socket.emit('createRoom', name);
}

function joinRoom() {
  const name = elements.playerName.value.trim();
  const code = elements.roomCode.value.trim().toUpperCase();
  
  if (!name) {
    showError('Please enter your name first!');
    return;
  }
  if (!code) {
    showError('Please enter a room code!');
    return;
  }
  
  state.playerName = name;
  localStorage.setItem('playerName', name);
  socket.emit('joinRoom', { roomId: code, playerName: name });
}

function leaveRoom() {
  socket.emit('leaveRoom');
  state.roomId = null;
  state.isHost = false;
  state.players = [];
  showScreen('mainMenu');
}

function copyRoomCode() {
  navigator.clipboard.writeText(state.roomId).then(() => {
    elements.copyCodeBtn.textContent = '✓';
    setTimeout(() => {
      elements.copyCodeBtn.textContent = '📋';
    }, 2000);
  });
}

function updatePlayersList(players) {
  state.players = players;
  elements.playersList.innerHTML = players.map(p => `
    <div class="player-item ${p.id === state.playerId && state.isHost ? 'host' : ''}">
      <span class="player-name">${escapeHtml(p.name)}</span>
      ${p.id === state.playerId && state.isHost ? '<span class="host-badge">👑 Host</span>' : ''}
      <span class="score">⭐ ${p.score}</span>
    </div>
  `).join('');
  
  // Show game selection only for host, show waiting message for others
  if (state.isHost) {
    elements.gameSelection.style.display = 'block';
    elements.gameSelection.innerHTML = `
      <h3>⚔️ Choose Your Battle ⚔️</h3>
      <div class="games-grid">
        <button class="game-card" data-game="tictactoe">
          <span class="game-icon">⭕❌</span>
          <span class="game-name">Upside Down<br>Tic-Tac-Toe</span>
          <span class="game-players">2 players</span>
        </button>
        <button class="game-card" data-game="memory">
          <span class="game-icon">🃏</span>
          <span class="game-name">Vecna's<br>Memory Match</span>
          <span class="game-players">2+ players</span>
        </button>
        <button class="game-card" data-game="chess">
          <span class="game-icon">♟️👑</span>
          <span class="game-name">Vecna's<br>Chess</span>
          <span class="game-players">2 players</span>
        </button>
        <button class="game-card" data-game="psychic">
          <span class="game-icon">🔮⚡</span>
          <span class="game-name">Psychic<br>Showdown</span>
          <span class="game-players">2+ players</span>
        </button>
        <button class="game-card" data-game="trivia">
          <span class="game-icon">🧠📺</span>
          <span class="game-name">Nevermore<br>Trivia</span>
          <span class="game-players">2+ players</span>
        </button>
        <button class="game-card" data-game="reaction">
          <span class="game-icon">👹🎯</span>
          <span class="game-name">Demogorgon<br>Hunt</span>
          <span class="game-players">2+ players</span>
        </button>
        <button class="game-card" data-game="wordchain">
          <span class="game-icon">🔤⛓️</span>
          <span class="game-name">Word<br>Chain</span>
          <span class="game-players">2+ players</span>
        </button>
      </div>
    `;
    // Re-attach event listeners for game cards
    document.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', () => handleGameSelection(card.dataset.game));
    });
  } else {
    elements.gameSelection.style.display = 'block';
    elements.gameSelection.innerHTML = '<h3 style="text-align: center; color: var(--text-secondary); font-family: Cinzel, serif;">⏳ Waiting for host to select a game... ⏳</h3>';
  }
}

// Handle game selection with options modal for certain games
function handleGameSelection(gameType) {
  if (gameType === 'memory') {
    showMemoryDifficultyModal();
  } else {
    startGame(gameType);
  }
}

// Show memory difficulty selection modal
function showMemoryDifficultyModal() {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'difficultyModal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>🃏 Select Difficulty 🃏</h2>
      <div class="difficulty-options">
        <button class="difficulty-btn" data-difficulty="easy">
          <span class="diff-icon">😊</span>
          <span class="diff-name">Easy</span>
          <span class="diff-desc">4×3 Grid (6 pairs)</span>
        </button>
        <button class="difficulty-btn" data-difficulty="hard">
          <span class="diff-icon">😈</span>
          <span class="diff-name">Hard</span>
          <span class="diff-desc">4×4 Grid (8 pairs)</span>
        </button>
        <button class="difficulty-btn" data-difficulty="insane">
          <span class="diff-icon">💀</span>
          <span class="diff-name">Insane</span>
          <span class="diff-desc">6×4 Grid (12 pairs)</span>
        </button>
      </div>
      <button class="btn btn-secondary" id="cancelDifficultyBtn" style="margin-top: 20px;">Cancel</button>
    </div>
  `;
  document.body.appendChild(modal);
  
  modal.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const difficulty = btn.dataset.difficulty;
      modal.remove();
      startGame({ type: 'memory', options: { difficulty } });
    });
  });
  
  document.getElementById('cancelDifficultyBtn').addEventListener('click', () => {
    modal.remove();
  });
}

// ============================================
// CHAT
// ============================================

function sendChat() {
  const message = elements.chatInput.value.trim();
  if (!message) return;
  socket.emit('chatMessage', message);
  elements.chatInput.value = '';
}

function sendGameChat() {
  const message = elements.gameChatInput.value.trim();
  if (!message) return;
  socket.emit('chatMessage', message);
  elements.gameChatInput.value = '';
}

function addChatMessage(msg, container = elements.chatMessages) {
  const div = document.createElement('div');
  div.className = 'chat-message' + (msg.isGuess ? ' guess' : '') + (msg.system ? ' system' : '');
  
  if (msg.system) {
    div.innerHTML = `<span class="message">${escapeHtml(msg.message)}</span>`;
  } else {
    div.innerHTML = `
      <span class="sender">${escapeHtml(msg.playerName)}:</span>
      <span class="message">${escapeHtml(msg.message)}</span>
    `;
  }
  
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ============================================
// GAME MANAGEMENT
// ============================================

function startGame(gameType) {
  if (!state.isHost) return;
  socket.emit('startGame', gameType);
}

function endGame() {
  socket.emit('endGame');
}

function closeResults() {
  elements.resultsModal.classList.remove('active');
}

function updateScoreBoard(players, currentPlayer = null) {
  elements.scoreBoard.innerHTML = players.map(p => `
    <div class="score-item ${p.id === currentPlayer ? 'current-turn' : ''}">
      <span class="name">${escapeHtml(p.name)}</span>
      <span class="points">${p.score}</span>
    </div>
  `).join('');
}

// ============================================
// TIC TAC TOE
// ============================================

function initTicTacToe(gameState, players) {
  state.gameState = gameState;
  elements.gameTitle.textContent = '⭕ Upside Down Tic-Tac-Toe ❌';
  
  const playerSymbols = new Map(Object.entries(gameState.playerSymbols));
  const mySymbol = playerSymbols.get(state.playerId);
  
  elements.gameContent.innerHTML = `
    <div class="ttt-container">
      <div class="ttt-status" id="tttStatus">
        ${gameState.currentPlayer === state.playerId ? "🔴 Your turn!" : "Waiting for opponent..."}
      </div>
      <div class="ttt-board" id="tttBoard">
        ${gameState.board.map((cell, i) => `
          <div class="ttt-cell ${cell ? 'taken' : ''}" data-index="${i}">${cell || ''}</div>
        `).join('')}
      </div>
      <div class="ttt-info" style="margin-top: 20px; color: var(--text-secondary);">
        Your symbol: ${mySymbol || 'Spectating'}
      </div>
    </div>
  `;
  
  document.querySelectorAll('.ttt-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      if (gameState.currentPlayer !== state.playerId) return;
      if (cell.classList.contains('taken')) return;
      socket.emit('tttMove', parseInt(cell.dataset.index));
    });
  });
  
  updateScoreBoard(players, gameState.currentPlayer);
}

function updateTicTacToe(data) {
  const board = document.getElementById('tttBoard');
  const status = document.getElementById('tttStatus');
  
  if (data.board) {
    state.gameState.board = data.board;
    board.innerHTML = data.board.map((cell, i) => `
      <div class="ttt-cell ${cell ? 'taken' : ''}" data-index="${i}">${cell || ''}</div>
    `).join('');
    
    document.querySelectorAll('.ttt-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        if (state.gameState.currentPlayer !== state.playerId) return;
        if (cell.classList.contains('taken')) return;
        socket.emit('tttMove', parseInt(cell.dataset.index));
      });
    });
  }
  
  if (data.winner) {
    status.innerHTML = `🏆 ${escapeHtml(data.winnerName)} wins! 🏆`;
    updateScoreBoard(data.players);
    showPlayAgainButton('ttt');
  } else if (data.draw) {
    status.innerHTML = "🤝 It's a draw! 🤝";
    showPlayAgainButton('ttt');
  } else if (data.currentPlayer) {
    state.gameState.currentPlayer = data.currentPlayer;
    status.innerHTML = data.currentPlayer === state.playerId ? "🔴 Your turn!" : "Waiting for opponent...";
    updateScoreBoard(state.players, data.currentPlayer);
  }
}

// Play Again button handler
function showPlayAgainButton(gameType) {
  const container = document.querySelector(`.${gameType}-container`) || elements.gameContent;
  
  // Remove existing play again button if any
  const existingBtn = container.querySelector('.play-again-btn');
  if (existingBtn) existingBtn.remove();
  
  const playAgainDiv = document.createElement('div');
  playAgainDiv.className = 'play-again-container';
  playAgainDiv.innerHTML = `
    <button class="btn btn-primary play-again-btn" id="playAgainBtn">
      <span class="btn-icon">🔄</span> Play Again
    </button>
    <button class="btn btn-secondary back-to-lobby-btn" id="backToLobbyFromGame">
      <span class="btn-icon">🏠</span> Back to Lobby
    </button>
  `;
  container.appendChild(playAgainDiv);
  
  document.getElementById('playAgainBtn').addEventListener('click', () => {
    if (state.isHost) {
      // For memory game, preserve the difficulty
      if (state.currentGame === 'memory' && state.gameState.difficulty) {
        socket.emit('restartGame', { type: 'memory', options: { difficulty: state.gameState.difficulty } });
      } else {
        socket.emit('restartGame', state.currentGame);
      }
    } else {
      showError('Only the host can restart the game!');
    }
  });
  
  document.getElementById('backToLobbyFromGame').addEventListener('click', () => {
    socket.emit('endGame');
  });
}

// ============================================
// MEMORY GAME
// ============================================

function initMemoryGame(gameState, players) {
  state.gameState = gameState;
  const difficultyLabel = gameState.difficulty ? gameState.difficulty.charAt(0).toUpperCase() + gameState.difficulty.slice(1) : 'Normal';
  elements.gameTitle.textContent = `🃏 Vecna's Memory Match (${difficultyLabel}) 🃏`;
  
  // Determine grid columns based on difficulty
  const gridCols = gameState.gridCols || 4;
  
  elements.gameContent.innerHTML = `
    <div class="memory-container">
      <div class="memory-status" id="memoryStatus">
        ${gameState.currentPlayer === state.playerId ? "🧠 Your turn to find a match!" : "Watching..."}
      </div>
      <div class="memory-board" id="memoryBoard" style="grid-template-columns: repeat(${gridCols}, 1fr);">
        ${gameState.cards.map((card, i) => `
          <div class="memory-card" data-index="${i}">
            <div class="card-content">
              <span class="card-emoji">${card.emoji}</span>
              <span class="card-name">${card.name}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  document.querySelectorAll('.memory-card').forEach(card => {
    card.addEventListener('click', () => {
      if (state.gameState.currentPlayer !== state.playerId) return;
      socket.emit('memoryFlip', parseInt(card.dataset.index));
    });
  });
  
  updateScoreBoard(players, gameState.currentPlayer);
}

function handleMemoryFlip(data) {
  const card = document.querySelector(`.memory-card[data-index="${data.cardIndex}"]`);
  if (card) {
    card.classList.add('flipped');
  }
  state.gameState.flipped = data.flipped;
}

function handleMemoryMatch(data) {
  data.cards.forEach(index => {
    const card = document.querySelector(`.memory-card[data-index="${index}"]`);
    if (card) {
      card.classList.add('matched');
      card.classList.remove('flipped');
    }
  });
  state.gameState.matched = data.matched;
  updateScoreBoard(data.players);
  
  // Check if game is complete (all cards matched)
  if (data.matched.length === state.gameState.cards.length) {
    const status = document.getElementById('memoryStatus');
    if (status) {
      status.innerHTML = "🎉 All matches found! 🎉";
    }
    showPlayAgainButton('memory');
  }
}

function handleMemoryMismatch(data) {
  setTimeout(() => {
    data.cards.forEach(index => {
      const card = document.querySelector(`.memory-card[data-index="${index}"]`);
      if (card) {
        card.classList.remove('flipped');
      }
    });
  }, 500);
}

function handleMemoryTurn(data) {
  state.gameState.currentPlayer = data.currentPlayer;
  const status = document.getElementById('memoryStatus');
  if (status) {
    status.innerHTML = data.currentPlayer === state.playerId ? 
      "🧠 Your turn to find a match!" : "Watching...";
  }
  updateScoreBoard(state.players, data.currentPlayer);
}

// ============================================
// TRIVIA
// ============================================

function initTrivia(gameState, players) {
  state.gameState = gameState;
  elements.gameTitle.textContent = '🧠 Nevermore Trivia 📺';
  
  showTriviaQuestion(0, gameState.questions[0], 15);
  updateScoreBoard(players);
}

function showTriviaQuestion(index, question, timeLeft) {
  state.gameState.currentQuestion = index;
  state.gameState.timeLeft = timeLeft;
  state.gameState.answered = [];
  state.gameState.selectedAnswer = null;
  
  elements.gameContent.innerHTML = `
    <div class="trivia-container">
      <div class="trivia-timer" id="triviaTimer">${timeLeft}</div>
      <div class="trivia-progress">Question ${index + 1} of ${state.gameState.questions.length}</div>
      <div class="trivia-question">${escapeHtml(question.q)}</div>
      <div class="trivia-options" id="triviaOptions">
        ${question.options.map((opt, i) => `
          <button class="trivia-option" data-index="${i}">${escapeHtml(opt)}</button>
        `).join('')}
      </div>
      <div class="trivia-answered" id="triviaAnswered">Waiting for answers...</div>
    </div>
  `;
  
  document.querySelectorAll('.trivia-option').forEach(option => {
    option.addEventListener('click', () => {
      if (state.gameState.selectedAnswer !== null) return;
      state.gameState.selectedAnswer = parseInt(option.dataset.index);
      option.classList.add('selected');
      socket.emit('triviaAnswer', state.gameState.selectedAnswer);
    });
  });
}

function updateTriviaTimer(timeLeft) {
  const timer = document.getElementById('triviaTimer');
  if (timer) {
    timer.textContent = timeLeft;
    if (timeLeft <= 5) {
      timer.classList.add('warning');
    } else {
      timer.classList.remove('warning');
    }
  }
}

function handlePlayerAnswered(data) {
  const answered = document.getElementById('triviaAnswered');
  if (answered) {
    answered.textContent = `${data.answeredCount}/${data.totalPlayers} players answered`;
  }
  updateScoreBoard(data.players);
}

function handleTriviaReveal(data) {
  const options = document.querySelectorAll('.trivia-option');
  options.forEach((opt, i) => {
    opt.classList.add('revealed');
    if (i === data.correctAnswer) {
      opt.classList.add('correct');
    } else if (i === state.gameState.selectedAnswer) {
      opt.classList.add('wrong');
    }
  });
  updateScoreBoard(data.players);
}

function handleNextTriviaQuestion(data) {
  showTriviaQuestion(data.questionIndex, data.question, 15);
}

function showTriviaGameOver() {
  const container = document.querySelector('.trivia-container');
  if (container) {
    const status = document.createElement('div');
    status.className = 'trivia-final';
    status.innerHTML = '<h3>🎉 Trivia Complete! 🎉</h3>';
    container.appendChild(status);
    showPlayAgainButton('trivia');
  }
}

// ============================================
// CHESS GAME (Improved with Chessground-inspired features)
// ============================================

// Use outlined pieces for white, filled pieces for black
// These Unicode characters are specifically designed: outlined = white, filled = black
const CHESS_PIECES = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',  // White (outlined)
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'   // Black (filled)
};

function initChessGame(gameState, players) {
  state.gameState = gameState;
  elements.gameTitle.textContent = '♟️ Vecna\'s Chess 👑';
  
  const isWhitePlayer = gameState.whitePlayer === state.playerId;
  const isBlackPlayer = gameState.blackPlayer === state.playerId;
  chessState.myColor = isWhitePlayer ? 'white' : (isBlackPlayer ? 'black' : null);
  chessState.isMyTurn = gameState.currentPlayer === state.playerId;
  chessState.selectedSquare = null;
  chessState.validMoves = [];
  
  const whiteName = players.find(p => p.id === gameState.whitePlayer)?.name || 'White';
  const blackName = players.find(p => p.id === gameState.blackPlayer)?.name || 'Black';
  
  renderChessBoard(gameState.board, gameState.isWhiteTurn, whiteName, blackName);
  updateScoreBoard(players, gameState.currentPlayer);
}

function renderChessBoard(board, isWhiteTurn, whiteName, blackName) {
  const isSpectator = !chessState.myColor;
  // Board orientation: Black player sees board from their perspective (flipped)
  const flipBoard = chessState.myColor === 'black';
  
  let statusText = '';
  if (state.gameState.gameOver) {
    statusText = `👑 ${state.gameState.winnerName} wins by checkmate!`;
  } else if (state.gameState.inCheck) {
    statusText = `⚠️ ${isWhiteTurn ? whiteName : blackName} is in CHECK!`;
  } else {
    statusText = chessState.isMyTurn ? "🎯 Your turn!" : "⏳ Opponent's turn...";
  }
  
  // Show opponent at top, player at bottom
  const topPlayer = flipBoard ? 
    `<span class="chess-player ${isWhiteTurn ? 'active' : ''}">⚪ ${escapeHtml(whiteName)}</span>` :
    `<span class="chess-player ${!isWhiteTurn ? 'active' : ''}">⚫ ${escapeHtml(blackName)}</span>`;
  
  const bottomPlayer = flipBoard ?
    `<span class="chess-player ${!isWhiteTurn ? 'active' : ''}">⚫ ${escapeHtml(blackName)}</span>` :
    `<span class="chess-player ${isWhiteTurn ? 'active' : ''}">⚪ ${escapeHtml(whiteName)}</span>`;
  
  elements.gameContent.innerHTML = `
    <div class="chess-container">
      <div class="chess-status" id="chessStatus">${statusText}</div>
      <div class="chess-player-top">${topPlayer}</div>
      <div class="chess-board-wrapper">
        <div class="chess-coords-col">
          ${flipBoard ? 
            [1,2,3,4,5,6,7,8].map(n => `<span>${n}</span>`).join('') :
            [8,7,6,5,4,3,2,1].map(n => `<span>${n}</span>`).join('')
          }
        </div>
        <div class="chess-board" id="chessBoard">
          ${renderChessBoardSquares(board, flipBoard)}
        </div>
      </div>
      <div class="chess-coords-row">
        ${flipBoard ?
          ['h','g','f','e','d','c','b','a'].map(l => `<span>${l}</span>`).join('') :
          ['a','b','c','d','e','f','g','h'].map(l => `<span>${l}</span>`).join('')
        }
      </div>
      <div class="chess-player-bottom">${bottomPlayer}</div>
      <div class="chess-info">
        ${isSpectator ? '👁️ Spectating' : `You are playing as ${chessState.myColor === 'white' ? '⚪ White' : '⚫ Black'}`}
      </div>
    </div>
  `;
  
  // Add click/touch handlers
  if (!state.gameState.gameOver) {
    document.querySelectorAll('.chess-square').forEach(square => {
      // Prevent text selection on touch
      square.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleChessSquareClick(
          parseInt(square.dataset.row),
          parseInt(square.dataset.col)
        );
      }, { passive: false });
      
      square.addEventListener('click', (e) => {
        e.preventDefault();
        handleChessSquareClick(
          parseInt(square.dataset.row),
          parseInt(square.dataset.col)
        );
      });
    });
  }
  
  // Show play again button if game over
  if (state.gameState.gameOver) {
    showPlayAgainButton('chess');
  }
}

function renderChessBoardSquares(board, flipBoard) {
  let html = '';
  
  for (let displayRow = 0; displayRow < 8; displayRow++) {
    for (let displayCol = 0; displayCol < 8; displayCol++) {
      const row = flipBoard ? 7 - displayRow : displayRow;
      const col = flipBoard ? 7 - displayCol : displayCol;
      const piece = board[row][col];
      const isLight = (row + col) % 2 === 0;
      const squareClass = isLight ? 'light' : 'dark';
      const pieceHtml = piece ? CHESS_PIECES[piece] : '';
      const isWhitePiece = piece && piece === piece.toUpperCase();
      const isBlackPiece = piece && piece === piece.toLowerCase();
      
      const isSelected = chessState.selectedSquare && 
                         chessState.selectedSquare[0] === row && 
                         chessState.selectedSquare[1] === col;
      const isLastMove = state.gameState.lastMove && (
        (state.gameState.lastMove.from[0] === row && state.gameState.lastMove.from[1] === col) ||
        (state.gameState.lastMove.to[0] === row && state.gameState.lastMove.to[1] === col)
      );
      const isValidMove = chessState.validMoves.some(m => m[0] === row && m[1] === col);
      const isCapture = isValidMove && piece;
      
      html += `
        <div class="chess-square ${squareClass} ${isSelected ? 'selected' : ''} ${isLastMove ? 'last-move' : ''} ${isValidMove ? 'valid-move' : ''} ${isCapture ? 'capture-move' : ''}" 
             data-row="${row}" data-col="${col}">
          ${isValidMove && !piece ? '<div class="move-indicator"></div>' : ''}
          ${isCapture ? '<div class="capture-indicator"></div>' : ''}
          <span class="chess-piece ${isWhitePiece ? 'white-piece' : ''} ${isBlackPiece ? 'black-piece' : ''}">
            ${pieceHtml}
          </span>
        </div>
      `;
    }
  }
  
  return html;
}

function handleChessSquareClick(row, col) {
  if (!chessState.isMyTurn || !chessState.myColor) return;
  
  const board = state.gameState.board;
  const piece = board[row][col];
  const isWhiteTurn = state.gameState.isWhiteTurn;
  
  // If we have a selected piece, try to move
  if (chessState.selectedSquare) {
    const [fromRow, fromCol] = chessState.selectedSquare;
    
    // Clicking same square deselects
    if (fromRow === row && fromCol === col) {
      chessState.selectedSquare = null;
      chessState.validMoves = [];
      updateChessBoardUI();
      return;
    }
    
    // Check if clicking on own piece - switch selection
    if (piece) {
      const isPieceWhite = piece === piece.toUpperCase();
      const canSelect = (chessState.myColor === 'white' && isPieceWhite && isWhiteTurn) ||
                        (chessState.myColor === 'black' && !isPieceWhite && !isWhiteTurn);
      if (canSelect) {
        chessState.selectedSquare = [row, col];
        chessState.validMoves = calculateValidMoves(board, row, col, isWhiteTurn);
        updateChessBoardUI();
        return;
      }
    }
    
    // Try to make the move
    socket.emit('chessMove', {
      from: [fromRow, fromCol],
      to: [row, col]
    });
    
    chessState.selectedSquare = null;
    chessState.validMoves = [];
    return;
  }
  
  // Select a piece if it's our color
  if (piece) {
    const isPieceWhite = piece === piece.toUpperCase();
    const canSelect = (chessState.myColor === 'white' && isPieceWhite && isWhiteTurn) ||
                      (chessState.myColor === 'black' && !isPieceWhite && !isWhiteTurn);
    
    if (canSelect) {
      chessState.selectedSquare = [row, col];
      chessState.validMoves = calculateValidMoves(board, row, col, isWhiteTurn);
      updateChessBoardUI();
    }
  }
}

// Calculate valid moves for a piece (client-side preview)
function calculateValidMoves(board, fromRow, fromCol, isWhiteTurn) {
  const piece = board[fromRow][fromCol];
  if (!piece) return [];
  
  const moves = [];
  const isWhite = piece === piece.toUpperCase();
  const pieceType = piece.toLowerCase();
  
  // Helper function to check if position is on board
  const isOnBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  
  // Helper to check if can move to square
  const canMoveTo = (r, c) => {
    if (!isOnBoard(r, c)) return false;
    const target = board[r][c];
    if (!target) return true;
    const targetIsWhite = target === target.toUpperCase();
    return targetIsWhite !== isWhite; // Can capture opponent
  };
  
  // Helper to check if square is empty
  const isEmpty = (r, c) => isOnBoard(r, c) && !board[r][c];
  
  // Helper to check if can capture at square
  const canCapture = (r, c) => {
    if (!isOnBoard(r, c)) return false;
    const target = board[r][c];
    if (!target) return false;
    const targetIsWhite = target === target.toUpperCase();
    return targetIsWhite !== isWhite;
  };
  
  switch (pieceType) {
    case 'p': // Pawn
      const direction = isWhite ? -1 : 1;
      const startRow = isWhite ? 6 : 1;
      
      // Move forward one
      if (isEmpty(fromRow + direction, fromCol)) {
        moves.push([fromRow + direction, fromCol]);
        // Move forward two from start
        if (fromRow === startRow && isEmpty(fromRow + 2 * direction, fromCol)) {
          moves.push([fromRow + 2 * direction, fromCol]);
        }
      }
      // Capture diagonally
      if (canCapture(fromRow + direction, fromCol - 1)) moves.push([fromRow + direction, fromCol - 1]);
      if (canCapture(fromRow + direction, fromCol + 1)) moves.push([fromRow + direction, fromCol + 1]);
      break;
      
    case 'n': // Knight
      const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      knightMoves.forEach(([dr, dc]) => {
        if (canMoveTo(fromRow + dr, fromCol + dc)) moves.push([fromRow + dr, fromCol + dc]);
      });
      break;
      
    case 'b': // Bishop
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        for (let i = 1; i < 8; i++) {
          const r = fromRow + dr * i, c = fromCol + dc * i;
          if (!isOnBoard(r, c)) break;
          if (isEmpty(r, c)) moves.push([r, c]);
          else {
            if (canCapture(r, c)) moves.push([r, c]);
            break;
          }
        }
      }
      break;
      
    case 'r': // Rook
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        for (let i = 1; i < 8; i++) {
          const r = fromRow + dr * i, c = fromCol + dc * i;
          if (!isOnBoard(r, c)) break;
          if (isEmpty(r, c)) moves.push([r, c]);
          else {
            if (canCapture(r, c)) moves.push([r, c]);
            break;
          }
        }
      }
      break;
      
    case 'q': // Queen
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        for (let i = 1; i < 8; i++) {
          const r = fromRow + dr * i, c = fromCol + dc * i;
          if (!isOnBoard(r, c)) break;
          if (isEmpty(r, c)) moves.push([r, c]);
          else {
            if (canCapture(r, c)) moves.push([r, c]);
            break;
          }
        }
      }
      break;
      
    case 'k': // King
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        if (canMoveTo(fromRow + dr, fromCol + dc)) moves.push([fromRow + dr, fromCol + dc]);
      }
      break;
  }
  
  return moves;
}

function updateChessBoardUI() {
  document.querySelectorAll('.chess-square').forEach(square => {
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);
    const piece = state.gameState.board[row][col];
    
    const isSelected = chessState.selectedSquare && 
                       chessState.selectedSquare[0] === row && 
                       chessState.selectedSquare[1] === col;
    const isValidMove = chessState.validMoves.some(m => m[0] === row && m[1] === col);
    const isCapture = isValidMove && piece;
    
    square.classList.toggle('selected', isSelected);
    square.classList.toggle('valid-move', isValidMove);
    square.classList.toggle('capture-move', isCapture);
    
    // Add/remove move indicators
    let indicator = square.querySelector('.move-indicator');
    let captureIndicator = square.querySelector('.capture-indicator');
    
    if (isValidMove && !piece && !indicator) {
      const div = document.createElement('div');
      div.className = 'move-indicator';
      square.appendChild(div);
    } else if ((!isValidMove || piece) && indicator) {
      indicator.remove();
    }
    
    if (isCapture && !captureIndicator) {
      const div = document.createElement('div');
      div.className = 'capture-indicator';
      square.appendChild(div);
    } else if (!isCapture && captureIndicator) {
      captureIndicator.remove();
    }
  });
}

function handleChessUpdate(data) {
  state.gameState.board = data.board;
  state.gameState.currentPlayer = data.currentPlayer;
  state.gameState.isWhiteTurn = data.isWhiteTurn;
  state.gameState.inCheck = data.inCheck;
  state.gameState.gameOver = data.gameOver;
  state.gameState.winner = data.winner;
  state.gameState.winnerName = data.winnerName;
  state.gameState.lastMove = data.lastMove;
  
  chessState.isMyTurn = data.currentPlayer === state.playerId;
  chessState.selectedSquare = null;
  chessState.validMoves = [];
  
  const whiteName = state.players.find(p => p.id === state.gameState.whitePlayer)?.name || 'White';
  const blackName = state.players.find(p => p.id === state.gameState.blackPlayer)?.name || 'Black';
  
  renderChessBoard(data.board, data.isWhiteTurn, whiteName, blackName);
  updateScoreBoard(data.players, data.currentPlayer);
  
  if (data.inCheck && !data.gameOver) {
    addChatMessage({
      system: true,
      message: `⚠️ ${data.isWhiteTurn ? whiteName : blackName} is in check!`
    }, elements.gameChatMessages);
  }
  
  if (data.gameOver) {
    addChatMessage({
      system: true,
      message: `👑 ${data.winnerName} wins the game!`
    }, elements.gameChatMessages);
  }
}

// ============================================
// PSYCHIC SHOWDOWN
// ============================================

function initPsychicGame(gameState, players) {
  state.gameState = gameState;
  state.gameState.myChoice = null;
  state.gameState.showingRules = true;
  elements.gameTitle.textContent = '🔮 Psychic Showdown ⚡';
  
  // Show rules first
  showPsychicRules(players);
}

function showPsychicRules(players) {
  elements.gameContent.innerHTML = `
    <div class="psychic-container">
      <div class="psychic-title">🔮 Psychic Showdown Rules ⚡</div>
      <div class="psychic-rules">
        <div class="rule-item">
          <span class="rule-matchup">👁️ Vision</span>
          <span class="rule-beats">BEATS</span>
          <span class="rule-matchup">🧠 Mind</span>
          <span class="rule-desc">(Wednesday sees through Vecna's tricks)</span>
        </div>
        <div class="rule-item">
          <span class="rule-matchup">🧠 Mind</span>
          <span class="rule-beats">BEATS</span>
          <span class="rule-matchup">⚡ Power</span>
          <span class="rule-desc">(Vecna outsmarts raw force)</span>
        </div>
        <div class="rule-item">
          <span class="rule-matchup">⚡ Power</span>
          <span class="rule-beats">BEATS</span>
          <span class="rule-matchup">👁️ Vision</span>
          <span class="rule-desc">(Eleven's power overwhelms visions)</span>
        </div>
      </div>
      <div class="psychic-rules-info">
        <p>🎮 Each round, all players choose simultaneously</p>
        <p>⭐ Win against each opponent = +5 points</p>
        <p>🏆 10 rounds total - highest score wins!</p>
      </div>
      <div class="psychic-countdown" id="psychicCountdown">Game starts in 5...</div>
    </div>
  `;
  
  updateScoreBoard(players);
  
  // Countdown to start
  let countdown = 5;
  const countdownEl = document.getElementById('psychicCountdown');
  const countdownInterval = setInterval(() => {
    countdown--;
    if (countdownEl) {
      countdownEl.textContent = countdown > 0 ? `Game starts in ${countdown}...` : 'GO!';
    }
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      state.gameState.showingRules = false;
      showPsychicRound(1);
    }
  }, 1000);
}

function showPsychicRound(round) {
  elements.gameContent.innerHTML = `
    <div class="psychic-container">
      <div class="psychic-round">Round ${round}/10</div>
      <div class="psychic-title">Choose Your Power!</div>
      <div class="psychic-choices">
        <button class="psychic-choice" data-choice="vision">
          <span class="choice-icon">👁️</span>
          <span class="choice-name">Vision</span>
          <span class="choice-desc">Wednesday's sight</span>
        </button>
        <button class="psychic-choice" data-choice="mind">
          <span class="choice-icon">🧠</span>
          <span class="choice-name">Mind</span>
          <span class="choice-desc">Vecna's control</span>
        </button>
        <button class="psychic-choice" data-choice="power">
          <span class="choice-icon">⚡</span>
          <span class="choice-name">Power</span>
          <span class="choice-desc">Eleven's force</span>
        </button>
      </div>
      <div class="psychic-waiting" id="psychicWaiting" style="display: none;">
        Waiting for other players...
      </div>
    </div>
  `;
  
  document.querySelectorAll('.psychic-choice').forEach(choice => {
    choice.addEventListener('click', () => {
      if (state.gameState.myChoice) return;
      state.gameState.myChoice = choice.dataset.choice;
      choice.classList.add('selected');
      document.getElementById('psychicWaiting').style.display = 'block';
      socket.emit('psychicMove', choice.dataset.choice);
    });
  });
}

function handlePlayerChose(data) {
  // Just a notification that someone chose
}

function handlePsychicResults(data) {
  const choiceEmojis = { vision: '👁️', mind: '🧠', power: '⚡' };
  const choiceNames = { vision: 'Vision', mind: 'Mind', power: 'Power' };
  const isFinalRound = data.round >= 10;
  
  elements.gameContent.innerHTML = `
    <div class="psychic-container">
      <div class="psychic-round">Round ${data.round}/10 ${isFinalRound ? '- FINAL ROUND!' : ''}</div>
      <div class="psychic-title">⚔️ Round Results ⚔️</div>
      <div class="psychic-results">
        ${state.players.map(p => {
          const choice = data.choices[p.id];
          const roundResult = data.roundResults ? data.roundResults[p.id] : null;
          const resultText = roundResult ? 
            (roundResult.wins > roundResult.losses ? '✅ Won' : 
             roundResult.wins < roundResult.losses ? '❌ Lost' : '🤝 Tied') : '';
          const pointsGained = roundResult ? roundResult.wins * 5 : 0;
          return `
            <div class="psychic-result-item ${roundResult && roundResult.wins > roundResult.losses ? 'winner' : ''}">
              <div class="result-player">
                <span class="result-name">${escapeHtml(p.name)}</span>
                <span class="result-choice">${choiceEmojis[choice] || '?'} ${choiceNames[choice] || 'No choice'}</span>
              </div>
              <div class="result-outcome">
                <span class="result-status">${resultText}</span>
                ${pointsGained > 0 ? `<span class="result-points">+${pointsGained}</span>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="psychic-rules-reminder">
        👁️ Vision beats 🧠 Mind | 🧠 Mind beats ⚡ Power | ⚡ Power beats 👁️ Vision
      </div>
      ${!isFinalRound ? `<div class="psychic-next-round">Next round in 5 seconds...</div>` : ''}
      ${isFinalRound ? '<div class="psychic-final"><h3>🎉 Game Complete! 🎉</h3></div>' : ''}
    </div>
  `;
  
  updateScoreBoard(data.players);
  
  if (isFinalRound) {
    showPlayAgainButton('psychic');
  }
}

function handleNextPsychicRound(data) {
  state.gameState.myChoice = null;
  showPsychicRound(data.round);
}

// ============================================
// DEMOGORGON HUNT (REACTION GAME)
// ============================================

function initReactionGame(gameState, players) {
  state.gameState = gameState;
  elements.gameTitle.textContent = '👹 Demogorgon Hunt 🎯';
  
  elements.gameContent.innerHTML = `
    <div class="reaction-container">
      <div class="reaction-round">Round ${gameState.round}/${gameState.maxRounds}</div>
      <div class="reaction-title">Get Ready to Hunt!</div>
      <div class="reaction-instructions">
        <p>🎯 Click the Demogorgon as fast as you can when it appears!</p>
        <p>⚡ Fastest player wins each round</p>
        <p>🏆 +10 points per round won</p>
      </div>
      <div class="reaction-arena" id="reactionArena">
        <div class="reaction-waiting">
          <span class="waiting-icon">👁️</span>
          <span>Watching the Upside Down...</span>
        </div>
      </div>
    </div>
  `;
  
  updateScoreBoard(players);
  
  // First round starts after a random delay (handled by server)
}

function handleReactionShowTarget(data) {
  const arena = document.getElementById('reactionArena');
  if (!arena) return;
  
  arena.innerHTML = `
    <div class="demogorgon-target" id="demogorgonTarget" 
         style="left: ${data.position.x}%; top: ${data.position.y}%;">
      👹
    </div>
  `;
  
  const target = document.getElementById('demogorgonTarget');
  if (target) {
    target.addEventListener('click', () => {
      socket.emit('reactionClick', { timestamp: Date.now() });
      target.classList.add('clicked');
    });
  }
}

function handleReactionRoundResult(data) {
  const arena = document.getElementById('reactionArena');
  if (!arena) return;
  
  arena.innerHTML = `
    <div class="reaction-result">
      <div class="result-winner-icon">🏆</div>
      <div class="result-winner-name">${escapeHtml(data.winnerName)}</div>
      <div class="result-reaction-time">${data.reactionTime}ms</div>
      <div class="result-caught">caught the Demogorgon!</div>
    </div>
  `;
  
  updateScoreBoard(data.players);
}

function handleReactionNextRound(data) {
  state.gameState.round = data.round;
  
  const container = document.querySelector('.reaction-container');
  if (container) {
    const roundEl = container.querySelector('.reaction-round');
    if (roundEl) {
      roundEl.textContent = `Round ${data.round}/${state.gameState.maxRounds}`;
    }
  }
  
  const arena = document.getElementById('reactionArena');
  if (arena) {
    arena.innerHTML = `
      <div class="reaction-waiting">
        <span class="waiting-icon">👁️</span>
        <span>Watching the Upside Down...</span>
      </div>
    `;
  }
}

// ============================================
// WORD CHAIN GAME
// ============================================

function initWordChainGame(gameState, players) {
  state.gameState = gameState;
  state.gameState.timerInterval = null;
  elements.gameTitle.textContent = '🔤 Word Chain ⛓️';
  
  const isMyTurn = gameState.currentPlayer === state.playerId;
  const currentPlayerName = players.find(p => p.id === gameState.currentPlayer)?.name || 'Unknown';
  
  elements.gameContent.innerHTML = `
    <div class="wordchain-container">
      <div class="wordchain-category">Category: ${escapeHtml(gameState.category)}</div>
      <div class="wordchain-letter">
        Next word must start with: <span class="letter-highlight">${gameState.currentLetter}</span>
      </div>
      <div class="wordchain-turn" id="wordchainTurn">
        ${isMyTurn ? "🎯 Your turn!" : `Waiting for ${escapeHtml(currentPlayerName)}...`}
      </div>
      <div class="wordchain-timer" id="wordchainTimer">${gameState.timeLeft}</div>
      ${isMyTurn ? `
        <div class="wordchain-input-container">
          <input type="text" id="wordchainInput" placeholder="Type a word..." maxlength="20" autocomplete="off">
          <button class="btn btn-primary" id="wordchainSubmitBtn">Submit</button>
        </div>
      ` : ''}
      <div class="wordchain-history" id="wordchainHistory">
        <h4>Words Used:</h4>
        <div class="word-list">
          ${gameState.usedWords.length > 0 ? gameState.usedWords.map(w => `<span class="used-word">${escapeHtml(w)}</span>`).join('') : '<span class="no-words">No words yet...</span>'}
        </div>
      </div>
      <div class="wordchain-rules">
        <p>📝 Type a word starting with the shown letter</p>
        <p>⏰ You have 10 seconds per turn</p>
        <p>⭐ Longer words = more points!</p>
      </div>
    </div>
  `;
  
  updateScoreBoard(players, gameState.currentPlayer);
  
  if (isMyTurn) {
    const input = document.getElementById('wordchainInput');
    const submitBtn = document.getElementById('wordchainSubmitBtn');
    
    input.focus();
    
    submitBtn.addEventListener('click', () => submitWord());
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitWord();
    });
    
    // Start local timer
    startWordChainTimer();
  }
}

function submitWord() {
  const input = document.getElementById('wordchainInput');
  if (!input) return;
  
  const word = input.value.trim();
  if (!word) {
    showError('Please enter a word!');
    return;
  }
  
  socket.emit('wordchainSubmit', word);
  input.value = '';
}

function startWordChainTimer() {
  if (state.gameState.timerInterval) {
    clearInterval(state.gameState.timerInterval);
  }
  
  state.gameState.timeLeft = 10;
  const timerEl = document.getElementById('wordchainTimer');
  
  state.gameState.timerInterval = setInterval(() => {
    state.gameState.timeLeft--;
    if (timerEl) {
      timerEl.textContent = state.gameState.timeLeft;
      if (state.gameState.timeLeft <= 3) {
        timerEl.classList.add('warning');
      }
    }
    
    if (state.gameState.timeLeft <= 0) {
      clearInterval(state.gameState.timerInterval);
      socket.emit('wordchainTimeout');
    }
  }, 1000);
}

function handleWordchainUpdate(data) {
  if (state.gameState.timerInterval) {
    clearInterval(state.gameState.timerInterval);
  }
  
  state.gameState.currentPlayer = data.currentPlayer;
  state.gameState.usedWords = data.usedWords;
  state.gameState.currentLetter = data.nextLetter;
  
  const isMyTurn = data.currentPlayer === state.playerId;
  const currentPlayerName = state.players.find(p => p.id === data.currentPlayer)?.name || 'Unknown';
  
  // Update letter
  const letterEl = document.querySelector('.wordchain-letter .letter-highlight');
  if (letterEl) letterEl.textContent = data.nextLetter;
  
  // Update turn indicator
  const turnEl = document.getElementById('wordchainTurn');
  if (turnEl) {
    turnEl.textContent = isMyTurn ? "🎯 Your turn!" : `Waiting for ${escapeHtml(currentPlayerName)}...`;
  }
  
  // Update word history
  const historyEl = document.getElementById('wordchainHistory');
  if (historyEl) {
    historyEl.innerHTML = `
      <h4>Words Used:</h4>
      <div class="word-list">
        ${data.usedWords.map(w => `<span class="used-word">${escapeHtml(w)}</span>`).join('')}
      </div>
    `;
  }
  
  // Add/remove input based on turn
  const container = document.querySelector('.wordchain-container');
  const existingInput = container.querySelector('.wordchain-input-container');
  
  if (isMyTurn && !existingInput) {
    const timerEl = document.getElementById('wordchainTimer');
    const inputHtml = `
      <div class="wordchain-input-container">
        <input type="text" id="wordchainInput" placeholder="Type a word..." maxlength="20" autocomplete="off">
        <button class="btn btn-primary" id="wordchainSubmitBtn">Submit</button>
      </div>
    `;
    timerEl.insertAdjacentHTML('afterend', inputHtml);
    
    const input = document.getElementById('wordchainInput');
    const submitBtn = document.getElementById('wordchainSubmitBtn');
    
    input.focus();
    submitBtn.addEventListener('click', () => submitWord());
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitWord();
    });
    
    startWordChainTimer();
  } else if (!isMyTurn && existingInput) {
    existingInput.remove();
  }
  
  // Reset timer display
  const timerEl = document.getElementById('wordchainTimer');
  if (timerEl) {
    timerEl.textContent = '10';
    timerEl.classList.remove('warning');
  }
  
  updateScoreBoard(data.players, data.currentPlayer);
}

function handleWordchainTimeout(data) {
  if (state.gameState.timerInterval) {
    clearInterval(state.gameState.timerInterval);
  }
  
  addChatMessage({
    system: true,
    message: `⏰ ${data.playerName} ran out of time! (-5 points)`
  }, elements.gameChatMessages);
  
  handleWordchainUpdate({
    currentPlayer: data.currentPlayer,
    usedWords: state.gameState.usedWords,
    nextLetter: state.gameState.currentLetter,
    players: data.players
  });
}

// ============================================
// SOCKET EVENT HANDLERS
// ============================================

socket.on('connect', () => {
  state.playerId = socket.id;
  console.log('🔌 Connected:', socket.id);
  updateConnectionStatus('connected', '✅', 'Connected! Ready to play!');
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
  updateConnectionStatus('disconnected', '❌', 'Server offline - <a href="https://render.com/deploy" target="_blank">Deploy backend first</a>');
});

socket.on('disconnect', () => {
  console.log('🔌 Disconnected from server');
  updateConnectionStatus('disconnected', '🔌', 'Disconnected from server');
});

function updateConnectionStatus(status, icon, text) {
  const statusEl = document.getElementById('connectionStatus');
  if (statusEl) {
    statusEl.className = 'connection-status ' + status;
    statusEl.innerHTML = `<span class="status-icon">${icon}</span><span class="status-text">${text}</span>`;
  }
}

socket.on('roomCreated', (data) => {
  state.roomId = data.roomId;
  state.isHost = true;
  state.players = data.players;
  elements.displayRoomCode.textContent = data.roomId;
  updatePlayersList(data.players);
  showScreen('lobby');
});

socket.on('roomJoined', (data) => {
  state.roomId = data.roomId;
  state.isHost = false;
  state.players = data.players;
  elements.displayRoomCode.textContent = data.roomId;
  updatePlayersList(data.players);
  showScreen('lobby');
});

socket.on('playerJoined', (data) => {
  updatePlayersList(data.players);
  addChatMessage({ system: true, message: '👤 A new outcast has arrived!' });
});

socket.on('playerLeft', (data) => {
  state.players = data.players;
  if (data.newHostId === state.playerId) {
    state.isHost = true;
  }
  updatePlayersList(data.players);
  addChatMessage({ system: true, message: `👻 ${data.playerName} vanished into the Upside Down...` });
});

socket.on('chatMessage', (msg) => {
  addChatMessage(msg, elements.chatMessages);
  addChatMessage(msg, elements.gameChatMessages);
});

socket.on('error', (data) => {
  showError(data.message);
});

// Game events
socket.on('gameStarted', (data) => {
  state.currentGame = data.gameType;
  state.players = data.players;
  showScreen('gameScreen');
  
  switch (data.gameType) {
    case 'tictactoe':
      initTicTacToe(data.gameState, data.players);
      break;
    case 'memory':
      initMemoryGame(data.gameState, data.players);
      break;
    case 'trivia':
      initTrivia(data.gameState, data.players);
      break;
    case 'chess':
      initChessGame(data.gameState, data.players);
      break;
    case 'psychic':
      initPsychicGame(data.gameState, data.players);
      break;
    case 'reaction':
      initReactionGame(data.gameState, data.players);
      break;
    case 'wordchain':
      initWordChainGame(data.gameState, data.players);
      break;
  }
});

socket.on('gameUpdate', (data) => {
  // Generic game update - specific games have their own handlers
});

socket.on('returnToLobby', (data) => {
  state.currentGame = null;
  state.players = data.players;
  updatePlayersList(data.players);
  showScreen('lobby');
});

// Tic Tac Toe
socket.on('tttUpdate', updateTicTacToe);

// Memory
socket.on('cardFlipped', handleMemoryFlip);
socket.on('memoryMatch', handleMemoryMatch);
socket.on('memoryMismatch', handleMemoryMismatch);
socket.on('memoryTurn', handleMemoryTurn);

// Trivia
socket.on('triviaTimer', (data) => updateTriviaTimer(data.timeLeft));
socket.on('playerAnswered', handlePlayerAnswered);
socket.on('triviaReveal', handleTriviaReveal);
socket.on('nextTriviaQuestion', handleNextTriviaQuestion);

// Chess
socket.on('chessUpdate', handleChessUpdate);
socket.on('invalidMove', (data) => showError(data.message));

// Psychic
socket.on('playerChose', handlePlayerChose);
socket.on('psychicResults', handlePsychicResults);
socket.on('nextPsychicRound', handleNextPsychicRound);

// Reaction Game (Demogorgon Hunt)
socket.on('reactionShowTarget', handleReactionShowTarget);
socket.on('reactionRoundResult', handleReactionRoundResult);
socket.on('reactionNextRound', handleReactionNextRound);

// Word Chain
socket.on('wordchainUpdate', handleWordchainUpdate);
socket.on('wordchainError', (data) => showError(data.message));
socket.on('wordchainTimeout', handleWordchainTimeout);

// Game end
socket.on('gameEnded', (data) => {
  elements.resultsTitle.textContent = '🏆 Game Over! 🏆';
  elements.resultsContent.innerHTML = `
    <div class="results-winner">
      👑 Winner: <span class="winner-name">${escapeHtml(data.winner.name)}</span>
      with ${data.winner.score} points!
    </div>
    <div class="results-list">
      ${data.players.map((p, i) => `
        <div class="results-item">
          <span><span class="rank">#${i + 1}</span> ${escapeHtml(p.name)}</span>
          <span class="score">${p.score} pts</span>
        </div>
      `).join('')}
    </div>
    <div class="results-actions">
      ${state.isHost ? `
        <button class="btn btn-primary" id="modalPlayAgainBtn">
          <span class="btn-icon">🔄</span> Play Again
        </button>
      ` : '<p style="color: var(--text-secondary); margin-top: 15px;">Waiting for host to restart...</p>'}
    </div>
  `;
  elements.resultsModal.classList.add('active');
  state.players = data.players;
  
  // Add play again handler in modal
  const modalPlayAgainBtn = document.getElementById('modalPlayAgainBtn');
  if (modalPlayAgainBtn) {
    modalPlayAgainBtn.addEventListener('click', () => {
      // For memory game, preserve the difficulty
      if (state.currentGame === 'memory' && state.gameState.difficulty) {
        socket.emit('restartGame', { type: 'memory', options: { difficulty: state.gameState.difficulty } });
      } else {
        socket.emit('restartGame', state.currentGame);
      }
    });
  }
});

// Game restarted
socket.on('gameRestarted', (data) => {
  elements.resultsModal.classList.remove('active');
  state.currentGame = data.gameType;
  state.players = data.players;
  
  switch (data.gameType) {
    case 'tictactoe':
      initTicTacToe(data.gameState, data.players);
      break;
    case 'memory':
      initMemoryGame(data.gameState, data.players);
      break;
    case 'trivia':
      initTrivia(data.gameState, data.players);
      break;
    case 'chess':
      initChessGame(data.gameState, data.players);
      break;
    case 'psychic':
      initPsychicGame(data.gameState, data.players);
      break;
    case 'reaction':
      initReactionGame(data.gameState, data.players);
      break;
    case 'wordchain':
      initWordChainGame(data.gameState, data.players);
      break;
  }
});

// ============================================
// UTILITIES
// ============================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

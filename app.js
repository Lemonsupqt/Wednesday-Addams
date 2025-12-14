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
      </div>
    `;
    // Re-attach event listeners for game cards
    document.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', () => startGame(card.dataset.game));
    });
  } else {
    elements.gameSelection.style.display = 'block';
    elements.gameSelection.innerHTML = '<h3 style="text-align: center; color: var(--text-secondary); font-family: Cinzel, serif;">⏳ Waiting for host to select a game... ⏳</h3>';
  }
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
  } else if (data.draw) {
    status.innerHTML = "🤝 It's a draw! 🤝";
  } else if (data.currentPlayer) {
    state.gameState.currentPlayer = data.currentPlayer;
    status.innerHTML = data.currentPlayer === state.playerId ? "🔴 Your turn!" : "Waiting for opponent...";
    updateScoreBoard(state.players, data.currentPlayer);
  }
}

// ============================================
// MEMORY GAME
// ============================================

function initMemoryGame(gameState, players) {
  state.gameState = gameState;
  elements.gameTitle.textContent = '🃏 Vecna\'s Memory Match 🃏';
  
  elements.gameContent.innerHTML = `
    <div class="memory-container">
      <div class="memory-status" id="memoryStatus">
        ${gameState.currentPlayer === state.playerId ? "🧠 Your turn to find a match!" : "Watching..."}
      </div>
      <div class="memory-board" id="memoryBoard">
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
      if (gameState.currentPlayer !== state.playerId) return;
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

// ============================================
// CHESS GAME
// ============================================

const CHESS_PIECES = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

function initChessGame(gameState, players) {
  state.gameState = gameState;
  elements.gameTitle.textContent = '♟️ Vecna\'s Chess 👑';
  
  const isWhitePlayer = gameState.whitePlayer === state.playerId;
  const isBlackPlayer = gameState.blackPlayer === state.playerId;
  chessState.myColor = isWhitePlayer ? 'white' : (isBlackPlayer ? 'black' : null);
  chessState.isMyTurn = gameState.currentPlayer === state.playerId;
  chessState.selectedSquare = null;
  
  const whiteName = players.find(p => p.id === gameState.whitePlayer)?.name || 'White';
  const blackName = players.find(p => p.id === gameState.blackPlayer)?.name || 'Black';
  
  renderChessBoard(gameState.board, gameState.isWhiteTurn, whiteName, blackName);
  updateScoreBoard(players, gameState.currentPlayer);
}

function renderChessBoard(board, isWhiteTurn, whiteName, blackName) {
  const isSpectator = !chessState.myColor;
  const flipBoard = chessState.myColor === 'black';
  
  let statusText = '';
  if (state.gameState.gameOver) {
    statusText = `👑 ${state.gameState.winnerName} wins!`;
  } else if (state.gameState.inCheck) {
    statusText = `⚠️ ${isWhiteTurn ? whiteName : blackName} is in CHECK!`;
  } else {
    statusText = chessState.isMyTurn ? "🎯 Your turn!" : "⏳ Opponent's turn...";
  }
  
  elements.gameContent.innerHTML = `
    <div class="chess-container">
      <div class="chess-status" id="chessStatus">${statusText}</div>
      <div class="chess-players">
        <span class="chess-player ${!isWhiteTurn ? 'active' : ''}">⚫ ${escapeHtml(blackName)}</span>
        <span class="chess-vs">vs</span>
        <span class="chess-player ${isWhiteTurn ? 'active' : ''}">⚪ ${escapeHtml(whiteName)}</span>
      </div>
      <div class="chess-board ${flipBoard ? 'flipped' : ''}" id="chessBoard">
        ${renderChessBoardSquares(board, flipBoard)}
      </div>
      <div class="chess-info">
        ${isSpectator ? '👁️ Spectating' : `You are playing as ${chessState.myColor === 'white' ? '⚪ White' : '⚫ Black'}`}
      </div>
    </div>
  `;
  
  // Add click handlers
  if (!state.gameState.gameOver) {
    document.querySelectorAll('.chess-square').forEach(square => {
      square.addEventListener('click', () => handleChessSquareClick(
        parseInt(square.dataset.row),
        parseInt(square.dataset.col)
      ));
    });
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
      const isSelected = chessState.selectedSquare && 
                         chessState.selectedSquare[0] === row && 
                         chessState.selectedSquare[1] === col;
      const isLastMove = state.gameState.lastMove && (
        (state.gameState.lastMove.from[0] === row && state.gameState.lastMove.from[1] === col) ||
        (state.gameState.lastMove.to[0] === row && state.gameState.lastMove.to[1] === col)
      );
      
      html += `
        <div class="chess-square ${squareClass} ${isSelected ? 'selected' : ''} ${isLastMove ? 'last-move' : ''}" 
             data-row="${row}" data-col="${col}">
          <span class="chess-piece ${piece && piece === piece.toUpperCase() ? 'white-piece' : 'black-piece'}">
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
      updateChessBoardUI();
      return;
    }
    
    // Try to make the move
    socket.emit('chessMove', {
      from: [fromRow, fromCol],
      to: [row, col]
    });
    
    chessState.selectedSquare = null;
    return;
  }
  
  // Select a piece if it's our color
  if (piece) {
    const isPieceWhite = piece === piece.toUpperCase();
    const canSelect = (chessState.myColor === 'white' && isPieceWhite && isWhiteTurn) ||
                      (chessState.myColor === 'black' && !isPieceWhite && !isWhiteTurn);
    
    if (canSelect) {
      chessState.selectedSquare = [row, col];
      updateChessBoardUI();
    }
  }
}

function updateChessBoardUI() {
  document.querySelectorAll('.chess-square').forEach(square => {
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);
    const isSelected = chessState.selectedSquare && 
                       chessState.selectedSquare[0] === row && 
                       chessState.selectedSquare[1] === col;
    square.classList.toggle('selected', isSelected);
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
  
  const whiteName = state.players.find(p => p.id === state.gameState.whitePlayer)?.name || 'White';
  const blackName = state.players.find(p => p.id === state.gameState.blackPlayer)?.name || 'Black';
  
  renderChessBoard(data.board, data.isWhiteTurn, whiteName, blackName);
  updateScoreBoard(data.players, data.currentPlayer);
  
  if (data.inCheck && !data.gameOver) {
    addChatMessage({
      system: true,
      message: `⚠️ ${data.isWhiteTurn ? blackName : whiteName} is in check!`
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
  elements.gameTitle.textContent = '🔮 Psychic Showdown ⚡';
  
  showPsychicRound(1);
  updateScoreBoard(players);
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
  
  elements.gameContent.innerHTML = `
    <div class="psychic-container">
      <div class="psychic-title">Results!</div>
      <div class="psychic-results">
        ${state.players.map(p => `
          <div class="psychic-result-item">
            <span>${escapeHtml(p.name)}</span>
            <span>${choiceEmojis[data.choices[p.id]] || '?'} ${data.choices[p.id] || 'No choice'}</span>
          </div>
        `).join('')}
      </div>
      <div style="margin-top: 20px; color: var(--text-secondary);">
        👁️ Vision beats 🧠 Mind | 🧠 Mind beats ⚡ Power | ⚡ Power beats 👁️ Vision
      </div>
    </div>
  `;
  
  updateScoreBoard(data.players);
}

function handleNextPsychicRound(data) {
  state.gameState.myChoice = null;
  showPsychicRound(data.round);
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
  `;
  elements.resultsModal.classList.add('active');
  state.players = data.players;
});

// ============================================
// UTILITIES
// ============================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

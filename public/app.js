// ============================================
// UPSIDE DOWN NEVERMORE GAMES
// Client-side game logic
// ============================================

const socket = io();

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

// Drawing state
let drawingState = {
  canvas: null,
  ctx: null,
  isDrawing: false,
  currentColor: '#000000',
  brushSize: 5,
  lastX: 0,
  lastY: 0
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
        <button class="game-card" data-game="drawing">
          <span class="game-icon">🖐️✏️</span>
          <span class="game-name">Thing's<br>Drawing Duel</span>
          <span class="game-players">3+ players</span>
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
        <button class="game-card" data-game="chess">
          <span class="game-icon">♟️♔</span>
          <span class="game-name">Nevermore<br>Chess</span>
          <span class="game-players">2 players</span>
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
  
  if (state.currentGame === 'drawing') {
    socket.emit('drawingGuess', message);
  } else {
    socket.emit('chatMessage', message);
  }
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
  
  if (data.winner || data.draw) {
    if (data.winner) {
      status.innerHTML = `🏆 ${escapeHtml(data.winnerName)} wins! 🏆`;
      updateScoreBoard(data.players);
    } else {
      status.innerHTML = "🤝 It's a draw! 🤝";
    }
    
    // Add play again buttons
    const container = document.querySelector('.ttt-container');
    if (container && !document.getElementById('tttPlayAgainBtns')) {
      const actionsDiv = document.createElement('div');
      actionsDiv.id = 'tttPlayAgainBtns';
      actionsDiv.className = 'game-over-actions';
      actionsDiv.innerHTML = `
        <button class="btn btn-primary game-rematch-btn">🔄 Play Again</button>
        <button class="btn btn-secondary game-lobby-btn">🏠 Back to Lobby</button>
      `;
      container.appendChild(actionsDiv);
      
      actionsDiv.querySelector('.game-rematch-btn').addEventListener('click', () => socket.emit('gameRematch'));
      actionsDiv.querySelector('.game-lobby-btn').addEventListener('click', () => socket.emit('endGame'));
    }
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
  
  // Check if game is over (all cards matched)
  if (data.matched.length === state.gameState.cards.length) {
    const container = document.querySelector('.memory-container');
    const status = document.getElementById('memoryStatus');
    if (status) {
      status.innerHTML = "🎉 All matches found! 🎉";
    }
    
    if (container && !document.getElementById('memoryPlayAgainBtns')) {
      const actionsDiv = document.createElement('div');
      actionsDiv.id = 'memoryPlayAgainBtns';
      actionsDiv.className = 'game-over-actions';
      actionsDiv.innerHTML = `
        <button class="btn btn-primary game-rematch-btn">🔄 Play Again</button>
        <button class="btn btn-secondary game-lobby-btn">🏠 Back to Lobby</button>
      `;
      container.appendChild(actionsDiv);
      
      actionsDiv.querySelector('.game-rematch-btn').addEventListener('click', () => socket.emit('gameRematch'));
      actionsDiv.querySelector('.game-lobby-btn').addEventListener('click', () => socket.emit('endGame'));
    }
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
  
  // Check if this is the last question
  const isLastQuestion = state.gameState.currentQuestion >= state.gameState.questions.length - 1;
  if (isLastQuestion) {
    const container = document.querySelector('.trivia-container');
    if (container && !document.getElementById('triviaPlayAgainBtns')) {
      const actionsDiv = document.createElement('div');
      actionsDiv.id = 'triviaPlayAgainBtns';
      actionsDiv.className = 'game-over-actions';
      actionsDiv.innerHTML = `
        <button class="btn btn-primary game-rematch-btn">🔄 Play Again</button>
        <button class="btn btn-secondary game-lobby-btn">🏠 Back to Lobby</button>
      `;
      container.appendChild(actionsDiv);
      
      actionsDiv.querySelector('.game-rematch-btn').addEventListener('click', () => socket.emit('gameRematch'));
      actionsDiv.querySelector('.game-lobby-btn').addEventListener('click', () => socket.emit('endGame'));
    }
  }
}

function handleNextTriviaQuestion(data) {
  showTriviaQuestion(data.questionIndex, data.question, 15);
}

// ============================================
// DRAWING GAME
// ============================================

function initDrawingGame(gameState, players) {
  state.gameState = gameState;
  elements.gameTitle.textContent = '🖐️ Thing\'s Drawing Duel ✏️';
  
  const isDrawer = gameState.currentDrawer === state.playerId;
  const drawerName = players.find(p => p.id === gameState.currentDrawer)?.name || 'Unknown';
  
  elements.gameContent.innerHTML = `
    <div class="drawing-container">
      <div class="drawing-info">
        <div class="drawing-prompt ${isDrawer ? '' : 'hidden'}">
          ${isDrawer ? `Draw: ${gameState.currentPrompt}` : `${drawerName} is drawing...`}
        </div>
        <div class="drawing-status">Round ${gameState.roundsPlayed + 1}/${gameState.maxRounds}</div>
      </div>
      <div class="drawing-canvas-container">
        <canvas id="drawingCanvas" width="600" height="400"></canvas>
      </div>
      ${isDrawer ? `
        <div class="drawing-tools">
          <div class="color-picker">
            ${['#000000', '#ffffff', '#e50914', '#9333ea', '#22c55e', '#3b82f6', '#eab308', '#f97316'].map(color => `
              <button class="color-btn ${color === '#000000' ? 'active' : ''}" style="background: ${color}" data-color="${color}"></button>
            `).join('')}
          </div>
          <div class="brush-sizes">
            <button class="size-btn small" data-size="3"></button>
            <button class="size-btn medium active" data-size="8"></button>
            <button class="size-btn large" data-size="15"></button>
          </div>
          <button id="clearCanvasBtn">🗑️ Clear</button>
        </div>
      ` : ''}
    </div>
  `;
  
  initCanvas(isDrawer);
  updateScoreBoard(players, gameState.currentDrawer);
}

function initCanvas(isDrawer) {
  const canvas = document.getElementById('drawingCanvas');
  const ctx = canvas.getContext('2d');
  
  drawingState.canvas = canvas;
  drawingState.ctx = ctx;
  drawingState.isDrawing = false;
  drawingState.currentColor = '#000000';
  drawingState.brushSize = 8;
  
  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (isDrawer) {
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Touch support
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      startDrawing({
        offsetX: touch.clientX - rect.left,
        offsetY: touch.clientY - rect.top
      });
    });
    
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      draw({
        offsetX: touch.clientX - rect.left,
        offsetY: touch.clientY - rect.top
      });
    });
    
    canvas.addEventListener('touchend', stopDrawing);
    
    // Color picker
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        drawingState.currentColor = btn.dataset.color;
      });
    });
    
    // Brush size
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        drawingState.brushSize = parseInt(btn.dataset.size);
      });
    });
    
    // Clear
    document.getElementById('clearCanvasBtn')?.addEventListener('click', () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      socket.emit('drawingData', { type: 'clear' });
    });
  } else {
    canvas.style.cursor = 'default';
  }
}

function startDrawing(e) {
  drawingState.isDrawing = true;
  drawingState.lastX = e.offsetX;
  drawingState.lastY = e.offsetY;
}

function draw(e) {
  if (!drawingState.isDrawing) return;
  
  const ctx = drawingState.ctx;
  ctx.beginPath();
  ctx.strokeStyle = drawingState.currentColor;
  ctx.lineWidth = drawingState.brushSize;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.moveTo(drawingState.lastX, drawingState.lastY);
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  
  // Send to others
  socket.emit('drawingData', {
    type: 'draw',
    x1: drawingState.lastX,
    y1: drawingState.lastY,
    x2: e.offsetX,
    y2: e.offsetY,
    color: drawingState.currentColor,
    size: drawingState.brushSize
  });
  
  drawingState.lastX = e.offsetX;
  drawingState.lastY = e.offsetY;
}

function stopDrawing() {
  drawingState.isDrawing = false;
}

function handleDrawingData(data) {
  if (state.gameState.currentDrawer === state.playerId) return;
  
  const ctx = drawingState.ctx;
  if (!ctx) return;
  
  if (data.data.type === 'clear') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, drawingState.canvas.width, drawingState.canvas.height);
  } else if (data.data.type === 'draw') {
    ctx.beginPath();
    ctx.strokeStyle = data.data.color;
    ctx.lineWidth = data.data.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(data.data.x1, data.data.y1);
    ctx.lineTo(data.data.x2, data.data.y2);
    ctx.stroke();
  }
}

function handleCorrectGuess(data) {
  addChatMessage({
    system: true,
    message: `🎉 ${data.playerName} guessed correctly!`
  }, elements.gameChatMessages);
  updateScoreBoard(data.players);
}

function handleNewDrawingRound(data) {
  state.gameState.currentDrawer = data.currentDrawer;
  state.gameState.currentPrompt = data.prompt;
  state.gameState.roundsPlayed = data.roundsPlayed;
  state.gameState.maxRounds = data.maxRounds || state.gameState.maxRounds;
  state.gameState.guessedPlayers = [];
  
  initDrawingGame(state.gameState, state.players);
  
  // Show play again buttons if this is the last round
  if (data.roundsPlayed >= data.maxRounds - 1) {
    const container = document.querySelector('.drawing-container');
    if (container && !document.getElementById('drawingPlayAgainBtns')) {
      const actionsDiv = document.createElement('div');
      actionsDiv.id = 'drawingPlayAgainBtns';
      actionsDiv.className = 'game-over-actions';
      actionsDiv.style.marginTop = '20px';
      actionsDiv.innerHTML = `
        <button class="btn btn-primary game-rematch-btn">🔄 Play Again</button>
        <button class="btn btn-secondary game-lobby-btn">🏠 Back to Lobby</button>
      `;
      container.appendChild(actionsDiv);
      
      actionsDiv.querySelector('.game-rematch-btn').addEventListener('click', () => socket.emit('gameRematch'));
      actionsDiv.querySelector('.game-lobby-btn').addEventListener('click', () => socket.emit('endGame'));
    }
  }
}

// ============================================
// CHESS GAME (Inspired by Lichess Chessground)
// ============================================

const CHESS_PIECES = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

let chessState = {
  selectedSquare: null,
  validMoves: [],
  playerColor: null,
  isDragging: false,
  dragPiece: null,
  dragElement: null
};

function initChessGame(gameState, players) {
  state.gameState = gameState;
  elements.gameTitle.textContent = '♟️ Nevermore Chess ♟️';
  
  // Determine player's color
  chessState.playerColor = gameState.whitePlayer === state.playerId ? 'white' : 
                           gameState.blackPlayer === state.playerId ? 'black' : null;
  chessState.selectedSquare = null;
  chessState.validMoves = [];
  
  renderChessBoard(gameState);
  updateScoreBoard(players, gameState.currentTurn === 'white' ? gameState.whitePlayer : gameState.blackPlayer);
}

function renderChessBoard(gameState) {
  const isFlipped = chessState.playerColor === 'black';
  const currentPlayerTurn = (gameState.currentTurn === 'white' && gameState.whitePlayer === state.playerId) ||
                            (gameState.currentTurn === 'black' && gameState.blackPlayer === state.playerId);
  
  let statusText = '';
  if (gameState.gameOver) {
    if (gameState.checkmate) {
      statusText = `♚ Checkmate! ${gameState.winnerName} wins! ♚`;
    } else if (gameState.stalemate) {
      statusText = "🤝 Stalemate - It's a draw! 🤝";
    }
  } else if (gameState.check) {
    statusText = currentPlayerTurn ? "⚠️ You're in check! Your move." : "⚠️ Check! Opponent's move.";
  } else {
    statusText = currentPlayerTurn ? "♟️ Your turn!" : "⏳ Opponent's turn...";
  }
  
  const whitePlayerName = state.players.find(p => p.id === gameState.whitePlayer)?.name || 'White';
  const blackPlayerName = state.players.find(p => p.id === gameState.blackPlayer)?.name || 'Black';
  
  elements.gameContent.innerHTML = `
    <div class="chess-container">
      <div class="chess-status" id="chessStatus">${statusText}</div>
      <div class="chess-players">
        <div class="chess-player ${gameState.currentTurn === 'black' ? 'active' : ''} ${isFlipped ? 'bottom' : 'top'}">
          <span class="player-color black-indicator">●</span>
          <span>${escapeHtml(blackPlayerName)}</span>
          <div class="captured-pieces" id="capturedByBlack">${renderCapturedPieces(gameState.capturedPieces.black)}</div>
        </div>
      </div>
      <div class="chess-board-wrapper">
        <div class="chess-board ${isFlipped ? 'flipped' : ''}" id="chessBoard">
          ${renderChessSquares(gameState.board, isFlipped, gameState.lastMove)}
        </div>
        <div class="chess-coordinates">
          <div class="files">${(isFlipped ? 'hgfedcba' : 'abcdefgh').split('').map(f => `<span>${f}</span>`).join('')}</div>
          <div class="ranks">${(isFlipped ? '12345678' : '87654321').split('').map(r => `<span>${r}</span>`).join('')}</div>
        </div>
      </div>
      <div class="chess-players">
        <div class="chess-player ${gameState.currentTurn === 'white' ? 'active' : ''} ${isFlipped ? 'top' : 'bottom'}">
          <span class="player-color white-indicator">○</span>
          <span>${escapeHtml(whitePlayerName)}</span>
          <div class="captured-pieces" id="capturedByWhite">${renderCapturedPieces(gameState.capturedPieces.white)}</div>
        </div>
      </div>
      ${gameState.gameOver ? `
        <div class="chess-game-over-actions">
          <button class="btn btn-primary chess-rematch-btn" id="chessRematchBtn">🔄 Play Again</button>
          <button class="btn btn-secondary chess-lobby-btn" id="chessLobbyBtn">🏠 Back to Lobby</button>
        </div>
      ` : ''}
    </div>
  `;
  
  attachChessEventListeners(gameState);
  
  if (gameState.gameOver) {
    document.getElementById('chessRematchBtn')?.addEventListener('click', () => {
      socket.emit('gameRematch');
    });
    document.getElementById('chessLobbyBtn')?.addEventListener('click', () => {
      socket.emit('endGame');
    });
  }
}

function renderChessSquares(board, isFlipped, lastMove) {
  let html = '';
  const rows = isFlipped ? [0, 1, 2, 3, 4, 5, 6, 7] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  
  for (let displayRow = 0; displayRow < 8; displayRow++) {
    for (let displayCol = 0; displayCol < 8; displayCol++) {
      const row = isFlipped ? 7 - displayRow : displayRow;
      const col = isFlipped ? 7 - displayCol : displayCol;
      const piece = board[row][col];
      const isLight = (row + col) % 2 === 0;
      const isSelected = chessState.selectedSquare && 
                         chessState.selectedSquare.row === row && 
                         chessState.selectedSquare.col === col;
      const isValidMove = chessState.validMoves.some(m => m.row === row && m.col === col);
      const isLastMove = lastMove && 
                         ((lastMove.from.row === row && lastMove.from.col === col) ||
                          (lastMove.to.row === row && lastMove.to.col === col));
      
      const pieceHtml = piece ? `<span class="chess-piece ${piece === piece.toUpperCase() ? 'white-piece' : 'black-piece'}">${CHESS_PIECES[piece]}</span>` : '';
      
      html += `
        <div class="chess-square ${isLight ? 'light' : 'dark'} ${isSelected ? 'selected' : ''} ${isValidMove ? 'valid-move' : ''} ${isLastMove ? 'last-move' : ''}" 
             data-row="${row}" data-col="${col}">
          ${pieceHtml}
          ${isValidMove && piece ? '<div class="capture-indicator"></div>' : ''}
          ${isValidMove && !piece ? '<div class="move-indicator"></div>' : ''}
        </div>
      `;
    }
  }
  return html;
}

function renderCapturedPieces(pieces) {
  return pieces.map(p => `<span class="captured-piece ${p === p.toUpperCase() ? 'white-piece' : 'black-piece'}">${CHESS_PIECES[p]}</span>`).join('');
}

function attachChessEventListeners(gameState) {
  const board = document.getElementById('chessBoard');
  if (!board) return;
  
  // Prevent text selection and context menu on the board
  board.addEventListener('selectstart', (e) => e.preventDefault());
  board.addEventListener('contextmenu', (e) => e.preventDefault());
  
  document.querySelectorAll('.chess-square').forEach(square => {
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);
    
    // Click handler
    square.addEventListener('click', (e) => {
      e.preventDefault();
      handleChessSquareClick(row, col, gameState);
    });
    
    // Touch handlers for mobile drag
    square.addEventListener('touchstart', (e) => {
      handleChessTouchStart(e, row, col, gameState);
    }, { passive: false });
    
    square.addEventListener('touchmove', (e) => {
      handleChessTouchMove(e);
    }, { passive: false });
    
    square.addEventListener('touchend', (e) => {
      handleChessTouchEnd(e, gameState);
    }, { passive: false });
    
    // Mouse drag handlers
    square.addEventListener('mousedown', (e) => {
      handleChessMouseDown(e, row, col, gameState);
    });
  });
  
  // Global mouse handlers for drag
  document.addEventListener('mousemove', handleChessMouseMove);
  document.addEventListener('mouseup', (e) => handleChessMouseUp(e, gameState));
}

function handleChessSquareClick(row, col, gameState) {
  if (gameState.gameOver) return;
  
  const isMyTurn = (gameState.currentTurn === 'white' && gameState.whitePlayer === state.playerId) ||
                   (gameState.currentTurn === 'black' && gameState.blackPlayer === state.playerId);
  if (!isMyTurn) return;
  
  const piece = gameState.board[row][col];
  const isMyPiece = piece && ((gameState.currentTurn === 'white' && piece === piece.toUpperCase()) ||
                              (gameState.currentTurn === 'black' && piece === piece.toLowerCase()));
  
  if (chessState.selectedSquare) {
    // Check if clicking on a valid move destination
    const isValidMove = chessState.validMoves.some(m => m.row === row && m.col === col);
    
    if (isValidMove) {
      // Make the move
      const from = chessState.selectedSquare;
      const to = { row, col };
      
      // Check for pawn promotion
      const movingPiece = gameState.board[from.row][from.col];
      let promotion = null;
      if (movingPiece && movingPiece.toLowerCase() === 'p' && (row === 0 || row === 7)) {
        promotion = 'q'; // Auto-promote to queen for simplicity
      }
      
      socket.emit('chessMove', { from, to, promotion });
      chessState.selectedSquare = null;
      chessState.validMoves = [];
    } else if (isMyPiece) {
      // Select different piece
      chessState.selectedSquare = { row, col };
      chessState.validMoves = getValidMoves(gameState, row, col);
      renderChessBoard(gameState);
    } else {
      // Deselect
      chessState.selectedSquare = null;
      chessState.validMoves = [];
      renderChessBoard(gameState);
    }
  } else if (isMyPiece) {
    // Select piece
    chessState.selectedSquare = { row, col };
    chessState.validMoves = getValidMoves(gameState, row, col);
    renderChessBoard(gameState);
  }
}

function handleChessTouchStart(e, row, col, gameState) {
  e.preventDefault();
  
  if (gameState.gameOver) return;
  
  const isMyTurn = (gameState.currentTurn === 'white' && gameState.whitePlayer === state.playerId) ||
                   (gameState.currentTurn === 'black' && gameState.blackPlayer === state.playerId);
  if (!isMyTurn) return;
  
  const piece = gameState.board[row][col];
  const isMyPiece = piece && ((gameState.currentTurn === 'white' && piece === piece.toUpperCase()) ||
                              (gameState.currentTurn === 'black' && piece === piece.toLowerCase()));
  
  if (isMyPiece) {
    chessState.selectedSquare = { row, col };
    chessState.validMoves = getValidMoves(gameState, row, col);
    chessState.isDragging = true;
    chessState.dragPiece = piece;
    
    // Create drag element
    const touch = e.touches[0];
    createDragElement(piece, touch.clientX, touch.clientY);
    
    renderChessBoard(gameState);
  } else if (chessState.selectedSquare) {
    handleChessSquareClick(row, col, gameState);
  }
}

function handleChessTouchMove(e) {
  if (!chessState.isDragging || !chessState.dragElement) return;
  e.preventDefault();
  
  const touch = e.touches[0];
  chessState.dragElement.style.left = (touch.clientX - 30) + 'px';
  chessState.dragElement.style.top = (touch.clientY - 30) + 'px';
}

function handleChessTouchEnd(e, gameState) {
  if (!chessState.isDragging) return;
  e.preventDefault();
  
  const touch = e.changedTouches[0];
  const targetSquare = getSquareFromPoint(touch.clientX, touch.clientY);
  
  if (targetSquare && chessState.selectedSquare) {
    const isValidMove = chessState.validMoves.some(m => m.row === targetSquare.row && m.col === targetSquare.col);
    
    if (isValidMove) {
      const from = chessState.selectedSquare;
      const to = targetSquare;
      
      const movingPiece = gameState.board[from.row][from.col];
      let promotion = null;
      if (movingPiece && movingPiece.toLowerCase() === 'p' && (to.row === 0 || to.row === 7)) {
        promotion = 'q';
      }
      
      socket.emit('chessMove', { from, to, promotion });
    }
  }
  
  removeDragElement();
  chessState.isDragging = false;
  chessState.dragPiece = null;
  chessState.selectedSquare = null;
  chessState.validMoves = [];
  renderChessBoard(gameState);
}

function handleChessMouseDown(e, row, col, gameState) {
  if (e.button !== 0) return; // Left click only
  
  if (gameState.gameOver) return;
  
  const isMyTurn = (gameState.currentTurn === 'white' && gameState.whitePlayer === state.playerId) ||
                   (gameState.currentTurn === 'black' && gameState.blackPlayer === state.playerId);
  if (!isMyTurn) return;
  
  const piece = gameState.board[row][col];
  const isMyPiece = piece && ((gameState.currentTurn === 'white' && piece === piece.toUpperCase()) ||
                              (gameState.currentTurn === 'black' && piece === piece.toLowerCase()));
  
  if (isMyPiece) {
    chessState.selectedSquare = { row, col };
    chessState.validMoves = getValidMoves(gameState, row, col);
    chessState.isDragging = true;
    chessState.dragPiece = piece;
    
    createDragElement(piece, e.clientX, e.clientY);
    renderChessBoard(gameState);
  }
}

function handleChessMouseMove(e) {
  if (!chessState.isDragging || !chessState.dragElement) return;
  
  chessState.dragElement.style.left = (e.clientX - 30) + 'px';
  chessState.dragElement.style.top = (e.clientY - 30) + 'px';
}

function handleChessMouseUp(e, gameState) {
  if (!chessState.isDragging) return;
  
  const targetSquare = getSquareFromPoint(e.clientX, e.clientY);
  
  if (targetSquare && chessState.selectedSquare) {
    const isValidMove = chessState.validMoves.some(m => m.row === targetSquare.row && m.col === targetSquare.col);
    
    if (isValidMove && (targetSquare.row !== chessState.selectedSquare.row || targetSquare.col !== chessState.selectedSquare.col)) {
      const from = chessState.selectedSquare;
      const to = targetSquare;
      
      const movingPiece = state.gameState.board[from.row][from.col];
      let promotion = null;
      if (movingPiece && movingPiece.toLowerCase() === 'p' && (to.row === 0 || to.row === 7)) {
        promotion = 'q';
      }
      
      socket.emit('chessMove', { from, to, promotion });
      
      removeDragElement();
      chessState.isDragging = false;
      chessState.dragPiece = null;
      chessState.selectedSquare = null;
      chessState.validMoves = [];
      return;
    }
  }
  
  removeDragElement();
  chessState.isDragging = false;
  chessState.dragPiece = null;
}

function createDragElement(piece, x, y) {
  removeDragElement();
  
  const el = document.createElement('div');
  el.className = 'chess-drag-piece';
  el.innerHTML = `<span class="chess-piece ${piece === piece.toUpperCase() ? 'white-piece' : 'black-piece'}">${CHESS_PIECES[piece]}</span>`;
  el.style.left = (x - 30) + 'px';
  el.style.top = (y - 30) + 'px';
  document.body.appendChild(el);
  chessState.dragElement = el;
}

function removeDragElement() {
  if (chessState.dragElement) {
    chessState.dragElement.remove();
    chessState.dragElement = null;
  }
}

function getSquareFromPoint(x, y) {
  const board = document.getElementById('chessBoard');
  if (!board) return null;
  
  const squares = document.querySelectorAll('.chess-square');
  for (const square of squares) {
    const rect = square.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return {
        row: parseInt(square.dataset.row),
        col: parseInt(square.dataset.col)
      };
    }
  }
  return null;
}

function getValidMoves(gameState, row, col) {
  const piece = gameState.board[row][col];
  if (!piece) return [];
  
  const moves = [];
  const isWhite = piece === piece.toUpperCase();
  
  // Generate all potential moves and filter
  for (let toRow = 0; toRow < 8; toRow++) {
    for (let toCol = 0; toCol < 8; toCol++) {
      if (row === toRow && col === toCol) continue;
      
      const targetPiece = gameState.board[toRow][toCol];
      if (targetPiece) {
        const targetIsWhite = targetPiece === targetPiece.toUpperCase();
        if (isWhite === targetIsWhite) continue; // Can't capture own piece
      }
      
      if (isValidMoveClient(gameState, row, col, toRow, toCol, piece)) {
        // Simulate move to check if it leaves king in check
        const testBoard = gameState.board.map(r => [...r]);
        testBoard[toRow][toCol] = piece;
        testBoard[row][col] = null;
        
        if (!isKingInCheckClient(testBoard, isWhite ? 'white' : 'black')) {
          moves.push({ row: toRow, col: toCol });
        }
      }
    }
  }
  
  return moves;
}

function isValidMoveClient(gameState, fromRow, fromCol, toRow, toCol, piece) {
  const isWhite = piece === piece.toUpperCase();
  const rowDiff = toRow - fromRow;
  const colDiff = toCol - fromCol;
  const absRowDiff = Math.abs(rowDiff);
  const absColDiff = Math.abs(colDiff);
  const board = gameState.board;
  
  switch (piece.toLowerCase()) {
    case 'p':
      const direction = isWhite ? -1 : 1;
      const startRow = isWhite ? 6 : 1;
      const targetPiece = board[toRow][toCol];
      
      if (colDiff === 0 && !targetPiece) {
        if (rowDiff === direction) return true;
        if (fromRow === startRow && rowDiff === 2 * direction && !board[fromRow + direction][fromCol]) return true;
      }
      if (absColDiff === 1 && rowDiff === direction) {
        if (targetPiece) return true;
        // En passant
        if (gameState.enPassantTarget && toRow === gameState.enPassantTarget.row && toCol === gameState.enPassantTarget.col) return true;
      }
      return false;
      
    case 'r':
      if (rowDiff !== 0 && colDiff !== 0) return false;
      return isPathClearClient(board, fromRow, fromCol, toRow, toCol);
      
    case 'n':
      return (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2);
      
    case 'b':
      if (absRowDiff !== absColDiff) return false;
      return isPathClearClient(board, fromRow, fromCol, toRow, toCol);
      
    case 'q':
      if (rowDiff !== 0 && colDiff !== 0 && absRowDiff !== absColDiff) return false;
      return isPathClearClient(board, fromRow, fromCol, toRow, toCol);
      
    case 'k':
      // Castling
      if (absRowDiff === 0 && absColDiff === 2) {
        const canCastle = gameState.canCastle;
        const kingMoved = isWhite ? !canCastle.whiteKing : !canCastle.blackKing;
        if (kingMoved) return false;
        
        const isKingside = toCol > fromCol;
        const rookCol = isKingside ? 7 : 0;
        const rook = board[fromRow][rookCol];
        if (!rook || rook.toLowerCase() !== 'r') return false;
        
        if (isKingside) {
          if (isWhite && !canCastle.whiteKingside) return false;
          if (!isWhite && !canCastle.blackKingside) return false;
        } else {
          if (isWhite && !canCastle.whiteQueenside) return false;
          if (!isWhite && !canCastle.blackQueenside) return false;
        }
        
        const pathCols = isKingside ? [5, 6] : [1, 2, 3];
        for (const col of pathCols) {
          if (board[fromRow][col]) return false;
        }
        return true;
      }
      return absRowDiff <= 1 && absColDiff <= 1;
  }
  return false;
}

function isPathClearClient(board, fromRow, fromCol, toRow, toCol) {
  const rowDir = Math.sign(toRow - fromRow);
  const colDir = Math.sign(toCol - fromCol);
  let row = fromRow + rowDir;
  let col = fromCol + colDir;
  
  while (row !== toRow || col !== toCol) {
    if (board[row][col]) return false;
    row += rowDir;
    col += colDir;
  }
  return true;
}

function isKingInCheckClient(board, turn) {
  const isWhite = turn === 'white';
  const king = isWhite ? 'K' : 'k';
  let kingRow, kingCol;
  
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === king) {
        kingRow = r;
        kingCol = c;
        break;
      }
    }
  }
  
  if (kingRow === undefined) return false;
  
  // Check if any opponent piece can attack the king
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const pieceIsWhite = piece === piece.toUpperCase();
      if (pieceIsWhite === isWhite) continue;
      
      if (canAttackSquare(board, r, c, kingRow, kingCol, piece)) {
        return true;
      }
    }
  }
  return false;
}

function canAttackSquare(board, fromRow, fromCol, toRow, toCol, piece) {
  const rowDiff = toRow - fromRow;
  const colDiff = toCol - fromCol;
  const absRowDiff = Math.abs(rowDiff);
  const absColDiff = Math.abs(colDiff);
  const isWhite = piece === piece.toUpperCase();
  
  switch (piece.toLowerCase()) {
    case 'p':
      const direction = isWhite ? -1 : 1;
      return absColDiff === 1 && rowDiff === direction;
    case 'r':
      if (rowDiff !== 0 && colDiff !== 0) return false;
      return isPathClearClient(board, fromRow, fromCol, toRow, toCol);
    case 'n':
      return (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2);
    case 'b':
      if (absRowDiff !== absColDiff) return false;
      return isPathClearClient(board, fromRow, fromCol, toRow, toCol);
    case 'q':
      if (rowDiff !== 0 && colDiff !== 0 && absRowDiff !== absColDiff) return false;
      return isPathClearClient(board, fromRow, fromCol, toRow, toCol);
    case 'k':
      return absRowDiff <= 1 && absColDiff <= 1;
  }
  return false;
}

function updateChessGame(data) {
  state.gameState = { ...state.gameState, ...data };
  renderChessBoard(state.gameState);
  
  if (data.players) {
    updateScoreBoard(data.players, data.currentTurn === 'white' ? state.gameState.whitePlayer : state.gameState.blackPlayer);
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
  const isLastRound = data.round >= 10;
  
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
      ${isLastRound ? `
        <div class="game-over-actions" style="margin-top: 20px;">
          <button class="btn btn-primary game-rematch-btn">🔄 Play Again</button>
          <button class="btn btn-secondary game-lobby-btn">🏠 Back to Lobby</button>
        </div>
      ` : ''}
    </div>
  `;
  
  updateScoreBoard(data.players);
  
  if (isLastRound) {
    document.querySelector('.game-rematch-btn')?.addEventListener('click', () => socket.emit('gameRematch'));
    document.querySelector('.game-lobby-btn')?.addEventListener('click', () => socket.emit('endGame'));
  }
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
});

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
    case 'drawing':
      initDrawingGame(data.gameState, data.players);
      break;
    case 'psychic':
      initPsychicGame(data.gameState, data.players);
      break;
    case 'chess':
      initChessGame(data.gameState, data.players);
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

// Drawing
socket.on('drawingData', handleDrawingData);
socket.on('correctGuess', handleCorrectGuess);
socket.on('newDrawingRound', handleNewDrawingRound);

// Psychic
socket.on('playerChose', handlePlayerChose);
socket.on('psychicResults', handlePsychicResults);
socket.on('nextPsychicRound', handleNextPsychicRound);

// Chess
socket.on('chessUpdate', updateChessGame);

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
      <button class="btn btn-primary results-rematch-btn">🔄 Play Again</button>
    </div>
  `;
  elements.resultsModal.classList.add('active');
  state.players = data.players;
  
  // Add play again button handler
  const rematchBtn = elements.resultsContent.querySelector('.results-rematch-btn');
  if (rematchBtn) {
    rematchBtn.addEventListener('click', () => {
      elements.resultsModal.classList.remove('active');
      socket.emit('gameRematch');
    });
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

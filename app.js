// ============================================
// UPSIDE DOWN NEVERMORE GAMES
// Client-side game logic
// ============================================

// ============================================
// 🔧 BACKEND SERVER URL 🔧
// ============================================
// Railway backend
// ============================================
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? window.location.origin  // Local development
  : 'https://wednesday-addams-production.up.railway.app';

console.log('🔌 Connecting to backend:', BACKEND_URL);

const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling']
});

// DOM Elements
const screens = {
  authScreen: document.getElementById('authScreen'),
  mainMenu: document.getElementById('mainMenu'),
  lobby: document.getElementById('lobby'),
  gameScreen: document.getElementById('gameScreen'),
  leaderboardScreen: document.getElementById('leaderboardScreen')
};

const elements = {
  // Auth screen
  authTabs: document.querySelectorAll('.auth-tab'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  loginUsername: document.getElementById('loginUsername'),
  loginPassword: document.getElementById('loginPassword'),
  loginBtn: document.getElementById('loginBtn'),
  registerUsername: document.getElementById('registerUsername'),
  registerPassword: document.getElementById('registerPassword'),
  registerDisplayName: document.getElementById('registerDisplayName'),
  registerBtn: document.getElementById('registerBtn'),
  guestBtn: document.getElementById('guestBtn'),
  
  // Main menu
  playerName: document.getElementById('playerName'),
  createRoomBtn: document.getElementById('createRoomBtn'),
  roomCode: document.getElementById('roomCode'),
  joinRoomBtn: document.getElementById('joinRoomBtn'),
  userInfoDisplay: document.getElementById('userInfoDisplay'),
  leaderboardBtn: document.getElementById('leaderboardBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  
  // Lobby
  displayRoomCode: document.getElementById('displayRoomCode'),
  copyCodeBtn: document.getElementById('copyCodeBtn'),
  playersList: document.getElementById('playersList'),
  chatMessages: document.getElementById('chatMessages'),
  chatInput: document.getElementById('chatInput'),
  sendChatBtn: document.getElementById('sendChatBtn'),
  gameSelection: document.getElementById('gameSelection'),
  leaveRoomBtn: document.getElementById('leaveRoomBtn'),
  startVotingBtn: document.getElementById('startVotingBtn'),
  
  // Game screen
  gameTitle: document.getElementById('gameTitle'),
  scoreBoard: document.getElementById('scoreBoard'),
  gameContent: document.getElementById('gameContent'),
  backToLobbyBtn: document.getElementById('backToLobbyBtn'),
  gameChatMessages: document.getElementById('gameChatMessages'),
  gameChatInput: document.getElementById('gameChatInput'),
  sendGameChatBtn: document.getElementById('sendGameChatBtn'),
  
  // Leaderboard
  leaderboardList: document.getElementById('leaderboardList'),
  backFromLeaderboardBtn: document.getElementById('backFromLeaderboardBtn'),
  
  // Modal
  resultsModal: document.getElementById('resultsModal'),
  resultsTitle: document.getElementById('resultsTitle'),
  resultsContent: document.getElementById('resultsContent'),
  closeResultsBtn: document.getElementById('closeResultsBtn'),
  votingModal: document.getElementById('votingModal'),
  votingContent: document.getElementById('votingContent'),
  
  // Toast
  errorToast: document.getElementById('errorToast')
};

// State
let state = {
  playerId: null,
  playerName: '',
  roomId: null,
  isAuthenticated: false,
  username: null,
  userStats: null,
  players: [],
  currentGame: null,
  gameState: {},
  votingActive: false,
  // Nested matches state
  currentMatchId: null,
  spectatingMatchId: null,
  activeMatches: [],
  pendingChallenge: null
};

// 2-player games that support nested matches
const TWO_PLAYER_GAMES = ['tictactoe', 'chess', 'connect4'];

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
  setupAuthListeners();
  setupFullscreenToggle();
  setupMobileChatOverlay();
  setupScoreToggle();
  
  // Restore saved player name for both guests and registered users
  const savedPlayerName = localStorage.getItem('playerName');
  if (savedPlayerName && elements.playerName) {
    elements.playerName.value = savedPlayerName;
  }
  
  // Restore last used room code if any
  const savedRoomCode = localStorage.getItem('lastRoomCode');
  if (savedRoomCode && elements.roomCode) {
    elements.roomCode.value = savedRoomCode;
  }
  
  // Check for saved session and attempt auto-login
  const savedAuth = localStorage.getItem('authSession');
  const savedGuestSession = localStorage.getItem('guestSession');
  
  if (savedAuth) {
    // Show auth screen while attempting login
    showScreen('authScreen');
    try {
      const auth = JSON.parse(savedAuth);
      if (auth.username && auth.password) {
        // Show loading state
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
          loginBtn.textContent = '⏳ Logging in...';
          loginBtn.disabled = true;
        }
        // Pre-fill the username only (not password for security)
        const loginUsername = document.getElementById('loginUsername');
        const loginPassword = document.getElementById('loginPassword');
        if (loginUsername) loginUsername.value = auth.username;
        // Don't pre-fill password with dots - it causes issues if auto-login fails
        // The actual login uses saved credentials from localStorage
        if (loginPassword) loginPassword.placeholder = 'Auto-logging in...';
        
        // Attempt auto-login
        socket.emit('login', auth);
      }
    } catch (e) {
      console.error('Failed to parse saved auth:', e);
      localStorage.removeItem('authSession');
      showScreen('authScreen');
    }
  } else if (savedGuestSession === 'true') {
    // Restore guest session - skip auth screen
    state.isAuthenticated = false;
    state.username = null;
    state.userStats = null;
    showScreen('mainMenu');
    updateUserInfoDisplay();
  } else {
    // No saved session - show auth screen
    showScreen('authScreen');
  }
});

// ============================================
// AUTHENTICATION (The Nevermore Archives)
// ============================================

function setupAuthListeners() {
  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const formType = tab.dataset.tab;
      document.getElementById('loginForm').style.display = formType === 'login' ? 'block' : 'none';
      document.getElementById('registerForm').style.display = formType === 'register' ? 'block' : 'none';
    });
  });
  
  // Login
  document.getElementById('loginBtn')?.addEventListener('click', () => {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
      showError('Enter username and password');
      return;
    }
    
    socket.emit('login', { username, password });
  });
  
  // Register
  document.getElementById('registerBtn')?.addEventListener('click', () => {
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const displayName = document.getElementById('registerDisplayName').value.trim();
    
    if (!username || !password) {
      showError('Enter username and password');
      return;
    }
    
    socket.emit('register', { username, password, displayName: displayName || username });
  });
  
  // Guest mode
  document.getElementById('guestBtn')?.addEventListener('click', () => {
    state.isAuthenticated = false;
    state.username = null;
    state.userStats = null;
    // Save guest session preference so user can skip auth screen next time
    localStorage.setItem('guestSession', 'true');
    showScreen('mainMenu');
    updateUserInfoDisplay();
  });
  
  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    socket.emit('logout');
    localStorage.removeItem('authSession');
    localStorage.removeItem('guestSession');
    state.isAuthenticated = false;
    state.username = null;
    state.userStats = null;
    showScreen('authScreen');
  });
  
  // Leaderboard
  document.getElementById('leaderboardBtn')?.addEventListener('click', () => {
    socket.emit('getLeaderboard');
    showScreen('leaderboardScreen');
  });
  
  document.getElementById('backFromLeaderboardBtn')?.addEventListener('click', () => {
    showScreen('mainMenu');
  });
  
  // Enter key for forms
  document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('loginBtn')?.click();
  });
  document.getElementById('registerDisplayName')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('registerBtn')?.click();
  });
}

function updateUserInfoDisplay() {
  const container = document.getElementById('userInfoDisplay');
  if (!container) return;
  
  if (state.isAuthenticated && state.userStats) {
    container.innerHTML = `
      <div class="user-info-card">
        <div class="user-title">${state.userStats.title}</div>
        <div class="user-name">${escapeHtml(state.userStats.displayName)}</div>
        <div class="user-stats">
          <span>🏆 ${state.userStats.trophies} Trophies</span>
          <span>⭐ ${state.userStats.totalWins} Wins</span>
          <span>🎮 ${state.userStats.gamesPlayed} Games</span>
        </div>
      </div>
    `;
    container.style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'inline-block';
  } else {
    container.innerHTML = `
      <div class="user-info-card guest">
        <div class="user-title">👻 Guest Mode</div>
        <div class="user-name">Playing without account</div>
        <div class="user-stats">
          <span>Stats won't be saved</span>
        </div>
        <button id="exitGuestBtn" class="btn btn-small btn-secondary" style="margin-top: 10px;">
          🚪 Exit Guest Mode
        </button>
      </div>
    `;
    container.style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'none';
    
    // Add exit guest mode handler
    document.getElementById('exitGuestBtn')?.addEventListener('click', () => {
      localStorage.removeItem('guestSession');
      localStorage.removeItem('playerName');
      state.isAuthenticated = false;
      state.username = null;
      state.userStats = null;
      showScreen('authScreen');
    });
  }
}

// Auth socket events
socket.on('authSuccess', (data) => {
  state.isAuthenticated = true;
  state.username = data.username;
  state.userStats = data;
  
  // Save session (for auto-login)
  const loginUsername = document.getElementById('loginUsername')?.value.trim();
  const loginPassword = document.getElementById('loginPassword')?.value;
  if (loginUsername && loginPassword) {
    localStorage.setItem('authSession', JSON.stringify({ 
      username: loginUsername, 
      password: loginPassword 
    }));
  }
  
  // Use display name for player name
  if (elements.playerName) {
    elements.playerName.value = data.displayName;
  }
  
  showScreen('mainMenu');
  updateUserInfoDisplay();
  showNotification(`Welcome back, ${data.displayName}! ${data.title}`, 'success');
});

socket.on('authError', (data) => {
  showError(data.message);
  
  // Reset login button state
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.innerHTML = '<span class="btn-icon">⚡</span> Enter the Archives';
    loginBtn.disabled = false;
  }
  
  // Clear password field and reset placeholder
  const loginPassword = document.getElementById('loginPassword');
  if (loginPassword) {
    loginPassword.value = '';
    loginPassword.placeholder = 'Password';
  }
  
  // Clear invalid saved session
  if (data.message.includes('not found') || data.message.includes('Incorrect')) {
    localStorage.removeItem('authSession');
  }
  
  // Make sure auth screen is visible
  showScreen('authScreen');
});

socket.on('loggedOut', () => {
  state.isAuthenticated = false;
  state.username = null;
  state.userStats = null;
  showScreen('authScreen');
});

socket.on('leaderboardData', (data) => {
  renderLeaderboard(data);
});

function renderLeaderboard(players) {
  const container = document.getElementById('leaderboardList');
  if (!container) return;
  
  if (players.length === 0) {
    container.innerHTML = '<div class="empty-leaderboard">No rankings yet. Be the first to earn trophies!</div>';
    return;
  }
  
  container.innerHTML = players.map((p, i) => `
    <div class="leaderboard-item ${i < 3 ? 'top-' + (i + 1) : ''} ${p.username === state.username ? 'is-me' : ''}">
      <div class="rank">${i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1)}</div>
      <div class="player-info">
        <div class="player-name">${escapeHtml(p.displayName)}</div>
        <div class="player-title">${p.title}</div>
      </div>
      <div class="player-stats">
        <span class="trophies">🏆 ${p.trophies}</span>
        <span class="wins">⭐ ${p.totalWins}</span>
        <span class="games">🎮 ${p.gamesPlayed}</span>
      </div>
    </div>
  `).join('');
}

// ============================================
// FULLSCREEN TOGGLE
// ============================================

function setupFullscreenToggle() {
  const toggleBtn = document.getElementById('fullscreenToggle');
  const icon = document.getElementById('fullscreenIcon');
  
  if (!toggleBtn) return;
  
  // Update button state based on fullscreen status
  function updateFullscreenButton() {
    const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    toggleBtn.classList.toggle('is-fullscreen', isFullscreen);
    icon.textContent = isFullscreen ? '⛶' : '⛶';
    toggleBtn.title = isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen';
  }
  
  // Toggle fullscreen
  toggleBtn.addEventListener('click', async () => {
    try {
      const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
      
      if (!isFullscreen) {
        // Enter fullscreen
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
          await elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (err) {
      console.log('Fullscreen error:', err);
      // Fallback: Show message that fullscreen is not supported
      showError('Fullscreen not supported on this device. Try "Add to Home Screen" for full app experience.');
    }
  });
  
  // Listen for fullscreen changes
  document.addEventListener('fullscreenchange', updateFullscreenButton);
  document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
  document.addEventListener('mozfullscreenchange', updateFullscreenButton);
  document.addEventListener('MSFullscreenChange', updateFullscreenButton);
  
  // Initial state
  updateFullscreenButton();
}

// Setup mobile chat overlay
function setupMobileChatOverlay() {
  const chatToggleBtn = document.getElementById('chatToggleBtn');
  const chatOverlay = document.getElementById('gameChatOverlay');
  const closeChatBtn = document.getElementById('closeChatOverlay');
  const mobileChatInput = document.getElementById('mobileChatInput');
  const sendMobileChatBtn = document.getElementById('sendMobileChatBtn');
  const mobileChatMessages = document.getElementById('mobileChatMessages');
  
  if (!chatToggleBtn || !chatOverlay) return;
  
  // Toggle chat overlay
  chatToggleBtn.addEventListener('click', () => {
    chatOverlay.classList.add('active');
    // Sync messages from main chat
    syncMobileChat();
  });
  
  // Close chat overlay
  closeChatBtn?.addEventListener('click', () => {
    chatOverlay.classList.remove('active');
  });
  
  // Send message from mobile chat
  function sendMobileChat() {
    const message = mobileChatInput.value.trim();
    if (!message) return;
    
    socket.emit('chatMessage', message);
    mobileChatInput.value = '';
  }
  
  sendMobileChatBtn?.addEventListener('click', sendMobileChat);
  mobileChatInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMobileChat();
  });
  
  // Sync mobile chat with main chat
  window.syncMobileChat = function() {
    if (!mobileChatMessages || !elements.gameChatMessages) return;
    mobileChatMessages.innerHTML = elements.gameChatMessages.innerHTML;
    mobileChatMessages.scrollTop = mobileChatMessages.scrollHeight;
  };
  
  // Show/hide chat toggle button based on screen
  window.updateChatToggleVisibility = function() {
    const isGameScreen = screens.gameScreen?.classList.contains('active');
    chatToggleBtn.style.display = isGameScreen && window.innerWidth <= 768 ? 'flex' : 'none';
    if (!isGameScreen) {
      chatOverlay.classList.remove('active');
    }
  };
}

// Setup collapsible score bar for mobile
function setupScoreToggle() {
  const toggleBtn = document.getElementById('toggleScoreBtn');
  const scoreBoard = document.getElementById('scoreBoard');
  
  if (!toggleBtn || !scoreBoard) return;
  
  toggleBtn.addEventListener('click', () => {
    scoreBoard.classList.toggle('expanded');
    toggleBtn.textContent = scoreBoard.classList.contains('expanded') ? '✕' : '📊';
  });
  
  // Close score board when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.game-title-bar') && scoreBoard.classList.contains('expanded')) {
      scoreBoard.classList.remove('expanded');
      toggleBtn.textContent = '📊';
    }
  });
}

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
  
  // Start voting button
  document.getElementById('startVotingBtn')?.addEventListener('click', () => {
    socket.emit('startVoting');
  });
  
  // Game selection - use event delegation for voting
  elements.gameSelection.addEventListener('click', (e) => {
    const card = e.target.closest('.game-card');
    if (card && card.dataset.game) {
      if (state.votingActive) {
        // Cast vote during voting phase
        handleVote(card.dataset.game);
      } else {
        // Legacy: direct selection (backward compatible)
        handleGameSelection(card.dataset.game);
      }
    }
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
// GAME VOTING (The Séance Circle)
// ============================================

function handleVote(gameType) {
  // Show vote confirmation
  const card = document.querySelector(`.game-card[data-game="${gameType}"]`);
  if (card) {
    document.querySelectorAll('.game-card').forEach(c => c.classList.remove('voted'));
    card.classList.add('voted');
  }
  
  // Check for games that need difficulty/mode selection
  if (gameType === 'memory') {
    showMemoryVoteOptions(gameType);
  } else if (gameType === 'sudoku') {
    showSudokuVoteOptions(gameType);
  } else if (gameType === 'connect4') {
    showConnect4VoteOptions(gameType);
  } else {
    socket.emit('voteGame', { gameType });
    showNotification(`Voted for ${getGameName(gameType)}! 🗳️`, 'info');
  }
}

function showConnect4VoteOptions(gameType) {
  const modal = document.getElementById('votingModal');
  if (!modal) {
    socket.emit('voteGame', { gameType, options: { winCondition: 4 } });
    return;
  }
  
  modal.innerHTML = `
    <div class="voting-modal-content">
      <h3>🔴🟡 Connect Game Mode</h3>
      <div class="difficulty-options">
        <button class="difficulty-btn" data-win="4">
          <span class="diff-icon">4️⃣</span>
          <div>
            <span class="diff-name">4 in a Row</span>
            <span class="diff-desc">Classic mode - connect 4 to win</span>
          </div>
        </button>
        <button class="difficulty-btn" data-win="5">
          <span class="diff-icon">5️⃣</span>
          <div>
            <span class="diff-name">5 in a Row</span>
            <span class="diff-desc">Challenge mode - connect 5 to win</span>
          </div>
        </button>
      </div>
    </div>
  `;
  modal.classList.add('active');
  
  modal.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const winCondition = parseInt(btn.dataset.win);
      socket.emit('voteGame', { gameType, options: { winCondition } });
      modal.classList.remove('active');
      showNotification(`Voted for ${winCondition} in a Row! 🗳️`, 'info');
    });
  });
}

function showMemoryVoteOptions(gameType) {
  const modal = document.getElementById('votingModal');
  if (!modal) {
    socket.emit('voteGame', { gameType, options: { difficulty: 'medium' } });
    return;
  }
  
  modal.innerHTML = `
    <div class="voting-modal-content">
      <h3>🧠 Memory Difficulty</h3>
      <div class="difficulty-options">
        <button class="difficulty-btn" data-difficulty="easy">Easy (8 pairs)</button>
        <button class="difficulty-btn" data-difficulty="medium">Medium (12 pairs)</button>
        <button class="difficulty-btn" data-difficulty="hard">Hard (18 pairs)</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
  
  modal.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      socket.emit('voteGame', { gameType, options: { difficulty: btn.dataset.difficulty } });
      modal.classList.remove('active');
      showNotification(`Voted for Memory (${btn.dataset.difficulty})! 🗳️`, 'info');
    });
  });
}

function showSudokuVoteOptions(gameType) {
  const modal = document.getElementById('votingModal');
  if (!modal) {
    socket.emit('voteGame', { gameType, options: { difficulty: 'medium' } });
    return;
  }
  
  modal.innerHTML = `
    <div class="voting-modal-content">
      <h3>🔢 Sudoku Difficulty</h3>
      <div class="difficulty-options">
        <button class="difficulty-btn" data-difficulty="easy">Easy</button>
        <button class="difficulty-btn" data-difficulty="medium">Medium</button>
        <button class="difficulty-btn" data-difficulty="hard">Hard</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
  
  modal.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      socket.emit('voteGame', { gameType, options: { difficulty: btn.dataset.difficulty } });
      modal.classList.remove('active');
      showNotification(`Voted for Sudoku (${btn.dataset.difficulty})! 🗳️`, 'info');
    });
  });
}

function getGameName(gameType) {
  const names = {
    tictactoe: 'Tic Tac Toe',
    memory: 'Memory Match',
    trivia: 'Trivia',
    chess: "Vecna's Chess",
    psychic: 'Psychic Showdown',
    sudoku: 'Sudoku',
    connect4: 'Connect 4',
    molewhack: 'Whack-a-Mole',
    mathquiz: 'Math Quiz',
    ludo: 'Ludo'
  };
  return names[gameType] || gameType;
}

// Socket events for voting
socket.on('votingStarted', (data) => {
  state.votingActive = true;
  state.players = data.players;
  updatePlayersList(data.players);
  updateVoteDisplay(data.voteCounts);
  showNotification('🗳️ Voting has begun! Choose a game!', 'info');
  
  // Highlight game selection
  document.querySelectorAll('.game-card').forEach(card => {
    card.classList.add('voting-mode');
  });
  
  // Update button
  const startVotingBtn = document.getElementById('startVotingBtn');
  if (startVotingBtn) {
    startVotingBtn.textContent = '⏳ Voting in progress...';
    startVotingBtn.disabled = true;
  }
});

socket.on('voteUpdate', (data) => {
  updateVoteDisplay(data.voteCounts);
  
  // Show progress
  const progress = document.getElementById('voteProgress');
  if (progress) {
    progress.textContent = `${data.voterCount}/${data.totalPlayers} voted`;
  }
});

function updateVoteDisplay(voteCounts) {
  document.querySelectorAll('.game-card').forEach(card => {
    const game = card.dataset.game;
    const count = voteCounts[game] || 0;
    
    let voteIndicator = card.querySelector('.vote-count');
    if (!voteIndicator) {
      voteIndicator = document.createElement('div');
      voteIndicator.className = 'vote-count';
      card.appendChild(voteIndicator);
    }
    
    voteIndicator.textContent = count > 0 ? `🗳️ ${count}` : '';
    voteIndicator.style.display = count > 0 ? 'block' : 'none';
  });
}

// ============================================
// SCREEN MANAGEMENT
// ============================================

function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
  
  // Toggle game mode class (but don't auto-fullscreen - let user control it)
  if (screenName === 'gameScreen') {
    document.body.classList.add('game-fullscreen');
  } else {
    document.body.classList.remove('game-fullscreen');
    // Exit fullscreen when leaving game
    exitGameFullscreen();
  }
  
  // Update mobile chat toggle visibility
  if (typeof updateChatToggleVisibility === 'function') {
    updateChatToggleVisibility();
  }
}

// Enter fullscreen mode for games (mobile-friendly)
function enterGameFullscreen() {
  // Only attempt fullscreen on mobile devices
  const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;
  if (!isMobile) return;
  
  // Don't auto-enter if already in fullscreen
  const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || 
                          document.mozFullScreenElement || document.msFullscreenElement);
  if (isFullscreen) return;
  
  // Try to enter fullscreen
  const elem = document.documentElement;
  try {
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
  } catch (err) {
    // Fullscreen may fail silently on some devices - that's OK
    console.log('Fullscreen not supported or blocked');
  }
}

// Exit fullscreen mode
function exitGameFullscreen() {
  const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || 
                          document.mozFullScreenElement || document.msFullscreenElement);
  if (!isFullscreen) return;
  
  try {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  } catch (err) {
    console.log('Exit fullscreen failed');
  }
}

// Track error toast timeout to prevent stacking
let errorToastTimeout = null;

function showError(message) {
  // Clear any existing timeout
  if (errorToastTimeout) {
    clearTimeout(errorToastTimeout);
  }
  
  // Remove any existing classes first
  elements.errorToast.classList.remove('active', 'hiding');
  
  // Set the message and show
  elements.errorToast.textContent = message;
  
  // Force reflow to restart animation
  void elements.errorToast.offsetWidth;
  
  elements.errorToast.classList.add('active');
  
  // Hide after 4 seconds with fade out
  errorToastTimeout = setTimeout(() => {
    elements.errorToast.classList.add('hiding');
    setTimeout(() => {
      elements.errorToast.classList.remove('active', 'hiding');
      errorToastTimeout = null;
    }, 300);
  }, 4000);
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `<span>${message}</span>`;
  document.body.appendChild(notification);
  
  // Trigger animation
  setTimeout(() => notification.classList.add('active'), 10);
  
  // Remove after delay
  setTimeout(() => {
    notification.classList.remove('active');
    setTimeout(() => notification.remove(), 300);
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
  localStorage.setItem('lastRoomCode', code);
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
  
  // Check if we're in the lobby (not in a match)
  const inLobby = !state.currentMatchId && !state.spectatingMatchId;
  
  elements.playersList.innerHTML = players.map(p => {
    const isMe = p.id === state.playerId;
    const inMatch = p.currentMatchId;
    const isSpectating = p.spectatingMatchId;
    
    // Determine player status
    let statusBadge = '';
    if (inMatch) {
      const match = state.activeMatches.find(m => m.id === p.currentMatchId);
      const gameIcon = match ? getGameIcon(match.gameType) : '🎮';
      statusBadge = `<span class="status-badge playing" title="Playing ${match?.gameType || 'game'}">${gameIcon} Playing</span>`;
    } else if (isSpectating) {
      statusBadge = `<span class="status-badge spectating" title="Spectating">👁️ Watching</span>`;
    }
    
    // Challenge button (only show for other players in lobby)
    let challengeBtn = '';
    if (!isMe && !inMatch && !isSpectating && inLobby && !state.currentMatchId) {
      challengeBtn = `<button class="btn-challenge" data-player-id="${p.id}" data-player-name="${escapeHtml(p.name)}" title="Challenge to a duel">⚔️</button>`;
    }
    
    return `
      <div class="player-item ${isMe ? 'is-me' : ''} ${inMatch ? 'in-match' : ''} ${isSpectating ? 'spectating' : ''}">
        <span class="player-color-indicator" style="background: ${p.color || '#e50914'}"></span>
        <span class="player-name" style="color: ${p.color || '#e50914'}">${escapeHtml(p.name)}</span>
        ${p.username ? `<span class="verified-badge" title="Registered">✓</span>` : ''}
        ${statusBadge}
        <span class="score" title="Trophies this session">🏆 ${p.trophies || 0}</span>
        ${challengeBtn}
      </div>
    `;
  }).join('');
  
  // Add click listeners to challenge buttons
  document.querySelectorAll('.btn-challenge').forEach(btn => {
    btn.addEventListener('click', () => {
      const playerId = btn.dataset.playerId;
      const playerName = btn.dataset.playerName;
      showChallengeModal(playerId, playerName);
    });
  });
}

// Get game icon for display
function getGameIcon(gameType) {
  const icons = {
    'tictactoe': '⭕❌',
    'chess': '♟️',
    'connect4': '🔴',
    'trivia': '🧠',
    'memory': '🃏',
    'psychic': '🔮',
    'sudoku': '🔢',
    'molewhack': '🔨',
    'mathquiz': '➕',
    'ludo': '🎲'
  };
  return icons[gameType] || '🎮';
}

// ============================================
// NESTED MATCHES SYSTEM (Rooms within Rooms)
// ============================================

// Show challenge modal to select a game
function showChallengeModal(targetPlayerId, targetPlayerName) {
  const modal = document.getElementById('votingModal');
  modal.innerHTML = `
    <div class="modal-content challenge-modal">
      <h2>⚔️ Challenge ${escapeHtml(targetPlayerName)}</h2>
      <p class="modal-subtitle">Select a game for your duel:</p>
      <div class="challenge-games-grid">
        <button class="challenge-game-btn" data-game="tictactoe">
          <span class="game-icon">⭕❌</span>
          <span>Tic-Tac-Toe</span>
        </button>
        <button class="challenge-game-btn" data-game="chess">
          <span class="game-icon">♟️</span>
          <span>Chess</span>
        </button>
        <button class="challenge-game-btn" data-game="connect4">
          <span class="game-icon">🔴🟡</span>
          <span>Connect 4</span>
        </button>
      </div>
      <button class="btn btn-secondary modal-close-btn" onclick="closeChallengeModal()">Cancel</button>
    </div>
  `;
  modal.classList.add('active');
  
  // Add click listeners to game buttons
  modal.querySelectorAll('.challenge-game-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const gameType = btn.dataset.game;
      sendChallenge(targetPlayerId, gameType);
      closeChallengeModal();
    });
  });
}

function closeChallengeModal() {
  const modal = document.getElementById('votingModal');
  modal.classList.remove('active');
}

// Send a challenge to another player
function sendChallenge(targetPlayerId, gameType) {
  socket.emit('challengePlayer', {
    targetPlayerId,
    gameType,
    options: {}
  });
  showNotification(`Challenge sent! Waiting for response...`, 'info');
}

// Show incoming challenge notification
function showIncomingChallenge(data) {
  state.pendingChallenge = data;
  
  const modal = document.getElementById('votingModal');
  modal.innerHTML = `
    <div class="modal-content challenge-modal incoming">
      <h2>⚔️ Challenge Received!</h2>
      <p class="challenger-name">${escapeHtml(data.challengerName)} challenges you to:</p>
      <div class="challenge-game-display">
        <span class="game-icon">${getGameIcon(data.gameType)}</span>
        <span class="game-name">${getGameDisplayName(data.gameType)}</span>
      </div>
      <div class="challenge-actions">
        <button class="btn btn-primary" onclick="acceptChallenge('${data.challengeId}')">
          <span class="btn-icon">✓</span> Accept
        </button>
        <button class="btn btn-danger" onclick="declineChallenge('${data.challengeId}')">
          <span class="btn-icon">✕</span> Decline
        </button>
      </div>
    </div>
  `;
  modal.classList.add('active');
}

function acceptChallenge(challengeId) {
  socket.emit('acceptChallenge', { challengeId });
  closeChallengeModal();
  state.pendingChallenge = null;
}

function declineChallenge(challengeId) {
  socket.emit('declineChallenge', { challengeId });
  closeChallengeModal();
  state.pendingChallenge = null;
}

// Get game display name
function getGameDisplayName(gameType) {
  const names = {
    'tictactoe': 'Tic-Tac-Toe',
    'chess': 'Chess',
    'connect4': 'Connect 4',
    'trivia': 'Trivia',
    'memory': 'Memory Match',
    'psychic': 'Psychic Showdown',
    'sudoku': 'Sudoku',
    'molewhack': 'Whack-a-Mole',
    'mathquiz': 'Math Quiz',
    'ludo': 'Ludo'
  };
  return names[gameType] || gameType;
}

// Show active matches panel in lobby
function updateActiveMatchesDisplay() {
  let matchesPanel = document.getElementById('activeMatchesPanel');
  
  if (!matchesPanel) {
    // Create the panel if it doesn't exist
    const lobbyContent = document.querySelector('.lobby-content');
    if (lobbyContent) {
      matchesPanel = document.createElement('div');
      matchesPanel.id = 'activeMatchesPanel';
      matchesPanel.className = 'active-matches-panel';
      lobbyContent.insertBefore(matchesPanel, lobbyContent.firstChild);
    }
  }
  
  if (!matchesPanel) return;
  
  if (state.activeMatches.length === 0) {
    matchesPanel.innerHTML = '';
    matchesPanel.style.display = 'none';
    return;
  }
  
  matchesPanel.style.display = 'block';
  matchesPanel.innerHTML = `
    <h3>🎮 Active Matches</h3>
    <div class="matches-list">
      ${state.activeMatches.map(match => `
        <div class="match-item">
          <span class="match-icon">${getGameIcon(match.gameType)}</span>
          <span class="match-players">${match.playerNames.join(' vs ')}</span>
          <span class="match-spectators">👁️ ${match.spectatorCount}</span>
          ${!state.currentMatchId && !state.spectatingMatchId ? `
            <button class="btn-spectate" data-match-id="${match.id}">Watch</button>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
  
  // Add click listeners to spectate buttons
  matchesPanel.querySelectorAll('.btn-spectate').forEach(btn => {
    btn.addEventListener('click', () => {
      const matchId = btn.dataset.matchId;
      spectateMatch(matchId);
    });
  });
}

function spectateMatch(matchId) {
  socket.emit('spectateMatch', { matchId });
}

function stopSpectating() {
  socket.emit('stopSpectating');
}

// Initialize match game (for nested 2-player games)
function initMatchGame(matchId, gameType, gameState, matchPlayers, isSpectator = false) {
  state.currentMatchId = matchId;
  state.currentGame = gameType;
  state.gameState = gameState;
  
  showScreen('gameScreen');
  
  // Set game title with spectator indicator
  const titleSuffix = isSpectator ? ' (Spectating)' : '';
  elements.gameTitle.textContent = getGameDisplayName(gameType) + titleSuffix;
  
  // Add back/leave button for matches
  const backBtn = document.getElementById('backToLobbyBtn');
  if (isSpectator) {
    backBtn.textContent = '👁️ Stop Watching';
    backBtn.onclick = () => {
      stopSpectating();
    };
  } else {
    backBtn.textContent = '🏳️ Forfeit';
    backBtn.onclick = () => {
      if (confirm('Are you sure you want to forfeit this match?')) {
        socket.emit('leaveMatch', { matchId });
      }
    };
  }
  
  // Initialize the game UI
  switch (gameType) {
    case 'tictactoe':
      initMatchTicTacToe(gameState, matchPlayers, isSpectator);
      break;
    case 'chess':
      initMatchChess(gameState, matchPlayers, isSpectator);
      break;
    case 'connect4':
      initMatchConnect4(gameState, matchPlayers, isSpectator);
      break;
  }
}

// Match-specific game initializers
function initMatchTicTacToe(gameState, players, isSpectator) {
  state.gameState = gameState;
  const symbols = gameState.playerSymbols;
  const mySymbol = symbols instanceof Map ? symbols.get(state.playerId) : symbols[state.playerId];
  const isMyTurn = gameState.currentPlayer === state.playerId && !isSpectator;
  
  elements.gameTitle.textContent = '☠️ Tic-Tac-Toe' + (isSpectator ? ' (Spectating)' : '');
  updateMatchScoreBoard(players);
  
  let html = `<div class="ttt-game">`;
  html += `<div class="turn-indicator">${isMyTurn ? "Your turn!" : (isSpectator ? "Watching..." : "Opponent's turn...")}</div>`;
  html += `<div class="ttt-board">`;
  
  for (let i = 0; i < 9; i++) {
    const cell = gameState.board[i];
    const canClick = !cell && isMyTurn && !isSpectator;
    html += `<div class="ttt-cell ${canClick ? 'clickable' : ''}" data-index="${i}">${cell || ''}</div>`;
  }
  
  html += `</div>`;
  if (mySymbol && !isSpectator) {
    html += `<div class="my-symbol">You are: ${mySymbol}</div>`;
  }
  html += `</div>`;
  
  elements.gameContent.innerHTML = html;
  
  // Add click handlers
  if (!isSpectator) {
    document.querySelectorAll('.ttt-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const index = parseInt(cell.dataset.index);
        if (!gameState.board[index] && gameState.currentPlayer === state.playerId) {
          socket.emit('matchTttMove', { matchId: state.currentMatchId, cellIndex: index });
        }
      });
    });
  }
}

function initMatchChess(gameState, players, isSpectator) {
  state.gameState = gameState;
  chessState.myColor = gameState.whitePlayer === state.playerId ? 'white' : 'black';
  chessState.isMyTurn = gameState.currentPlayer === state.playerId && !isSpectator;
  chessState.selectedSquare = null;
  
  elements.gameTitle.textContent = '♟️ Chess' + (isSpectator ? ' (Spectating)' : '');
  updateMatchScoreBoard(players);
  renderMatchChessBoard(gameState, isSpectator);
}

function initMatchConnect4(gameState, players, isSpectator) {
  state.gameState = gameState;
  const isMyTurn = gameState.currentPlayer === state.playerId && !isSpectator;
  const myPiece = gameState.player1 === state.playerId ? '🔴' : '🟡';
  
  elements.gameTitle.textContent = '🔴 Connect ' + (gameState.winCondition || 4) + (isSpectator ? ' (Spectating)' : '');
  updateMatchScoreBoard(players);
  
  let html = `<div class="connect4-game">`;
  html += `<div class="turn-indicator">${isMyTurn ? "Your turn!" : (isSpectator ? "Watching..." : "Opponent's turn...")}</div>`;
  html += `<div class="connect4-board">`;
  
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      const cell = gameState.board[row][col];
      html += `<div class="connect4-cell" data-col="${col}">${cell || ''}</div>`;
    }
  }
  
  html += `</div>`;
  if (!isSpectator) {
    html += `<div class="my-piece">You are: ${myPiece}</div>`;
  }
  html += `</div>`;
  
  elements.gameContent.innerHTML = html;
  
  // Add click handlers
  if (!isSpectator) {
    document.querySelectorAll('.connect4-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        if (gameState.currentPlayer === state.playerId && !gameState.winner) {
          const col = parseInt(cell.dataset.col);
          socket.emit('matchConnect4Move', { matchId: state.currentMatchId, col });
        }
      });
    });
  }
}

function renderMatchChessBoard(gameState, isSpectator = false) {
  const board = gameState.board;
  const isFlipped = chessState.myColor === 'black' && !isSpectator;
  
  let html = `<div class="chess-game">`;
  html += `<div class="turn-indicator">${chessState.isMyTurn && !isSpectator ? "Your turn!" : (isSpectator ? "Watching..." : "Opponent's turn...")}</div>`;
  
  if (gameState.inCheck) {
    html += `<div class="check-warning">⚠️ CHECK!</div>`;
  }
  
  html += `<div class="chess-board ${isFlipped ? 'flipped' : ''}">`;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const displayRow = isFlipped ? 7 - row : row;
      const displayCol = isFlipped ? 7 - col : col;
      const piece = board[displayRow][displayCol];
      const isLight = (displayRow + displayCol) % 2 === 0;
      const isSelected = chessState.selectedSquare && 
                        chessState.selectedSquare[0] === displayRow && 
                        chessState.selectedSquare[1] === displayCol;
      const isLastMove = gameState.lastMove && 
                        ((gameState.lastMove.from[0] === displayRow && gameState.lastMove.from[1] === displayCol) ||
                         (gameState.lastMove.to[0] === displayRow && gameState.lastMove.to[1] === displayCol));
      
      html += `<div class="chess-square ${isLight ? 'light' : 'dark'} ${isSelected ? 'selected' : ''} ${isLastMove ? 'last-move' : ''}" 
                   data-row="${displayRow}" data-col="${displayCol}">
                ${piece ? getPieceSymbol(piece) : ''}
              </div>`;
    }
  }
  
  html += `</div>`;
  html += `<div class="chess-info">You play: ${chessState.myColor === 'white' ? '⬜ White' : '⬛ Black'}</div>`;
  html += `</div>`;
  
  elements.gameContent.innerHTML = html;
  
  // Add click handlers for non-spectators
  if (!isSpectator) {
    document.querySelectorAll('.chess-square').forEach(square => {
      square.addEventListener('click', () => {
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);
        handleMatchChessClick(row, col);
      });
    });
  }
}

function handleMatchChessClick(row, col) {
  if (!chessState.isMyTurn) return;
  
  const piece = state.gameState.board[row][col];
  const isMyPiece = piece && (
    (chessState.myColor === 'white' && piece === piece.toUpperCase()) ||
    (chessState.myColor === 'black' && piece === piece.toLowerCase())
  );
  
  if (chessState.selectedSquare) {
    // Try to move
    const [fromRow, fromCol] = chessState.selectedSquare;
    if (fromRow === row && fromCol === col) {
      // Deselect
      chessState.selectedSquare = null;
      renderMatchChessBoard(state.gameState);
    } else {
      // Attempt move
      socket.emit('matchChessMove', {
        matchId: state.currentMatchId,
        from: [fromRow, fromCol],
        to: [row, col]
      });
      chessState.selectedSquare = null;
    }
  } else if (isMyPiece) {
    // Select piece
    chessState.selectedSquare = [row, col];
    renderMatchChessBoard(state.gameState);
  }
}

function updateMatchScoreBoard(players) {
  if (!players || players.length === 0) return;
  
  elements.scoreBoard.innerHTML = players.map(p => `
    <div class="score-item ${p.id === state.playerId ? 'is-me' : ''}">
      <span class="player-dot" style="background: ${p.color || '#e50914'}"></span>
      <span class="player-name">${escapeHtml(p.name)}</span>
    </div>
  `).join('');
}

// Update match game state handlers
function handleMatchTttUpdate(data) {
  if (data.matchId !== state.currentMatchId) return;
  
  state.gameState.board = data.board;
  state.gameState.currentPlayer = data.currentPlayer;
  
  if (data.winner) {
    state.gameState.winner = data.winner;
    const isWinner = data.winner === state.playerId;
    showMatchResult(isWinner ? 'You Win! 🎉' : `${data.winnerName} Wins!`, data);
  } else if (data.draw) {
    showMatchResult("It's a Draw! 🤝", data);
  } else {
    // Refresh board
    const isSpectator = state.spectatingMatchId === data.matchId;
    initMatchTicTacToe(state.gameState, state.players, isSpectator);
  }
}

function handleMatchChessUpdate(data) {
  if (data.matchId !== state.currentMatchId) return;
  
  state.gameState = { ...state.gameState, ...data };
  chessState.isMyTurn = data.currentPlayer === state.playerId;
  
  if (data.gameOver) {
    if (data.isCheckmate) {
      const isWinner = data.winner === state.playerId;
      showMatchResult(isWinner ? 'Checkmate! You Win! 🎉' : `Checkmate! ${data.winnerName} Wins!`, data);
    } else if (data.isStalemate) {
      showMatchResult("Stalemate! It's a Draw! 🤝", data);
    }
  } else {
    const isSpectator = state.spectatingMatchId === data.matchId;
    renderMatchChessBoard(state.gameState, isSpectator);
  }
}

function handleMatchConnect4Update(data) {
  if (data.matchId !== state.currentMatchId) return;
  
  state.gameState.board = data.board;
  state.gameState.currentPlayer = data.currentPlayer;
  
  if (data.winner) {
    state.gameState.winner = data.winner;
    state.gameState.winningCells = data.winningCells;
    const isWinner = data.winner === state.playerId;
    showMatchResult(isWinner ? 'You Win! 🎉' : `${data.winnerName} Wins!`, data);
  } else if (data.isDraw) {
    showMatchResult("It's a Draw! 🤝", data);
  } else {
    const isSpectator = state.spectatingMatchId === data.matchId;
    initMatchConnect4(state.gameState, state.players, isSpectator);
  }
}

function showMatchResult(title, data) {
  const modal = document.getElementById('resultsModal');
  document.getElementById('resultsTitle').textContent = title;
  
  let content = '';
  if (data.winner) {
    content = `<p class="winner-announcement">${data.winnerName} is victorious!</p>`;
  }
  
  content += `
    <div class="match-result-actions">
      <button class="btn btn-primary" onclick="requestRematch()">
        <span class="btn-icon">🔄</span> Rematch
      </button>
      <button class="btn btn-secondary" onclick="returnToLobbyFromMatch()">
        <span class="btn-icon">🚪</span> Back to Lobby
      </button>
    </div>
  `;
  
  document.getElementById('resultsContent').innerHTML = content;
  modal.classList.add('active');
}

function requestRematch() {
  if (state.currentMatchId) {
    socket.emit('requestRematch', { matchId: state.currentMatchId });
  }
  document.getElementById('resultsModal').classList.remove('active');
}

function returnToLobbyFromMatch() {
  state.currentMatchId = null;
  state.spectatingMatchId = null;
  state.currentGame = null;
  state.gameState = {};
  document.getElementById('resultsModal').classList.remove('active');
  showScreen('lobby');
}

// Update game selection to show 2-player games section
function updateGameSelection() {
  // Show game selection for everyone (voting-based)
  elements.gameSelection.style.display = 'block';
  elements.gameSelection.innerHTML = `
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
      <button class="game-card" data-game="sudoku">
        <span class="game-icon">🔢🧩</span>
        <span class="game-name">Vecna's<br>Sudoku</span>
        <span class="game-players">2+ players (Co-op)</span>
      </button>
      <button class="game-card" data-game="connect4">
        <span class="game-icon">🔴🟡</span>
        <span class="game-name">Connect<br>4 or 5</span>
        <span class="game-players">2 players</span>
      </button>
      <button class="game-card" data-game="molewhack">
        <span class="game-icon">🔨🐹</span>
        <span class="game-name">Mole<br>Whacker</span>
        <span class="game-players">2+ players</span>
      </button>
      <button class="game-card" data-game="mathquiz">
        <span class="game-icon">🔢➕</span>
        <span class="game-name">Math<br>Quiz</span>
        <span class="game-players">2+ players</span>
      </button>
      <button class="game-card" data-game="ludo">
        <span class="game-icon">🎲🦇</span>
        <span class="game-name">Upside Down<br>Ludo</span>
        <span class="game-players">2-4 players</span>
      </button>
    </div>
    <p class="voting-hint">💡 Click "Start Voting" then everyone picks a game. Most votes wins!</p>
  `;
}

// Handle game selection (legacy - directly starts game without voting)
function handleGameSelection(gameType) {
  // If voting is active, this shouldn't be called - use handleVote instead
  if (state.votingActive) {
    handleVote(gameType);
    return;
  }
  
  // Legacy direct start (only if not in voting mode)
  if (gameType === 'memory') {
    showMemoryDifficultyModal();
  } else if (gameType === 'sudoku') {
    showSudokuDifficultyModal();
  } else if (gameType === 'connect4') {
    showConnect4DifficultyModal();
  } else {
    startGame(gameType);
  }
}

// Show Connect 4/5 selection modal (non-voting mode)
function showConnect4DifficultyModal() {
  const modal = document.getElementById('votingModal');
  if (!modal) {
    startGame('connect4');
    return;
  }
  
  modal.innerHTML = `
    <div class="voting-modal-content">
      <h3>🔴🟡 Choose Your Battle</h3>
      <div class="difficulty-options">
        <button class="difficulty-btn" data-win="4">
          <span class="diff-icon">4️⃣</span>
          <div>
            <span class="diff-name">4 in a Row</span>
            <span class="diff-desc">Classic Connect 4</span>
          </div>
        </button>
        <button class="difficulty-btn" data-win="5">
          <span class="diff-icon">5️⃣</span>
          <div>
            <span class="diff-name">5 in a Row</span>
            <span class="diff-desc">Extended Challenge</span>
          </div>
        </button>
      </div>
      <button class="btn btn-secondary" style="margin-top: 15px;" id="cancelConnect4Modal">Cancel</button>
    </div>
  `;
  modal.classList.add('active');
  
  modal.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const winCondition = parseInt(btn.dataset.win);
      modal.classList.remove('active');
      socket.emit('startGame', { type: 'connect4', options: { winCondition } });
    });
  });
  
  document.getElementById('cancelConnect4Modal')?.addEventListener('click', () => {
    modal.classList.remove('active');
  });
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

// Show color picker for host to change player colors
function showColorPicker(playerId) {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return;
  
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'colorPickerModal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>🎨 Change Color for ${escapeHtml(player.name)}</h2>
      <div class="color-picker-grid">
        ${PLAYER_COLORS.map(color => `
          <button class="color-option ${player.color === color ? 'selected' : ''}" 
                  data-color="${color}" 
                  style="background: ${color}"></button>
        `).join('')}
      </div>
      <button class="btn btn-secondary" id="cancelColorBtn" style="margin-top: 20px;">Cancel</button>
    </div>
  `;
  document.body.appendChild(modal);
  
  modal.querySelectorAll('.color-option').forEach(btn => {
    btn.addEventListener('click', () => {
      socket.emit('changePlayerColor', { targetPlayerId: playerId, color: btn.dataset.color });
      modal.remove();
    });
  });
  
  document.getElementById('cancelColorBtn').addEventListener('click', () => {
    modal.remove();
  });
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
          <span class="diff-desc">4×3 Grid (6 pairs, 12 cards)</span>
        </button>
        <button class="difficulty-btn" data-difficulty="hard">
          <span class="diff-icon">😈</span>
          <span class="diff-name">Hard</span>
          <span class="diff-desc">4×4 Grid (8 pairs, 16 cards)</span>
        </button>
        <button class="difficulty-btn" data-difficulty="insane">
          <span class="diff-icon">💀</span>
          <span class="diff-name">Insane</span>
          <span class="diff-desc">6×4 Grid (12 pairs, 24 cards)</span>
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

// Show sudoku difficulty selection modal
function showSudokuDifficultyModal() {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'difficultyModal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>🔢 Select Difficulty 🔢</h2>
      <div class="difficulty-options">
        <button class="difficulty-btn" data-difficulty="easy">
          <span class="diff-icon">😊</span>
          <span class="diff-name">Easy</span>
          <span class="diff-desc">~30 empty cells</span>
        </button>
        <button class="difficulty-btn" data-difficulty="medium">
          <span class="diff-icon">🤔</span>
          <span class="diff-name">Medium</span>
          <span class="diff-desc">~40 empty cells</span>
        </button>
        <button class="difficulty-btn" data-difficulty="hard">
          <span class="diff-icon">😈</span>
          <span class="diff-name">Hard</span>
          <span class="diff-desc">~50 empty cells</span>
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
      startGame({ type: 'sudoku', options: { difficulty } });
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
  
  // Determine message type class
  let typeClass = '';
  if (msg.type === 'gameStart') typeClass = ' game-start';
  else if (msg.type === 'gameEnd') typeClass = ' game-end';
  else if (msg.type === 'autoRotation') typeClass = ' auto-rotation';
  else if (msg.type === 'system' || msg.system) typeClass = ' system';
  
  div.className = 'chat-message' + (msg.isGuess ? ' guess' : '') + typeClass;
  
  if (msg.system || msg.type === 'system' || msg.type === 'gameStart' || msg.type === 'gameEnd' || msg.type === 'autoRotation') {
    div.innerHTML = `<span class="message">${escapeHtml(msg.message)}</span>`;
  } else {
    // Use player color if available, fallback to default
    const senderColor = msg.playerColor || '#ff2a6d';
    div.innerHTML = `
      <span class="sender" style="color: ${senderColor}">${escapeHtml(msg.playerName)}:</span>
      <span class="message">${escapeHtml(msg.message)}</span>
    `;
  }
  
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  
  // Sync to mobile chat if this is the game chat
  if (container === elements.gameChatMessages && typeof syncMobileChat === 'function') {
    syncMobileChat();
  }
}

// ============================================
// GAME MANAGEMENT
// ============================================

function startGame(gameType) {
  socket.emit('startGame', gameType);
}

function endGame() {
  // Clean up any game-specific listeners
  document.removeEventListener('keydown', handleSudokuKeypress);
  window.sudokuKeyboardListenerAdded = false;
  socket.emit('endGame');
}

function closeResults() {
  elements.resultsModal.classList.remove('active');
  // Actually return to lobby - send endGame to server
  socket.emit('endGame');
}

function updateScoreBoard(players, currentPlayer = null) {
  elements.scoreBoard.innerHTML = `
    <div class="score-header">
      <span>Player</span>
      <span title="In-game Points">Pts</span>
      <span title="Session Wins">Wins</span>
      <span title="Trophies">🏆</span>
    </div>
    ${players.map(p => `
      <div class="score-item ${p.id === currentPlayer ? 'current-turn' : ''} ${p.id === state.playerId ? 'is-me' : ''}">
        <span class="name" style="color: ${p.color || '#fff'}">${escapeHtml(p.name)}</span>
        <span class="points">${p.points || 0}</span>
        <span class="session-wins">${p.sessionWins || 0}</span>
        <span class="trophies">${p.trophies || 0}</span>
      </div>
    `).join('')}
  `;
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
    // Any player can trigger play again
    if (state.currentGame === 'memory' && state.gameState.difficulty) {
      socket.emit('restartGame', { type: 'memory', options: { difficulty: state.gameState.difficulty } });
    } else if (state.currentGame === 'sudoku' && state.gameState.difficulty) {
      socket.emit('restartGame', { type: 'sudoku', options: { difficulty: state.gameState.difficulty } });
    } else {
      socket.emit('restartGame', state.currentGame);
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
  
  // Determine grid columns based on difficulty and screen
  let gridCols = gameState.gridCols || 4;
  const totalCards = gameState.cards.length;
  
  // Smart grid sizing for portrait mode on mobile
  const isPortrait = window.innerHeight > window.innerWidth;
  const isMobile = window.innerWidth <= 480;
  
  if (isMobile && isPortrait) {
    // Adjust columns to fit better in portrait
    if (totalCards <= 16) {
      gridCols = 4; // 4x4 fits well
    } else if (totalCards <= 24) {
      gridCols = 4; // 4x6 fits vertically
    } else if (totalCards <= 36) {
      gridCols = 4; // 4x9 scrolls less
    } else {
      gridCols = 5; // Larger grids use 5 columns to minimize horizontal space
    }
  }
  
  elements.gameContent.innerHTML = `
    <div class="memory-container">
      <div class="memory-status" id="memoryStatus">
        ${gameState.currentPlayer === state.playerId ? "🧠 Your turn to find a match!" : "Watching..."}
      </div>
      <div class="memory-board" id="memoryBoard" data-cols="${gridCols}" style="grid-template-columns: repeat(${gridCols}, 1fr);">
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
    if (state.gameState.isCheckmate) {
      statusText = `👑 CHECKMATE! ${state.gameState.winnerName} wins!`;
    } else if (state.gameState.isStalemate) {
      statusText = `🤝 STALEMATE! It's a draw!`;
    } else if (state.gameState.winnerName) {
      statusText = `👑 ${state.gameState.winnerName} wins!`;
    } else {
      statusText = `🏁 Game Over!`;
    }
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
      
      // Add castling moves if available
      if (state.gameState && state.gameState.castlingRights) {
        const rights = state.gameState.castlingRights;
        const row = isWhite ? 7 : 0;
        
        // Only check castling if king is on starting square
        if (fromRow === row && fromCol === 4) {
          // Kingside castling (O-O)
          const canKingside = isWhite ? rights.whiteKingside : rights.blackKingside;
          if (canKingside) {
            // Check path is clear (f1/f8 and g1/g8)
            if (isEmpty(row, 5) && isEmpty(row, 6)) {
              moves.push([row, 6]); // King moves to g1 or g8
            }
          }
          
          // Queenside castling (O-O-O)
          const canQueenside = isWhite ? rights.whiteQueenside : rights.blackQueenside;
          if (canQueenside) {
            // Check path is clear (b1/b8, c1/c8, and d1/d8)
            if (isEmpty(row, 1) && isEmpty(row, 2) && isEmpty(row, 3)) {
              moves.push([row, 2]); // King moves to c1 or c8
            }
          }
        }
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
  state.gameState.isCheckmate = data.isCheckmate;
  state.gameState.isStalemate = data.isStalemate;
  
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
    if (data.isCheckmate) {
      addChatMessage({
        system: true,
        message: `👑 CHECKMATE! ${data.winnerName} wins the game!`
      }, elements.gameChatMessages);
    } else if (data.isStalemate) {
      addChatMessage({
        system: true,
        message: `🤝 STALEMATE! The game is a draw!`
      }, elements.gameChatMessages);
    } else {
      addChatMessage({
        system: true,
        message: `👑 ${data.winnerName} wins the game!`
      }, elements.gameChatMessages);
    }
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

// ============================================
// NESTED MATCHES SOCKET HANDLERS
// ============================================

// Challenge received
socket.on('challengeReceived', (data) => {
  console.log('⚔️ Challenge received:', data);
  showIncomingChallenge(data);
});

// Challenge sent confirmation
socket.on('challengeSent', (data) => {
  console.log('📤 Challenge sent to:', data.targetName);
});

// Challenge declined
socket.on('challengeDeclined', (data) => {
  showNotification(`${data.declinedBy} declined your challenge`, 'info');
});

// Match started (as player)
socket.on('matchStarted', (data) => {
  console.log('🎮 Match started:', data);
  state.currentMatchId = data.matchId;
  state.spectatingMatchId = null;
  initMatchGame(data.matchId, data.gameType, data.gameState, data.players, false);
  
  if (data.isRematch) {
    showNotification('Rematch started!', 'success');
  } else if (data.isAutoRotation) {
    showNotification('Auto-rotation: Your turn to play!', 'success');
  }
});

// Spectating a match
socket.on('spectatingMatch', (data) => {
  console.log('👁️ Spectating match:', data);
  state.spectatingMatchId = data.matchId;
  state.currentMatchId = null;
  initMatchGame(data.matchId, data.gameType, data.gameState, data.players, true);
  
  if (data.queuePosition > 0) {
    showNotification(`You're #${data.queuePosition} in the spectator queue`, 'info');
  }
});

// Stopped spectating
socket.on('stoppedSpectating', () => {
  state.spectatingMatchId = null;
  state.currentGame = null;
  showScreen('lobby');
});

// Match updates
socket.on('matchTttUpdate', handleMatchTttUpdate);
socket.on('matchChessUpdate', handleMatchChessUpdate);
socket.on('matchConnect4Update', handleMatchConnect4Update);

// Match ended
socket.on('matchEnded', (data) => {
  console.log('🏁 Match ended:', data);
  
  if (data.autoRotation && data.nextPlayerId === state.playerId) {
    showNotification(`Get ready! You're playing next against the winner!`, 'success');
  }
});

// Match forfeited
socket.on('matchForfeited', (data) => {
  console.log('🏳️ Match forfeited:', data);
  const isWinner = data.winner === state.playerId;
  showMatchResult(
    isWinner ? 'Opponent Forfeited! You Win! 🎉' : `${data.winnerName} wins by forfeit`,
    data
  );
});

// Rotated out (loser replaced by spectator)
socket.on('rotatedOut', (data) => {
  showNotification(`${data.replacedByName} has taken your spot. Better luck next time!`, 'info');
  state.currentMatchId = null;
  state.currentGame = null;
  showScreen('lobby');
});

// Player status updates (who's in matches, spectating, etc.)
socket.on('playerStatusUpdate', (data) => {
  state.players = data.players;
  state.activeMatches = data.activeMatches || [];
  updatePlayersList(data.players);
  updateActiveMatchesDisplay();
});

// Spectator joined/left notifications
socket.on('spectatorJoined', (data) => {
  showNotification(`👁️ ${data.spectatorName} is now watching`, 'info');
});

socket.on('spectatorLeft', (data) => {
  // Optional: notify when spectator leaves
});

// Forced logout (duplicate login)
socket.on('forcedLogout', (data) => {
  showError(data.message);
  state.isAuthenticated = false;
  state.username = null;
  localStorage.removeItem('authSession');
  showScreen('authScreen');
});

// Game events
socket.on('gameStarted', (data) => {
  console.log('🎮 Game started:', data.gameType, data.gameState);
  state.currentGame = data.gameType;
  state.players = data.players;
  showScreen('gameScreen');
  
  try {
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
      case 'sudoku':
        initSudokuGame(data.gameState, data.players);
        break;
      case 'connect4':
        initConnect4Game(data.gameState, data.players);
        break;
      case 'molewhack':
        initMoleWhackGame(data.gameState, data.players);
        break;
      case 'mathquiz':
        initMathQuizGame(data.gameState, data.players);
        break;
      case 'ludo':
        initLudoGame(data.gameState, data.players);
        break;
      default:
        console.error('Unknown game type:', data.gameType);
        elements.gameContent.innerHTML = '<div style="text-align:center;color:red;">Unknown game type</div>';
    }
  } catch (err) {
    console.error('Error initializing game:', err);
    elements.gameContent.innerHTML = `<div style="text-align:center;color:red;">Error loading game: ${err.message}</div>`;
  }
});

socket.on('gameUpdate', (data) => {
  // Generic game update - specific games have their own handlers
});

socket.on('returnToLobby', (data) => {
  state.currentGame = null;
  state.gameState = {};
  state.players = data.players;
  state.votingActive = false;
  
  // Clean up game-specific listeners
  document.removeEventListener('keydown', handleSudokuKeypress);
  window.sudokuKeyboardListenerAdded = false;
  
  // Clear game content
  elements.gameContent.innerHTML = '';
  // Close any open modals
  elements.resultsModal.classList.remove('active');
  
  // Reset voting UI
  document.querySelectorAll('.game-card').forEach(card => {
    card.classList.remove('voting-mode', 'voted');
    const voteCount = card.querySelector('.vote-count');
    if (voteCount) voteCount.remove();
  });
  const startVotingBtn = document.getElementById('startVotingBtn');
  if (startVotingBtn) {
    startVotingBtn.textContent = '🗳️ Start Voting';
    startVotingBtn.disabled = false;
  }
  
  updatePlayersList(data.players);
  showScreen('lobby');
  
  // Show notification about trophy
  if (data.trophyWinner) {
    showNotification(`🏆 ${data.trophyWinner.name} earned a Trophy! (Total: ${data.trophyWinner.totalTrophies})`, 'success');
    
    // Update own stats if we're the winner
    if (data.trophyWinner.id === state.playerId && state.userStats) {
      state.userStats.trophies = data.trophyWinner.totalTrophies;
      updateUserInfoDisplay();
    }
  }
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

// Sudoku
socket.on('sudokuUpdate', handleSudokuUpdate);
socket.on('sudokuComplete', handleSudokuComplete);

// Connect 4
socket.on('connect4Update', handleConnect4Update);

// Mole Whack
socket.on('moleRoundStart', handleMoleRoundStart);
socket.on('moleSpawned', handleMoleSpawned);
socket.on('moleWhacked', handleMoleWhacked);
socket.on('moleHidden', handleMoleHidden);
socket.on('moleRoundEnd', handleMoleRoundEnd);

// Math Quiz
socket.on('mathTimer', (data) => updateMathTimer(data.timeLeft));
socket.on('mathPlayerAnswered', handleMathPlayerAnswered);
socket.on('mathReveal', handleMathReveal);
socket.on('mathNextQuestion', handleMathNextQuestion);

// Ludo
socket.on('ludoUpdate', handleLudoUpdate);
socket.on('ludoDiceRoll', handleLudoDiceRoll);
socket.on('ludoTokenMoved', handleLudoTokenMoved);
socket.on('ludoTurnChange', handleLudoTurnChange);

// Player color changed
socket.on('playerColorChanged', (data) => {
  const player = state.players.find(p => p.id === data.playerId);
  if (player) player.color = data.color;
  updatePlayersList(data.players);
});

// Game end
socket.on('gameEnded', (data) => {
  const sessionWinner = data.sessionWinner;
  const hasWinner = sessionWinner && sessionWinner.sessionWins > 0;
  
  elements.resultsTitle.textContent = '🎭 Round Complete! 🎭';
  elements.resultsContent.innerHTML = `
    <div class="results-winner">
      ${hasWinner 
        ? `🥇 <span class="winner-name">${escapeHtml(sessionWinner.name)}</span> won this round!`
        : `🤝 It's a tie! No winner this round.`
      }
    </div>
    
    <div class="scoring-explanation">
      <h4>📊 How Scoring Works:</h4>
      <div class="score-tiers">
        <div class="tier"><span class="tier-icon">⭐</span> <strong>Points</strong> - In-game score (resets each round)</div>
        <div class="tier"><span class="tier-icon">🏅</span> <strong>Wins</strong> - Rounds won this session</div>
        <div class="tier"><span class="tier-icon">🏆</span> <strong>Trophy</strong> - Most wins when leaving = +1 Trophy!</div>
      </div>
    </div>
    
    <div class="results-list">
      <h4>Session Standings:</h4>
      <div class="results-header">
        <span>Player</span>
        <span>Points</span>
        <span>Wins</span>
        <span>Trophies</span>
      </div>
      ${data.players.map((p, i) => `
        <div class="results-item ${p.id === sessionWinner?.id ? 'session-leader' : ''} ${p.id === state.playerId ? 'is-me' : ''}">
          <span class="player-name">${escapeHtml(p.name)}</span>
          <span class="points">⭐ ${p.points || 0}</span>
          <span class="session-wins">🏅 ${p.sessionWins || 0}</span>
          <span class="trophies">🏆 ${p.trophies || 0}</span>
        </div>
      `).join('')}
    </div>
    
    <div class="results-actions">
      <button class="btn btn-primary" id="modalPlayAgainBtn">
        <span class="btn-icon">🔄</span> Play Again
      </button>
      <button class="btn btn-secondary" id="modalBackToLobbyBtn">
        <span class="btn-icon">🏠</span> Back to Lobby
      </button>
      <p class="trophy-hint">🏆 Most session wins gets +1 Trophy when returning to lobby!</p>
    </div>
  `;
  elements.resultsModal.classList.add('active');
  state.players = data.players;
  
  // Add play again handler in modal - any player can trigger
  const modalPlayAgainBtn = document.getElementById('modalPlayAgainBtn');
  if (modalPlayAgainBtn) {
    modalPlayAgainBtn.addEventListener('click', () => {
      // For memory and sudoku games, preserve the difficulty
      if (state.currentGame === 'memory' && state.gameState.difficulty) {
        socket.emit('restartGame', { type: 'memory', options: { difficulty: state.gameState.difficulty } });
      } else if (state.currentGame === 'sudoku' && state.gameState.difficulty) {
        socket.emit('restartGame', { type: 'sudoku', options: { difficulty: state.gameState.difficulty } });
      } else {
        socket.emit('restartGame', state.currentGame);
      }
    });
  }
  
  // Add back to lobby handler - any player can trigger
  const modalBackToLobbyBtn = document.getElementById('modalBackToLobbyBtn');
  if (modalBackToLobbyBtn) {
    modalBackToLobbyBtn.addEventListener('click', () => {
      socket.emit('endGame');
    });
  }
});

// Game restarted
socket.on('gameRestarted', (data) => {
  console.log('🔄 Game restarted:', data.gameType, data.gameState);
  elements.resultsModal.classList.remove('active');
  state.currentGame = data.gameType;
  state.players = data.players;
  
  try {
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
      case 'sudoku':
        initSudokuGame(data.gameState, data.players);
        break;
      case 'connect4':
        initConnect4Game(data.gameState, data.players);
        break;
      case 'molewhack':
        initMoleWhackGame(data.gameState, data.players);
        break;
      case 'mathquiz':
        initMathQuizGame(data.gameState, data.players);
        break;
      case 'ludo':
        initLudoGame(data.gameState, data.players);
        break;
      default:
        console.error('Unknown game type:', data.gameType);
    }
  } catch (err) {
    console.error('Error restarting game:', err);
    elements.gameContent.innerHTML = `<div style="text-align:center;color:red;">Error loading game: ${err.message}</div>`;
  }
});

// ============================================
// SUDOKU GAME
// ============================================

function initSudokuGame(gameState, players) {
  try {
    console.log('Initializing Sudoku:', gameState);
    state.gameState = gameState || {};
    state.gameState.selectedCell = null;
    
    // Ensure currentBoard exists
    if (!state.gameState.currentBoard || !Array.isArray(state.gameState.currentBoard)) {
      console.error('Sudoku: Invalid currentBoard');
      elements.gameTitle.textContent = '🔢 Vecna\'s Sudoku 🧩';
      elements.gameContent.innerHTML = '<div style="text-align:center;color:red;">Error loading Sudoku puzzle</div>';
      return;
    }
    
    const difficultyLabel = gameState.difficulty ? gameState.difficulty.charAt(0).toUpperCase() + gameState.difficulty.slice(1) : 'Medium';
    elements.gameTitle.textContent = `🔢 Vecna's Sudoku (${difficultyLabel}) 🧩`;
    
    // Create the board structure ONCE
    createSudokuBoard(gameState);
    
    // Set up event listeners ONCE
    setupSudokuListeners();
    
    // Initial display update
    updateSudokuDisplay();
    
    updateScoreBoard(players);
  } catch (err) {
    console.error('Sudoku init error:', err);
  }
}

function createSudokuBoard(gameState) {
  const currentBoard = gameState.currentBoard || [];
  const puzzle = gameState.puzzle || [];
  
  elements.gameContent.innerHTML = `
    <div class="sudoku-game">
      <div class="sudoku-main">
        <div class="sudoku-board" id="sudokuBoard">
          ${currentBoard.map((row, rowIndex) => 
            (row || []).map((cell, colIndex) => {
              const isOriginal = puzzle[rowIndex] && puzzle[rowIndex][colIndex] !== 0;
              return `<div class="sudoku-cell ${isOriginal ? 'original' : 'editable'}" 
                          data-row="${rowIndex}" data-col="${colIndex}">
                        <span class="cell-value">${cell !== 0 ? cell : ''}</span>
                      </div>`;
            }).join('')
          ).join('')}
        </div>
      </div>
      
      <div class="sudoku-controls">
        <div class="sudoku-numpad" id="sudokuNumpad">
          ${[1,2,3,4,5,6,7,8,9].map(num => 
            `<button class="numpad-btn" data-num="${num}">${num}</button>`
          ).join('')}
          <button class="numpad-btn erase" data-num="0">✕</button>
        </div>
        <div class="sudoku-hints">
          <span>🎯 Tap cell, then number</span>
          <span>✅ +5 pts | ❌ -2 pts</span>
        </div>
      </div>
    </div>
  `;
}

function setupSudokuListeners() {
  // Remove any existing listeners
  document.removeEventListener('keydown', handleSudokuKeypress);
  
  // Get the board and numpad elements
  const board = document.getElementById('sudokuBoard');
  const numpad = document.getElementById('sudokuNumpad');
  
  // Board click handler - attach directly to cells
  if (board) {
    const cells = board.querySelectorAll('.sudoku-cell');
    cells.forEach(cell => {
      cell.addEventListener('click', function() {
        const row = parseInt(this.dataset.row);
        const col = parseInt(this.dataset.col);
        
        // Toggle selection - deselect if same cell is tapped again
        const currentSelection = state.gameState.selectedCell;
        if (currentSelection && currentSelection[0] === row && currentSelection[1] === col) {
          state.gameState.selectedCell = null;
        } else {
          state.gameState.selectedCell = [row, col];
        }
        updateSudokuDisplay();
      });
    });
  }
  
  // Numpad click handler - use event delegation on the numpad container
  if (numpad) {
    numpad.addEventListener('click', handleNumpadClick);
  }
  
  // Keyboard handler
  document.addEventListener('keydown', handleSudokuKeypress);
}

function updateSudokuDisplay() {
  const gameState = state.gameState;
  if (!gameState) return;
  
  const selectedCell = gameState.selectedCell;
  const puzzle = gameState.puzzle || [];
  const solution = gameState.solution || [];
  const currentBoard = gameState.currentBoard || [];
  const playerMoves = gameState.playerMoves || {};
  
  // Get selected cell info
  const selectedRow = selectedCell ? selectedCell[0] : -1;
  const selectedCol = selectedCell ? selectedCell[1] : -1;
  const selectedValue = selectedCell && currentBoard[selectedRow] ? currentBoard[selectedRow][selectedCol] : 0;
  
  // Count completed numbers
  const numberCounts = {};
  for (let i = 1; i <= 9; i++) numberCounts[i] = 0;
  
  // Update each cell
  document.querySelectorAll('.sudoku-cell').forEach(cellEl => {
    const row = parseInt(cellEl.dataset.row);
    const col = parseInt(cellEl.dataset.col);
    const cell = currentBoard[row] ? currentBoard[row][col] : 0;
    const puzzleVal = puzzle[row] ? puzzle[row][col] : 0;
    const solutionVal = solution[row] ? solution[row][col] : 0;
    const isOriginal = puzzleVal !== 0;
    
    // Update cell value
    const valueEl = cellEl.querySelector('.cell-value');
    if (valueEl) {
      valueEl.textContent = cell !== 0 ? cell : '';
    }
    
    // Count correct numbers
    if (cell !== 0 && cell === solutionVal) {
      numberCounts[cell]++;
    }
    
    // Calculate states
    const isSelected = selectedRow === row && selectedCol === col;
    const isWrong = cell !== 0 && cell !== solutionVal;
    const isSameNumber = cell !== 0 && cell === selectedValue && selectedValue !== 0;
    const isInSelectedRow = selectedRow === row && selectedRow !== -1;
    const isInSelectedCol = selectedCol === col && selectedCol !== -1;
    // Only highlight row and column, not 3x3 box
    const isHighlighted = !isSelected && (isInSelectedRow || isInSelectedCol);
    
    // Update classes
    cellEl.className = 'sudoku-cell';
    if (isOriginal) cellEl.classList.add('original');
    else cellEl.classList.add('editable');
    if (isSelected) cellEl.classList.add('selected');
    if (isWrong) cellEl.classList.add('wrong');
    if (isSameNumber) cellEl.classList.add('same-number');
    if (isHighlighted) cellEl.classList.add('highlighted');
  });
  
  // Update numpad buttons
  document.querySelectorAll('.numpad-btn[data-num]').forEach(btn => {
    const num = parseInt(btn.dataset.num);
    if (num >= 1 && num <= 9) {
      const isComplete = numberCounts[num] >= 9;
      btn.classList.toggle('completed', isComplete);
      btn.disabled = isComplete;
    }
  });
}

function selectSudokuCell(row, col) {
  state.gameState.selectedCell = [row, col];
  updateSudokuDisplay();
}

function handleNumpadClick(e) {
  const btn = e.target.closest('.numpad-btn');
  if (!btn || btn.disabled) return;
  
  if (!state.gameState || !state.gameState.selectedCell) return;
  
  const num = parseInt(btn.dataset.num);
  const [row, col] = state.gameState.selectedCell;
  const puzzle = state.gameState.puzzle || [];
  
  // Check if cell is an original puzzle cell (non-zero in original puzzle)
  const puzzleValue = puzzle[row] !== undefined && puzzle[row][col] !== undefined ? puzzle[row][col] : 0;
  const isOriginal = puzzleValue !== 0;
  
  if (!isOriginal) {
    socket.emit('sudokuMove', { row, col, value: num });
  }
}

function handleSudokuKeypress(e) {
  if (state.currentGame !== 'sudoku') return;
  if (!state.gameState.selectedCell) return;
  
  const [row, col] = state.gameState.selectedCell;
  const puzzle = state.gameState.puzzle || [];
  const puzzleValue = puzzle[row] !== undefined && puzzle[row][col] !== undefined ? puzzle[row][col] : 0;
  const isOriginal = puzzleValue !== 0;
  
  // Number keys 1-9 (only on editable cells)
  if (e.key >= '1' && e.key <= '9' && !isOriginal) {
    e.preventDefault();
    socket.emit('sudokuMove', { row, col, value: parseInt(e.key) });
  }
  // Delete or backspace to erase (only on editable cells)
  else if ((e.key === 'Delete' || e.key === 'Backspace' || e.key === '0') && !isOriginal) {
    e.preventDefault();
    socket.emit('sudokuMove', { row, col, value: 0 });
  }
  // Arrow keys to move selection
  else if (e.key === 'ArrowUp' && row > 0) {
    e.preventDefault();
    selectSudokuCell(row - 1, col);
  }
  else if (e.key === 'ArrowDown' && row < 8) {
    e.preventDefault();
    selectSudokuCell(row + 1, col);
  }
  else if (e.key === 'ArrowLeft' && col > 0) {
    e.preventDefault();
    selectSudokuCell(row, col - 1);
  }
  else if (e.key === 'ArrowRight' && col < 8) {
    e.preventDefault();
    selectSudokuCell(row, col + 1);
  }
}

function handleSudokuUpdate(data) {
  state.gameState.currentBoard = data.currentBoard;
  state.gameState.playerMoves = data.playerMoves;
  
  // Show feedback
  if (data.value !== 0) {
    addChatMessage({
      system: true,
      message: `${data.playerName} placed ${data.value} - ${data.isCorrect ? '✅ Correct!' : '❌ Wrong!'}`
    }, elements.gameChatMessages);
  }
  
  updateSudokuDisplay();
  updateScoreBoard(data.players);
}

function handleSudokuComplete(data) {
  const minutes = Math.floor(data.completionTime / 60);
  const seconds = data.completionTime % 60;
  
  elements.gameContent.innerHTML = `
    <div class="sudoku-container">
      <div class="sudoku-complete">
        <h2>🎉 Puzzle Solved! 🎉</h2>
        <div class="completion-time">
          <span class="time-icon">⏱️</span>
          <span class="time-value">${minutes}:${seconds.toString().padStart(2, '0')}</span>
        </div>
        <p>All players receive +20 bonus points!</p>
      </div>
    </div>
  `;
  
  updateScoreBoard(data.players);
  showPlayAgainButton('sudoku');
}

// ============================================
// CONNECT 4 GAME
// ============================================

function initConnect4Game(gameState, players) {
  console.log('Initializing Connect 4:', gameState);
  state.gameState = gameState || {};
  const winCondition = gameState.winCondition || 4;
  elements.gameTitle.textContent = `🔴 ${winCondition} in a Row 🟡`;
  
  // Ensure board exists
  if (!state.gameState.board || !Array.isArray(state.gameState.board)) {
    console.error('Connect4: Invalid board');
    elements.gameContent.innerHTML = '<div style="text-align:center;color:red;">Error loading Connect 4</div>';
    return;
  }
  
  renderConnect4Board(gameState, players);
  updateScoreBoard(players, gameState.currentPlayer);
}

function renderConnect4Board(gameState, players) {
  const player1 = players.find(p => p.id === gameState.player1);
  const player2 = players.find(p => p.id === gameState.player2);
  const isMyTurn = gameState.currentPlayer === state.playerId;
  const myPiece = state.playerId === gameState.player1 ? '🔴' : '🟡';
  
  let statusText = '';
  if (gameState.winner) {
    const winnerName = players.find(p => p.id === gameState.winner)?.name || 'Winner';
    statusText = `🏆 ${winnerName} wins!`;
  } else if (gameState.isDraw) {
    statusText = "🤝 It's a draw!";
  } else {
    statusText = isMyTurn ? `🎯 Your turn! (${myPiece})` : "⏳ Opponent's turn...";
  }
  
  elements.gameContent.innerHTML = `
    <div class="connect4-container">
      <div class="connect4-status" id="connect4Status">${statusText}</div>
      <div class="connect4-players">
        <span class="c4-player ${gameState.currentPlayer === gameState.player1 ? 'active' : ''}">
          🔴 ${escapeHtml(player1?.name || 'Player 1')}
        </span>
        <span class="c4-player ${gameState.currentPlayer === gameState.player2 ? 'active' : ''}">
          🟡 ${escapeHtml(player2?.name || 'Player 2')}
        </span>
      </div>
      <div class="connect4-board" id="connect4Board">
        ${[0,1,2,3,4,5].map(row => 
          [0,1,2,3,4,5,6].map(col => {
            const cell = gameState.board && gameState.board[row] ? gameState.board[row][col] : null;
            const isWinning = gameState.winningCells?.some(([r,c]) => r === row && c === col);
            return `<div class="c4-cell ${cell ? 'filled' : 'empty'} ${isWinning ? 'winning' : ''}" data-col="${col}">
              ${cell || ''}
            </div>`;
          }).join('')
        ).join('')}
      </div>
    </div>
  `;
  
  // Add click handlers for empty columns
  if (!gameState.winner && !gameState.isDraw && isMyTurn) {
    document.querySelectorAll('.c4-cell.empty').forEach(cell => {
      cell.addEventListener('click', () => {
        const col = parseInt(cell.dataset.col);
        socket.emit('connect4Move', col);
      });
    });
  }
  
  if (gameState.winner || gameState.isDraw) {
    showPlayAgainButton('connect4');
  }
}

function handleConnect4Update(data) {
  state.gameState.board = data.board;
  state.gameState.currentPlayer = data.currentPlayer;
  state.gameState.winner = data.winner;
  state.gameState.winningCells = data.winningCells;
  state.gameState.isDraw = data.isDraw;
  
  renderConnect4Board(state.gameState, data.players);
  updateScoreBoard(data.players, data.currentPlayer);
}

// ============================================
// MOLE WHACK GAME
// ============================================

function initMoleWhackGame(gameState, players) {
  console.log('Initializing Mole Whack:', gameState);
  state.gameState = gameState || { maxRounds: 5, round: 1 };
  state.gameState.activeMoles = new Map(); // Map of position -> mole data
  elements.gameTitle.textContent = '🔨 Mole Whacker 🐹';
  
  const maxRounds = state.gameState.maxRounds || 5;
  
  // Find current player's color
  const myPlayer = players.find(p => p.id === state.playerId);
  const myColor = myPlayer?.color || '#e50914';
  
  elements.gameContent.innerHTML = `
    <div class="mole-container">
      <div class="mole-status" id="moleStatus">🎯 Get Ready!</div>
      <div class="mole-round" id="moleRound">Round 1/${maxRounds}</div>
      <div class="mole-info">
        <div class="mole-your-color">Your moles: <span class="color-indicator" style="background:${myColor}"></span></div>
        <div class="mole-score" id="moleScore">Score: 0</div>
      </div>
      <div class="mole-rules">
        <span class="rule-good">✅ Hit YOUR color = +10</span>
        <span class="rule-bad">❌ Hit other color = -5</span>
      </div>
      <div class="mole-board" id="moleBoard">
        ${[0,1,2,3,4,5,6,7,8].map(i => `
          <div class="mole-hole" data-index="${i}">
            <div class="mole" id="mole-${i}" data-color="">
              <span class="mole-headband"></span>
              <span class="mole-face">🐹</span>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="mole-instructions">
        <p>👆 Only hit moles with YOUR color!</p>
        <p>⚡ Speed increases each round!</p>
      </div>
    </div>
  `;
  
  updateScoreBoard(players);
  setupMoleClickHandlers();
  console.log('Mole Whack initialized, waiting for moles...');
}

function setupMoleClickHandlers() {
  console.log('Setting up mole click handlers');
  document.querySelectorAll('.mole-hole').forEach(hole => {
    // Use both click and touchstart for better mobile support
    const handleWhack = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const index = parseInt(hole.dataset.index);
      const mole = document.getElementById(`mole-${index}`);
      if (mole && mole.classList.contains('visible')) {
        console.log('🔨 Whacking mole at:', index);
        socket.emit('whackMole', index);
        // Immediate visual feedback
        mole.classList.add('hit');
        mole.classList.remove('visible');
        setTimeout(() => mole.classList.remove('hit'), 150);
      }
    };
    
    hole.addEventListener('click', handleWhack);
    hole.addEventListener('touchstart', handleWhack, { passive: false });
  });
}

function handleMoleRoundStart(data) {
  console.log('🎯 Mole round started:', data.round, 'intensity:', data.intensity);
  if (state.gameState) {
    state.gameState.round = data.round;
    state.gameState.activeMoles = new Map();
  }
  
  const statusEl = document.getElementById('moleStatus');
  const roundEl = document.getElementById('moleRound');
  const maxRounds = state.gameState?.maxRounds || 5;
  
  // Show intensity level
  const intensityLabel = data.round === 1 ? '🐢 Slow' : 
                         data.round === 2 ? '🚶 Normal' :
                         data.round === 3 ? '🏃 Fast' :
                         data.round === 4 ? '⚡ Very Fast' : '🔥 INSANE!';
  
  if (statusEl) statusEl.innerHTML = `🔨 WHACK YOUR MOLES! <span class="intensity">${intensityLabel}</span>`;
  if (roundEl) roundEl.textContent = `Round ${data.round}/${maxRounds}`;
  
  // Clear all moles - reset their visibility
  document.querySelectorAll('.mole').forEach(m => {
    m.classList.remove('visible', 'hit', 'whacked', 'my-mole', 'other-mole');
    m.dataset.color = '';
    m.dataset.playerId = '';
  });
}

function handleMoleSpawned(data) {
  console.log('🐹 Mole spawned at:', data.moleIndex, 'for player:', data.playerName, 'color:', data.color);
  const mole = document.getElementById(`mole-${data.moleIndex}`);
  if (mole) {
    mole.classList.remove('hit', 'whacked');
    mole.classList.add('visible');
    mole.dataset.color = data.color || '';
    mole.dataset.playerId = data.playerId || '';
    
    // Set headband color
    const headband = mole.querySelector('.mole-headband');
    if (headband) {
      headband.style.background = data.color || '#888';
      headband.style.boxShadow = `0 0 8px ${data.color || '#888'}`;
    }
    
    // Check if it's the current player's mole
    const isMyMole = data.playerId === state.playerId;
    mole.classList.toggle('my-mole', isMyMole);
    mole.classList.toggle('other-mole', !isMyMole);
    
    if (state.gameState && state.gameState.activeMoles) {
      state.gameState.activeMoles.set(data.moleIndex, {
        playerId: data.playerId,
        color: data.color,
        playerName: data.playerName
      });
    }
  } else {
    console.warn('Mole element not found:', `mole-${data.moleIndex}`);
  }
}

function handleMoleWhacked(data) {
  const mole = document.getElementById(`mole-${data.moleIndex}`);
  if (mole) {
    mole.classList.remove('visible', 'my-mole', 'other-mole');
    mole.classList.add('whacked');
    if (state.gameState && state.gameState.activeMoles) {
      state.gameState.activeMoles.delete(data.moleIndex);
    }
    setTimeout(() => {
      mole.classList.remove('whacked');
      mole.dataset.color = '';
      mole.dataset.playerId = '';
    }, 300);
  }
  
  // Show feedback based on whether they hit their own mole
  const feedbackMsg = data.isOwnMole 
    ? `🔨 ${data.whackerName} whacked their mole! (+10)` 
    : `❌ ${data.whackerName} hit ${data.moleOwnerName}'s mole! (${data.pointsChange})`;
  
  addChatMessage({
    system: true,
    message: feedbackMsg
  }, elements.gameChatMessages);
  
  // Show floating feedback on the mole position
  showMoleHitFeedback(data.moleIndex, data.isOwnMole, data.pointsChange);
  
  // Update personal score display
  const myScore = data.players.find(p => p.id === state.playerId)?.score || 0;
  const scoreEl = document.getElementById('moleScore');
  if (scoreEl) scoreEl.textContent = `Score: ${myScore}`;
  
  updateScoreBoard(data.players);
}

function showMoleHitFeedback(moleIndex, isOwnMole, points) {
  const hole = document.querySelector(`.mole-hole[data-index="${moleIndex}"]`);
  if (!hole) return;
  
  const feedback = document.createElement('div');
  feedback.className = `mole-feedback ${isOwnMole ? 'positive' : 'negative'}`;
  feedback.textContent = points > 0 ? `+${points}` : `${points}`;
  hole.appendChild(feedback);
  
  setTimeout(() => feedback.remove(), 800);
}

function handleMoleHidden(data) {
  const mole = document.getElementById(`mole-${data.moleIndex}`);
  if (mole) {
    mole.classList.remove('visible', 'my-mole', 'other-mole');
    mole.dataset.color = '';
    mole.dataset.playerId = '';
    if (state.gameState && state.gameState.activeMoles) {
      state.gameState.activeMoles.delete(data.moleIndex);
    }
  }
}

function handleMoleRoundEnd(data) {
  state.gameState.activeMoles = new Set();
  
  // Hide all moles
  document.querySelectorAll('.mole').forEach(m => m.classList.remove('visible'));
  
  const statusEl = document.getElementById('moleStatus');
  const roundEl = document.getElementById('moleRound');
  
  if (data.round >= state.gameState.maxRounds) {
    if (statusEl) statusEl.textContent = '🎉 Game Over!';
    showPlayAgainButton('mole');
  } else {
    if (statusEl) statusEl.textContent = `✅ Round ${data.round} Complete! Next round in 3s...`;
    if (roundEl) roundEl.textContent = `Round ${data.round}/${state.gameState.maxRounds}`;
  }
  
  updateScoreBoard(data.players);
}

// ============================================
// MATH QUIZ GAME
// ============================================

function initMathQuizGame(gameState, players) {
  console.log('Initializing Math Quiz:', gameState);
  state.gameState = gameState || {};
  state.gameState.selectedAnswer = null;
  elements.gameTitle.textContent = '🔢 Math Quiz ➕';
  
  // Ensure questions exist
  if (!state.gameState.questions || !Array.isArray(state.gameState.questions) || state.gameState.questions.length === 0) {
    console.error('MathQuiz: Invalid questions');
    elements.gameContent.innerHTML = '<div style="text-align:center;color:red;">Error loading Math Quiz</div>';
    return;
  }
  
  showMathQuestion(0, gameState.questions[0], 15);
  updateScoreBoard(players);
}

function showMathQuestion(index, question, timeLeft) {
  state.gameState.currentQuestion = index;
  state.gameState.timeLeft = timeLeft;
  state.gameState.selectedAnswer = null;
  
  elements.gameContent.innerHTML = `
    <div class="math-container">
      <div class="math-timer" id="mathTimer">${timeLeft}</div>
      <div class="math-progress">Question ${index + 1} of ${state.gameState.questions.length}</div>
      <div class="math-question">${escapeHtml(question.question)}</div>
      <div class="math-options" id="mathOptions">
        ${question.options.map((opt, i) => `
          <button class="math-option" data-index="${i}">${opt}</button>
        `).join('')}
      </div>
    </div>
  `;
  
  document.querySelectorAll('.math-option').forEach(option => {
    option.addEventListener('click', () => {
      if (state.gameState.selectedAnswer !== null) return;
      state.gameState.selectedAnswer = parseInt(option.dataset.index);
      option.classList.add('selected');
      socket.emit('mathAnswer', state.gameState.selectedAnswer);
    });
  });
}

function updateMathTimer(timeLeft) {
  const timer = document.getElementById('mathTimer');
  if (timer) {
    timer.textContent = timeLeft;
    if (timeLeft <= 5) {
      timer.classList.add('warning');
    }
  }
}

function handleMathPlayerAnswered(data) {
  updateScoreBoard(data.players);
}

function handleMathReveal(data) {
  const options = document.querySelectorAll('.math-option');
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

function handleMathNextQuestion(data) {
  showMathQuestion(data.questionIndex, data.question, 15);
}

// ============================================
// LUDO GAME (Upside Down / Wednesday Theme)
// ============================================

// Ludo Colors - Wednesday/Stranger Things themed
const LUDO_COLORS = {
  0: { name: 'Eleven', color: '#e50914', emoji: '🔴', light: '#ff4d4d' },
  1: { name: 'Wednesday', color: '#9333ea', emoji: '🖤', light: '#b366ff' },
  2: { name: 'Dustin', color: '#05d9e8', emoji: '🧢', light: '#4de8f4' },
  3: { name: 'Enid', color: '#f59e0b', emoji: '🐺', light: '#ffc04d' }
};

const LUDO_SAFE_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47];
const LUDO_START_SQUARES = [0, 13, 26, 39];

function initLudoGame(gameState, players) {
  console.log('Initializing Ludo:', gameState);
  state.gameState = gameState || {};
  elements.gameTitle.textContent = '🎲 The Upside Down Race 🦇';
  
  if (!state.gameState.tokens || !state.gameState.playerOrder) {
    console.error('Ludo: Invalid game state');
    elements.gameContent.innerHTML = '<div style="text-align:center;color:red;">Error loading Ludo</div>';
    return;
  }
  
  renderLudoBoard(gameState, players);
  updateScoreBoard(players, gameState.currentPlayer);
}

function renderLudoBoard(gameState, players) {
  const currentPlayerName = players.find(p => p.id === gameState.currentPlayer)?.name || 'Unknown';
  const isMyTurn = gameState.currentPlayer === state.playerId;
  const myPlayerIndex = gameState.playerOrder.indexOf(state.playerId);
  const FINISH_STEP = 56;
  
  // Calculate each player's total progress (sum of all token steps)
  const playerProgress = {};
  gameState.playerOrder.forEach(pid => {
    const tokens = gameState.tokens[pid] || [];
    playerProgress[pid] = tokens.reduce((sum, t) => sum + (t.steps || 0), 0);
  });
  
  let statusText = '';
  let statusClass = '';
  if (gameState.winner) {
    const winnerName = players.find(p => p.id === gameState.winner)?.name || 'Winner';
    statusText = `🏆 ${winnerName} escaped the Upside Down!`;
    statusClass = 'winner';
  } else if (isMyTurn) {
    if (!gameState.diceRolled) {
      statusText = '🎲 Your turn! Roll the dice!';
      statusClass = 'roll';
    } else if (gameState.validMoves && gameState.validMoves.length > 0) {
      statusText = '👆 Choose a piece to move';
      statusClass = 'move';
    } else {
      statusText = '😱 No valid moves! Turn passing...';
      statusClass = 'no-moves';
    }
  } else {
    statusText = `⏳ ${escapeHtml(currentPlayerName)}'s turn...`;
    statusClass = 'waiting';
  }
  
  elements.gameContent.innerHTML = `
    <div class="ludo-game">
      <div class="ludo-status ${statusClass}">${statusText}</div>
      
      <!-- Dice and Controls -->
      <div class="ludo-dice-section">
        <div class="ludo-dice ${gameState.lastDice ? 'rolled' : ''}" id="ludoDice">
          ${gameState.lastDice ? getDiceEmoji(gameState.lastDice) : '🎲'}
        </div>
        ${isMyTurn && !gameState.diceRolled && !gameState.winner ? `
          <button class="btn btn-primary ludo-roll-btn" id="ludoRollBtn">
            🎲 Roll Dice
          </button>
        ` : ''}
        ${gameState.lastDice === 6 ? '<div class="bonus-indicator">⭐ Bonus Turn!</div>' : ''}
      </div>
      
      <!-- Turn Order Display -->
      <div class="ludo-turn-order">
        ${gameState.playerOrder.map((playerId, idx) => {
          const player = players.find(p => p.id === playerId);
          const colorInfo = LUDO_COLORS[idx];
          const isCurrentPlayer = gameState.currentPlayer === playerId;
          const progress = playerProgress[playerId] || 0;
          const maxProgress = FINISH_STEP * 4; // 4 tokens * 56 steps
          
          return `
            <div class="turn-order-player ${isCurrentPlayer ? 'current' : ''}" 
                 style="--player-color: ${colorInfo.color}">
              <span class="turn-emoji">${colorInfo.emoji}</span>
              <span class="turn-name">${escapeHtml(player?.name || colorInfo.name).substring(0, 8)}</span>
              <span class="turn-score">${progress}/${maxProgress}</span>
              ${isCurrentPlayer ? '<span class="turn-arrow">◄</span>' : ''}
            </div>
          `;
        }).join('')}
      </div>
      
      <!-- Player Areas with Tokens -->
      <div class="ludo-player-areas">
        ${gameState.playerOrder.map((playerId, idx) => {
          const player = players.find(p => p.id === playerId);
          const colorInfo = LUDO_COLORS[idx];
          const tokens = gameState.tokens[playerId] || [];
          const isCurrentPlayer = gameState.currentPlayer === playerId;
          const isMe = playerId === state.playerId;
          const finishedCount = tokens.filter(t => t.position === 'finished').length;
          
          return `
            <div class="ludo-player-area ${isCurrentPlayer ? 'active' : ''} ${isMe ? 'is-me' : ''}" 
                 style="--player-color: ${colorInfo.color}; --player-light: ${colorInfo.light}">
              <div class="player-area-header">
                <span class="player-emoji">${colorInfo.emoji}</span>
                <span class="player-name">${escapeHtml(player?.name || colorInfo.name)}</span>
                <span class="finished-count">${finishedCount}/4 🏁</span>
                ${isCurrentPlayer ? '<span class="turn-indicator">🎯</span>' : ''}
              </div>
              
              <div class="player-tokens-grid">
                ${tokens.map((token, tokenIdx) => {
                  const isMovable = isMyTurn && gameState.validMoves && 
                    gameState.validMoves.some(m => m.tokenIndex === tokenIdx) &&
                    playerId === state.playerId;
                  
                  let tokenStatus = '';
                  let tokenProgress = 0;
                  const steps = token.steps || 0;
                  
                  if (token.position === 'home') {
                    tokenStatus = 'home';
                    tokenProgress = 0;
                  } else if (token.position === 'finished') {
                    tokenStatus = 'finished';
                    tokenProgress = 100;
                  } else if (typeof token.position === 'string' && token.position.startsWith('homeStretch')) {
                    tokenStatus = 'homeStretch';
                    tokenProgress = Math.round((steps / FINISH_STEP) * 100);
                  } else {
                    tokenStatus = 'onTrack';
                    tokenProgress = Math.round((steps / FINISH_STEP) * 100);
                  }
                  
                  return `
                    <div class="ludo-token-wrapper ${tokenStatus} ${isMovable ? 'movable' : ''}"
                         data-token-index="${tokenIdx}" data-player-id="${playerId}">
                      <div class="ludo-token" style="background: ${colorInfo.color}">
                        ${colorInfo.emoji}
                      </div>
                      <div class="token-progress-bar">
                        <div class="token-progress-fill" style="width: ${tokenProgress}%"></div>
                      </div>
                      <div class="token-status-text">
                        ${tokenStatus === 'home' ? '🏠' : 
                          tokenStatus === 'finished' ? '🏁' : 
                          `${steps}/${FINISH_STEP}`}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      
      <!-- Game Rules Info -->
      <div class="ludo-rules-hint">
        <span>🎯 Roll 6 to release</span>
        <span>🛡️ Safe spots protect</span>
        <span>💥 Capture = Bonus</span>
      </div>
    </div>
  `;
  
  // Add roll button handler
  const rollBtn = document.getElementById('ludoRollBtn');
  if (rollBtn) {
    rollBtn.addEventListener('click', () => {
      socket.emit('ludoRollDice');
      rollBtn.disabled = true;
    });
  }
  
  // Add token click handlers
  if (isMyTurn && gameState.diceRolled && gameState.validMoves && gameState.validMoves.length > 0) {
    document.querySelectorAll('.ludo-token-wrapper.movable').forEach(wrapper => {
      wrapper.addEventListener('click', () => {
        const tokenIndex = parseInt(wrapper.dataset.tokenIndex);
        socket.emit('ludoMoveToken', tokenIndex);
        // Disable further clicks
        document.querySelectorAll('.ludo-token-wrapper.movable').forEach(w => {
          w.classList.remove('movable');
        });
      });
    });
  }
  
  if (gameState.winner) {
    showPlayAgainButton('ludo');
  }
}

// Removed old renderLudoBoardHTML and helper functions - using new player-area based UI

function getDiceEmoji(value) {
  const diceEmojis = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  return diceEmojis[value] || '🎲';
}

function handleLudoDiceRoll(data) {
  // Update state with server data
  if (data.gameState) {
    state.gameState = { ...state.gameState, ...data.gameState };
  }
  state.gameState.lastDice = data.value;
  state.gameState.diceRolled = true;
  state.gameState.validMoves = data.validMoves;
  
  const dice = document.getElementById('ludoDice');
  if (dice) {
    dice.classList.add('rolled');
    setTimeout(() => {
      dice.textContent = getDiceEmoji(data.value);
      // Re-render to show movable tokens
      renderLudoBoard(state.gameState, state.players);
    }, 500);
  }
  
  // Update status
  const status = document.getElementById('ludoStatus');
  const isMyTurn = state.gameState.currentPlayer === state.playerId;
  if (status && isMyTurn) {
    if (data.validMoves && data.validMoves.length > 0) {
      status.textContent = '👆 Select a token to move';
    } else {
      status.textContent = '❌ No valid moves - passing turn...';
    }
  }
  
  // Re-render to show movable tokens
  renderLudoBoard(state.gameState, state.players);
}

function handleLudoTokenMoved(data) {
  // Update state with server data
  if (data.gameState) {
    state.gameState = { ...state.gameState, ...data.gameState };
  }
  state.gameState.tokens = data.tokens;
  
  // Show move info
  if (data.newPosition === 'start') {
    addChatMessage({
      system: true,
      message: `🎯 ${data.playerName} released a token!`
    }, elements.gameChatMessages);
  } else {
    addChatMessage({
      system: true,
      message: `🎲 ${data.playerName} moved ${data.diceValue || ''} steps`
    }, elements.gameChatMessages);
  }
  
  if (data.captured) {
    addChatMessage({
      system: true,
      message: `💥 ${data.playerName} captured an opponent! Bonus turn!`
    }, elements.gameChatMessages);
  }
  
  if (data.finished) {
    addChatMessage({
      system: true,
      message: `🏁 ${data.playerName} got a token home! Bonus turn!`
    }, elements.gameChatMessages);
  }
  
  renderLudoBoard(state.gameState, state.players);
  updateScoreBoard(state.players, state.gameState.currentPlayer);
}

function handleLudoTurnChange(data) {
  // Update state with server data
  if (data.gameState) {
    state.gameState = { ...state.gameState, ...data.gameState };
  }
  state.gameState.currentPlayer = data.currentPlayer;
  state.gameState.diceRolled = false;
  state.gameState.lastDice = null;
  state.gameState.validMoves = [];
  
  renderLudoBoard(state.gameState, state.players);
  updateScoreBoard(state.players, data.currentPlayer);
}

function handleLudoUpdate(data) {
  state.gameState = { ...state.gameState, ...data };
  
  if (data.winner) {
    const winnerName = state.players.find(p => p.id === data.winner)?.name || 'Winner';
    addChatMessage({
      system: true,
      message: `🏆 ${winnerName} wins the game!`
    }, elements.gameChatMessages);
  }
  
  renderLudoBoard(state.gameState, data.players || state.players);
  updateScoreBoard(data.players || state.players, state.gameState.currentPlayer);
}

// ============================================
// UTILITIES
// ============================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

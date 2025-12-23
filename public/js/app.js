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

// Register new game socket handlers if available
if (typeof window !== 'undefined' && typeof window.setupNewGameSocketHandlers === 'function') {
  try {
    window.setupNewGameSocketHandlers();
  } catch (err) {
    console.error('⚠️ Error setting up new game socket handlers:', err);
  }
} else {
  console.warn('⚠️ setupNewGameSocketHandlers is not available. New game socket handlers were not registered.');
}

// DOM Elements
const screens = {
  authScreen: document.getElementById('authScreen'),
  mainMenu: document.getElementById('mainMenu'),
  lobby: document.getElementById('lobby'),
  gameScreen: document.getElementById('gameScreen'),
  leaderboardScreen: document.getElementById('leaderboardScreen'),
  profileScreen: document.getElementById('profileScreen'),
  achievementsScreen: document.getElementById('achievementsScreen'),
  settingsScreen: document.getElementById('settingsScreen')
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
  // Challenge/match system state
  matchId: null,
  isSpectator: false,
  activeMatches: [],
  // AI Mode state
  isAIGame: false,
  aiDifficulty: 'medium',
  aiDifficulties: null
};

// AI Player constants (match server)
const AI_PLAYER_ID = 'AI_OPPONENT';
const AI_PLAYER_NAME = '🤖 Wednesday AI';

// Chess state
let chessState = {
  selectedSquare: null,
  validMoves: [],
  isMyTurn: false,
  myColor: null
};

// FIX Bug 8: Drawing state for drawing/guessing games
let drawingState = {
  canvas: null,
  ctx: null,
  isDrawing: false
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
  initAdvancedChat();
  
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
        
        // Wait for socket to connect before auto-login
        if (socket.connected) {
          socket.emit('login', auth);
        } else {
          socket.once('connect', () => {
            socket.emit('login', auth);
          });
        }
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
  // Auth tab switching with mobile support
  function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    const formType = tab.dataset.tab;
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginForm) loginForm.style.display = formType === 'login' ? 'block' : 'none';
    if (registerForm) registerForm.style.display = formType === 'register' ? 'block' : 'none';
    
    console.log('📋 Switched to', formType, 'form');
  }
  
  document.querySelectorAll('.auth-tab').forEach(tab => {
    // Click event for desktop
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchAuthTab(tab);
    });
    
    // Touch event for mobile
    tab.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchAuthTab(tab);
    });
  });
  
  console.log('✅ Auth tab listeners attached to', document.querySelectorAll('.auth-tab').length, 'tabs');
  
  // Login
  document.getElementById('loginBtn')?.addEventListener('click', () => {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
      showError('Enter username and password');
      return;
    }
    
    // Check socket connection
    if (!socket.connected) {
      showError('Connecting to server... Please try again in a moment.');
      console.log('⚠️ Socket not connected, attempting reconnect...');
      socket.connect();
      return;
    }
    
    console.log('📤 Sending login request for:', username);
    socket.emit('login', { username, password });
  });
  
  // Register - handle the registration process
  function handleRegister() {
    const username = document.getElementById('registerUsername')?.value?.trim();
    const password = document.getElementById('registerPassword')?.value;
    const displayName = document.getElementById('registerDisplayName')?.value?.trim();
    
    console.log('🔐 Register attempt:', { username, hasPassword: !!password });
    
    if (!username || !password) {
      showError('Enter username and password');
      return;
    }
    
    if (username.length < 3) {
      showError('Username must be at least 3 characters');
      return;
    }
    
    if (password.length < 4) {
      showError('Password must be at least 4 characters');
      return;
    }
    
    // Check socket connection
    if (!socket || !socket.connected) {
      showError('Connecting to server... Please try again in a moment.');
      console.log('⚠️ Socket not connected, attempting reconnect...');
      if (socket) socket.connect();
      return;
    }
    
    // Disable button during registration
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
      registerBtn.innerHTML = '<span class="btn-icon">⏳</span> Creating account...';
      registerBtn.disabled = true;
    }
    
    console.log('📤 Sending register request for:', username);
    socket.emit('register', { username, password, displayName: displayName || username });
    
    // Timeout to reset button if no response
    setTimeout(() => {
      const btn = document.getElementById('registerBtn');
      if (btn && btn.disabled) {
        btn.innerHTML = '<span class="btn-icon">🦇</span> Join Nevermore';
        btn.disabled = false;
        showError('Server not responding. Please try again.');
      }
    }, 10000); // 10 second timeout
  }
  
  // Add click event for register button
  const registerBtn = document.getElementById('registerBtn');
  if (registerBtn) {
    registerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleRegister();
    });
    // Also add touchend for mobile
    registerBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleRegister();
    });
    console.log('✅ Register button event listeners attached');
  } else {
    console.error('❌ Register button not found in DOM');
  }
  
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
  
  // Save session (for auto-login) - only if manually logging in (not auto-login)
  const loginUsername = document.getElementById('loginUsername')?.value.trim();
  const loginPassword = document.getElementById('loginPassword')?.value;
  const registerUsername = document.getElementById('registerUsername')?.value.trim();
  const registerPassword = document.getElementById('registerPassword')?.value;
  
  if (loginUsername && loginPassword) {
    localStorage.setItem('authSession', JSON.stringify({ 
      username: loginUsername, 
      password: loginPassword 
    }));
  } else if (registerUsername && registerPassword) {
    // Save newly registered account for auto-login
    localStorage.setItem('authSession', JSON.stringify({ 
      username: registerUsername, 
      password: registerPassword 
    }));
  }
  // Note: During auto-login, the saved session is preserved (not overwritten)
  
  // Use display name for player name
  if (elements.playerName) {
    elements.playerName.value = data.displayName;
  }
  
  // Reset login button state
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.innerHTML = '<span class="btn-icon">⚡</span> Enter the Archives';
    loginBtn.disabled = false;
  }
  
  // Reset register button state
  const registerBtn = document.getElementById('registerBtn');
  if (registerBtn) {
    registerBtn.innerHTML = '<span class="btn-icon">🦇</span> Join Nevermore';
    registerBtn.disabled = false;
  }
  
  // Reset password placeholder
  const loginPasswordEl = document.getElementById('loginPassword');
  if (loginPasswordEl) {
    loginPasswordEl.placeholder = 'Password';
  }
  
  // Clear registration fields
  const regUsername = document.getElementById('registerUsername');
  const regPassword = document.getElementById('registerPassword');
  const regDisplayName = document.getElementById('registerDisplayName');
  if (regUsername) regUsername.value = '';
  if (regPassword) regPassword.value = '';
  if (regDisplayName) regDisplayName.value = '';
  
  showScreen('mainMenu');
  updateUserInfoDisplay();
  const welcomeMsg = data.gamesPlayed === 0 ? `Welcome to Nevermore, ${data.displayName}! ${data.title}` : `Welcome back, ${data.displayName}! ${data.title}`;
  showNotification(welcomeMsg, 'success');
});

socket.on('authError', (data) => {
  showError(data.message);
  
  // Reset login button state
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.innerHTML = '<span class="btn-icon">⚡</span> Enter the Archives';
    loginBtn.disabled = false;
  }
  
  // Reset register button state
  const registerBtn = document.getElementById('registerBtn');
  if (registerBtn) {
    registerBtn.innerHTML = '<span class="btn-icon">🦇</span> Join Nevermore';
    registerBtn.disabled = false;
  }
  
  // Clear password field and reset placeholder
  const loginPassword = document.getElementById('loginPassword');
  if (loginPassword) {
    loginPassword.value = '';
    loginPassword.placeholder = 'Password';
  }
  
  // Clear register password field
  const registerPassword = document.getElementById('registerPassword');
  if (registerPassword) {
    registerPassword.value = '';
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
  
  // Send message from mobile chat - use global sendMobileChat function
  sendMobileChatBtn?.addEventListener('click', () => {
    if (typeof window.sendMobileChat === 'function') {
      window.sendMobileChat();
    } else {
      // Fallback
      const message = mobileChatInput.value.trim();
      if (!message) return;
      socket.emit('chatMessage', { message });
      mobileChatInput.value = '';
    }
  });
  mobileChatInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      if (typeof window.sendMobileChat === 'function') {
        window.sendMobileChat();
      } else {
        const message = mobileChatInput.value.trim();
        if (!message) return;
        socket.emit('chatMessage', { message });
        mobileChatInput.value = '';
      }
    }
  });
  
  // Sync mobile chat with main chat - properly clone messages with click handlers
  window.syncMobileChat = function() {
    if (!mobileChatMessages || !elements.gameChatMessages) return;
    
    // Clone all messages from game chat to mobile chat
    mobileChatMessages.innerHTML = '';
    
    const gameMessages = elements.gameChatMessages.querySelectorAll('.chat-message');
    gameMessages.forEach(msg => {
      const clone = msg.cloneNode(true);
      // Update the chat type for mobile
      clone.dataset.chatType = 'mobile';
      
      // Re-add click handler if this is a clickable message
      if (clone.dataset.msgId && !clone.classList.contains('system')) {
        clone.style.cursor = 'pointer';
        clone.title = 'Click to reply';
        clone.addEventListener('click', (e) => {
          e.stopPropagation();
          setReplyToByType('mobile', clone.dataset.msgId, clone.dataset.msgPlayerName, clone.dataset.msgText);
        });
      }
      
      mobileChatMessages.appendChild(clone);
    });
    
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
  
  // AI Mode button
  document.getElementById('playAIBtn')?.addEventListener('click', showAIGameSelection);
  
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
// 🤖 AI MODE (Play vs Wednesday AI)
// ============================================

const AI_GAMES = ['tictactoe', 'chess', 'memory', 'psychic', 'connect4'];

function showAIGameSelection() {
  const name = elements.playerName.value.trim();
  if (!name) {
    showError('Enter your name first, mortal.');
    elements.playerName.focus();
    return;
  }
  
  const modal = document.getElementById('votingModal');
  if (!modal) return;
  
  modal.innerHTML = `
    <div class="voting-modal-content ai-selection-modal">
      <h3>🤖 Challenge Wednesday AI</h3>
      <p class="modal-subtitle">Select your doom:</p>
      <div class="ai-games-grid">
        <button class="game-card ai-game-card" data-game="tictactoe">
          <span class="game-icon">⭕❌</span>
          <span class="game-name">Tic-Tac-Toe</span>
        </button>
        <button class="game-card ai-game-card" data-game="chess">
          <span class="game-icon">♟️👑</span>
          <span class="game-name">Chess</span>
        </button>
        <button class="game-card ai-game-card" data-game="memory">
          <span class="game-icon">🃏</span>
          <span class="game-name">Memory Match</span>
        </button>
        <button class="game-card ai-game-card" data-game="psychic">
          <span class="game-icon">🔮⚡</span>
          <span class="game-name">Psychic Showdown</span>
        </button>
        <button class="game-card ai-game-card" data-game="connect4">
          <span class="game-icon">🔴🟡</span>
          <span class="game-name">Connect 4</span>
        </button>
      </div>
      <button class="btn btn-secondary" id="cancelAISelection" style="margin-top: 20px;">Cancel</button>
    </div>
  `;
  modal.classList.add('active');
  
  // Game selection
  modal.querySelectorAll('.ai-game-card').forEach(card => {
    card.addEventListener('click', () => {
      const gameType = card.dataset.game;
      modal.classList.remove('active');
      showAIDifficultySelection(gameType);
    });
  });
  
  document.getElementById('cancelAISelection')?.addEventListener('click', () => {
    modal.classList.remove('active');
  });
}

function showAIDifficultySelection(gameType) {
  const modal = document.getElementById('votingModal');
  if (!modal) return;
  
  const gameNames = {
    tictactoe: '⭕❌ Tic-Tac-Toe',
    chess: '♟️ Chess',
    memory: '🃏 Memory Match',
    psychic: '🔮 Psychic Showdown',
    connect4: '🔴 Connect 4'
  };
  
  modal.innerHTML = `
    <div class="voting-modal-content ai-difficulty-modal">
      <h3>${gameNames[gameType] || gameType}</h3>
      <p class="modal-subtitle">Choose AI difficulty:</p>
      <div class="difficulty-options ai-difficulty-options">
        <button class="difficulty-btn ai-diff-btn" data-difficulty="easy">
          <span class="diff-icon">😊</span>
          <div>
            <span class="diff-name">Easy</span>
            <span class="diff-desc">For beginners</span>
          </div>
        </button>
        <button class="difficulty-btn ai-diff-btn" data-difficulty="medium">
          <span class="diff-icon">🤔</span>
          <div>
            <span class="diff-name">Medium</span>
            <span class="diff-desc">A fair challenge</span>
          </div>
        </button>
        <button class="difficulty-btn ai-diff-btn" data-difficulty="hard">
          <span class="diff-icon">😈</span>
          <div>
            <span class="diff-name">Hard</span>
            <span class="diff-desc">Prepare to lose</span>
          </div>
        </button>
        <button class="difficulty-btn ai-diff-btn impossible" data-difficulty="impossible">
          <span class="diff-icon">💀</span>
          <div>
            <span class="diff-name">Impossible</span>
            <span class="diff-desc">You cannot win</span>
          </div>
        </button>
      </div>
      <button class="btn btn-secondary" id="backToAIGames" style="margin-top: 20px;">← Back</button>
    </div>
  `;
  modal.classList.add('active');
  
  modal.querySelectorAll('.ai-diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const difficulty = btn.dataset.difficulty;
      modal.classList.remove('active');
      
      // For memory game, ask for grid size
      if (gameType === 'memory') {
        showAIMemoryOptions(difficulty);
      } else if (gameType === 'connect4') {
        showAIConnect4Options(difficulty);
      } else {
        createAIRoom(gameType, difficulty);
      }
    });
  });
  
  document.getElementById('backToAIGames')?.addEventListener('click', () => {
    showAIGameSelection();
  });
}

function showAIMemoryOptions(difficulty) {
  const modal = document.getElementById('votingModal');
  modal.innerHTML = `
    <div class="voting-modal-content">
      <h3>🃏 Memory Grid Size</h3>
      <div class="difficulty-options">
        <button class="difficulty-btn" data-size="easy">
          <span class="diff-icon">😊</span>
          <div>
            <span class="diff-name">Easy</span>
            <span class="diff-desc">4×3 (6 pairs)</span>
          </div>
        </button>
        <button class="difficulty-btn" data-size="hard">
          <span class="diff-icon">😈</span>
          <div>
            <span class="diff-name">Hard</span>
            <span class="diff-desc">4×4 (8 pairs)</span>
          </div>
        </button>
        <button class="difficulty-btn" data-size="insane">
          <span class="diff-icon">💀</span>
          <div>
            <span class="diff-name">Insane</span>
            <span class="diff-desc">6×4 (12 pairs)</span>
          </div>
        </button>
      </div>
    </div>
  `;
  modal.classList.add('active');
  
  modal.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.classList.remove('active');
      createAIRoom('memory', difficulty, { difficulty: btn.dataset.size });
    });
  });
}

function showAIConnect4Options(difficulty) {
  const modal = document.getElementById('votingModal');
  modal.innerHTML = `
    <div class="voting-modal-content">
      <h3>🔴🟡 Connect Mode</h3>
      <div class="difficulty-options">
        <button class="difficulty-btn" data-win="4">
          <span class="diff-icon">4️⃣</span>
          <div>
            <span class="diff-name">Connect 4</span>
            <span class="diff-desc">Classic</span>
          </div>
        </button>
        <button class="difficulty-btn" data-win="5">
          <span class="diff-icon">5️⃣</span>
          <div>
            <span class="diff-name">Connect 5</span>
            <span class="diff-desc">Harder</span>
          </div>
        </button>
      </div>
    </div>
  `;
  modal.classList.add('active');
  
  modal.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.classList.remove('active');
      createAIRoom('connect4', difficulty, { winCondition: parseInt(btn.dataset.win) });
    });
  });
}

function createAIRoom(gameType, difficulty, options = {}) {
  const name = elements.playerName.value.trim();
  state.playerName = name;
  state.isAIGame = true;
  state.aiDifficulty = difficulty;
  
  localStorage.setItem('playerName', name);
  
  socket.emit('createAIRoom', { 
    playerName: name, 
    gameType, 
    difficulty 
  });
  
  // Store options for game start
  state.pendingAIOptions = options;
  state.pendingAIGame = gameType;
}

// AI Socket Events
socket.on('aiRoomCreated', (data) => {
  state.roomId = data.roomId;
  state.players = data.players;
  state.aiDifficulties = data.aiDifficulties;
  state.isAIGame = true;
  
  // Start the game immediately
  const options = state.pendingAIOptions || {};
  socket.emit('startAIGame', { 
    gameType: data.gameType || state.pendingAIGame, 
    options 
  });
  
  showNotification(`🤖 Entering the AI realm...`, 'info');
});

socket.on('leftAIRoom', () => {
  state.isAIGame = false;
  state.roomId = null;
  state.currentGame = null;
  showScreen('mainMenu');
});

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
  elements.playersList.innerHTML = players.map(p => `
    <div class="player-item ${p.id === state.playerId ? 'is-me' : ''} ${p.inMatch ? 'in-game' : ''}">
      <span class="player-color-indicator" style="background: ${p.color || '#e50914'}"></span>
      <span class="player-name" style="color: ${p.color || '#e50914'}">${escapeHtml(p.name)}</span>
      ${p.username ? `<span class="verified-badge" title="Registered">✓</span>` : ''}
      ${p.inMatch ? '<span class="in-game-badge" title="In a game">🎮</span>' : ''}
      <span class="score" title="Trophies this session">🏆 ${p.trophies || 0}</span>
    </div>
  `).join('');
  
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
      <button class="game-card new-game" data-game="hangman">
        <span class="game-icon">🎯💀</span>
        <span class="game-name">Hangman<br>Challenge</span>
        <span class="game-players">2+ players</span>
        <span class="new-badge">NEW</span>
      </button>
      <button class="game-card new-game" data-game="wordchain">
        <span class="game-icon">⛓️📝</span>
        <span class="game-name">Word<br>Chain</span>
        <span class="game-players">2+ players</span>
        <span class="new-badge">NEW</span>
      </button>
      <button class="game-card new-game" data-game="reaction">
        <span class="game-icon">🔀✨</span>
        <span class="game-name">Word<br>Scramble</span>
        <span class="game-players">2+ players</span>
        <span class="new-badge">NEW</span>
      </button>
      <button class="game-card new-game" data-game="battleship">
        <span class="game-icon">🚢💥</span>
        <span class="game-name">Battleship<br>Hawkins</span>
        <span class="game-players">2 players</span>
        <span class="new-badge">NEW</span>
      </button>
      <button class="game-card new-game" data-game="poker">
        <span class="game-icon">🃏♠️</span>
        <span class="game-name">Texas<br>Hold'em</span>
        <span class="game-players">2-6 players</span>
        <span class="new-badge">NEW</span>
      </button>
      <button class="game-card new-game" data-game="blackjack">
        <span class="game-icon">🎰🃏</span>
        <span class="game-name">Blackjack<br>21</span>
        <span class="game-players">2+ players</span>
        <span class="new-badge">NEW</span>
      </button>
      <button class="game-card new-game" data-game="game24">
        <span class="game-icon">🔢🎯</span>
        <span class="game-name">Make<br>24</span>
        <span class="game-players">2+ players</span>
        <span class="new-badge">NEW</span>
      </button>
    </div>
    <p class="voting-hint">💡 Click "Start Voting" then everyone picks a game. Most votes wins!</p>
  `;
}

// 2-player games that use challenge system
const TWO_PLAYER_GAMES = ['tictactoe', 'chess', 'connect4'];

// Handle game selection
function handleGameSelection(gameType) {
  // If voting is active, use voting system
  if (state.votingActive) {
    handleVote(gameType);
    return;
  }
  
  // For 2-player games, show player selection modal
  if (TWO_PLAYER_GAMES.includes(gameType)) {
    showPlayerSelectionModal(gameType);
    return;
  }
  
  // For multiplayer games, use normal flow
  if (gameType === 'memory') {
    showMemoryDifficultyModal();
  } else if (gameType === 'sudoku') {
    showSudokuDifficultyModal();
  } else {
    startGame(gameType);
  }
}

// Show player selection modal for 2-player games
function showPlayerSelectionModal(gameType) {
  const modal = document.getElementById('votingModal');
  if (!modal) return;
  
  // Get other players (not me, not already in a game)
  const availablePlayers = state.players.filter(p => 
    p.id !== state.playerId && !p.inGame
  );
  
  const gameNames = {
    'tictactoe': '⭕❌ Tic-Tac-Toe',
    'chess': '♟️ Chess',
    'connect4': '🔴🟡 Connect 4'
  };
  
  // Build player list HTML
  const playerListHtml = availablePlayers.map(p => `
    <button class="player-select-btn" data-player-id="${p.id}">
      <span class="player-color-dot" style="background: ${p.color || '#e50914'}"></span>
      <span class="player-select-name">${escapeHtml(p.name)}</span>
      ${p.username ? '<span class="verified-small">✓</span>' : ''}
    </button>
  `).join('');
  
  // Wednesday AI option removed - use dedicated AI mode instead
  
  modal.innerHTML = `
    <div class="voting-modal-content player-select-modal">
      <h3>${gameNames[gameType] || gameType}</h3>
      <p class="modal-subtitle">Choose your opponent:</p>
      <div class="player-select-list">
        ${playerListHtml}
      </div>
      <button class="btn btn-secondary" style="margin-top: 15px;" id="cancelPlayerSelect">Cancel</button>
    </div>
  `;
  modal.classList.add('active');
  
  // Add click handlers
  modal.querySelectorAll('.player-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.playerId;
      modal.classList.remove('active');
      
      // Regular player challenge
      if (gameType === 'connect4') {
        showConnect4OptionsAndChallenge(targetId);
      } else {
        sendChallenge(targetId, gameType, {});
      }
    });
  });
  
  document.getElementById('cancelPlayerSelect')?.addEventListener('click', () => {
    modal.classList.remove('active');
  });
}

// Show AI difficulty selection for challenge from lobby
// REMOVED: Challenge Wednesday from rooms - use dedicated AI mode instead
/* function showAIDifficultyForChallenge(gameType, options = {}) {
  const modal = document.getElementById('votingModal');
  if (!modal) return;
  
  modal.innerHTML = `
    <div class="voting-modal-content">
      <h3>🤖 Challenge Wednesday</h3>
      <p class="modal-subtitle">Select difficulty:</p>
      <div class="difficulty-options">
        <button class="difficulty-btn ai-diff" data-diff="easy">
          <span class="diff-icon">😊</span>
          <div>
            <strong>Easy</strong>
            <small>For beginners</small>
          </div>
        </button>
        <button class="difficulty-btn ai-diff" data-diff="medium">
          <span class="diff-icon">🤔</span>
          <div>
            <strong>Medium</strong>
            <small>A fair challenge</small>
          </div>
        </button>
        <button class="difficulty-btn ai-diff" data-diff="hard">
          <span class="diff-icon">😈</span>
          <div>
            <strong>Hard</strong>
            <small>Good luck</small>
          </div>
        </button>
        <button class="difficulty-btn ai-diff impossible" data-diff="impossible">
          <span class="diff-icon">💀</span>
          <div>
            <strong>Impossible</strong>
            <small>Wednesday's wrath</small>
          </div>
        </button>
      </div>
      <button class="btn btn-secondary" style="margin-top: 15px;" id="cancelAIDiff">Cancel</button>
    </div>
  `;
  modal.classList.add('active');
  
  modal.querySelectorAll('.ai-diff').forEach(btn => {
    btn.addEventListener('click', () => {
      const difficulty = btn.dataset.diff;
      modal.classList.remove('active');
      // Start AI game from within the room
      socket.emit('challengeWednesday', { gameType, difficulty, options });
    });
  });
  
  document.getElementById('cancelAIDiff')?.addEventListener('click', () => {
    modal.classList.remove('active');
  });
} */

// Show Connect4 options for AI game
function showConnect4AIOptions(gameType) {
  const modal = document.getElementById('votingModal');
  modal.innerHTML = `
    <div class="voting-modal-content">
      <h3>🔴🟡 Choose Mode vs Wednesday</h3>
      <div class="difficulty-options">
        <button class="difficulty-btn" data-win="4">
          <span class="diff-icon">4️⃣</span>
          <div>
            <strong>Connect 4</strong>
            <small>Classic mode</small>
          </div>
        </button>
        <button class="difficulty-btn" data-win="5">
          <span class="diff-icon">5️⃣</span>
          <div>
            <strong>Connect 5</strong>
            <small>Extended challenge</small>
          </div>
        </button>
      </div>
      <button class="btn btn-secondary" style="margin-top: 15px;" id="cancelC4AI">Cancel</button>
    </div>
  `;
  modal.classList.add('active');
  
  modal.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const winCondition = parseInt(btn.dataset.win);
      modal.classList.remove('active');
      // Now show difficulty selection
      showAIDifficultyForChallenge('connect4', { winCondition });
    });
  });
  
  document.getElementById('cancelC4AI')?.addEventListener('click', () => {
    modal.classList.remove('active');
  });
}

// Show Connect4 options then send challenge
function showConnect4OptionsAndChallenge(targetPlayerId) {
  const modal = document.getElementById('votingModal');
  modal.innerHTML = `
    <div class="voting-modal-content">
      <h3>🔴🟡 Choose Mode</h3>
      <div class="difficulty-options">
        <button class="difficulty-btn" data-win="4">
          <span class="diff-icon">4️⃣</span>
          <div>
            <span class="diff-name">Connect 4</span>
            <span class="diff-desc">Classic</span>
          </div>
        </button>
        <button class="difficulty-btn" data-win="5">
          <span class="diff-icon">5️⃣</span>
          <div>
            <span class="diff-name">Connect 5</span>
            <span class="diff-desc">Harder</span>
          </div>
        </button>
      </div>
      <button class="btn btn-secondary" style="margin-top: 15px;" id="cancelConnect4">Cancel</button>
    </div>
  `;
  modal.classList.add('active');
  
  modal.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const winCondition = parseInt(btn.dataset.win);
      modal.classList.remove('active');
      sendChallenge(targetPlayerId, 'connect4', { winCondition });
    });
  });
  
  document.getElementById('cancelConnect4')?.addEventListener('click', () => {
    modal.classList.remove('active');
  });
}

// Send challenge to another player
function sendChallenge(targetPlayerId, gameType, options) {
  const targetPlayer = state.players.find(p => p.id === targetPlayerId);
  socket.emit('challengePlayer', { targetPlayerId, gameType, options });
  showNotification(`Challenge sent to ${targetPlayer?.name || 'player'}!`, 'info');
}

// Show incoming challenge popup
function showIncomingChallenge(data) {
  const modal = document.getElementById('votingModal');
  const gameNames = {
    'tictactoe': '⭕❌ Tic-Tac-Toe',
    'chess': '♟️ Chess',
    'connect4': '🔴🟡 Connect 4'
  };
  
  modal.innerHTML = `
    <div class="voting-modal-content challenge-received">
      <h3>⚔️ Challenge!</h3>
      <p class="challenger-info">${escapeHtml(data.challengerName)} wants to play:</p>
      <div class="challenge-game-name">${gameNames[data.gameType] || data.gameType}</div>
      <div class="challenge-buttons">
        <button class="btn btn-primary" id="acceptChallenge">Accept</button>
        <button class="btn btn-danger" id="declineChallenge">Decline</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
  
  document.getElementById('acceptChallenge')?.addEventListener('click', () => {
    socket.emit('acceptChallenge', { challengeId: data.challengeId });
    modal.classList.remove('active');
  });
  
  document.getElementById('declineChallenge')?.addEventListener('click', () => {
    socket.emit('declineChallenge', { challengeId: data.challengeId });
    modal.classList.remove('active');
  });
}

// Simple notification function
function showNotification(message, type = 'info') {
  // Use existing error toast for now, but style differently
  const toast = document.getElementById('errorToast');
  if (toast) {
    toast.textContent = message;
    toast.className = `toast ${type} active`;
    setTimeout(() => {
      toast.classList.remove('active');
    }, 3000);
  }
}

// Floating translucent notification (for in-game player join alerts)
function showFloatingNotification(message) {
  // Create or reuse floating notification element
  let floater = document.getElementById('floatingNotification');
  if (!floater) {
    floater = document.createElement('div');
    floater.id = 'floatingNotification';
    floater.className = 'floating-notification';
    document.body.appendChild(floater);
  }
  
  floater.textContent = message;
  floater.classList.add('active');
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    floater.classList.remove('active');
  }, 3000);
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
  
  const chatData = { message };
  if (replyState.lobby.replyTo) {
    chatData.replyTo = replyState.lobby.replyTo;
    cancelReply('lobby');
  }
  
  socket.emit('chatMessage', chatData);
  elements.chatInput.value = '';
}

function sendGameChat() {
  const message = elements.gameChatInput.value.trim();
  if (!message) return;
  
  const chatData = { message };
  if (replyState.game.replyTo) {
    chatData.replyTo = replyState.game.replyTo;
    cancelReply('game');
  }
  
  socket.emit('chatMessage', chatData);
  elements.gameChatInput.value = '';
}

function sendMobileChat() {
  const input = document.getElementById('mobileChatInput');
  const message = input ? input.value.trim() : '';
  if (!message) return;
  
  const chatData = { message };
  if (replyState.mobile.replyTo) {
    chatData.replyTo = replyState.mobile.replyTo;
    cancelReply('mobile');
  }
  
  socket.emit('chatMessage', chatData);
  if (input) input.value = '';
}
// Make available globally for mobile chat overlay
window.sendMobileChat = sendMobileChat;

// Reply state
const replyState = {
  lobby: { replyTo: null },
  game: { replyTo: null },
  mobile: { replyTo: null }
};

function addChatMessage(msg, container = elements.chatMessages) {
  const div = document.createElement('div');
  let className = 'chat-message chat-notification';
  if (msg.isGuess) className += ' guess';
  if (msg.system) className += ' system';
  if (msg.isAI) className += ' ai-message';
  if (msg.playerId === state.playerId) className += ' is-me';
  
  // Check if player is mentioned
  const playerName = state.playerName || '';
  if (msg.message && playerName && msg.message.toLowerCase().includes(playerName.toLowerCase())) {
    className += ' mentioned';
  }
  
  div.className = className;
  
  // Store message ID for reply functionality
  if (msg.id) {
    div.dataset.msgId = msg.id;
    div.dataset.msgPlayerName = msg.playerName || '';
    div.dataset.msgText = msg.message || '';
  }
  
  const timestamp = msg.timestamp ? formatMessageTime(msg.timestamp) : getTimeString();
  
  if (msg.system) {
    div.innerHTML = `
      <span class="message">${escapeHtml(msg.message)}</span>
      <span class="timestamp">${timestamp}</span>
    `;
  } else {
    // Use player color if available, fallback to default
    const senderColor = msg.color || msg.playerColor || (msg.isAI ? '#9333ea' : '#ff2a6d');
    const aiIcon = msg.isAI ? '' : '';
    const wednesdayIcon = msg.playerName === '🖤 Wednesday' ? '' : '';
    
    // Build reply context if this is a reply
    let replyHtml = '';
    if (msg.replyTo && msg.replyTo.playerName) {
      const replyText = (msg.replyTo.text || '').substring(0, 50) + (msg.replyTo.text && msg.replyTo.text.length > 50 ? '...' : '');
      replyHtml = `<div class="reply-context">↩ ${escapeHtml(msg.replyTo.playerName)}: ${escapeHtml(replyText)}</div>`;
    }
    
    // Format message with simple markdown support
    let formattedMessage = escapeHtml(msg.message);
    // Bold: **text** -> <strong>text</strong>
    formattedMessage = formattedMessage.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic: *text* -> <em>text</em>
    formattedMessage = formattedMessage.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Highlight @Wednesday mentions
    formattedMessage = formattedMessage.replace(/@wednesday/gi, '<span class="wednesday-mention">@Wednesday</span>');
    
    div.innerHTML = `
      ${replyHtml}
      <span class="sender" style="color: ${senderColor}">${aiIcon}${wednesdayIcon}${escapeHtml(msg.playerName)}:</span>
      <span class="message">${formattedMessage}</span>
      <span class="timestamp">${timestamp}</span>
    `;
  }
  
  // Add click handler for reply (only for non-system messages)
  if (!msg.system && msg.id) {
    // Add data attribute to identify chat type
    if (container.id === 'gameChatMessages' || container === elements.gameChatMessages) {
      div.dataset.chatType = 'game';
    } else if (container.id === 'mobileChatMessages') {
      div.dataset.chatType = 'mobile';
    } else {
      div.dataset.chatType = 'lobby';
    }
    
    div.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent event bubbling issues
      const chatType = div.dataset.chatType;
      setReplyToByType(chatType, msg.id, msg.playerName, msg.message);
    });
    div.style.cursor = 'pointer';
    div.title = 'Click to reply';
  }
  
  container.appendChild(div);
  
  // Smart scroll - only auto-scroll if already near bottom
  const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
  if (isNearBottom) {
    container.scrollTop = container.scrollHeight;
  } else {
    // Show scroll button if not at bottom
    showScrollToBottomButton(container);
  }
  
  // Play notification sound if enabled and not own message
  if (chatSettings.soundEnabled && msg.playerId !== state.playerId && !msg.system) {
    playMessageSound();
  }
  
  // Sync to mobile chat if this is the game chat
  if (container === elements.gameChatMessages && typeof syncMobileChat === 'function') {
    syncMobileChat();
  }
}

// Format message timestamp
function formatMessageTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Clear chat containers
function clearChat() {
  if (elements.chatMessages) elements.chatMessages.innerHTML = '';
  if (elements.gameChatMessages) elements.gameChatMessages.innerHTML = '';
  const mobileChat = document.getElementById('mobileChatMessages');
  if (mobileChat) mobileChat.innerHTML = '';
}

// Load chat history
function loadChatHistory(history) {
  history.forEach(msg => {
    addChatMessage(msg, elements.chatMessages);
  });
}

// Set reply to a message by chat type (more reliable)
function setReplyToByType(chatType, msgId, playerName, text) {
  const configs = {
    lobby: {
      stateKey: 'lobby',
      previewId: 'replyPreview',
      nameId: 'replyToName',
      textId: 'replyToText',
      inputId: 'chatInput'
    },
    game: {
      stateKey: 'game',
      previewId: 'gameReplyPreview',
      nameId: 'gameReplyToName',
      textId: 'gameReplyToText',
      inputId: 'gameChatInput'
    },
    mobile: {
      stateKey: 'mobile',
      previewId: 'mobileReplyPreview',
      nameId: 'mobileReplyToName',
      textId: 'mobileReplyToText',
      inputId: 'mobileChatInput'
    }
  };
  
  const config = configs[chatType] || configs.lobby;
  
  replyState[config.stateKey].replyTo = { id: msgId, playerName, text };
  
  const preview = document.getElementById(config.previewId);
  const nameEl = document.getElementById(config.nameId);
  const textEl = document.getElementById(config.textId);
  const input = document.getElementById(config.inputId);
  
  if (preview && nameEl && textEl) {
    nameEl.textContent = playerName;
    textEl.textContent = text.substring(0, 50) + (text.length > 50 ? '...' : '');
    preview.style.display = 'flex';
  }
  
  if (input) input.focus();
}

// Set reply to a message (legacy, uses container reference)
function setReplyTo(container, msgId, playerName, text) {
  let chatType = 'lobby';
  
  // Check both reference and ID for game chat (more reliable)
  if (container === elements.gameChatMessages || container.id === 'gameChatMessages') {
    chatType = 'game';
  } else if (container.id === 'mobileChatMessages') {
    chatType = 'mobile';
  }
  
  setReplyToByType(chatType, msgId, playerName, text);
}

// Cancel reply
function cancelReply(stateKey) {
  replyState[stateKey].replyTo = null;
  
  const previewIds = {
    lobby: 'replyPreview',
    game: 'gameReplyPreview',
    mobile: 'mobileReplyPreview'
  };
  
  const preview = document.getElementById(previewIds[stateKey]);
  if (preview) preview.style.display = 'none';
}

// Show scroll to bottom button
function showScrollToBottomButton(container) {
  let btnId = 'scrollToBottomBtn';
  if (container === elements.gameChatMessages) btnId = 'gameScrollToBottomBtn';
  else if (container.id === 'mobileChatMessages') btnId = 'mobileScrollToBottomBtn';
  
  const btn = document.getElementById(btnId);
  if (btn) btn.style.display = 'flex';
}

// Hide scroll to bottom button
function hideScrollToBottomButton(container) {
  let btnId = 'scrollToBottomBtn';
  if (container === elements.gameChatMessages) btnId = 'gameScrollToBottomBtn';
  else if (container.id === 'mobileChatMessages') btnId = 'mobileScrollToBottomBtn';
  
  const btn = document.getElementById(btnId);
  if (btn) btn.style.display = 'none';
}

// Scroll to bottom of chat
function scrollChatToBottom(container) {
  container.scrollTop = container.scrollHeight;
  hideScrollToBottomButton(container);
}

// ============================================
// 💬 ADVANCED CHAT FEATURES
// ============================================

// Chat settings
const chatSettings = {
  soundEnabled: true,
  lastTypingTime: 0,
  typingTimeout: null
};

// Initialize advanced chat features
function initAdvancedChat() {
  // Sound toggle
  const soundToggle = document.getElementById('chatSoundToggle');
  if (soundToggle) {
    // Load saved preference
    const savedSound = localStorage.getItem('chatSoundEnabled');
    if (savedSound !== null) {
      chatSettings.soundEnabled = savedSound === 'true';
      soundToggle.classList.toggle('muted', !chatSettings.soundEnabled);
      soundToggle.textContent = chatSettings.soundEnabled ? '🔔' : '🔕';
    }
    
    soundToggle.addEventListener('click', () => {
      chatSettings.soundEnabled = !chatSettings.soundEnabled;
      localStorage.setItem('chatSoundEnabled', chatSettings.soundEnabled);
      soundToggle.classList.toggle('muted', !chatSettings.soundEnabled);
      soundToggle.textContent = chatSettings.soundEnabled ? '🔔' : '🔕';
      showNotification(chatSettings.soundEnabled ? '🔔 Sound enabled' : '🔕 Sound muted', 'info');
    });
  }
  
  // Typing indicator - send typing status
  const chatInput = document.getElementById('chatInput');
  const gameChatInput = document.getElementById('gameChatInput');
  const mobileChatInput = document.getElementById('mobileChatInput');
  
  [chatInput, gameChatInput, mobileChatInput].forEach(input => {
    if (input) {
      input.addEventListener('input', () => {
        const now = Date.now();
        if (now - chatSettings.lastTypingTime > 2000) {
          chatSettings.lastTypingTime = now;
          socket.emit('typing', { isTyping: true });
        }
        
        // Clear previous timeout
        if (chatSettings.typingTimeout) {
          clearTimeout(chatSettings.typingTimeout);
        }
        
        // Stop typing after 3 seconds of no input
        chatSettings.typingTimeout = setTimeout(() => {
          socket.emit('typing', { isTyping: false });
        }, 3000);
      });
      
      // Stop typing on send
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          if (chatSettings.typingTimeout) {
            clearTimeout(chatSettings.typingTimeout);
          }
          socket.emit('typing', { isTyping: false });
        }
      });
    }
  });
  
  // Scroll to bottom buttons
  const scrollToBottomBtn = document.getElementById('scrollToBottomBtn');
  const gameScrollToBottomBtn = document.getElementById('gameScrollToBottomBtn');
  const mobileScrollToBottomBtn = document.getElementById('mobileScrollToBottomBtn');
  
  if (scrollToBottomBtn) {
    scrollToBottomBtn.addEventListener('click', () => {
      scrollChatToBottom(elements.chatMessages);
    });
  }
  if (gameScrollToBottomBtn) {
    gameScrollToBottomBtn.addEventListener('click', () => {
      scrollChatToBottom(elements.gameChatMessages);
    });
  }
  if (mobileScrollToBottomBtn) {
    mobileScrollToBottomBtn.addEventListener('click', () => {
      const mobileChat = document.getElementById('mobileChatMessages');
      if (mobileChat) scrollChatToBottom(mobileChat);
    });
  }
  
  // Hide scroll button when at bottom
  [elements.chatMessages, elements.gameChatMessages].forEach(container => {
    if (container) {
      container.addEventListener('scroll', () => {
        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
        if (isAtBottom) {
          hideScrollToBottomButton(container);
        }
      });
    }
  });
  
  // Mobile chat scroll
  const mobileChat = document.getElementById('mobileChatMessages');
  if (mobileChat) {
    mobileChat.addEventListener('scroll', () => {
      const isAtBottom = mobileChat.scrollHeight - mobileChat.scrollTop - mobileChat.clientHeight < 50;
      if (isAtBottom) {
        hideScrollToBottomButton(mobileChat);
      }
    });
  }
  
  // Cancel reply buttons
  const cancelReplyBtn = document.getElementById('cancelReplyBtn');
  const gameCancelReplyBtn = document.getElementById('gameCancelReplyBtn');
  const mobileCancelReplyBtn = document.getElementById('mobileCancelReplyBtn');
  
  if (cancelReplyBtn) {
    cancelReplyBtn.addEventListener('click', () => cancelReply('lobby'));
  }
  if (gameCancelReplyBtn) {
    gameCancelReplyBtn.addEventListener('click', () => cancelReply('game'));
  }
  if (mobileCancelReplyBtn) {
    mobileCancelReplyBtn.addEventListener('click', () => cancelReply('mobile'));
  }
  
  // Wednesday buttons - quick summon
  const wednesdayBtn = document.getElementById('wednesdayBtn');
  const gameWednesdayBtn = document.getElementById('gameWednesdayBtn');
  const mobileWednesdayBtn = document.getElementById('mobileWednesdayBtn');
  
  if (wednesdayBtn) {
    wednesdayBtn.addEventListener('click', () => {
      const input = document.getElementById('chatInput');
      if (input) {
        input.value = '@Wednesday ' + input.value;
        input.focus();
        wednesdayBtn.classList.add('active');
        setTimeout(() => wednesdayBtn.classList.remove('active'), 300);
      }
    });
  }
  if (gameWednesdayBtn) {
    gameWednesdayBtn.addEventListener('click', () => {
      const input = document.getElementById('gameChatInput');
      if (input) {
        input.value = '@Wednesday ' + input.value;
        input.focus();
        gameWednesdayBtn.classList.add('active');
        setTimeout(() => gameWednesdayBtn.classList.remove('active'), 300);
      }
    });
  }
  if (mobileWednesdayBtn) {
    mobileWednesdayBtn.addEventListener('click', () => {
      const input = document.getElementById('mobileChatInput');
      if (input) {
        input.value = '@Wednesday ' + input.value;
        input.focus();
        mobileWednesdayBtn.classList.add('active');
        setTimeout(() => mobileWednesdayBtn.classList.remove('active'), 300);
      }
    });
  }
}

// Update unread badge
function updateUnreadBadge(container) {
  if (container === elements.chatMessages) {
    const badge = document.getElementById('unreadBadge');
    if (badge) {
      const count = parseInt(badge.textContent || '0') + 1;
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'block';
    }
  }
}

// Play message notification sound
function playMessageSound() {
  if (!chatSettings.soundEnabled) return;
  
  try {
    // Create a simple beep using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.1;
    
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) {
    // Audio not supported, fail silently
  }
}

// Get time string for message
function getTimeString() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Handle typing indicator from server
socket.on('userTyping', (data) => {
  const indicator = data.inGame ? 
    document.getElementById('gameTypingIndicator') : 
    document.getElementById('typingIndicator');
  
  if (indicator) {
    if (data.isTyping && data.playerName && data.playerId !== state.playerId) {
      indicator.textContent = `${data.playerName} is typing...`;
    } else {
      indicator.textContent = '';
    }
  }
});

// ============================================
// GAME MANAGEMENT
// ============================================

function startGame(gameType) {
  socket.emit('startGame', gameType);
}

// FIX Bug 9: Define backToLobby function
function backToLobby() {
  console.log('🔙 Returning to lobby');
  endGame();
}

function endGame() {
  // Clean up any game-specific listeners
  document.removeEventListener('keydown', handleSudokuKeypress);
  window.sudokuKeyboardListenerAdded = false;
  
  if (state.isAIGame) {
    socket.emit('leaveAIRoom');
    state.isAIGame = false;
    state.roomId = null;
    state.currentGame = null;
    showScreen('mainMenu');
  } else {
    socket.emit('endGame');
  }
}

function closeResults() {
  elements.resultsModal.classList.remove('active');
  
  if (state.isAIGame) {
    // For AI games, offer play again or return to menu
    showAIPlayAgainModal();
  } else {
    // Actually return to lobby - send endGame to server
    socket.emit('endGame');
  }
}

function showAIPlayAgainModal() {
  const modal = document.getElementById('votingModal');
  if (!modal) {
    endGame();
    return;
  }
  
  modal.innerHTML = `
    <div class="voting-modal-content">
      <h3>🎮 Game Over</h3>
      <div class="ai-end-options">
        <button class="btn btn-primary" id="aiPlayAgainBtn">
          <span class="btn-icon">🔄</span> Play Again
        </button>
        <button class="btn btn-secondary" id="aiChangeDifficultyBtn">
          <span class="btn-icon">⚙️</span> Change Difficulty
        </button>
        <button class="btn btn-ghost" id="aiExitBtn">
          <span class="btn-icon">🚪</span> Exit to Menu
        </button>
      </div>
    </div>
  `;
  modal.classList.add('active');
  
  document.getElementById('aiPlayAgainBtn')?.addEventListener('click', () => {
    modal.classList.remove('active');
    socket.emit('restartAIGame', { type: state.currentGame });
  });
  
  document.getElementById('aiChangeDifficultyBtn')?.addEventListener('click', () => {
    modal.classList.remove('active');
    endGame();
    showAIDifficultySelection(state.currentGame);
  });
  
  document.getElementById('aiExitBtn')?.addEventListener('click', () => {
    modal.classList.remove('active');
    endGame();
  });
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
  console.log('🎮 initTicTacToe called with:', { gameState, players, playerId: state.playerId });
  
  if (!gameState || !gameState.playerSymbols) {
    console.error('Invalid game state:', gameState);
    elements.gameContent.innerHTML = '<div style="text-align:center;color:red;">Error: Invalid game state</div>';
    return;
  }
  
  state.gameState = gameState;
  elements.gameTitle.textContent = '⭕ Upside Down Tic-Tac-Toe ❌';
  
  // Handle playerSymbols whether it's a Map or Object
  let playerSymbols;
  if (gameState.playerSymbols instanceof Map) {
    playerSymbols = gameState.playerSymbols;
  } else {
    playerSymbols = new Map(Object.entries(gameState.playerSymbols));
  }
  state.gameState.playerSymbols = playerSymbols;
  
  const mySymbol = playerSymbols.get(state.playerId);
  const isSpectator = state.isSpectator || !mySymbol;
  
  // Update "Now Playing" display
  if (players && players.length > 0) {
    updateNowPlayingDisplay(players);
  }
  
  // Add spectator badge if watching
  if (isSpectator) {
    addSpectatorBadge();
  }
  
  // Determine status message
  let statusMessage;
  if (isSpectator) {
    statusMessage = '👁️ Watching...';
  } else if (gameState.currentPlayer === state.playerId) {
    statusMessage = '🔴 Your turn!';
  } else if (state.isAIGame && gameState.currentPlayer === AI_PLAYER_ID) {
    statusMessage = '<span class="ai-thinking">🤖 Wednesday is thinking...</span>';
  } else {
    statusMessage = 'Waiting for opponent...';
  }

  elements.gameContent.innerHTML = `
    <div class="ttt-container">
      <div class="ttt-status" id="tttStatus">
        ${statusMessage}
      </div>
      <div class="ttt-board" id="tttBoard">
        ${gameState.board.map((cell, i) => `
          <div class="ttt-cell ${cell ? 'taken' : ''}" data-index="${i}">${cell || ''}</div>
        `).join('')}
      </div>
      <div class="ttt-info" style="margin-top: 20px; color: var(--text-secondary);">
        ${isSpectator ? '👁️ Spectating' : `Your symbol: ${mySymbol}`}
      </div>
    </div>
  `;
  
  if (!isSpectator) {
    document.querySelectorAll('.ttt-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        if (state.gameState.currentPlayer !== state.playerId) return;
        if (cell.classList.contains('taken')) return;
        // Use correct socket event based on game mode
        if (state.matchId) {
          socket.emit('matchMove', { matchId: state.matchId, moveData: { cellIndex: parseInt(cell.dataset.index) }});
        } else if (state.isAIGame) {
          socket.emit('aiTttMove', parseInt(cell.dataset.index));
        } else {
          socket.emit('tttMove', parseInt(cell.dataset.index));
        }
      });
    });
  }
  
  updateScoreBoard(players, gameState.currentPlayer);
}

// Add spectator badge to screen with leave button
function addSpectatorBadge() {
  let badge = document.getElementById('spectatorBadge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'spectatorBadge';
    badge.className = 'spectator-badge';
    badge.innerHTML = '👁️ SPECTATING <button class="leave-spectate-btn" onclick="leaveSpectate()">✕ Leave</button>';
    document.body.appendChild(badge);
  }
}

// Remove spectator badge
function removeSpectatorBadge() {
  const badge = document.getElementById('spectatorBadge');
  if (badge) badge.remove();
}

// Leave spectating mode
function leaveSpectate() {
  if (state.matchId && state.isSpectator) {
    socket.emit('leaveSpectate', { matchId: state.matchId });
    state.matchId = null;
    state.isSpectator = false;
    state.currentGame = null;
    state.gameState = {};
    removeSpectatorBadge();
    showScreen('lobby');
  }
}

// Update the "Now Playing" display next to End Game button
function updateNowPlayingDisplay(players) {
  const display = document.getElementById('nowPlayingDisplay');
  if (!display) return;
  
  if (!players || players.length === 0) {
    display.innerHTML = '';
    return;
  }
  
  const names = players.map(p => p.name).join(' vs ');
  display.innerHTML = `<span class="now-playing-label">🎮</span><span class="now-playing-names">${escapeHtml(names)}</span>`;
}

// Clear the "Now Playing" display
function clearNowPlayingDisplay() {
  const display = document.getElementById('nowPlayingDisplay');
  if (display) display.innerHTML = '';
}

function updateTicTacToe(data) {
  const board = document.getElementById('tttBoard');
  const status = document.getElementById('tttStatus');
  const isSpectator = state.isSpectator;
  
  if (!board || !status) return;
  
  // FIX Bug 5: Update playerSymbols if provided
  if (data.playerSymbols) {
    state.gameState.playerSymbols = data.playerSymbols;
  }
  
  if (data.board) {
    state.gameState.board = data.board;
    board.innerHTML = data.board.map((cell, i) => `
      <div class="ttt-cell ${cell ? 'taken' : ''}" data-index="${i}">${cell || ''}</div>
    `).join('');
    
    if (!isSpectator) {
      document.querySelectorAll('.ttt-cell').forEach(cell => {
        cell.addEventListener('click', () => {
          if (state.gameState.currentPlayer !== state.playerId) return;
          if (cell.classList.contains('taken')) return;
          if (state.matchId) {
            socket.emit('matchMove', { matchId: state.matchId, moveData: { cellIndex: parseInt(cell.dataset.index) }});
          } else if (state.isAIGame) {
            socket.emit('aiTttMove', parseInt(cell.dataset.index));
          } else {
            socket.emit('tttMove', parseInt(cell.dataset.index));
          }
        });
      });
    }
  }
  
  // Use players from data if available (for real-time score updates)
  const players = data.players || state.players;
  
  if (data.winner) {
    status.innerHTML = `🏆 ${escapeHtml(data.winnerName)} wins! 🏆`;
    updateScoreBoard(players);
    if (!state.matchId) showPlayAgainButton('ttt');
  } else if (data.draw) {
    status.innerHTML = "🤝 It's a draw! 🤝";
    if (!state.matchId) showPlayAgainButton('ttt');
  } else if (data.currentPlayer) {
    // FIX Bug 6: Delay currentPlayer update to prevent race condition
    setTimeout(() => {
      state.gameState.currentPlayer = data.currentPlayer;
      if (isSpectator) {
        status.innerHTML = '👁️ Watching...';
      } else if (data.currentPlayer === state.playerId) {
        status.innerHTML = '🔴 Your turn!';
      } else if (state.isAIGame && data.currentPlayer === AI_PLAYER_ID) {
        status.innerHTML = '<span class="ai-thinking">🤖 Wednesday is thinking...</span>';
      } else {
        status.innerHTML = 'Waiting for opponent...';
      }
      updateScoreBoard(players, data.currentPlayer);
    }, 50); // Small delay to ensure board renders first
  }
}

// Play Again button handler
function showPlayAgainButton(gameType) {
  const container = document.querySelector(`.${gameType}-container`) || elements.gameContent;
  
  // Remove existing play again button if any
  const existingBtn = container.querySelector('.play-again-container');
  if (existingBtn) existingBtn.remove();
  
  const playAgainDiv = document.createElement('div');
  playAgainDiv.className = 'play-again-container';
  
  // Different buttons for AI mode vs regular mode
  if (state.isAIGame) {
    playAgainDiv.innerHTML = `
      <button class="btn btn-primary play-again-btn" id="playAgainBtn">
        <span class="btn-icon">🔄</span> Play Again
      </button>
      <button class="btn btn-secondary" id="aiChangeDiffBtn">
        <span class="btn-icon">⚙️</span> Change Difficulty
      </button>
      <button class="btn btn-ghost" id="aiExitToMenuBtn">
        <span class="btn-icon">🚪</span> Exit to Menu
      </button>
    `;
    container.appendChild(playAgainDiv);
    
    document.getElementById('playAgainBtn')?.addEventListener('click', () => {
      const options = {};
      if (state.currentGame === 'memory' && state.gameState.difficulty) {
        options.difficulty = state.gameState.difficulty;
      }
      socket.emit('restartAIGame', { type: state.currentGame, options });
    });
    
    document.getElementById('aiChangeDiffBtn')?.addEventListener('click', () => {
      const currentGame = state.currentGame;
      endGame();
      showAIDifficultySelection(currentGame);
    });
    
    document.getElementById('aiExitToMenuBtn')?.addEventListener('click', () => {
      endGame();
    });
  } else {
    playAgainDiv.innerHTML = `
      <button class="btn btn-primary play-again-btn" id="playAgainBtn">
        <span class="btn-icon">🔄</span> Play Again
      </button>
      <button class="btn btn-secondary back-to-lobby-btn" id="backToLobbyFromGame">
        <span class="btn-icon">🏠</span> Back to Lobby
      </button>
    `;
    container.appendChild(playAgainDiv);
    
    document.getElementById('playAgainBtn')?.addEventListener('click', () => {
      if (state.currentGame === 'memory' && state.gameState.difficulty) {
        socket.emit('restartGame', { type: 'memory', options: { difficulty: state.gameState.difficulty } });
      } else if (state.currentGame === 'sudoku' && state.gameState.difficulty) {
        socket.emit('restartGame', { type: 'sudoku', options: { difficulty: state.gameState.difficulty } });
      } else {
        socket.emit('restartGame', state.currentGame);
      }
    });
    
    document.getElementById('backToLobbyFromGame')?.addEventListener('click', () => {
      socket.emit('endGame');
    });
  }
}

// ============================================
// MEMORY GAME
// ============================================

function initMemoryGame(gameState, players) {
  console.log('🎮 initMemoryGame called with:', { gameState, players, playerId: state.playerId });
  
  if (!gameState || !gameState.cards) {
    console.error('Invalid memory game state:', gameState);
    elements.gameContent.innerHTML = '<div style="text-align:center;color:red;">Error: Invalid game state</div>';
    return;
  }
  
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
  
  // Determine status message
  let memoryStatusMsg;
  if (gameState.currentPlayer === state.playerId) {
    memoryStatusMsg = "🧠 Your turn to find a match!";
  } else if (state.isAIGame && gameState.currentPlayer === AI_PLAYER_ID) {
    memoryStatusMsg = '<span class="ai-thinking">🤖 Wednesday is searching...</span>';
  } else {
    memoryStatusMsg = "Watching...";
  }

  elements.gameContent.innerHTML = `
    <div class="memory-container">
      <div class="memory-status" id="memoryStatus">
        ${memoryStatusMsg}
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
      if (state.isAIGame) {
        socket.emit('aiMemoryFlip', parseInt(card.dataset.index));
      } else {
        socket.emit('memoryFlip', parseInt(card.dataset.index));
      }
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
    if (data.currentPlayer === state.playerId) {
      status.innerHTML = "🧠 Your turn to find a match!";
    } else if (state.isAIGame && data.currentPlayer === AI_PLAYER_ID) {
      status.innerHTML = '<span class="ai-thinking">🤖 Wednesday is searching...</span>';
    } else {
      status.innerHTML = "Watching...";
    }
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
  console.log('🎮 initChessGame called with:', { gameState, players, playerId: state.playerId });
  
  if (!gameState || !gameState.board) {
    console.error('Invalid chess game state:', gameState);
    elements.gameContent.innerHTML = '<div style="text-align:center;color:red;">Error: Invalid game state</div>';
    return;
  }
  
  state.gameState = gameState;
  elements.gameTitle.textContent = '♟️ Vecna\'s Chess 👑';
  
  const isWhitePlayer = gameState.whitePlayer === state.playerId;
  const isBlackPlayer = gameState.blackPlayer === state.playerId;
  chessState.myColor = isWhitePlayer ? 'white' : (isBlackPlayer ? 'black' : null);
  chessState.isMyTurn = gameState.currentPlayer === state.playerId;
  chessState.selectedSquare = null;
  chessState.validMoves = [];
  
  // Handle AI player names
  const whiteName = players.find(p => p.id === gameState.whitePlayer)?.name || (gameState.whitePlayer === AI_PLAYER_ID ? AI_PLAYER_NAME : 'White');
  const blackName = players.find(p => p.id === gameState.blackPlayer)?.name || (gameState.blackPlayer === AI_PLAYER_ID ? AI_PLAYER_NAME : 'Black');
  
  // Update "Now Playing" display
  if (players && players.length > 0) {
    updateNowPlayingDisplay(players);
  }
  
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
    if (state.matchId) {
      socket.emit('matchMove', { 
        matchId: state.matchId, 
        moveData: { from: [fromRow, fromCol], to: [row, col] }
      });
    } else if (state.isAIGame) {
      socket.emit('aiChessMove', {
        from: [fromRow, fromCol],
        to: [row, col]
      });
    } else {
      socket.emit('chessMove', {
        from: [fromRow, fromCol],
        to: [row, col]
      });
    }
    
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
  console.log('🎮 initPsychicGame called with:', { gameState, players });
  
  if (!gameState) {
    console.error('Invalid psychic game state:', gameState);
    elements.gameContent.innerHTML = '<div style="text-align:center;color:red;">Error: Invalid game state</div>';
    return;
  }
  
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
      if (state.isAIGame) {
        socket.emit('aiPsychicMove', choice.dataset.choice);
      } else {
        socket.emit('psychicMove', choice.dataset.choice);
      }
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
  updateConnectionStatus('disconnected', '❌', 'Server offline - Please wait, connecting to Railway...');
});

socket.on('disconnect', () => {
  console.log('🔌 Disconnected from server');
  updateConnectionStatus('disconnected', '🔌', 'Disconnected from server');
});

// Forced logout (account logged in elsewhere)
socket.on('forcedLogout', (data) => {
  console.log('⚠️ Forced logout:', data.message);
  showError(data.message);
  state.isAuthenticated = false;
  state.username = null;
  state.userStats = null;
  localStorage.removeItem('authSession');
  showScreen('authScreen');
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
  
  // Clear and load chat history
  clearChat();
  if (data.chatHistory && data.chatHistory.length > 0) {
    loadChatHistory(data.chatHistory);
  }
  
  showScreen('lobby');
});

socket.on('roomJoined', (data) => {
  state.roomId = data.roomId;
  state.isHost = false;
  state.players = data.players;
  state.activeMatches = data.activeMatches || [];
  elements.displayRoomCode.textContent = data.roomId;
  updatePlayersList(data.players);
  
  // Clear and load chat history (new joiners get empty history)
  clearChat();
  if (data.chatHistory && data.chatHistory.length > 0) {
    loadChatHistory(data.chatHistory);
  }
  
  // Display active matches if any
  if (data.activeMatches && data.activeMatches.length > 0) {
    updateActiveMatchesDisplay(data.activeMatches);
  }
  
  showScreen('lobby');
});

socket.on('playerJoined', (data) => {
  updatePlayersList(data.players);
  addChatMessage({ system: true, message: '👤 A new outcast has arrived!' });
  
  // Show floating notification for new player (especially for those in-game)
  if (data.newPlayer && data.newPlayer.id !== state.playerId) {
    showFloatingNotification(`${data.newPlayer.name} joined the room`);
  }
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

// Challenge system events
socket.on('challengeReceived', (data) => {
  showIncomingChallenge(data);
});

socket.on('challengeDeclined', (data) => {
  showNotification(`${data.playerName} declined your challenge`, 'error');
});

socket.on('challengeCancelled', (data) => {
  const modal = document.getElementById('votingModal');
  if (modal) modal.classList.remove('active');
  showNotification(data.message || 'Challenge was cancelled', 'info');
});

socket.on('matchStarted', (data) => {
  // A 2-player match started - could be us or spectating
  console.log('🎮 Match started:', data);
  
  // Remove spectator badge from previous match
  removeSpectatorBadge();
  
  if (data.players.some(p => p.id === state.playerId)) {
    // We're in the match - start the game
    state.currentGame = data.gameType;
    state.matchId = data.matchId;
    state.isSpectator = false;
    
    // Check if this is an AI match
    if (data.isAIMatch) {
      state.isAIGame = true;
      state.aiDifficulty = data.aiDifficulty;
      showNotification(`🤖 Match vs Wednesday (${data.aiDifficulty})!`, 'info');
    } else {
      state.isAIGame = false;
      state.aiDifficulty = null;
      if (data.autoRotation) {
        showNotification('🔄 New round! Your turn to play!', 'info');
      }
    }
    
    showScreen('gameScreen');
    initMatchGame(data);
  } else if (data.isSpectator) {
    // We're spectating this match
    state.currentGame = data.gameType;
    state.matchId = data.matchId;
    state.isSpectator = false;
    state.isAIGame = false;
    
    if (data.autoRotation) {
      showNotification('🔄 New round started - you\'re next in queue!', 'info');
    }
    
    showScreen('gameScreen');
    initMatchGame(data);
  } else {
    // We're in the lobby - update to show match in progress
    updateLobbyWithActiveMatch(data);
  }
});

socket.on('matchUpdate', (data) => {
  // Update match state (for both players and spectators)
  if (state.matchId === data.matchId) {
    handleMatchUpdate(data);
  }
});

// Track pending AI end options timeout so we can cancel it
let aiEndOptionsTimeout = null;

socket.on('matchEnded', (data) => {
  console.log('🏁 Match ended:', data);
  const wasMyMatch = state.matchId === data.matchId;
  const savedMatchId = state.matchId;
  const wasAIGame = state.isAIGame; // Save before potentially clearing
  const currentGame = state.currentGame;
  state.matchId = null;
  state.isSpectator = false;
  
  // Remove spectator badge if present
  removeSpectatorBadge();
  
  // Show results
  if (data.winner) {
    showNotification(`🏆 ${data.winner.name} wins!`, 'success');
  } else if (data.draw) {
    showNotification(`🤝 It's a draw!`, 'info');
  }
  
  // If this was an AI match, show replay options
  if (wasMyMatch && wasAIGame) {
    // Cancel any existing timeout
    if (aiEndOptionsTimeout) {
      clearTimeout(aiEndOptionsTimeout);
    }
    // Show options after a brief delay for the win/draw message to display
    aiEndOptionsTimeout = setTimeout(() => {
      // Only show if still on game screen and still AI game
      if (state.isAIGame && document.getElementById('gameScreen')?.classList.contains('active')) {
        showAIMatchEndOptions(currentGame);
      }
      aiEndOptionsTimeout = null;
    }, 800);
    return;
  }
  
  // If no auto-rotation (new match starting), return to lobby
  if (wasMyMatch && !data.autoRotation) {
    setTimeout(() => {
      state.currentGame = null;
      state.gameState = {};
      showScreen('lobby');
    }, 2000);
  }
});

// Show end options for AI matches
function showAIMatchEndOptions(gameType) {
  const modal = document.getElementById('votingModal');
  if (!modal) return;
  
  // Prevent showing if modal is already active with AI options
  if (modal.classList.contains('active') && modal.querySelector('.ai-end-options')) {
    return;
  }
  
  // FIX Bug 4: Capture winCondition immediately before state is cleared
  const savedWinCondition = state.gameState?.winCondition || 4;
  
  const gameNames = {
    'tictactoe': '⭕❌ Tic-Tac-Toe',
    'chess': '♟️ Chess',
    'connect4': '🔴🟡 Connect 4'
  };
  
  modal.innerHTML = `
    <div class="voting-modal-content">
      <h3>🏁 Game Over!</h3>
      <p class="modal-subtitle">${gameNames[gameType] || gameType} vs Wednesday</p>
      <div class="ai-end-options">
        <button class="btn btn-primary ai-end-btn" id="aiRematchBtn">
          <span class="btn-icon">🔄</span> Play Again
        </button>
        <button class="btn btn-secondary ai-end-btn" id="aiChangeDiffBtn">
          <span class="btn-icon">⚙️</span> Change Difficulty
        </button>
        <button class="btn btn-ghost ai-end-btn" id="aiBackToLobbyBtn">
          <span class="btn-icon">🚪</span> Back to Lobby
        </button>
      </div>
    </div>
  `;
  modal.classList.add('active');
  
  document.getElementById('aiRematchBtn')?.addEventListener('click', () => {
    modal.classList.remove('active');
    // Rechallenge Wednesday with same difficulty using saved winCondition
    socket.emit('challengeWednesday', { 
      gameType: gameType, 
      difficulty: state.aiDifficulty || 'medium',
      options: gameType === 'connect4' ? { winCondition: savedWinCondition } : {}
    });
  });
  
  document.getElementById('aiChangeDiffBtn')?.addEventListener('click', () => {
    modal.classList.remove('active');
    // Show difficulty selection
    if (gameType === 'connect4') {
      showConnect4AIOptions(gameType);
    } else {
      showAIDifficultyForChallenge(gameType);
    }
  });
  
  document.getElementById('aiBackToLobbyBtn')?.addEventListener('click', () => {
    modal.classList.remove('active');
    // Clear any pending timeout
    if (aiEndOptionsTimeout) {
      clearTimeout(aiEndOptionsTimeout);
      aiEndOptionsTimeout = null;
    }
    state.currentGame = null;
    state.gameState = {};
    state.isAIGame = false;
    state.aiDifficulty = null;
    showScreen('lobby');
  });
}

socket.on('activeMatchesUpdate', (data) => {
  // Update lobby display with current matches
  updateActiveMatchesDisplay(data.matches);
});

// Initialize match game based on type
function initMatchGame(data) {
  switch (data.gameType) {
    case 'tictactoe':
      initTicTacToe(data.gameState, data.players);
      break;
    case 'chess':
      initChessGame(data.gameState, data.players);
      break;
    case 'connect4':
      initConnect4Game(data.gameState, data.players);
      break;
    default:
      console.error('Unknown match game type:', data.gameType);
  }
}

// Handle match updates
function handleMatchUpdate(data) {
  // Update state with match game state
  state.gameState = { ...state.gameState, ...data.gameState };
  
  // Update "Now Playing" display with current player info
  if (data.players) {
    updateNowPlayingDisplay(data.players);
  }
  
  switch (data.gameType) {
    case 'tictactoe':
      updateTicTacToe({ ...data.gameState, players: data.players || state.players });
      break;
    case 'chess':
      handleChessUpdate({ ...data.gameState, players: data.players || state.players });
      break;
    case 'connect4':
      handleConnect4Update({ ...data.gameState, players: data.players || state.players });
      break;
  }
}

// Update lobby with active match info
function updateLobbyWithActiveMatch(matchData) {
  state.activeMatches = state.activeMatches || [];
  const existingIdx = state.activeMatches.findIndex(m => m.matchId === matchData.matchId);
  if (existingIdx >= 0) {
    state.activeMatches[existingIdx] = matchData;
  } else {
    state.activeMatches.push(matchData);
  }
  updateActiveMatchesDisplay(state.activeMatches);
}

// Display active matches in lobby
function updateActiveMatchesDisplay(matches) {
  let container = document.getElementById('activeMatchesContainer');
  
  if (!matches || matches.length === 0) {
    if (container) container.remove();
    return;
  }
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'activeMatchesContainer';
    container.className = 'active-matches-container';
    // Insert before game cards
    const gameCards = document.querySelector('.game-cards');
    if (gameCards) {
      gameCards.parentNode.insertBefore(container, gameCards);
    }
  }
  
  const gameNames = {
    'tictactoe': '⭕❌ Tic-Tac-Toe',
    'chess': '♟️ Chess',
    'connect4': '🔴🟡 Connect 4'
  };
  
  container.innerHTML = `
    <h4 class="active-matches-title">🎮 Games in Progress</h4>
    <div class="active-matches-list">
      ${matches.map(m => `
        <div class="active-match-card" data-match-id="${m.matchId}">
          <span class="match-game">${gameNames[m.gameType] || m.gameType}</span>
          <span class="match-players">${m.players.map(p => escapeHtml(p.name)).join(' vs ')}</span>
          <button class="btn-spectate" onclick="spectateMatch('${m.matchId}')">👁️ Watch</button>
        </div>
      `).join('')}
    </div>
  `;
}

// Spectate a match
function spectateMatch(matchId) {
  socket.emit('spectateMatch', { matchId });
  state.isSpectator = true;
  state.matchId = matchId;
}

// Spectator joined notification
socket.on('spectatorJoined', (data) => {
  if (!state.isSpectator) {
    showNotification(`👁️ ${data.playerName} is watching`, 'info');
  }
});

// Game events
socket.on('gameStarted', (data) => {
  console.log('🎮 Game started:', data.gameType || data.game, data.gameState || data.state);
  
  // Support both formats (regular and AI)
  const gameType = data.gameType || data.game;
  const gameState = data.gameState || data.state;
  
  // Handle AI game flag
  if (data.isAIGame) {
    state.isAIGame = true;
    state.aiDifficulty = data.aiDifficulty;
  }
  
  state.currentGame = gameType;
  state.players = data.players;
  showScreen('gameScreen');
  
  // Add AI indicator to game title if AI game
  if (state.isAIGame) {
    const diffEmoji = { easy: '😊', medium: '🤔', hard: '😈', impossible: '💀' };
    setTimeout(() => {
      const existingIndicator = document.querySelector('.ai-indicator');
      if (!existingIndicator) {
        const indicator = document.createElement('span');
        indicator.className = 'ai-indicator';
        indicator.textContent = ` vs AI ${diffEmoji[state.aiDifficulty] || '🤖'}`;
        elements.gameTitle.appendChild(indicator);
      }
    }, 100);
  }
  
  try {
    switch (gameType) {
      case 'tictactoe':
        initTicTacToe(gameState, data.players);
        break;
      case 'memory':
        initMemoryGame(gameState, data.players);
        break;
      case 'trivia':
        initTrivia(gameState, data.players);
        break;
      case 'chess':
        initChessGame(gameState, data.players);
        break;
      case 'psychic':
        initPsychicGame(gameState, data.players);
        break;
      case 'sudoku':
        initSudokuGame(gameState, data.players);
        break;
      case 'connect4':
        initConnect4Game(gameState, data.players);
        break;
      case 'molewhack':
        initMoleWhackGame(gameState, data.players);
        break;
      case 'mathquiz':
        initMathQuizGame(gameState, data.players);
        break;
      case 'ludo':
        initLudoGame(gameState, data.players);
        break;
      case 'hangman':
        initHangman(gameState, data.players);
        break;
      case 'wordchain':
        initWordChain(gameState, data.players);
        break;
      case 'reaction':
        initReactionTest(gameState, data.players);
        break;
      case 'battleship':
        // For battleship, we need to transform the game state to player-specific view
        const battleshipState = {
          phase: gameState.phase,
          currentPlayer: gameState.currentPlayer,
          myBoard: gameState.boards?.[state.playerId] || Array(10).fill(null).map(() => Array(10).fill(null)),
          enemyShots: [],
          myShots: [],
          placedShips: gameState.ships?.[state.playerId]?.map(s => s.index) || [],
          allShipsPlaced: false,
          isReady: gameState.placementReady?.[state.playerId] || false
        };
        initBattleship(battleshipState, data.players);
        break;
      case 'drawing':
        initDrawingGuess(gameState, data.players);
        break;
      case 'poker':
        if (typeof initPoker === 'function') {
          initPoker(gameState, data.players);
        }
        break;
      case 'blackjack':
        if (typeof initBlackjack === 'function') {
          initBlackjack(gameState, data.players);
        }
        break;
      case 'game24':
        if (typeof init24Game === 'function') {
          init24Game(gameState, data.players);
        }
        break;
      default:
        console.error('Unknown game type:', gameType);
        elements.gameContent.innerHTML = '<div style="text-align:center;color:red;">Unknown game type: ' + gameType + '</div>';
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
  // For AI games, go to main menu instead of lobby
  if (state.isAIGame) {
    state.isAIGame = false;
    state.currentGame = null;
    state.gameState = {};
    state.roomId = null;
    elements.gameContent.innerHTML = '';
    elements.resultsModal.classList.remove('active');
    document.getElementById('votingModal')?.classList.remove('active');
    showScreen('mainMenu');
    return;
  }
  
  state.currentGame = null;
  state.gameState = {};
  state.players = data.players;
  state.votingActive = false;
  state.matchId = null;
  state.isSpectator = false;
  
  // Remove spectator badge if present
  removeSpectatorBadge();
  
  // Clear now playing display
  clearNowPlayingDisplay();
  
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

// Hangman
socket.on('hangmanUpdate', updateHangman);

// Word Chain
socket.on('wordChainUpdate', updateWordChain);

// Reaction Test
socket.on('reactionUpdate', updateReactionTest);
socket.on('reactionCountdown', (data) => {
  if (typeof updateReactionTest === 'function') {
    updateReactionTest({ status: 'countdown', ...data });
  }
});
socket.on('reactionTarget', (data) => {
  if (typeof updateReactionTest === 'function') {
    updateReactionTest({ status: 'react', ...data });
  }
});
socket.on('reactionResults', (data) => {
  if (typeof updateReactionTest === 'function') {
    updateReactionTest({ status: 'results', ...data });
  }
});

// Battleship
socket.on('battleshipUpdate', updateBattleship);

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
  
  // Close any open modals
  const votingModal = document.getElementById('votingModal');
  if (votingModal) votingModal.classList.remove('active');
  
  state.currentGame = data.gameType;
  state.players = data.players;
  
  // Keep AI game state
  if (data.isAIGame) {
    state.isAIGame = true;
  }
  
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
      case 'hangman':
        initHangman(data.gameState, data.players);
        break;
      case 'wordchain':
        initWordChain(data.gameState, data.players);
        break;
      case 'reaction':
        initReactionTest(data.gameState, data.players);
        break;
      case 'battleship':
        // For battleship, transform the game state to player-specific view
        const bsState = {
          phase: data.gameState.phase,
          currentPlayer: data.gameState.currentPlayer,
          myBoard: data.gameState.boards?.[state.playerId] || Array(10).fill(null).map(() => Array(10).fill(null)),
          enemyShots: [],
          myShots: [],
          placedShips: data.gameState.ships?.[state.playerId]?.map(s => s.index) || [],
          allShipsPlaced: false,
          isReady: data.gameState.placementReady?.[state.playerId] || false
        };
        initBattleship(bsState, data.players);
        break;
      case 'drawing':
        initDrawingGuess(data.gameState, data.players);
        break;
      case 'poker':
        if (typeof initPoker === 'function') {
          initPoker(data.gameState, data.players);
        }
        break;
      case 'blackjack':
        if (typeof initBlackjack === 'function') {
          initBlackjack(data.gameState, data.players);
        }
        break;
      case 'game24':
        if (typeof init24Game === 'function') {
          init24Game(data.gameState, data.players);
        }
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
  
  // Update "Now Playing" display
  if (players && players.length > 0) {
    updateNowPlayingDisplay(players);
  }
  
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
  const player1Name = player1?.name || (gameState.player1 === AI_PLAYER_ID ? AI_PLAYER_NAME : 'Player 1');
  const player2Name = player2?.name || (gameState.player2 === AI_PLAYER_ID ? AI_PLAYER_NAME : 'Player 2');
  const isMyTurn = gameState.currentPlayer === state.playerId;
  const myPiece = state.playerId === gameState.player1 ? '🔴' : '🟡';
  
  let statusText = '';
  if (gameState.winner) {
    const winnerPlayer = players.find(p => p.id === gameState.winner);
    const winnerName = winnerPlayer?.name || (gameState.winner === AI_PLAYER_ID ? AI_PLAYER_NAME : 'Winner');
    statusText = `🏆 ${winnerName} wins!`;
  } else if (gameState.isDraw) {
    statusText = "🤝 It's a draw!";
  } else if (isMyTurn) {
    statusText = `🎯 Your turn! (${myPiece})`;
  } else if (state.isAIGame && gameState.currentPlayer === AI_PLAYER_ID) {
    statusText = '<span class="ai-thinking">🤖 Wednesday is plotting...</span>';
  } else {
    statusText = "⏳ Opponent's turn...";
  }
  
  elements.gameContent.innerHTML = `
    <div class="connect4-container">
      <div class="connect4-status" id="connect4Status">${statusText}</div>
      <div class="connect4-players">
        <span class="c4-player ${gameState.currentPlayer === gameState.player1 ? 'active' : ''}">
          🔴 ${escapeHtml(player1Name)}
        </span>
        <span class="c4-player ${gameState.currentPlayer === gameState.player2 ? 'active' : ''}">
          🟡 ${escapeHtml(player2Name)}
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
        if (state.matchId) {
          socket.emit('matchMove', { matchId: state.matchId, moveData: { column: col } });
        } else if (state.isAIGame) {
          socket.emit('aiConnect4Move', col);
        } else {
          socket.emit('connect4Move', col);
        }
      });
    });
  }
  
  // FIX Bug 3: Only show play again button for non-match mode and non-AI game
  // (match mode uses showAIMatchEndOptions via matchEnded event)
  if ((gameState.winner || gameState.isDraw) && !state.matchId && !state.isAIGame) {
    showPlayAgainButton('connect4');
  }
}

function handleConnect4Update(data) {
  state.gameState.board = data.board;
  state.gameState.currentPlayer = data.currentPlayer;
  state.gameState.winner = data.winner;
  state.gameState.winningCells = data.winningCells;
  state.gameState.isDraw = data.draw || data.isDraw; // Support both 'draw' and 'isDraw'
  
  // FIX Bug 2: Preserve or update winCondition
  if (data.winCondition) {
    state.gameState.winCondition = data.winCondition;
  }
  
  // FIX Bug 1: Use provided players or fall back to cached players with proper colors
  const players = data.players || state.players || [
    { 
      id: state.gameState.player1, 
      name: state.gameState.player1 === AI_PLAYER_ID ? AI_PLAYER_NAME : 'Player 1',
      color: '#e50914' // Red for player 1
    },
    { 
      id: state.gameState.player2, 
      name: state.gameState.player2 === AI_PLAYER_ID ? AI_PLAYER_NAME : 'Player 2',
      color: '#f59e0b' // Yellow for player 2/AI
    }
  ];
  
  renderConnect4Board(state.gameState, players);
  updateScoreBoard(players, data.currentPlayer);
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


// ============================================
// GAME STATE MANAGEMENT FIXES
// Enhanced cleanup and state management
// ============================================

/**
 * Clean up game state when ending a game
 */
function cleanupGameState() {
  console.log('🧹 Cleaning up game state...');
  
  // Clear game-specific state
  state.gameState = {};
  state.currentGame = null;
  state.matchId = null;
  state.isSpectator = false;
  
  // Clear drawing state
  if (drawingState.canvas) {
    const ctx = drawingState.ctx;
    if (ctx) {
      ctx.clearRect(0, 0, drawingState.canvas.width, drawingState.canvas.height);
    }
    drawingState.isDrawing = false;
    drawingState.canvas = null;
    drawingState.ctx = null;
  }
  
  // Clear chess state
  if (typeof chessState !== 'undefined') {
    chessState.selectedSquare = null;
    chessState.legalMoves = [];
    chessState.draggedPiece = null;
  }
  
  // Clear any game-specific timers
  if (typeof gameTimer !== 'undefined' && gameTimer) {
    clearInterval(gameTimer);
  }
  
  // Clear game content
  if (elements.gameContent) {
    elements.gameContent.innerHTML = '';
  }
  
  clearNowPlayingDisplay();
  console.log('✅ Game state cleaned up');
}

/**
 * Enhanced backToLobby with proper cleanup
 */
const originalBackToLobby = backToLobby;
backToLobby = function() {
  console.log('🔙 Enhanced back to lobby with cleanup');
  cleanupGameState();
  if (originalBackToLobby) {
    originalBackToLobby();
  }
};

/**
 * Fix canvas touch events for mobile
 */
function fixCanvasTouchEvents(canvas) {
  if (!canvas) return;
  
  console.log('📱 Fixing canvas touch events...');
  canvas.style.touchAction = 'none';
  
  function getCanvasCoordinates(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }
  
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const coords = getCanvasCoordinates(e, canvas);
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: coords.x,
      clientY: coords.y,
      bubbles: true
    });
    canvas.dispatchEvent(mouseEvent);
  }, { passive: false });
  
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const coords = getCanvasCoordinates(e, canvas);
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: coords.x,
      clientY: coords.y,
      bubbles: true
    });
    canvas.dispatchEvent(mouseEvent);
  }, { passive: false });
  
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const coords = getCanvasCoordinates(e, canvas);
    const mouseEvent = new MouseEvent('mouseup', {
      clientX: coords.x,
      clientY: coords.y,
      bubbles: true
    });
    canvas.dispatchEvent(mouseEvent);
  }, { passive: false });
  
  console.log('✅ Canvas touch events fixed');
}

/**
 * Fix canvas aspect ratio
 */
function fixCanvasAspectRatio(canvas, aspectRatio = 4/3) {
  if (!canvas) return;
  
  console.log('📐 Fixing canvas aspect ratio...');
  const container = canvas.parentElement;
  if (!container) return;
  
  function resizeCanvas() {
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    let width, height;
    if (containerWidth / containerHeight > aspectRatio) {
      height = containerHeight;
      width = height * aspectRatio;
    } else {
      width = containerWidth;
      height = width / aspectRatio;
    }
    
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 100);
  });
  
  console.log('✅ Canvas aspect ratio fixed');
}

// Apply fixes to existing drawing game initialization
const originalInitDrawingGame = initDrawingGame;
initDrawingGame = function(gameState, players) {
  originalInitDrawingGame(gameState, players);
  
  // Apply canvas fixes after initialization
  setTimeout(() => {
    const canvas = document.getElementById('drawingCanvas');
    if (canvas) {
      fixCanvasTouchEvents(canvas);
      fixCanvasAspectRatio(canvas, 4/3);
      drawingState.canvas = canvas;
      drawingState.ctx = canvas.getContext('2d');
    }
  }, 100);
};

console.log('✅ Game state management fixes loaded');

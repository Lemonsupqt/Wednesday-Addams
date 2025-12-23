// ============================================
// GAME STATE MANAGEMENT FIXES
// Fixes for continuous gameplay bugs
// ============================================

// Add to app.js - Game State Cleanup Functions

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
    gameTimer = null;
  }
  
  // Clear game content
  if (elements.gameContent) {
    elements.gameContent.innerHTML = '';
  }
  
  // Clear game chat but keep messages
  clearNowPlayingDisplay();
  
  console.log('✅ Game state cleaned up');
}

/**
 * Reset game state for new round
 */
function resetGameForNewRound() {
  console.log('🔄 Resetting game for new round...');
  
  // Keep current game type but reset state
  const currentGameType = state.currentGame;
  state.gameState = {};
  state.currentGame = currentGameType;
  
  // Clear visual elements
  if (elements.gameContent) {
    elements.gameContent.innerHTML = '<div class="loading">Loading next round...</div>';
  }
  
  // Reset drawing canvas if exists
  if (drawingState.canvas && drawingState.ctx) {
    const ctx = drawingState.ctx;
    ctx.clearRect(0, 0, drawingState.canvas.width, drawingState.canvas.height);
    drawingState.isDrawing = false;
  }
  
  console.log('✅ Game reset for new round');
}

/**
 * Remove all game event listeners to prevent duplicates
 */
function removeGameEventListeners() {
  console.log('🔌 Removing game event listeners...');
  
  // Remove canvas event listeners
  if (drawingState.canvas) {
    const canvas = drawingState.canvas;
    const newCanvas = canvas.cloneNode(true);
    canvas.parentNode?.replaceChild(newCanvas, canvas);
    drawingState.canvas = null;
    drawingState.ctx = null;
  }
  
  // Remove keyboard listeners
  document.removeEventListener('keydown', handleSudokuKeypress);
  document.removeEventListener('keydown', handleChessKeypress);
  
  // Remove click listeners by cloning game content
  if (elements.gameContent) {
    const oldContent = elements.gameContent;
    const newContent = oldContent.cloneNode(false);
    oldContent.parentNode?.replaceChild(newContent, oldContent);
    elements.gameContent = newContent;
  }
  
  console.log('✅ Game event listeners removed');
}

/**
 * Properly end game and return to lobby
 */
function properlyEndGame() {
  console.log('🛑 Properly ending game...');
  
  // Clean up first
  removeGameEventListeners();
  cleanupGameState();
  
  // Emit end game event
  if (state.roomId) {
    socket.emit('endGame', { roomId: state.roomId });
  }
  
  // Show lobby
  showScreen('lobby');
  
  console.log('✅ Game properly ended');
}

/**
 * Fix for play again button
 */
function showPlayAgainButton(gameType) {
  const playAgainBtn = document.createElement('button');
  playAgainBtn.className = 'btn btn-primary';
  playAgainBtn.innerHTML = '<span class="btn-icon">🔄</span> Play Again';
  playAgainBtn.style.marginTop = '20px';
  
  playAgainBtn.addEventListener('click', () => {
    console.log('🔄 Play again clicked for:', gameType);
    
    // Clean up current game state
    resetGameForNewRound();
    
    // Request new game
    socket.emit('playAgain', { 
      roomId: state.roomId, 
      gameType: gameType 
    });
    
    // Remove the button
    playAgainBtn.remove();
  }, { once: true }); // Only fire once
  
  // Find container and append
  const container = elements.gameContent.querySelector('.ttt-container, .memory-container, .drawing-container, .chess-container, .trivia-container, .psychic-container, .sudoku-container, .connect4-container');
  if (container) {
    container.appendChild(playAgainBtn);
  }
}

/**
 * Fix voting system - prevent multiple votes
 */
function fixVotingSystem() {
  let hasVoted = false;
  let votedGame = null;
  
  return {
    vote: function(gameType) {
      if (hasVoted) {
        console.log('⚠️ Already voted for:', votedGame);
        showError('You have already voted!');
        return false;
      }
      
      hasVoted = true;
      votedGame = gameType;
      console.log('✅ Voted for:', gameType);
      return true;
    },
    
    reset: function() {
      hasVoted = false;
      votedGame = null;
      console.log('🔄 Voting reset');
    },
    
    hasVoted: function() {
      return hasVoted;
    },
    
    getVote: function() {
      return votedGame;
    }
  };
}

// Create voting manager instance
const votingManager = fixVotingSystem();

/**
 * Enhanced game initialization with cleanup
 */
function safeInitGame(gameType, gameState, players) {
  console.log('🎮 Safe initializing game:', gameType);
  
  // Clean up previous game
  removeGameEventListeners();
  cleanupGameState();
  
  // Set new game
  state.currentGame = gameType;
  state.gameState = gameState || {};
  
  // Initialize based on game type
  switch(gameType) {
    case 'tictactoe':
      initTicTacToeGame(gameState, players);
      break;
    case 'memory':
      initMemoryGame(gameState, players);
      break;
    case 'drawing':
      initDrawingGame(gameState, players);
      break;
    case 'chess':
      initChessGame(gameState, players);
      break;
    case 'trivia':
      initTriviaGame(gameState, players);
      break;
    case 'psychic':
      initPsychicGame(gameState, players);
      break;
    case 'sudoku':
      initSudokuGame(gameState, players);
      break;
    case 'connect4':
      initConnect4Game(gameState, players);
      break;
    default:
      console.error('Unknown game type:', gameType);
  }
  
  console.log('✅ Game safely initialized');
}

/**
 * Fix canvas touch events for mobile
 */
function fixCanvasTouchEvents(canvas) {
  if (!canvas) return;
  
  console.log('📱 Fixing canvas touch events...');
  
  // Prevent default touch behavior
  canvas.style.touchAction = 'none';
  
  // Get canvas bounds helper
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
  
  // Touch start
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const coords = getCanvasCoordinates(e, canvas);
    
    // Trigger mouse down event
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: coords.x,
      clientY: coords.y,
      bubbles: true
    });
    canvas.dispatchEvent(mouseEvent);
  }, { passive: false });
  
  // Touch move
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const coords = getCanvasCoordinates(e, canvas);
    
    // Trigger mouse move event
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: coords.x,
      clientY: coords.y,
      bubbles: true
    });
    canvas.dispatchEvent(mouseEvent);
  }, { passive: false });
  
  // Touch end
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const coords = getCanvasCoordinates(e, canvas);
    
    // Trigger mouse up event
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
 * Fix aspect ratio for game canvases
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
      // Container is wider than aspect ratio
      height = containerHeight;
      width = height * aspectRatio;
    } else {
      // Container is taller than aspect ratio
      width = containerWidth;
      height = width / aspectRatio;
    }
    
    // Set canvas size
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    // Set internal resolution (for drawing)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    // Scale context for high DPI
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }
  
  // Initial resize
  resizeCanvas();
  
  // Resize on window resize
  window.addEventListener('resize', resizeCanvas);
  
  // Resize on orientation change
  window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 100);
  });
  
  console.log('✅ Canvas aspect ratio fixed');
}

// Export functions for use in main app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cleanupGameState,
    resetGameForNewRound,
    removeGameEventListeners,
    properlyEndGame,
    showPlayAgainButton,
    votingManager,
    safeInitGame,
    fixCanvasTouchEvents,
    fixCanvasAspectRatio
  };
}

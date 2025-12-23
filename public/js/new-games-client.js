// ============================================
// 🎮 NEW GAMES - CLIENT SIDE CODE
// ============================================
// Games: Hangman, Word Chain, Reaction Test, Battleship, Drawing Guess

// ============================================
// UTILITY FUNCTIONS
// ============================================

// escapeHtml utility function (needed since this file loads before app.js)
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// HANGMAN GAME 🎯
// ============================================

function initHangman(gameState, players) {
  console.log('🎯 Initializing Hangman:', gameState);
  state.gameState = gameState;
  elements.gameTitle.textContent = '🎯 Hangman Challenge';
  
  const isMyTurn = gameState.currentGuesser === state.playerId;
  const maskedWord = gameState.maskedWord || '_ '.repeat(gameState.wordLength || 8);
  
  elements.gameContent.innerHTML = `
    <div class="hangman-container">
      <div class="hangman-hint">📖 Hint: ${escapeHtml(gameState.hint || 'Mystery Word')}</div>
      
      <div class="hangman-display">
        <div class="hangman-figure" id="hangmanFigure">
          <svg viewBox="0 0 200 250" class="hangman-svg">
            <!-- Gallows -->
            <line x1="20" y1="230" x2="100" y2="230" stroke="var(--accent-purple)" stroke-width="4"/>
            <line x1="60" y1="230" x2="60" y2="20" stroke="var(--accent-purple)" stroke-width="4"/>
            <line x1="60" y1="20" x2="140" y2="20" stroke="var(--accent-purple)" stroke-width="4"/>
            <line x1="140" y1="20" x2="140" y2="50" stroke="var(--accent-purple)" stroke-width="4"/>
            
            <!-- Body parts (hidden initially) -->
            <circle cx="140" cy="70" r="20" class="hangman-part" id="head" stroke="var(--accent-red)" stroke-width="3" fill="none"/>
            <line x1="140" y1="90" x2="140" y2="150" class="hangman-part" id="body" stroke="var(--accent-red)" stroke-width="3"/>
            <line x1="140" y1="110" x2="110" y2="140" class="hangman-part" id="leftArm" stroke="var(--accent-red)" stroke-width="3"/>
            <line x1="140" y1="110" x2="170" y2="140" class="hangman-part" id="rightArm" stroke="var(--accent-red)" stroke-width="3"/>
            <line x1="140" y1="150" x2="110" y2="200" class="hangman-part" id="leftLeg" stroke="var(--accent-red)" stroke-width="3"/>
            <line x1="140" y1="150" x2="170" y2="200" class="hangman-part" id="rightLeg" stroke="var(--accent-red)" stroke-width="3"/>
          </svg>
        </div>
        
        <div class="hangman-word" id="hangmanWord">${maskedWord}</div>
        
        <div class="hangman-status" id="hangmanStatus">
          ${gameState.status === 'won' ? '🎉 Word Guessed!' : 
            gameState.status === 'lost' ? '💀 Game Over!' :
            isMyTurn ? '🎯 Your turn to guess!' : '⏳ Waiting for guess...'}
        </div>
        
        <div class="hangman-wrong" id="hangmanWrong">
          Wrong: ${gameState.wrongGuesses || 0}/${gameState.maxWrongs || 6}
        </div>
      </div>
      
      <div class="hangman-guessed" id="hangmanGuessed">
        <span class="guessed-label">Guessed:</span>
        ${(gameState.guessedLetters || []).map(l => 
          `<span class="guessed-letter ${gameState.word?.includes(l) ? 'correct' : 'wrong'}">${l}</span>`
        ).join('')}
      </div>
      
      <div class="hangman-keyboard" id="hangmanKeyboard">
        ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => `
          <button class="keyboard-key ${(gameState.guessedLetters || []).includes(letter) ? 'used' : ''}" 
                  data-letter="${letter}" 
                  ${(gameState.guessedLetters || []).includes(letter) || !isMyTurn || gameState.status !== 'playing' ? 'disabled' : ''}>
            ${letter}
          </button>
        `).join('')}
      </div>
    </div>
  `;
  
  // Add keyboard event listeners
  if (isMyTurn && gameState.status === 'playing') {
    document.querySelectorAll('.keyboard-key:not(.used)').forEach(key => {
      key.addEventListener('click', () => {
        const letter = key.dataset.letter;
        if (state.isAIGame) {
          socket.emit('aiHangmanGuess', letter);
        } else {
          socket.emit('hangmanGuess', letter);
        }
      });
    });
  }
  
  // Update hangman figure
  updateHangmanFigure(gameState.wrongGuesses || 0);
  updateScoreBoard(players);
}

function updateHangmanFigure(wrongGuesses) {
  const parts = ['head', 'body', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
  parts.forEach((part, index) => {
    const element = document.getElementById(part);
    if (element) {
      element.style.opacity = index < wrongGuesses ? '1' : '0';
    }
  });
}

function updateHangman(data) {
  if (data.maskedWord) {
    const wordEl = document.getElementById('hangmanWord');
    if (wordEl) wordEl.textContent = data.maskedWord;
  }
  
  if (data.wrongGuesses !== undefined) {
    updateHangmanFigure(data.wrongGuesses);
    const wrongEl = document.getElementById('hangmanWrong');
    if (wrongEl) wrongEl.textContent = `Wrong: ${data.wrongGuesses}/${data.maxWrongs || 6}`;
  }
  
  if (data.guessedLetters) {
    const guessedEl = document.getElementById('hangmanGuessed');
    if (guessedEl) {
      guessedEl.innerHTML = `
        <span class="guessed-label">Guessed:</span>
        ${data.guessedLetters.map(l => 
          `<span class="guessed-letter ${data.word?.includes(l) ? 'correct' : 'wrong'}">${l}</span>`
        ).join('')}
      `;
    }
    
    // Disable used keys
    data.guessedLetters.forEach(letter => {
      const key = document.querySelector(`.keyboard-key[data-letter="${letter}"]`);
      if (key) {
        key.classList.add('used');
        key.disabled = true;
      }
    });
  }
  
  const statusEl = document.getElementById('hangmanStatus');
  const isMyTurn = data.currentGuesser === state.playerId;
  
  if (statusEl) {
    if (data.status === 'won') {
      statusEl.innerHTML = `🎉 <span class="winner-name">${escapeHtml(data.winnerName || 'You')}</span> guessed it! The word was: <strong>${data.word}</strong>`;
      showPlayAgainButton('hangman');
    } else if (data.status === 'lost') {
      statusEl.innerHTML = `💀 Game Over! The word was: <strong>${data.word}</strong>`;
      showPlayAgainButton('hangman');
    } else if (isMyTurn) {
      statusEl.textContent = '🎯 Your turn to guess!';
    } else {
      const guesserName = data.players?.find(p => p.id === data.currentGuesser)?.name || 'opponent';
      statusEl.textContent = `⏳ Waiting for ${escapeHtml(guesserName)}...`;
    }
  }
  
  // Enable/disable keyboard based on turn
  document.querySelectorAll('.keyboard-key:not(.used)').forEach(key => {
    if (data.status === 'playing' && isMyTurn) {
      key.disabled = false;
      // Re-add click listener if not already present
      if (!key.dataset.listenerAdded) {
        key.addEventListener('click', () => {
          const letter = key.dataset.letter;
          if (state.isAIGame) {
            socket.emit('aiHangmanGuess', letter);
          } else {
            socket.emit('hangmanGuess', letter);
          }
        });
        key.dataset.listenerAdded = 'true';
      }
    } else {
      key.disabled = true;
    }
  });
  
  updateScoreBoard(data.players);
}

// ============================================
// WORD CHAIN GAME ⛓️
// ============================================

function initWordChain(gameState, players) {
  console.log('⛓️ Initializing Word Chain:', gameState);
  state.gameState = gameState;
  elements.gameTitle.textContent = '⛓️ Word Chain Challenge';
  
  const isMyTurn = gameState.playerOrder[gameState.currentPlayerIndex] === state.playerId;
  const lastLetter = gameState.currentWord ? gameState.currentWord[gameState.currentWord.length - 1] : null;
  
  elements.gameContent.innerHTML = `
    <div class="wordchain-container">
      <div class="wordchain-info">
        <div class="wordchain-round">Round ${gameState.roundsPlayed + 1}/${gameState.maxRounds * gameState.playerOrder.length}</div>
        <div class="wordchain-timer" id="wordchainTimer">⏱️ ${gameState.timePerTurn}s</div>
      </div>
      
      <div class="wordchain-current">
        ${gameState.currentWord ? `
          <div class="current-word">${escapeHtml(gameState.currentWord)}</div>
          <div class="next-letter">Next word must start with: <strong>${lastLetter}</strong></div>
        ` : `
          <div class="current-word">Start the chain!</div>
          <div class="next-letter">Enter any word to begin</div>
        `}
      </div>
      
      <div class="wordchain-used" id="wordchainUsed">
        <div class="used-label">Used words:</div>
        <div class="used-words">${(gameState.usedWords || []).slice(-10).map(w => 
          `<span class="used-word">${escapeHtml(w)}</span>`
        ).join('')}</div>
      </div>
      
      <div class="wordchain-input ${isMyTurn ? '' : 'disabled'}">
        <input type="text" id="wordchainInput" placeholder="${isMyTurn ? `Enter a word starting with "${lastLetter || 'any letter'}"...` : 'Wait for your turn...'}" 
               ${isMyTurn ? '' : 'disabled'} autocomplete="off" maxlength="20">
        <button class="btn btn-primary" id="wordchainSubmit" ${isMyTurn ? '' : 'disabled'}>
          <span class="btn-icon">📤</span> Submit
        </button>
      </div>
      
      <div class="wordchain-status" id="wordchainStatus">
        ${isMyTurn ? '🎯 Your turn!' : `⏳ Waiting for ${escapeHtml(players.find(p => p.id === gameState.playerOrder[gameState.currentPlayerIndex])?.name || 'opponent')}...`}
      </div>
    </div>
  `;
  
  if (isMyTurn) {
    const input = document.getElementById('wordchainInput');
    const submit = document.getElementById('wordchainSubmit');
    
    const submitWord = () => {
      const word = input.value.trim();
      if (word.length >= 3) {
        if (state.isAIGame) {
          socket.emit('aiWordChainWord', word);
        } else {
          socket.emit('wordChainWord', word);
        }
        input.value = '';
      }
    };
    
    submit.addEventListener('click', submitWord);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitWord();
    });
    
    input.focus();
  }
  
  updateScoreBoard(players);
}

function updateWordChain(data) {
  if (data.currentWord) {
    const currentEl = document.querySelector('.wordchain-current');
    const lastLetter = data.currentWord[data.currentWord.length - 1];
    if (currentEl) {
      currentEl.innerHTML = `
        <div class="current-word animate-pop">${escapeHtml(data.currentWord)}</div>
        <div class="next-letter">Next word must start with: <strong>${lastLetter}</strong></div>
      `;
    }
  }
  
  if (data.usedWords) {
    const usedEl = document.getElementById('wordchainUsed');
    if (usedEl) {
      usedEl.innerHTML = `
        <div class="used-label">Used words:</div>
        <div class="used-words">${data.usedWords.slice(-10).map(w => 
          `<span class="used-word">${escapeHtml(w)}</span>`
        ).join('')}</div>
      `;
    }
  }
  
  const statusEl = document.getElementById('wordchainStatus');
  const isMyTurn = data.nextPlayer === state.playerId;
  
  if (data.gameOver) {
    if (statusEl) statusEl.innerHTML = '🏆 Game Over!';
    showPlayAgainButton('wordchain');
  } else if (data.error) {
    if (statusEl) statusEl.innerHTML = `❌ ${escapeHtml(data.error)}`;
  } else {
    if (statusEl) {
      statusEl.textContent = isMyTurn ? '🎯 Your turn!' : `⏳ Waiting for ${escapeHtml(data.nextPlayerName || 'opponent')}...`;
    }
    
    // Update input state
    const input = document.getElementById('wordchainInput');
    const submit = document.getElementById('wordchainSubmit');
    if (input && submit) {
      input.disabled = !isMyTurn;
      submit.disabled = !isMyTurn;
      if (isMyTurn) {
        const lastLetter = data.currentWord ? data.currentWord[data.currentWord.length - 1] : 'any letter';
        input.placeholder = `Enter a word starting with "${lastLetter}"...`;
        input.focus();
      }
    }
  }
  
  updateScoreBoard(data.players);
}

// ============================================
// WORD SCRAMBLE 🔀 (Unscramble words race)
// ============================================

let wordScrambleState = {
  canAnswer: true,
  currentWord: null
};

function initReactionTest(gameState, players) {
  console.log('🔀 Initializing Word Scramble:', gameState);
  state.gameState = gameState;
  wordScrambleState = {
    canAnswer: true,
    currentWord: null
  };
  elements.gameTitle.textContent = '🔀 Word Scramble Race';
  
  elements.gameContent.innerHTML = `
    <div class="word-scramble-container">
      <div class="scramble-info">
        <div class="scramble-round">Round <span id="scrambleRound">${gameState.round || 1}</span>/${gameState.maxRounds || 8}</div>
        <div class="scramble-timer" id="scrambleTimer">⏱️ Waiting...</div>
      </div>
      
      <div class="scramble-word-display" id="scrambleWord">
        <div class="scramble-waiting">🎯 Get Ready to Unscramble!</div>
      </div>
      
      <div class="scramble-input">
        <input type="text" id="scrambleInput" placeholder="Type the word..." autocomplete="off" maxlength="20" disabled>
        <button class="btn btn-primary" id="scrambleSubmitBtn" disabled>
          <span class="btn-icon">✨</span> Guess
        </button>
      </div>
      
      <div class="scramble-feedback" id="scrambleFeedback"></div>
      
      <div class="scramble-scores" id="scrambleScores">
        ${players.map(p => `
          <div class="scramble-player ${p.id === state.playerId ? 'me' : ''}">
            <span class="player-name">${escapeHtml(p.name)}</span>
            <span class="player-score" id="score-${p.id}">${gameState.scores?.[p.id] || 0} pts</span>
            <span class="round-result" id="result-${p.id}"></span>
          </div>
        `).join('')}
      </div>
      
      <div class="scramble-hint">
        💡 First to unscramble gets +5 bonus! Longer words = more points!
      </div>
    </div>
  `;
  
  setupWordScrambleListeners();
  updateScoreBoard(players);
}

function setupWordScrambleListeners() {
  const input = document.getElementById('scrambleInput');
  const submitBtn = document.getElementById('scrambleSubmitBtn');
  
  if (input && submitBtn) {
    const submitAnswer = () => {
      const answer = input.value.trim();
      if (answer === '' || !wordScrambleState.canAnswer) return;
      
      if (state.isAIGame) {
        socket.emit('aiReactionClick', { answer: answer });
      } else {
        socket.emit('reactionClick', { answer: answer });
      }
    };
    
    submitBtn.addEventListener('click', submitAnswer);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitAnswer();
    });
  }
}

function updateReactionTest(data) {
  const wordEl = document.getElementById('scrambleWord');
  const feedbackEl = document.getElementById('scrambleFeedback');
  const timerEl = document.getElementById('scrambleTimer');
  const input = document.getElementById('scrambleInput');
  const submitBtn = document.getElementById('scrambleSubmitBtn');
  const roundEl = document.getElementById('scrambleRound');
  
  // New scrambled word
  if (data.scrambledWord) {
    wordScrambleState.canAnswer = true;
    wordScrambleState.currentWord = data.scrambledWord;
    if (input) {
      input.value = '';
      input.disabled = false;
      input.focus();
    }
    if (submitBtn) submitBtn.disabled = false;
    if (feedbackEl) feedbackEl.innerHTML = '';
    
    if (wordEl) {
      wordEl.innerHTML = `
        <div class="scrambled-letters animate-pop">
          ${data.scrambledWord.split('').map(letter => `
            <span class="scramble-letter">${letter}</span>
          `).join('')}
        </div>
        <div class="letter-count">${data.scrambledWord.length} letters</div>
      `;
    }
    
    // Clear previous round results
    document.querySelectorAll('.round-result').forEach(el => el.innerHTML = '');
  }
  
  // Round update
  if (data.round !== undefined && roundEl) {
    roundEl.textContent = data.round;
  }
  
  // Timer update
  if (data.timeLeft !== undefined && timerEl) {
    timerEl.textContent = `⏱️ ${data.timeLeft}s`;
    if (data.timeLeft <= 5) {
      timerEl.classList.add('urgent');
    } else {
      timerEl.classList.remove('urgent');
    }
  }
  
  // Answer result
  if (data.correct !== undefined) {
    const resultEl = document.getElementById(`result-${state.playerId}`);
    
    if (data.correct) {
      wordScrambleState.canAnswer = false;
      if (input) input.disabled = true;
      if (submitBtn) submitBtn.disabled = true;
      
      if (feedbackEl) {
        feedbackEl.innerHTML = `
          <div class="feedback-correct">
            ✅ "${data.word}" is correct! ${data.isFirst ? '🥇 First!' : ''} +${data.points} points
            <div class="response-time">⚡ ${(data.responseTime / 1000).toFixed(2)}s</div>
          </div>
        `;
      }
      if (resultEl) resultEl.innerHTML = `<span class="correct">+${data.points}</span>`;
    } else {
      if (feedbackEl) {
        feedbackEl.innerHTML = `
          <div class="feedback-wrong">
            ❌ "${data.guess}" is not correct. ${data.hint || 'Keep trying!'}
          </div>
        `;
      }
      // Allow trying again
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  }
  
  // Update scores
  if (data.scores) {
    for (const [playerId, score] of Object.entries(data.scores)) {
      const scoreEl = document.getElementById(`score-${playerId}`);
      if (scoreEl) scoreEl.textContent = `${score} pts`;
    }
  }
  
  // Player solved (not you)
  if (data.playerAnswered && data.playerAnswered !== state.playerId) {
    const resultEl = document.getElementById(`result-${data.playerAnswered}`);
    if (resultEl) {
      if (data.wasCorrect) {
        resultEl.innerHTML = `<span class="correct">${data.wasFirst ? '🥇' : '✓'}</span>`;
      }
    }
  }
  
  // Time up - reveal answer
  if (data.timeUp) {
    wordScrambleState.canAnswer = false;
    if (input) input.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    
    if (feedbackEl) {
      feedbackEl.innerHTML = `
        <div class="feedback-timeout">
          ⏰ Time's up! The word was: <strong>${data.correctWord}</strong>
        </div>
      `;
    }
  }
  
  // Waiting for next round
  if (data.status === 'waiting' || data.nextRound) {
    if (wordEl) {
      wordEl.innerHTML = `<div class="scramble-waiting">⏳ Next word coming...</div>`;
    }
    wordScrambleState.canAnswer = false;
    if (input) input.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
  }
  
  // Game over
  if (data.gameOver || data.status === 'finished') {
    wordScrambleState.canAnswer = false;
    if (input) input.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    
    if (wordEl) {
      wordEl.innerHTML = `<div class="scramble-waiting">🏆 Game Over!</div>`;
    }
    
    showPlayAgainButton('reaction');
    
    if (data.results) {
      const scoresEl = document.getElementById('scrambleScores');
      if (scoresEl) {
        scoresEl.innerHTML = data.results.map((r, i) => `
          <div class="scramble-player ${r.playerId === state.playerId ? 'me' : ''} ${i === 0 ? 'winner' : ''}">
            <span class="rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`}</span>
            <span class="player-name">${escapeHtml(r.playerName || 'Player')}</span>
            <span class="player-score">${r.score} pts</span>
          </div>
        `).join('');
      }
    }
  }
  
  updateScoreBoard(data.players);
}

// ============================================
// BATTLESHIP GAME 🚢
// ============================================

function initBattleship(gameState, players) {
  console.log('🚢 Initializing Battleship:', gameState);
  state.gameState = gameState;
  state.battleshipState = {
    selectedShip: null,
    horizontal: true,
    placedShips: gameState.placedShips || []
  };
  elements.gameTitle.textContent = '🚢 Battleship - Hawkins Naval Warfare';
  
  const isMyTurn = gameState.currentPlayer === state.playerId;
  const isPlacement = gameState.phase === 'placement';
  
  elements.gameContent.innerHTML = `
    <div class="battleship-container mobile-friendly">
      <div class="battleship-status" id="battleshipStatus">
        ${isPlacement ? '📍 Tap a ship, then tap the board to place it!' : isMyTurn ? '🎯 Tap enemy waters to fire!' : '⏳ Opponent\'s turn...'}
      </div>
      
      ${isPlacement ? `
        <div class="ship-placement-mobile" id="shipPlacement">
          <div class="placement-header">🚢 Select a ship to place:</div>
          <div class="ships-to-place-mobile">
            ${BATTLESHIP_SHIPS.map((ship, i) => `
              <button class="ship-btn ${gameState.placedShips?.includes(i) ? 'placed' : ''} ${state.battleshipState?.selectedShip === i ? 'selected' : ''}" 
                      data-ship="${i}" ${gameState.placedShips?.includes(i) ? 'disabled' : ''}>
                <span class="ship-emoji">${ship.emoji}</span>
                <span class="ship-info">
                  <span class="ship-name">${ship.name}</span>
                  <span class="ship-size">${'🟪'.repeat(ship.size)}</span>
                </span>
              </button>
            `).join('')}
          </div>
          <div class="orientation-indicator" id="orientationIndicator">
            <span>📐 Direction:</span>
            <span id="orientationText">
              <span class="rotation-preview horizontal" id="rotationPreview">
                <span></span><span></span><span></span>
              </span>
              Horizontal →
            </span>
          </div>
          <div class="placement-controls-mobile">
            <button class="btn btn-secondary btn-large" id="rotateShip">🔄 Rotate</button>
            <button class="btn btn-primary btn-large" id="confirmPlacement" ${(gameState.placedShips?.length || 0) < 5 ? 'disabled' : ''}>⚔️ Ready!</button>
          </div>
        </div>
      ` : ''}
      
      <div class="battleship-boards-mobile">
        <div class="board-section-mobile ${isPlacement ? 'active' : ''}">
          <div class="board-label">🚢 Your Fleet</div>
          <div class="battleship-board my-board mobile-board" id="myBoard">
            ${renderBattleshipBoardMobile(gameState.myBoard, false, isPlacement)}
          </div>
        </div>
        
        ${!isPlacement ? `
        <div class="board-section-mobile ${isMyTurn ? 'active' : ''}">
          <div class="board-label">🎯 Enemy Waters ${isMyTurn ? '(TAP TO FIRE!)' : ''}</div>
          <div class="battleship-board enemy-board mobile-board" id="enemyBoard">
            ${renderBattleshipBoardMobile(gameState.myShots || [], true, false)}
          </div>
        </div>
        ` : ''}
      </div>
      
      <div class="battleship-legend-mobile">
        <span class="legend-item"><span class="cell-icon">🌊</span> Water</span>
        <span class="legend-item"><span class="cell-icon">🚢</span> Ship</span>
        <span class="legend-item"><span class="cell-icon">💥</span> Hit</span>
        <span class="legend-item"><span class="cell-icon">⚪</span> Miss</span>
      </div>
    </div>
  `;
  
  setupBattleshipMobileListeners(gameState, isPlacement);
  updateScoreBoard(players);
}

const BATTLESHIP_SHIPS = [
  { name: 'Creel House', size: 5, emoji: '🏚️' },
  { name: 'Nevermore', size: 4, emoji: '🏰' },
  { name: 'Hawkins Van', size: 3, emoji: '🚐' },
  { name: 'Bicycle', size: 3, emoji: '🚲' },
  { name: 'Canoe', size: 2, emoji: '🛶' }
];

function renderBattleshipBoard(data, isEnemy, isPlacement) {
  let html = '<div class="board-grid">';
  
  // Column headers
  html += '<div class="board-header"></div>';
  for (let c = 0; c < 10; c++) {
    html += `<div class="board-header">${String.fromCharCode(65 + c)}</div>`;
  }
  
  for (let r = 0; r < 10; r++) {
    html += `<div class="board-row-label">${r + 1}</div>`;
    for (let c = 0; c < 10; c++) {
      const cellData = data?.[r]?.[c];
      let cellClass = 'board-cell';
      let cellContent = '';
      
      if (isEnemy) {
        // Enemy board - show shots
        if (cellData?.hit) {
          cellClass += ' hit';
          cellContent = '💥';
        } else if (cellData?.miss) {
          cellClass += ' miss';
          cellContent = '○';
        } else {
          cellClass += ' unknown';
          cellContent = '~';
        }
      } else {
        // My board - show ships and incoming shots
        if (cellData?.ship !== undefined) {
          cellClass += ' ship';
          if (cellData?.hit) {
            cellClass += ' hit';
            cellContent = '💥';
          } else {
            cellContent = '■';
          }
        } else if (cellData?.miss) {
          cellClass += ' miss';
          cellContent = '○';
        } else {
          cellContent = '~';
        }
      }
      
      html += `<div class="${cellClass}" data-row="${r}" data-col="${c}">${cellContent}</div>`;
    }
  }
  
  html += '</div>';
  return html;
}

// Mobile-friendly battleship board renderer
function renderBattleshipBoardMobile(data, isEnemy, isPlacement) {
  let html = '<div class="board-grid-mobile">';
  
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      let cellClass = 'board-cell-mobile';
      let cellContent = '';
      
      if (isEnemy) {
        // Enemy board - show shots (data is array of shot objects)
        const shot = Array.isArray(data) ? data.find(s => s.row === r && s.col === c) : null;
        if (shot?.hit) {
          cellClass += ' hit';
          cellContent = '💥';
        } else if (shot) {
          cellClass += ' miss';
          cellContent = '⚪';
        } else {
          cellClass += ' unknown';
          cellContent = '🌊';
        }
      } else {
        // My board - show ships (data is 2D array)
        const cellData = data?.[r]?.[c];
        if (cellData !== null && cellData !== undefined) {
          cellClass += ' ship';
          cellContent = '🚢';
        } else {
          cellContent = '🌊';
        }
      }
      
      html += `<div class="${cellClass}" data-row="${r}" data-col="${c}">${cellContent}</div>`;
    }
  }
  
  html += '</div>';
  return html;
}

// Mobile-friendly battleship event listeners
function setupBattleshipMobileListeners(gameState, isPlacement) {
  if (isPlacement) {
    // Ship selection
    document.querySelectorAll('.ship-btn:not(.placed)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.ship-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state.battleshipState.selectedShip = parseInt(btn.dataset.ship);
        
        // Update status
        const statusEl = document.getElementById('battleshipStatus');
        if (statusEl) {
          const ship = BATTLESHIP_SHIPS[state.battleshipState.selectedShip];
          statusEl.textContent = `📍 Tap the board to place ${ship.emoji} ${ship.name} (${ship.size} cells)`;
        }
      });
    });
    
    // Rotate button - fixed to prevent transform issues
    document.getElementById('rotateShip')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Toggle horizontal/vertical state
      state.battleshipState.horizontal = !state.battleshipState.horizontal;
      const isHorizontal = state.battleshipState.horizontal;
      
      const orientText = document.getElementById('orientationText');
      const orientIndicator = document.getElementById('orientationIndicator');
      
      if (orientText) {
        // Update the orientation text and preview
        orientText.innerHTML = isHorizontal 
          ? `<span class="rotation-preview horizontal" id="rotationPreview">
              <span></span><span></span><span></span>
            </span>
            Horizontal →`
          : `<span class="rotation-preview vertical" id="rotationPreview">
              <span></span><span></span><span></span>
            </span>
            Vertical ↓`;
      }
      
      // Visual feedback on the indicator container instead of button
      if (orientIndicator) {
        orientIndicator.style.boxShadow = '0 0 15px rgba(147, 51, 234, 0.6)';
        setTimeout(() => {
          orientIndicator.style.boxShadow = '';
        }, 300);
      }
      
      // Update status to show current direction
      const statusEl = document.getElementById('battleshipStatus');
      if (statusEl && state.battleshipState.selectedShip !== null) {
        const ship = BATTLESHIP_SHIPS[state.battleshipState.selectedShip];
        statusEl.textContent = `📍 ${ship.emoji} ${ship.name} - ${isHorizontal ? 'Horizontal →' : 'Vertical ↓'}`;
      }
      
      console.log('🔄 Rotation toggled:', isHorizontal ? 'Horizontal' : 'Vertical');
    });
    
    // Board cell tap for placement
    document.querySelectorAll('#myBoard .board-cell-mobile').forEach(cell => {
      cell.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.battleshipState.selectedShip !== null) {
          const row = parseInt(cell.dataset.row);
          const col = parseInt(cell.dataset.col);
          socket.emit('battleshipPlaceShip', { 
            shipIndex: state.battleshipState.selectedShip, 
            row, 
            col, 
            horizontal: state.battleshipState.horizontal 
          });
        } else {
          showNotification('Select a ship first!', 'warning');
        }
      });
    });
    
    // Ready button
    document.getElementById('confirmPlacement')?.addEventListener('click', (e) => {
      e.preventDefault();
      socket.emit('battleshipReady');
    });
  } else if (gameState.phase === 'playing' && gameState.currentPlayer === state.playerId) {
    // Firing logic
    document.querySelectorAll('#enemyBoard .board-cell-mobile.unknown').forEach(cell => {
      cell.addEventListener('click', (e) => {
        e.preventDefault();
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        if (state.isAIGame) {
          socket.emit('aiBattleshipFire', { row, col });
        } else {
          socket.emit('battleshipFire', { row, col });
        }
      });
    });
  }
}

function setupBattleshipListeners(gameState) {
  if (gameState.phase === 'placement') {
    // Ship placement logic
    let selectedShip = null;
    let horizontal = true;
    
    document.querySelectorAll('.ship-option:not(.placed)').forEach(option => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.ship-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        selectedShip = parseInt(option.dataset.ship);
      });
    });
    
    document.getElementById('rotateShip')?.addEventListener('click', () => {
      horizontal = !horizontal;
    });
    
    document.querySelectorAll('#myBoard .board-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        if (selectedShip !== null) {
          const row = parseInt(cell.dataset.row);
          const col = parseInt(cell.dataset.col);
          socket.emit('battleshipPlaceShip', { shipIndex: selectedShip, row, col, horizontal });
        }
      });
    });
    
    document.getElementById('confirmPlacement')?.addEventListener('click', () => {
      socket.emit('battleshipReady');
    });
  } else if (gameState.phase === 'playing' && gameState.currentPlayer === state.playerId) {
    // Firing logic
    document.querySelectorAll('#enemyBoard .board-cell.unknown').forEach(cell => {
      cell.addEventListener('click', () => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        if (state.isAIGame) {
          socket.emit('aiBattleshipFire', { row, col });
        } else {
          socket.emit('battleshipFire', { row, col });
        }
      });
    });
  }
}

function updateBattleship(data) {
  if (data.shipPlaced) {
    // Mark ship as placed in both old and new UI
    const option = document.querySelector(`.ship-option[data-ship="${data.shipIndex}"]`);
    if (option) option.classList.add('placed');
    
    const shipBtn = document.querySelector(`.ship-btn[data-ship="${data.shipIndex}"]`);
    if (shipBtn) {
      shipBtn.classList.add('placed');
      shipBtn.classList.remove('selected');
      shipBtn.disabled = true;
    }
    
    // Update board (both desktop and mobile)
    const myBoard = document.getElementById('myBoard');
    if (myBoard && data.positions) {
      data.positions.forEach(pos => {
        // Try mobile cell first, then desktop
        let cell = myBoard.querySelector(`.board-cell-mobile[data-row="${pos.row}"][data-col="${pos.col}"]`);
        if (!cell) {
          cell = myBoard.querySelector(`[data-row="${pos.row}"][data-col="${pos.col}"]`);
        }
        if (cell) {
          cell.classList.add('ship');
          cell.textContent = '🚢';
        }
      });
    }
    
    // Update placed ships state
    if (state.battleshipState) {
      state.battleshipState.placedShips.push(data.shipIndex);
      state.battleshipState.selectedShip = null;
    }
    
    // Enable ready button if all ships placed
    if (data.allPlaced) {
      const confirmBtn = document.getElementById('confirmPlacement');
      if (confirmBtn) confirmBtn.disabled = false;
      
      const statusEl = document.getElementById('battleshipStatus');
      if (statusEl) statusEl.textContent = '✅ All ships placed! Tap Ready to Battle!';
    }
  }
  
  if (data.shotResult) {
    const { row, col, hit, sunk } = data.shotResult;
    const isMyShot = data.shooter === state.playerId;
    const board = document.getElementById(isMyShot ? 'enemyBoard' : 'myBoard');
    
    if (board) {
      // Try mobile cell first, then desktop
      let cell = board.querySelector(`.board-cell-mobile[data-row="${row}"][data-col="${col}"]`);
      if (!cell) {
        cell = board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      }
      if (cell) {
        cell.classList.remove('unknown');
        cell.classList.add(hit ? 'hit' : 'miss');
        cell.textContent = hit ? '💥' : '⚪';
      }
    }
    
    if (sunk) {
      showNotification(`${sunk.name} has been sunk! ${sunk.emoji}`, 'info');
    }
  }
  
  const statusEl = document.getElementById('battleshipStatus');
  if (statusEl) {
    if (data.gameOver) {
      statusEl.textContent = data.winner === state.playerId ? '🎉 Victory! You sunk their fleet!' : '💀 Defeat! Your fleet was destroyed!';
      showPlayAgainButton('battleship');
    } else if (data.phase === 'playing') {
      statusEl.textContent = data.currentPlayer === state.playerId ? '🎯 Tap enemy waters to fire!' : '⏳ Opponent\'s turn...';
      
      // Re-setup listeners for the new turn
      if (data.currentPlayer === state.playerId) {
        document.querySelectorAll('#enemyBoard .board-cell-mobile.unknown, #enemyBoard .board-cell.unknown').forEach(cell => {
          if (!cell.dataset.listenerAdded) {
            cell.addEventListener('click', (e) => {
              e.preventDefault();
              const r = parseInt(cell.dataset.row);
              const c = parseInt(cell.dataset.col);
              if (state.isAIGame) {
                socket.emit('aiBattleshipFire', { row: r, col: c });
              } else {
                socket.emit('battleshipFire', { row: r, col: c });
              }
            });
            cell.dataset.listenerAdded = 'true';
          }
        });
      }
    }
  }
  
  updateScoreBoard(data.players);
}

// ============================================
// DRAWING GUESS GAME 🎨
// ============================================

let drawingCanvas = null;
let drawingCtx = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentColor = '#ffffff';
let brushSize = 5;

function initDrawingGuess(gameState, players) {
  console.log('🎨 Initializing Drawing Guess:', gameState);
  state.gameState = gameState;
  elements.gameTitle.textContent = '🎨 Drawing Guess - Nevermore Pictionary';
  
  const isDrawer = gameState.playerOrder[gameState.drawerIndex] === state.playerId;
  const drawer = players.find(p => p.id === gameState.playerOrder[gameState.drawerIndex]);
  
  elements.gameContent.innerHTML = `
    <div class="drawing-container">
      <div class="drawing-info">
        <div class="drawing-round">Round ${gameState.round}/${gameState.maxRounds}</div>
        <div class="drawing-timer" id="drawingTimer">⏱️ ${gameState.timePerRound}s</div>
        <div class="drawing-drawer">
          ${isDrawer ? '🎨 You are drawing!' : `👁️ ${escapeHtml(drawer?.name || 'Someone')} is drawing`}
        </div>
      </div>
      
      ${isDrawer ? `
        <div class="drawing-word">
          <span class="word-label">Draw this:</span>
          <span class="word-value">${escapeHtml(gameState.word || '???')}</span>
        </div>
      ` : `
        <div class="drawing-hint">
          <span class="hint-label">Hint:</span>
          <span class="hint-value">${escapeHtml(gameState.wordHint || '_ _ _ _')}</span>
        </div>
      `}
      
      <div class="drawing-canvas-container">
        <canvas id="drawingCanvas" width="600" height="400"></canvas>
      </div>
      
      ${isDrawer ? `
        <div class="drawing-tools">
          <div class="color-picker">
            ${['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#000000'].map(color => `
              <button class="color-btn ${color === currentColor ? 'active' : ''}" style="background: ${color}" data-color="${color}"></button>
            `).join('')}
          </div>
          <div class="brush-sizes">
            ${[3, 5, 10, 20].map(size => `
              <button class="size-btn ${size === brushSize ? 'active' : ''}" data-size="${size}">${size}</button>
            `).join('')}
          </div>
          <button class="btn btn-secondary" id="clearCanvas">🗑️ Clear</button>
        </div>
      ` : `
        <div class="guess-input">
          <input type="text" id="guessInput" placeholder="Type your guess..." autocomplete="off">
          <button class="btn btn-primary" id="submitGuess">
            <span class="btn-icon">💬</span> Guess
          </button>
        </div>
      `}
      
      <div class="drawing-guesses" id="drawingGuesses">
        ${(gameState.guesses || []).slice(-5).map(g => `
          <div class="guess-item ${g.correct ? 'correct' : ''}">
            <span class="guesser">${escapeHtml(g.playerName || 'Player')}:</span>
            <span class="guess-text">${g.correct ? '✅ Got it!' : escapeHtml(g.guess)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  setupDrawingCanvas(isDrawer);
  updateScoreBoard(players);
}

function setupDrawingCanvas(isDrawer) {
  drawingCanvas = document.getElementById('drawingCanvas');
  if (!drawingCanvas) return;
  
  drawingCtx = drawingCanvas.getContext('2d');
  drawingCtx.fillStyle = '#1a1a2e';
  drawingCtx.fillRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  drawingCtx.lineCap = 'round';
  drawingCtx.lineJoin = 'round';
  
  if (isDrawer) {
    // Drawing events
    drawingCanvas.addEventListener('mousedown', startDrawing);
    drawingCanvas.addEventListener('mousemove', draw);
    drawingCanvas.addEventListener('mouseup', stopDrawing);
    drawingCanvas.addEventListener('mouseout', stopDrawing);
    
    // Touch events
    drawingCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    drawingCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    drawingCanvas.addEventListener('touchend', stopDrawing);
    
    // Color picker
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentColor = btn.dataset.color;
      });
    });
    
    // Brush size
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        brushSize = parseInt(btn.dataset.size);
      });
    });
    
    // Clear canvas
    document.getElementById('clearCanvas')?.addEventListener('click', () => {
      drawingCtx.fillStyle = '#1a1a2e';
      drawingCtx.fillRect(0, 0, drawingCanvas.width, drawingCanvas.height);
      socket.emit('drawingClear');
    });
  } else {
    // Guess input
    const input = document.getElementById('guessInput');
    const submit = document.getElementById('submitGuess');
    
    const submitGuess = () => {
      const guess = input.value.trim();
      if (guess) {
        socket.emit('drawingGuess', guess);
        input.value = '';
      }
    };
    
    submit?.addEventListener('click', submitGuess);
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitGuess();
    });
  }
}

function startDrawing(e) {
  isDrawing = true;
  [lastX, lastY] = getCanvasCoords(e);
}

function draw(e) {
  if (!isDrawing) return;
  
  const [x, y] = getCanvasCoords(e);
  
  drawingCtx.strokeStyle = currentColor;
  drawingCtx.lineWidth = brushSize;
  drawingCtx.beginPath();
  drawingCtx.moveTo(lastX, lastY);
  drawingCtx.lineTo(x, y);
  drawingCtx.stroke();
  
  // Send drawing data
  socket.emit('drawingData', { 
    fromX: lastX, fromY: lastY, 
    toX: x, toY: y, 
    color: currentColor, 
    size: brushSize 
  });
  
  [lastX, lastY] = [x, y];
}

function stopDrawing() {
  isDrawing = false;
}

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  startDrawing(mouseEvent);
}

function handleTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  draw(mouseEvent);
}

function getCanvasCoords(e) {
  const rect = drawingCanvas.getBoundingClientRect();
  const scaleX = drawingCanvas.width / rect.width;
  const scaleY = drawingCanvas.height / rect.height;
  return [
    (e.clientX - rect.left) * scaleX,
    (e.clientY - rect.top) * scaleY
  ];
}

function updateDrawingGuess(data) {
  // Receive drawing data
  if (data.drawingData && drawingCtx) {
    const { fromX, fromY, toX, toY, color, size } = data.drawingData;
    drawingCtx.strokeStyle = color;
    drawingCtx.lineWidth = size;
    drawingCtx.beginPath();
    drawingCtx.moveTo(fromX, fromY);
    drawingCtx.lineTo(toX, toY);
    drawingCtx.stroke();
  }
  
  // Clear canvas
  if (data.clear && drawingCtx) {
    drawingCtx.fillStyle = '#1a1a2e';
    drawingCtx.fillRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  }
  
  // New guess
  if (data.guess) {
    const guessesEl = document.getElementById('drawingGuesses');
    if (guessesEl) {
      const guessDiv = document.createElement('div');
      guessDiv.className = `guess-item ${data.guess.correct ? 'correct' : ''}`;
      guessDiv.innerHTML = `
        <span class="guesser">${escapeHtml(data.guess.playerName || 'Player')}:</span>
        <span class="guess-text">${data.guess.correct ? '✅ Got it!' : escapeHtml(data.guess.text)}</span>
      `;
      guessesEl.appendChild(guessDiv);
      guessesEl.scrollTop = guessesEl.scrollHeight;
    }
    
    if (data.guess.correct && data.guess.playerId === state.playerId) {
      showNotification(`🎉 Correct! +${data.guess.points} points!`, 'success');
    }
  }
  
  // Round end
  if (data.roundEnd) {
    const word = data.word;
    showNotification(`The word was: ${word}`, 'info');
    
    if (!data.gameOver) {
      // Start next round after delay
      setTimeout(() => {
        if (state.currentGame === 'drawing') {
          socket.emit('drawingNextRound');
        }
      }, 3000);
    }
  }
  
  // Game over
  if (data.gameOver) {
    showPlayAgainButton('drawing');
  }
  
  // Timer update
  if (data.timeLeft !== undefined) {
    const timerEl = document.getElementById('drawingTimer');
    if (timerEl) timerEl.textContent = `⏱️ ${data.timeLeft}s`;
  }
  
  updateScoreBoard(data.players);
}

// ============================================
// POKER GAME 🃏
// ============================================

function initPoker(gameState, players) {
  console.log('🃏 Initializing Poker:', gameState);
  state.gameState = gameState;
  elements.gameTitle.textContent = '🃏 Texas Hold\'em Poker';
  
  const myHand = gameState.hands?.[state.playerId] || [];
  const myChips = gameState.chips?.[state.playerId] || 1000;
  
  elements.gameContent.innerHTML = `
    <div class="poker-container">
      <div class="poker-info">
        <div class="poker-round">Round ${gameState.round || 1}/${gameState.maxRounds || 5}</div>
        <div class="poker-pot">Pot: 💰 ${gameState.pot || 0}</div>
        <div class="poker-phase">${getPokerPhaseName(gameState.phase)}</div>
      </div>
      
      <div class="poker-community" id="pokerCommunity">
        <div class="community-label">Community Cards</div>
        <div class="community-cards">
          ${gameState.communityCards?.length > 0 ? 
            gameState.communityCards.map(card => renderCard(card)).join('') :
            '<div class="card-placeholder">🂠</div><div class="card-placeholder">🂠</div><div class="card-placeholder">🂠</div><div class="card-placeholder">🂠</div><div class="card-placeholder">🂠</div>'
          }
        </div>
      </div>
      
      <div class="poker-hand" id="pokerHand">
        <div class="hand-label">Your Hand</div>
        <div class="hand-cards">
          ${myHand.map(card => renderCard(card)).join('')}
        </div>
      </div>
      
      <div class="poker-chips">
        <span>💰 Your Chips: ${myChips}</span>
      </div>
      
      <div class="poker-actions" id="pokerActions">
        ${gameState.phase !== 'showdown' ? `
          <button class="btn btn-secondary" id="pokerFold">🚫 Fold</button>
          <button class="btn btn-primary" id="pokerCall">✅ Call</button>
          <button class="btn btn-accent" id="pokerRaise">⬆️ Raise</button>
        ` : ''}
      </div>
      
      <div class="poker-players" id="pokerPlayers">
        ${players.map(p => `
          <div class="poker-player ${p.id === state.playerId ? 'me' : ''} ${gameState.folded?.includes(p.id) ? 'folded' : ''}">
            <span class="player-name">${escapeHtml(p.name)}</span>
            <span class="player-chips">💰 ${gameState.chips?.[p.id] || 1000}</span>
            <span class="player-bet">Bet: ${gameState.bets?.[p.id] || 0}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  setupPokerListeners();
  updateScoreBoard(players);
}

function getPokerPhaseName(phase) {
  const phases = {
    'preflop': '🎴 Pre-Flop',
    'flop': '🃏 Flop',
    'turn': '🎯 Turn',
    'river': '🌊 River',
    'showdown': '👑 Showdown'
  };
  return phases[phase] || phase;
}

function renderCard(card) {
  const isRed = card.suit === '♥' || card.suit === '♦';
  return `<div class="playing-card ${isRed ? 'red' : 'black'}">${card.value}${card.suit}</div>`;
}

function setupPokerListeners() {
  document.getElementById('pokerFold')?.addEventListener('click', () => {
    socket.emit('pokerAction', { action: 'fold' });
  });
  
  document.getElementById('pokerCall')?.addEventListener('click', () => {
    socket.emit('pokerAction', { action: 'call' });
  });
  
  document.getElementById('pokerRaise')?.addEventListener('click', () => {
    socket.emit('pokerAction', { action: 'raise', amount: 50 });
  });
}

function updatePoker(data) {
  if (data.communityCards) {
    const communityEl = document.querySelector('.community-cards');
    if (communityEl) {
      communityEl.innerHTML = data.communityCards.map(card => renderCard(card)).join('');
    }
  }
  
  if (data.phase) {
    const phaseEl = document.querySelector('.poker-phase');
    if (phaseEl) phaseEl.textContent = getPokerPhaseName(data.phase);
  }
  
  if (data.pot !== undefined) {
    const potEl = document.querySelector('.poker-pot');
    if (potEl) potEl.textContent = `Pot: 💰 ${data.pot}`;
  }
  
  if (data.showdown) {
    const actionsEl = document.getElementById('pokerActions');
    if (actionsEl) {
      actionsEl.innerHTML = `
        <div class="showdown-result">
          <div class="winner-name">🏆 ${escapeHtml(data.winnerName)} wins!</div>
          <div class="winning-hand">${data.handName}</div>
        </div>
      `;
    }
  }
  
  if (data.gameOver) {
    showPlayAgainButton('poker');
  }
  
  updateScoreBoard(data.players);
}

// ============================================
// BLACKJACK GAME 🎰
// ============================================

function initBlackjack(gameState, players) {
  console.log('🎰 Initializing Blackjack:', gameState);
  state.gameState = gameState;
  elements.gameTitle.textContent = '🎰 Blackjack 21';
  
  const myHand = gameState.hands?.[state.playerId] || [];
  const myValue = calculateHandValue(myHand);
  const dealerHand = gameState.dealerHand || [];
  
  elements.gameContent.innerHTML = `
    <div class="blackjack-container">
      <div class="blackjack-info">
        <div class="bj-round">Round ${gameState.round || 1}/${gameState.maxRounds || 5}</div>
      </div>
      
      <div class="dealer-section">
        <div class="dealer-label">🎩 Dealer</div>
        <div class="dealer-cards" id="dealerCards">
          ${dealerHand.length > 0 ? renderCard(dealerHand[0]) : ''}
          ${gameState.dealerHidden ? '<div class="playing-card hidden">🂠</div>' : (dealerHand[1] ? renderCard(dealerHand[1]) : '')}
          ${!gameState.dealerHidden && dealerHand.length > 2 ? dealerHand.slice(2).map(c => renderCard(c)).join('') : ''}
        </div>
        <div class="dealer-value" id="dealerValue">
          ${gameState.dealerHidden ? '?' : calculateHandValue(dealerHand)}
        </div>
      </div>
      
      <div class="player-section">
        <div class="player-label">🃏 Your Hand</div>
        <div class="player-cards" id="playerCards">
          ${myHand.map(card => renderCard(card)).join('')}
        </div>
        <div class="player-value" id="playerValue">${myValue}</div>
      </div>
      
      <div class="blackjack-actions" id="bjActions">
        ${!gameState.stood?.includes(state.playerId) && !gameState.busted?.includes(state.playerId) ? `
          <button class="btn btn-primary btn-large" id="bjHit">👊 Hit</button>
          <button class="btn btn-secondary btn-large" id="bjStand">✋ Stand</button>
        ` : `<div class="waiting-message">Waiting for other players...</div>`}
      </div>
      
      <div class="blackjack-status" id="bjStatus"></div>
      
      <div class="blackjack-scores" id="bjScores">
        ${players.map(p => `
          <div class="bj-player ${p.id === state.playerId ? 'me' : ''} ${gameState.busted?.includes(p.id) ? 'busted' : ''} ${gameState.stood?.includes(p.id) ? 'stood' : ''}">
            <span class="player-name">${escapeHtml(p.name)}</span>
            <span class="player-score">${gameState.scores?.[p.id] || 0} pts</span>
            <span class="player-status">${gameState.busted?.includes(p.id) ? '💥' : gameState.stood?.includes(p.id) ? '✋' : '🎴'}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  setupBlackjackListeners();
  updateScoreBoard(players);
}

function calculateHandValue(cards) {
  let value = 0;
  let aces = 0;
  
  for (const card of cards) {
    if (card.value === 'A') {
      aces++;
      value += 11;
    } else if (['K', 'Q', 'J'].includes(card.value)) {
      value += 10;
    } else {
      value += parseInt(card.value);
    }
  }
  
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  
  return value;
}

function setupBlackjackListeners() {
  document.getElementById('bjHit')?.addEventListener('click', () => {
    socket.emit('blackjackAction', { action: 'hit' });
  });
  
  document.getElementById('bjStand')?.addEventListener('click', () => {
    socket.emit('blackjackAction', { action: 'stand' });
  });
}

function updateBlackjack(data) {
  // New card dealt to player
  if (data.newCard && data.playerId === state.playerId) {
    const cardsEl = document.getElementById('playerCards');
    if (cardsEl) {
      cardsEl.innerHTML += renderCard(data.newCard);
    }
    const valueEl = document.getElementById('playerValue');
    if (valueEl) valueEl.textContent = data.handValue;
    
    if (data.busted) {
      const actionsEl = document.getElementById('bjActions');
      if (actionsEl) actionsEl.innerHTML = '<div class="busted-message">💥 BUSTED!</div>';
    }
  }
  
  // Stood
  if (data.stood && data.playerId === state.playerId) {
    const actionsEl = document.getElementById('bjActions');
    if (actionsEl) actionsEl.innerHTML = '<div class="stood-message">✋ Standing at ' + data.handValue + '</div>';
  }
  
  // Dealer reveal
  if (data.dealerReveal) {
    const dealerCardsEl = document.getElementById('dealerCards');
    if (dealerCardsEl) {
      dealerCardsEl.innerHTML = data.dealerHand.map(card => renderCard(card)).join('');
    }
    const dealerValueEl = document.getElementById('dealerValue');
    if (dealerValueEl) dealerValueEl.textContent = data.dealerValue;
  }
  
  // Round results
  if (data.results) {
    const statusEl = document.getElementById('bjStatus');
    const myResult = data.results[state.playerId];
    if (statusEl && myResult) {
      const resultClass = myResult.result === 'win' ? 'win' : myResult.result === 'lose' ? 'lose' : 'push';
      statusEl.innerHTML = `
        <div class="result-banner ${resultClass}">
          ${myResult.result === 'win' ? '🎉 You Win!' : myResult.result === 'lose' ? '😢 You Lose' : '🤝 Push'}
          <div class="result-reason">${myResult.reason}</div>
        </div>
      `;
    }
  }
  
  if (data.gameOver) {
    showPlayAgainButton('blackjack');
  }
  
  updateScoreBoard(data.players);
}

// ============================================
// 24 GAME 🔢
// ============================================

function init24Game(gameState, players) {
  console.log('🔢 Initializing 24 Game:', gameState);
  state.gameState = gameState;
  elements.gameTitle.textContent = '🔢 Make 24!';
  
  elements.gameContent.innerHTML = `
    <div class="game24-container">
      <div class="game24-info">
        <div class="game24-round">Round ${gameState.round || 1}/${gameState.maxRounds || 8}</div>
        <div class="game24-timer" id="game24Timer">⏱️ ${gameState.timePerRound || 60}s</div>
      </div>
      
      <div class="game24-numbers" id="game24Numbers">
        ${(gameState.numbers || [1,2,3,4]).map(num => `
          <div class="number-card">${num}</div>
        `).join('')}
      </div>
      
      <div class="game24-goal">
        <span>Use all 4 numbers with + - × ÷ to make</span>
        <span class="goal-number">24</span>
      </div>
      
      <div class="game24-input">
        <input type="text" id="game24Input" placeholder="Enter expression like (1+2)*3+4" autocomplete="off">
        <button class="btn btn-primary" id="game24Submit">
          <span class="btn-icon">✓</span> Check
        </button>
      </div>
      
      <div class="game24-feedback" id="game24Feedback"></div>
      
      <div class="game24-hint">
        💡 Use parentheses! Example: (8-4)×(3+3)=24
      </div>
      
      <div class="game24-scores" id="game24Scores">
        ${players.map(p => `
          <div class="game24-player ${p.id === state.playerId ? 'me' : ''}">
            <span class="player-name">${escapeHtml(p.name)}</span>
            <span class="player-score">${gameState.scores?.[p.id] || 0} pts</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  setup24GameListeners();
  updateScoreBoard(players);
}

function setup24GameListeners() {
  const input = document.getElementById('game24Input');
  const submitBtn = document.getElementById('game24Submit');
  
  if (input && submitBtn) {
    const submitGuess = () => {
      const expr = input.value.trim();
      if (!expr) return;
      socket.emit('game24Guess', { expression: expr });
    };
    
    submitBtn.addEventListener('click', submitGuess);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitGuess();
    });
    
    input.focus();
  }
}

function update24Game(data) {
  const feedbackEl = document.getElementById('game24Feedback');
  const timerEl = document.getElementById('game24Timer');
  const numbersEl = document.getElementById('game24Numbers');
  const input = document.getElementById('game24Input');
  
  // Timer update
  if (data.timeLeft !== undefined && timerEl) {
    timerEl.textContent = `⏱️ ${data.timeLeft}s`;
    if (data.timeLeft <= 10) {
      timerEl.classList.add('urgent');
    }
  }
  
  // Guess result
  if (data.correct !== undefined) {
    if (data.correct) {
      if (feedbackEl) {
        feedbackEl.innerHTML = `
          <div class="feedback-correct">
            ✅ Correct! ${data.expression} = 24 (+${data.points} pts)
          </div>
        `;
      }
      if (input) input.disabled = true;
    } else {
      if (feedbackEl) {
        feedbackEl.innerHTML = `
          <div class="feedback-wrong">
            ❌ ${data.error}
          </div>
        `;
      }
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  }
  
  // Someone solved it
  if (data.solved && data.solvedBy !== state.playerId) {
    if (feedbackEl) {
      feedbackEl.innerHTML = `
        <div class="feedback-info">
          ${escapeHtml(data.solverName)} solved it! ${data.expression} = 24
        </div>
      `;
    }
    if (input) input.disabled = true;
  }
  
  // New round
  if (data.newRound && data.numbers) {
    if (numbersEl) {
      numbersEl.innerHTML = data.numbers.map(num => `
        <div class="number-card animate-pop">${num}</div>
      `).join('');
    }
    if (feedbackEl) feedbackEl.innerHTML = '';
    if (input) {
      input.value = '';
      input.disabled = false;
      input.focus();
    }
    if (timerEl) {
      timerEl.classList.remove('urgent');
      timerEl.textContent = `⏱️ ${data.timePerRound || 60}s`;
    }
    
    const roundEl = document.querySelector('.game24-round');
    if (roundEl) roundEl.textContent = `Round ${data.round}/${data.maxRounds || 8}`;
  }
  
  // Update scores
  if (data.scores) {
    for (const [playerId, score] of Object.entries(data.scores)) {
      const scoreEl = document.querySelector(`.game24-player[data-id="${playerId}"] .player-score`);
      if (scoreEl) scoreEl.textContent = `${score} pts`;
    }
  }
  
  // Time up
  if (data.timeUp) {
    if (feedbackEl) {
      feedbackEl.innerHTML = `
        <div class="feedback-timeout">
          ⏰ Time's up! No one solved it.
        </div>
      `;
    }
    if (input) input.disabled = true;
  }
  
  // Game over
  if (data.gameOver) {
    showPlayAgainButton('game24');
    
    if (data.results) {
      const scoresEl = document.getElementById('game24Scores');
      if (scoresEl) {
        scoresEl.innerHTML = data.results.map((r, i) => `
          <div class="game24-player ${r.playerId === state.playerId ? 'me' : ''} ${i === 0 ? 'winner' : ''}">
            <span class="rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`}</span>
            <span class="player-name">${escapeHtml(r.playerName || 'Player')}</span>
            <span class="player-score">${r.score} pts</span>
          </div>
        `).join('');
      }
    }
  }
  
  updateScoreBoard(data.players);
}

// ============================================
// SOCKET EVENT HANDLERS FOR NEW GAMES
// ============================================

// These will be added to the main socket event listeners
function setupNewGameSocketHandlers() {
  // Hangman
  socket.on('hangmanInit', (data) => initHangman(data.gameState, data.players));
  socket.on('hangmanUpdate', updateHangman);
  
  // Word Chain
  socket.on('wordChainInit', (data) => initWordChain(data.gameState, data.players));
  socket.on('wordChainUpdate', updateWordChain);
  
  // Reaction Test / Word Scramble
  socket.on('reactionInit', (data) => initReactionTest(data.gameState, data.players));
  socket.on('reactionUpdate', updateReactionTest);
  
  // Battleship
  socket.on('battleshipInit', (data) => initBattleship(data.gameState, data.players));
  socket.on('battleshipUpdate', updateBattleship);
  
  // Drawing Guess
  socket.on('drawingInit', (data) => initDrawingGuess(data.gameState, data.players));
  socket.on('drawingUpdate', updateDrawingGuess);
  
  // Poker
  socket.on('pokerInit', (data) => initPoker(data.gameState, data.players));
  socket.on('pokerUpdate', updatePoker);
  
  // Blackjack
  socket.on('blackjackInit', (data) => initBlackjack(data.gameState, data.players));
  socket.on('blackjackUpdate', updateBlackjack);
  
  // 24 Game
  socket.on('game24Init', (data) => init24Game(data.gameState, data.players));
  socket.on('game24Update', update24Game);
}

// Export for integration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initHangman,
    updateHangman,
    initWordChain,
    updateWordChain,
    initReactionTest,
    updateReactionTest,
    initBattleship,
    updateBattleship,
    initDrawingGuess,
    updateDrawingGuess,
    initPoker,
    updatePoker,
    initBlackjack,
    updateBlackjack,
    init24Game,
    update24Game,
    setupNewGameSocketHandlers
  };
}

// Expose to window for browser context
if (typeof window !== 'undefined') {
  window.setupNewGameSocketHandlers = setupNewGameSocketHandlers;
  window.initHangman = initHangman;
  window.updateHangman = updateHangman;
  window.initWordChain = initWordChain;
  window.updateWordChain = updateWordChain;
  window.initReactionTest = initReactionTest;
  window.updateReactionTest = updateReactionTest;
  window.initBattleship = initBattleship;
  window.updateBattleship = updateBattleship;
  window.initDrawingGuess = initDrawingGuess;
  window.updateDrawingGuess = updateDrawingGuess;
  window.initPoker = initPoker;
  window.updatePoker = updatePoker;
  window.initBlackjack = initBlackjack;
  window.updateBlackjack = updateBlackjack;
  window.init24Game = init24Game;
  window.update24Game = update24Game;
}

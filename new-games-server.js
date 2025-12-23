// ============================================
// 🎮 NEW GAMES - SERVER SIDE CODE
// ============================================
// Games: Hangman, Word Chain, Reaction Test, Battleship, Drawing Guess

// ============================================
// HANGMAN GAME 🎯
// ============================================

const HANGMAN_WORDS = {
  strangerthings: {
    characters: ['ELEVEN', 'HOPPER', 'DUSTIN', 'MIKE', 'LUCAS', 'WILL', 'NANCY', 'JONATHAN', 'STEVE', 'ROBIN', 'MAX', 'EDDIE', 'VECNA', 'DEMOGORGON', 'MINDFLAYER', 'BRENNER', 'JOYCE', 'MURRAY', 'ARGYLE', 'ERICA'],
    locations: ['HAWKINS', 'UPSIDEDOWN', 'STARCOURT', 'CREELHOUSE', 'HAWKINSLAB', 'BYERS', 'WHEELER', 'ARCADE', 'SCHOOLGYM', 'QUARRY', 'JUNKYARD', 'CABIN', 'RUSSIA', 'NEVADA', 'PIZZERIA'],
    items: ['WAFFLE', 'WALKIE', 'BICYCLE', 'CHRISTMAS', 'LIGHTS', 'BATHTUB', 'COMPASS', 'FIREWORKS', 'CASSETTE', 'GUITAR', 'SKATEBOARD', 'DUNGEONS', 'DRAGONS'],
    quotes: ['FRIENDS', 'PROMISE', 'MOUTHBREATHER', 'TOTALLY', 'TUBULAR', 'HELLFIRE', 'RAINBOW', 'ROOM']
  },
  wednesday: {
    characters: ['WEDNESDAY', 'ENID', 'THING', 'MORTICIA', 'GOMEZ', 'PUGSLEY', 'LURCH', 'XAVIER', 'AJAX', 'BIANCA', 'TYLER', 'EUGENE', 'WEEMS', 'THORNHILL', 'FESTER'],
    locations: ['NEVERMORE', 'JERICHO', 'WEATHERVANE', 'PILGRIM', 'CRACKSTONE', 'DORMITORY', 'LIBRARY', 'GREENHOUSE', 'WOODS', 'CAVE', 'CRYPT', 'MANSION'],
    items: ['CELLO', 'TYPEWRITER', 'UMBRELLA', 'POISON', 'SPIDER', 'CRYSTAL', 'CANOE', 'FENCING', 'SWORD', 'BOOK', 'DIARY', 'UNIFORM'],
    quotes: ['TORTURE', 'DARKNESS', 'PSYCHIC', 'OUTCAST', 'NORMIE', 'MONSTER', 'MURDER', 'MYSTERY']
  },
  general: {
    animals: ['ELEPHANT', 'GIRAFFE', 'PENGUIN', 'DOLPHIN', 'BUTTERFLY', 'CROCODILE', 'KANGAROO', 'OCTOPUS', 'SQUIRREL', 'HAMSTER', 'PARROT', 'LEOPARD', 'CHEETAH', 'PANTHER', 'KOALA', 'ZEBRA', 'RABBIT', 'TURTLE', 'FALCON', 'PYTHON'],
    food: ['HAMBURGER', 'SPAGHETTI', 'CHOCOLATE', 'STRAWBERRY', 'PINEAPPLE', 'MUSHROOM', 'BROCCOLI', 'SANDWICH', 'PANCAKES', 'AVOCADO', 'CUCUMBER', 'LASAGNA', 'BURRITO', 'POPCORN', 'PRETZEL', 'MUFFIN', 'WAFFLE', 'COOKIE', 'PIZZA', 'TACO'],
    places: ['MOUNTAIN', 'HOSPITAL', 'AIRPORT', 'LIBRARY', 'RESTAURANT', 'STADIUM', 'THEATER', 'MUSEUM', 'AQUARIUM', 'CATHEDRAL', 'CASTLE', 'VILLAGE', 'ISLAND', 'JUNGLE', 'DESERT', 'FOREST', 'VOLCANO', 'WATERFALL', 'PYRAMID', 'LIGHTHOUSE'],
    objects: ['COMPUTER', 'TELEPHONE', 'UMBRELLA', 'BACKPACK', 'SCISSORS', 'CALENDAR', 'KEYBOARD', 'HEADPHONES', 'SUNGLASSES', 'TELESCOPE', 'MICROSCOPE', 'FLASHLIGHT', 'SCREWDRIVER', 'THERMOMETER', 'CALCULATOR', 'ENVELOPE', 'SUITCASE', 'PILLOW', 'BLANKET', 'PAINTING'],
    nature: ['RAINBOW', 'THUNDER', 'LIGHTNING', 'TORNADO', 'HURRICANE', 'BLIZZARD', 'WATERFALL', 'GLACIER', 'VOLCANO', 'EARTHQUAKE', 'SUNRISE', 'SUNSET', 'MOONLIGHT', 'STARLIGHT', 'MEADOW', 'CANYON', 'CLIFF', 'RIVER', 'OCEAN', 'FOREST'],
    sports: ['BASKETBALL', 'FOOTBALL', 'VOLLEYBALL', 'BASEBALL', 'GYMNASTICS', 'SWIMMING', 'WRESTLING', 'ARCHERY', 'BADMINTON', 'BOWLING', 'SURFING', 'SKIING', 'SKATING', 'CYCLING', 'RUNNING', 'BOXING', 'TENNIS', 'CRICKET', 'HOCKEY', 'SOCCER'],
    science: ['CHEMISTRY', 'BIOLOGY', 'PHYSICS', 'ASTRONOMY', 'GRAVITY', 'MOLECULE', 'ELECTRON', 'NEUTRON', 'PROTON', 'OXYGEN', 'NITROGEN', 'HYDROGEN', 'CARBON', 'PHOTON', 'QUANTUM', 'ELEMENT', 'COMPOUND', 'REACTION', 'ENERGY', 'MAGNET'],
    music: ['GUITAR', 'PIANO', 'VIOLIN', 'TRUMPET', 'SAXOPHONE', 'HARMONICA', 'ACCORDION', 'CLARINET', 'XYLOPHONE', 'TAMBOURINE', 'ORCHESTRA', 'SYMPHONY', 'MELODY', 'HARMONY', 'RHYTHM', 'CHORUS', 'CONCERT', 'ALBUM', 'LYRICS', 'COMPOSER'],
    professions: ['DOCTOR', 'TEACHER', 'ENGINEER', 'SCIENTIST', 'ARCHITECT', 'DESIGNER', 'PROGRAMMER', 'ASTRONAUT', 'FIREFIGHTER', 'DETECTIVE', 'JOURNALIST', 'PHOTOGRAPHER', 'MUSICIAN', 'ARTIST', 'CHEF', 'PILOT', 'LAWYER', 'NURSE', 'DENTIST', 'SURGEON'],
    emotions: ['HAPPINESS', 'EXCITEMENT', 'SURPRISE', 'CURIOUS', 'GRATEFUL', 'PEACEFUL', 'CONFIDENT', 'CREATIVE', 'ENERGETIC', 'HOPEFUL', 'INSPIRED', 'JOYFUL', 'PROUD', 'RELAXED', 'SATISFIED', 'CHEERFUL', 'FRIENDLY', 'GENEROUS', 'PATIENT', 'BRAVE']
  }
};

function getRandomHangmanWord(category = null) {
  const allCategories = { 
    ...HANGMAN_WORDS.strangerthings, 
    ...HANGMAN_WORDS.wednesday,
    ...HANGMAN_WORDS.general
  };
  let words = [];
  
  if (category && allCategories[category]) {
    words = allCategories[category];
  } else {
    // Combine all words
    Object.values(allCategories).forEach(arr => words.push(...arr));
  }
  
  return words[Math.floor(Math.random() * words.length)];
}

function createHangmanState(roomId, customWord = null, players = null) {
  const word = customWord || getRandomHangmanWord();
  
  // Get player IDs and select a random starting guesser
  let currentGuesser = null;
  let playerOrder = [];
  if (players && players.size > 0) {
    playerOrder = Array.from(players.keys()).filter(id => id !== 'AI_PLAYER');
    if (playerOrder.length > 0) {
      currentGuesser = playerOrder[Math.floor(Math.random() * playerOrder.length)];
    }
  }
  
  return {
    word: word.toUpperCase(),
    guessedLetters: [],
    wrongGuesses: 0,
    maxWrongs: 6,
    status: 'playing', // playing, won, lost
    currentGuesser: currentGuesser,
    playerOrder: playerOrder,
    hint: getHangmanHint(word),
    wordLength: word.length,
    maskedWord: getMaskedWord(word.toUpperCase(), [])
  };
}

function getHangmanHint(word) {
  // Find which category the word belongs to
  for (const [show, categories] of Object.entries(HANGMAN_WORDS)) {
    for (const [cat, words] of Object.entries(categories)) {
      if (words.includes(word.toUpperCase())) {
        let showName;
        if (show === 'strangerthings') {
          showName = 'Stranger Things';
        } else if (show === 'wednesday') {
          showName = 'Wednesday';
        } else if (show === 'general') {
          showName = 'General';
        } else {
          showName = show;
        }
        // Capitalize category name nicely
        const catName = cat.charAt(0).toUpperCase() + cat.slice(1);
        return `${showName} - ${catName}`;
      }
    }
  }
  return 'Mystery Word';
}

function getMaskedWord(word, guessedLetters) {
  return word.split('').map(letter => 
    guessedLetters.includes(letter) ? letter : '_'
  ).join(' ');
}

function processHangmanGuess(state, letter) {
  letter = letter.toUpperCase();
  
  if (state.guessedLetters.includes(letter)) {
    return { valid: false, reason: 'already_guessed' };
  }
  
  state.guessedLetters.push(letter);
  
  if (state.word.includes(letter)) {
    // Check if won
    const allLettersGuessed = state.word.split('').every(l => state.guessedLetters.includes(l));
    if (allLettersGuessed) {
      state.status = 'won';
    }
    return { valid: true, correct: true, won: allLettersGuessed };
  } else {
    state.wrongGuesses++;
    if (state.wrongGuesses >= state.maxWrongs) {
      state.status = 'lost';
    }
    return { valid: true, correct: false, lost: state.wrongGuesses >= state.maxWrongs };
  }
}

// ============================================
// WORD CHAIN GAME ⛓️
// ============================================

const WORD_CHAIN_DICTIONARY = new Set([
  // Common words for word chain
  'APPLE', 'ELEPHANT', 'TIGER', 'RABBIT', 'TABLE', 'EAGLE', 'EARTH', 'HOUSE', 'ESCAPE',
  'ENERGY', 'YELLOW', 'WINDOW', 'WATER', 'RIVER', 'RADIO', 'ORANGE', 'EAGLE', 'ELEVEN',
  'NIGHT', 'TRAIN', 'NATURE', 'EMPTY', 'YOUTH', 'HEART', 'TOWER', 'ROBOT', 'TOAST',
  'STORM', 'MUSIC', 'CROWN', 'NOVEL', 'LIGHT', 'THINK', 'KNIFE', 'EXTRA', 'ARROW',
  'WORLD', 'DREAM', 'MAGIC', 'CANDY', 'YOUNG', 'GHOST', 'TRUTH', 'HONOR', 'ROYAL',
  'LEMON', 'NURSE', 'EMBER', 'RAVEN', 'NEVER', 'REALM', 'MANGO', 'OCEAN', 'NORTH',
  'HAPPY', 'YEARS', 'SOLAR', 'REIGN', 'NIGHT', 'TEMPO', 'OASIS', 'STONE', 'EVENT',
  // Stranger Things themed
  'ELEVEN', 'NANCY', 'DUSTIN', 'NANCY', 'HOPPER', 'ROBIN', 'NANCY', 'STEVE', 'EDDIE',
  'UPSIDE', 'EGGO', 'WAFFLE', 'EGGO', 'LIGHTS', 'SHADOW', 'WALKIE', 'ESCAPE',
  // Wednesday themed  
  'WEDNESDAY', 'YELLOW', 'WEEMS', 'SPIDER', 'RAVEN', 'NEVERMORE', 'ENID', 'DARKNESS',
  'STORM', 'MURDER', 'RAVEN', 'NEVERMORE', 'EDGAR', 'RAVEN', 'NIGHTMARE', 'EVIL'
]);

function createWordChainState(roomId, players) {
  const playerIds = Array.from(players.keys()).filter(id => id !== 'AI_PLAYER');
  return {
    usedWords: [],
    currentWord: null,
    currentPlayerIndex: 0,
    playerOrder: playerIds,
    scores: new Map(playerIds.map(id => [id, 0])),
    timePerTurn: 15, // seconds
    turnStartTime: null,
    status: 'playing',
    roundsPlayed: 0,
    maxRounds: 10
  };
}

function isValidWordChainWord(word, lastWord, usedWords) {
  word = word.toUpperCase().trim();
  
  // Check if word was already used
  if (usedWords.includes(word)) {
    return { valid: false, reason: 'Word already used' };
  }
  
  // Check if word starts with last letter of previous word
  if (lastWord) {
    const lastLetter = lastWord[lastWord.length - 1];
    if (word[0] !== lastLetter) {
      return { valid: false, reason: `Word must start with "${lastLetter}"` };
    }
  }
  
  // Check minimum length
  if (word.length < 3) {
    return { valid: false, reason: 'Word must be at least 3 letters' };
  }
  
  // For now, accept any word (could add dictionary check)
  return { valid: true };
}

function processWordChainTurn(state, playerId, word) {
  word = word.toUpperCase().trim();
  
  const validation = isValidWordChainWord(word, state.currentWord, state.usedWords);
  if (!validation.valid) {
    return { success: false, reason: validation.reason };
  }
  
  // Valid word
  state.usedWords.push(word);
  state.currentWord = word;
  
  // Award points based on word length
  const points = word.length;
  state.scores.set(playerId, (state.scores.get(playerId) || 0) + points);
  
  // Next player
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.playerOrder.length;
  state.turnStartTime = Date.now();
  state.roundsPlayed++;
  
  // Check if game over
  if (state.roundsPlayed >= state.maxRounds * state.playerOrder.length) {
    state.status = 'finished';
  }
  
  return { 
    success: true, 
    points,
    nextPlayer: state.playerOrder[state.currentPlayerIndex],
    gameOver: state.status === 'finished'
  };
}

// ============================================
// SPEED MATH DUEL 🔢⚡ (Fast-paced math competition)
// ============================================

// Operation types for different difficulties
const MATH_OPERATIONS = {
  easy: ['+', '-'],
  medium: ['+', '-', '×'],
  hard: ['+', '-', '×', '÷']
};

function generateMathProblem(difficulty = 'medium') {
  const ops = MATH_OPERATIONS[difficulty] || MATH_OPERATIONS.medium;
  const op = ops[Math.floor(Math.random() * ops.length)];
  
  let num1, num2, answer;
  
  switch (op) {
    case '+':
      num1 = Math.floor(Math.random() * (difficulty === 'hard' ? 100 : 50)) + 1;
      num2 = Math.floor(Math.random() * (difficulty === 'hard' ? 100 : 50)) + 1;
      answer = num1 + num2;
      break;
    case '-':
      num1 = Math.floor(Math.random() * (difficulty === 'hard' ? 100 : 50)) + 10;
      num2 = Math.floor(Math.random() * num1);
      answer = num1 - num2;
      break;
    case '×':
      num1 = Math.floor(Math.random() * (difficulty === 'hard' ? 15 : 12)) + 1;
      num2 = Math.floor(Math.random() * (difficulty === 'hard' ? 15 : 12)) + 1;
      answer = num1 * num2;
      break;
    case '÷':
      num2 = Math.floor(Math.random() * 10) + 2;
      answer = Math.floor(Math.random() * 12) + 1;
      num1 = num2 * answer;
      break;
    default:
      num1 = Math.floor(Math.random() * 20) + 1;
      num2 = Math.floor(Math.random() * 20) + 1;
      answer = num1 + num2;
  }
  
  return {
    num1,
    num2,
    operation: op,
    answer,
    display: `${num1} ${op} ${num2} = ?`
  };
}

function createReactionTestState(roomId, players) {
  const playerIds = Array.from(players.keys()).filter(id => id !== 'AI_PLAYER');
  return {
    round: 1,
    maxRounds: 10,
    status: 'waiting', // waiting, active, answered, finished
    currentProblem: null,
    problemStartTime: null,
    playerOrder: playerIds,
    scores: Object.fromEntries(playerIds.map(id => [id, 0])),
    roundScores: Object.fromEntries(playerIds.map(id => [id, 0])),
    answeredThisRound: [],
    firstCorrect: null,
    difficulty: 'medium',
    timePerRound: 10, // seconds
    gameType: 'speed_math'
  };
}

function startReactionRound(state) {
  state.currentProblem = generateMathProblem(state.difficulty);
  state.problemStartTime = Date.now();
  state.status = 'active';
  state.answeredThisRound = [];
  state.firstCorrect = null;
  state.roundScores = Object.fromEntries(state.playerOrder.map(id => [id, 0]));
  
  return state;
}

function processReactionClick(state, playerId, answer) {
  // Already answered this round?
  if (state.answeredThisRound.includes(playerId)) {
    return { error: 'Already answered this round' };
  }
  
  if (state.status !== 'active') {
    return { error: 'Round not active' };
  }
  
  const isCorrect = parseInt(answer) === state.currentProblem.answer;
  const responseTime = Date.now() - state.problemStartTime;
  
  state.answeredThisRound.push(playerId);
  
  if (isCorrect) {
    // Calculate points based on speed (max 10 points, min 1)
    const timeBonus = Math.max(1, Math.floor(10 - (responseTime / 1000)));
    const isFirst = state.firstCorrect === null;
    
    if (isFirst) {
      state.firstCorrect = playerId;
    }
    
    // First correct gets bonus points
    const points = isFirst ? timeBonus + 3 : timeBonus;
    state.scores[playerId] = (state.scores[playerId] || 0) + points;
    state.roundScores[playerId] = points;
    
    // Check if all players answered
    const allAnswered = state.answeredThisRound.length >= state.playerOrder.length;
    
    if (allAnswered) {
      state.round++;
      if (state.round > state.maxRounds) {
        state.status = 'finished';
      } else {
        state.status = 'waiting';
      }
    }
    
    return {
      correct: true,
      isFirst,
      points,
      responseTime,
      allAnswered,
      gameOver: state.status === 'finished'
    };
  } else {
    // Wrong answer - small penalty
    state.scores[playerId] = Math.max(0, (state.scores[playerId] || 0) - 1);
    state.roundScores[playerId] = -1;
    
    return {
      correct: false,
      correctAnswer: state.currentProblem.answer,
      penalty: -1
    };
  }
}

function getReactionResults(state) {
  const results = [];
  for (const playerId of state.playerOrder) {
    results.push({
      playerId,
      score: state.scores[playerId] || 0
    });
  }
  results.sort((a, b) => b.score - a.score);
  
  // Award placement points
  const points = [3, 2, 1];
  results.forEach((r, i) => {
    r.points = points[i] || 0;
  });
  
  return results;
}

// ============================================
// BATTLESHIP GAME 🚢
// ============================================

const BATTLESHIP_SHIPS = [
  { name: 'Creel House', size: 5, emoji: '🏚️' },
  { name: 'Nevermore', size: 4, emoji: '🏰' },
  { name: 'Hawkins Van', size: 3, emoji: '🚐' },
  { name: 'Bicycle', size: 3, emoji: '🚲' },
  { name: 'Canoe', size: 2, emoji: '🛶' }
];

function createBattleshipState(player1Id, player2Id) {
  // Create initial empty boards for both players
  const board1 = createEmptyBoard();
  const board2 = createEmptyBoard();
  
  return {
    player1: player1Id,
    player2: player2Id,
    boards: {
      [player1Id]: board1,
      [player2Id]: board2
    },
    ships: {
      [player1Id]: [],
      [player2Id]: []
    },
    shots: {
      [player1Id]: [], // shots player1 has fired at player2
      [player2Id]: []
    },
    phase: 'placement', // placement, playing, finished
    currentPlayer: player1Id,
    placementReady: {
      [player1Id]: false,
      [player2Id]: false
    },
    winner: null,
    // Helper function to get player-specific view of game state
    getPlayerView: function(playerId) {
      const opponentId = playerId === this.player1 ? this.player2 : this.player1;
      return {
        phase: this.phase,
        currentPlayer: this.currentPlayer,
        myBoard: this.boards[playerId],
        enemyShots: this.shots[opponentId].map(s => ({ row: s.row, col: s.col, hit: s.hit })),
        myShots: this.shots[playerId].map(s => ({ row: s.row, col: s.col, hit: s.hit })),
        placedShips: this.ships[playerId].map(s => s.index),
        allShipsPlaced: this.ships[playerId].length === BATTLESHIP_SHIPS.length,
        isReady: this.placementReady[playerId],
        opponentReady: this.placementReady[opponentId]
      };
    }
  };
}

function createEmptyBoard() {
  return Array(10).fill(null).map(() => Array(10).fill(null));
}

function placeShip(state, playerId, shipIndex, startRow, startCol, horizontal) {
  const ship = BATTLESHIP_SHIPS[shipIndex];
  if (!ship) return { success: false, reason: 'Invalid ship' };
  
  const board = state.boards[playerId];
  const positions = [];
  
  // Check if placement is valid
  for (let i = 0; i < ship.size; i++) {
    const row = horizontal ? startRow : startRow + i;
    const col = horizontal ? startCol + i : startCol;
    
    if (row < 0 || row >= 10 || col < 0 || col >= 10) {
      return { success: false, reason: 'Ship goes off board' };
    }
    
    if (board[row][col] !== null) {
      return { success: false, reason: 'Space already occupied' };
    }
    
    positions.push({ row, col });
  }
  
  // Place the ship
  positions.forEach(pos => {
    board[pos.row][pos.col] = shipIndex;
  });
  
  state.ships[playerId].push({
    ...ship,
    index: shipIndex,
    positions,
    hits: 0
  });
  
  return { success: true, positions };
}

function fireShot(state, shooterId, targetRow, targetCol) {
  const targetId = shooterId === state.player1 ? state.player2 : state.player1;
  const targetBoard = state.boards[targetId];
  const shots = state.shots[shooterId];
  
  // Check if already shot here
  if (shots.some(s => s.row === targetRow && s.col === targetCol)) {
    return { success: false, reason: 'Already shot here' };
  }
  
  const cellValue = targetBoard[targetRow][targetCol];
  const isHit = cellValue !== null;
  
  shots.push({ row: targetRow, col: targetCol, hit: isHit });
  
  let sunk = null;
  if (isHit) {
    // Find and update the ship
    const ship = state.ships[targetId].find(s => s.index === cellValue);
    if (ship) {
      ship.hits++;
      if (ship.hits === ship.size) {
        sunk = ship;
      }
    }
  }
  
  // Check for winner
  const allSunk = state.ships[targetId].every(s => s.hits === s.size);
  if (allSunk) {
    state.winner = shooterId;
    state.phase = 'finished';
  } else {
    // Switch turns
    state.currentPlayer = targetId;
  }
  
  return { 
    success: true, 
    hit: isHit, 
    sunk,
    gameOver: state.phase === 'finished',
    winner: state.winner
  };
}

// ============================================
// DRAWING GUESS GAME 🎨
// ============================================

const DRAWING_WORDS = {
  easy: [
    'CAT', 'DOG', 'HOUSE', 'TREE', 'SUN', 'MOON', 'STAR', 'FISH', 'BIRD', 'FLOWER',
    'CAR', 'BOAT', 'PLANE', 'BALL', 'BOOK', 'CHAIR', 'TABLE', 'BED', 'DOOR', 'WINDOW'
  ],
  medium: [
    'BICYCLE', 'ELEPHANT', 'GUITAR', 'RAINBOW', 'CASTLE', 'DRAGON', 'WIZARD', 'PIRATE',
    'ROBOT', 'ALIEN', 'VAMPIRE', 'GHOST', 'WITCH', 'MONSTER', 'UNICORN', 'MERMAID'
  ],
  hard: [
    'DEMOGORGON', 'MINDFLAYER', 'UPSIDEDOWN', 'NEVERMORE', 'WEDNESDAY', 'ADDAMS',
    'TELEKINESIS', 'PSYCHIC', 'NIGHTMARE', 'DARKNESS', 'MYSTERY', 'SUPERNATURAL'
  ],
  strangerthings: [
    'ELEVEN', 'WAFFLE', 'CHRISTMAS LIGHTS', 'DEMOGORGON', 'BICYCLE', 'WALKIE TALKIE',
    'UPSIDE DOWN', 'HAWKINS', 'MIND FLAYER', 'VECNA', 'CREEL HOUSE', 'STARCOURT'
  ],
  wednesday: [
    'WEDNESDAY', 'THING', 'CELLO', 'NEVERMORE', 'SPIDER', 'RAVEN', 'UMBRELLA',
    'TYPEWRITER', 'FENCING', 'CRYSTAL BALL', 'POISON', 'GOTHIC'
  ]
};

function createDrawingGuessState(players, difficulty = 'medium') {
  const playerIds = Array.from(players.keys()).filter(id => id !== 'AI_PLAYER');
  return {
    round: 0,
    maxRounds: playerIds.length * 2, // Each player draws twice
    drawerIndex: 0,
    playerOrder: playerIds,
    currentWord: null,
    wordHint: null,
    guesses: [],
    correctGuessers: [],
    scores: new Map(playerIds.map(id => [id, 0])),
    timePerRound: 60, // seconds
    roundStartTime: null,
    status: 'waiting', // waiting, drawing, roundEnd, finished
    difficulty,
    canvasData: null
  };
}

function startDrawingRound(state) {
  state.round++;
  state.status = 'drawing';
  state.guesses = [];
  state.correctGuessers = [];
  state.canvasData = null;
  state.roundStartTime = Date.now();
  
  // Select word based on difficulty
  const wordList = DRAWING_WORDS[state.difficulty] || DRAWING_WORDS.medium;
  state.currentWord = wordList[Math.floor(Math.random() * wordList.length)];
  state.wordHint = state.currentWord.split('').map((c, i) => 
    i === 0 || c === ' ' ? c : '_'
  ).join('');
  
  return {
    drawer: state.playerOrder[state.drawerIndex],
    word: state.currentWord,
    hint: state.wordHint,
    round: state.round,
    maxRounds: state.maxRounds
  };
}

function processDrawingGuess(state, playerId, guess) {
  // Can't guess if you're the drawer
  if (playerId === state.playerOrder[state.drawerIndex]) {
    return { valid: false, reason: 'drawer_cannot_guess' };
  }
  
  // Can't guess if already guessed correctly
  if (state.correctGuessers.includes(playerId)) {
    return { valid: false, reason: 'already_correct' };
  }
  
  const normalizedGuess = guess.toUpperCase().trim();
  const normalizedWord = state.currentWord.toUpperCase().trim();
  
  state.guesses.push({ playerId, guess, correct: normalizedGuess === normalizedWord });
  
  if (normalizedGuess === normalizedWord) {
    state.correctGuessers.push(playerId);
    
    // Points based on order of correct guesses
    const points = Math.max(10 - (state.correctGuessers.length - 1) * 2, 2);
    state.scores.set(playerId, (state.scores.get(playerId) || 0) + points);
    
    // Drawer also gets points
    const drawerId = state.playerOrder[state.drawerIndex];
    state.scores.set(drawerId, (state.scores.get(drawerId) || 0) + 2);
    
    return { 
      valid: true, 
      correct: true, 
      points,
      allGuessed: state.correctGuessers.length === state.playerOrder.length - 1
    };
  }
  
  return { valid: true, correct: false };
}

function endDrawingRound(state) {
  state.drawerIndex = (state.drawerIndex + 1) % state.playerOrder.length;
  
  if (state.round >= state.maxRounds) {
    state.status = 'finished';
  } else {
    state.status = 'roundEnd';
  }
  
  return {
    word: state.currentWord,
    correctGuessers: state.correctGuessers,
    scores: Object.fromEntries(state.scores),
    gameOver: state.status === 'finished'
  };
}

// ============================================
// AI OPPONENTS FOR NEW GAMES
// ============================================

function getAIHangmanGuess(state) {
  // AI guesses based on letter frequency
  const frequency = 'ETAOINSHRDLCUMWFGYPBVKJXQZ';
  for (const letter of frequency) {
    if (!state.guessedLetters.includes(letter)) {
      return letter;
    }
  }
  return 'A';
}

function getAIWordChainWord(lastWord, usedWords) {
  const lastLetter = lastWord ? lastWord[lastWord.length - 1] : 'A';
  
  // Find a word starting with the last letter
  const possibleWords = Array.from(WORD_CHAIN_DICTIONARY).filter(word => 
    word[0] === lastLetter && !usedWords.includes(word)
  );
  
  if (possibleWords.length > 0) {
    return possibleWords[Math.floor(Math.random() * possibleWords.length)];
  }
  
  return null; // AI loses if no word found
}

function getAIBattleshipShot(shots, boardSize = 10) {
  // Hunt and target algorithm
  const shotSet = new Set(shots.map(s => `${s.row},${s.col}`));
  
  // Find hits that aren't part of sunk ships
  const unsunkHits = shots.filter(s => s.hit && !s.partOfSunk);
  
  if (unsunkHits.length > 0) {
    // Target mode: shoot adjacent to hits
    for (const hit of unsunkHits) {
      const adjacent = [
        { row: hit.row - 1, col: hit.col },
        { row: hit.row + 1, col: hit.col },
        { row: hit.row, col: hit.col - 1 },
        { row: hit.row, col: hit.col + 1 }
      ];
      
      for (const pos of adjacent) {
        if (pos.row >= 0 && pos.row < boardSize && 
            pos.col >= 0 && pos.col < boardSize &&
            !shotSet.has(`${pos.row},${pos.col}`)) {
          return pos;
        }
      }
    }
  }
  
  // Hunt mode: checkerboard pattern
  const candidates = [];
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if ((row + col) % 2 === 0 && !shotSet.has(`${row},${col}`)) {
        candidates.push({ row, col });
      }
    }
  }
  
  if (candidates.length === 0) {
    // Fill in remaining squares
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (!shotSet.has(`${row},${col}`)) {
          candidates.push({ row, col });
        }
      }
    }
  }
  
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Export all functions
module.exports = {
  // Hangman
  HANGMAN_WORDS,
  getRandomHangmanWord,
  createHangmanState,
  getMaskedWord,
  processHangmanGuess,
  getAIHangmanGuess,
  
  // Word Chain
  WORD_CHAIN_DICTIONARY,
  createWordChainState,
  isValidWordChainWord,
  processWordChainTurn,
  getAIWordChainWord,
  
  // Reaction Test
  createReactionTestState,
  startReactionRound,
  processReactionClick,
  getReactionResults,
  
  // Battleship
  BATTLESHIP_SHIPS,
  createBattleshipState,
  createEmptyBoard,
  placeShip,
  fireShot,
  getAIBattleshipShot,
  
  // Drawing Guess
  DRAWING_WORDS,
  createDrawingGuessState,
  startDrawingRound,
  processDrawingGuess,
  endDrawingRound
};

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
// WORD SCRAMBLE 🔀 (Unscramble words race)
// ============================================

// Word lists for scrambling
const SCRAMBLE_WORDS = {
  easy: [
    'APPLE', 'BEACH', 'CANDY', 'DANCE', 'EAGLE', 'FLAME', 'GRAPE', 'HAPPY', 'IMAGE', 'JUICE',
    'KITE', 'LEMON', 'MAGIC', 'NIGHT', 'OCEAN', 'PIANO', 'QUEEN', 'RIVER', 'STORM', 'TIGER',
    'UNCLE', 'VOICE', 'WATER', 'YOUTH', 'ZEBRA', 'BREAD', 'CHAIR', 'DREAM', 'EARTH', 'FROST'
  ],
  medium: [
    'BUTTERFLY', 'CHOCOLATE', 'DOLPHIN', 'ELEPHANT', 'FESTIVAL', 'GIRAFFE', 'HARMONY', 
    'INVENTOR', 'JOURNEY', 'KITCHEN', 'LANTERN', 'MOUNTAIN', 'NOTEBOOK', 'OPPOSITE',
    'PARADISE', 'QUESTION', 'RAINBOW', 'SUNSHINE', 'TREASURE', 'UMBRELLA', 'VACATION',
    'WHISPER', 'ADVENTURE', 'BIRTHDAY', 'CHAMPION', 'DIAMOND', 'ENORMOUS', 'FANTASTIC'
  ],
  hard: [
    'MYSTERIOUS', 'ADVENTURE', 'BEAUTIFUL', 'CELEBRATE', 'DANGEROUS', 'EXCITEMENT',
    'FRIENDSHIP', 'GENERATION', 'HAPPINESS', 'IMPOSSIBLE', 'JOURNALISM', 'KNOWLEDGE',
    'LABORATORY', 'MAGNIFICENT', 'NEIGHBORHOOD', 'OPPORTUNITY', 'PHOTOGRAPHY', 'RESTAURANT',
    'SKATEBOARD', 'TECHNOLOGY', 'UNDERSTAND', 'VOLLEYBALL', 'WEDNESDAY', 'XYLOPHONE'
  ]
};

function scrambleWord(word) {
  const letters = word.split('');
  let scrambled = word;
  
  // Keep scrambling until it's different from original
  let attempts = 0;
  while (scrambled === word && attempts < 20) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    scrambled = letters.join('');
    attempts++;
  }
  
  return scrambled;
}

function getRandomScrambleWord(difficulty = 'medium') {
  const words = SCRAMBLE_WORDS[difficulty] || SCRAMBLE_WORDS.medium;
  return words[Math.floor(Math.random() * words.length)];
}

function createReactionTestState(roomId, players) {
  const playerIds = Array.from(players.keys()).filter(id => id !== 'AI_PLAYER');
  return {
    round: 1,
    maxRounds: 8,
    status: 'waiting', // waiting, active, answered, finished
    currentWord: null,
    scrambledWord: null,
    wordStartTime: null,
    playerOrder: playerIds,
    scores: Object.fromEntries(playerIds.map(id => [id, 0])),
    answeredThisRound: [],
    firstCorrect: null,
    difficulty: 'medium',
    timePerRound: 20, // seconds
    hintsUsed: Object.fromEntries(playerIds.map(id => [id, 0])),
    gameType: 'word_scramble'
  };
}

function startReactionRound(state) {
  const word = getRandomScrambleWord(state.difficulty);
  state.currentWord = word;
  state.scrambledWord = scrambleWord(word);
  state.wordStartTime = Date.now();
  state.status = 'active';
  state.answeredThisRound = [];
  state.firstCorrect = null;
  
  return state;
}

function processReactionClick(state, playerId, answer) {
  // Already answered correctly this round?
  if (state.answeredThisRound.includes(playerId)) {
    return { error: 'Already solved this round' };
  }
  
  if (state.status !== 'active') {
    return { error: 'Round not active' };
  }
  
  const guess = (answer + '').toUpperCase().trim();
  const isCorrect = guess === state.currentWord;
  const responseTime = Date.now() - state.wordStartTime;
  
  if (isCorrect) {
    state.answeredThisRound.push(playerId);
    
    // Calculate points based on speed and word length
    const wordBonus = Math.floor(state.currentWord.length / 2);
    const timeBonus = Math.max(1, Math.floor(15 - (responseTime / 1000)));
    const isFirst = state.firstCorrect === null;
    
    if (isFirst) {
      state.firstCorrect = playerId;
    }
    
    // First correct gets bonus points
    const points = isFirst ? timeBonus + wordBonus + 5 : timeBonus + wordBonus;
    state.scores[playerId] = (state.scores[playerId] || 0) + points;
    
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
      word: state.currentWord,
      gameOver: state.status === 'finished'
    };
  } else {
    // Wrong guess - no penalty, just feedback
    return {
      correct: false,
      guess: guess,
      hint: `Try again! The word has ${state.currentWord.length} letters.`
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

// ============================================
// POKER GAME 🃏 (Texas Hold'em style)
// ============================================

const CARD_SUITS = ['♠', '♥', '♦', '♣'];
const CARD_VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const HAND_RANKS = {
  'Royal Flush': 10,
  'Straight Flush': 9,
  'Four of a Kind': 8,
  'Full House': 7,
  'Flush': 6,
  'Straight': 5,
  'Three of a Kind': 4,
  'Two Pair': 3,
  'One Pair': 2,
  'High Card': 1
};

function createDeck() {
  const deck = [];
  for (const suit of CARD_SUITS) {
    for (const value of CARD_VALUES) {
      deck.push({ suit, value, display: `${value}${suit}` });
    }
  }
  return shuffleDeck(deck);
}

function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getCardNumericValue(value) {
  if (value === 'A') return 14;
  if (value === 'K') return 13;
  if (value === 'Q') return 12;
  if (value === 'J') return 11;
  return parseInt(value);
}

function evaluatePokerHand(cards) {
  // Sort by value
  const sorted = [...cards].sort((a, b) => getCardNumericValue(b.value) - getCardNumericValue(a.value));
  const values = sorted.map(c => getCardNumericValue(c.value));
  const suits = sorted.map(c => c.suit);
  
  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = values.every((v, i) => i === 0 || values[i-1] - v === 1) ||
                     (values[0] === 14 && values[1] === 5); // Ace-low straight
  
  // Count values
  const valueCounts = {};
  values.forEach(v => valueCounts[v] = (valueCounts[v] || 0) + 1);
  const counts = Object.values(valueCounts).sort((a, b) => b - a);
  
  let rank, handName;
  
  if (isFlush && isStraight && values[0] === 14) {
    rank = HAND_RANKS['Royal Flush'];
    handName = 'Royal Flush';
  } else if (isFlush && isStraight) {
    rank = HAND_RANKS['Straight Flush'];
    handName = 'Straight Flush';
  } else if (counts[0] === 4) {
    rank = HAND_RANKS['Four of a Kind'];
    handName = 'Four of a Kind';
  } else if (counts[0] === 3 && counts[1] === 2) {
    rank = HAND_RANKS['Full House'];
    handName = 'Full House';
  } else if (isFlush) {
    rank = HAND_RANKS['Flush'];
    handName = 'Flush';
  } else if (isStraight) {
    rank = HAND_RANKS['Straight'];
    handName = 'Straight';
  } else if (counts[0] === 3) {
    rank = HAND_RANKS['Three of a Kind'];
    handName = 'Three of a Kind';
  } else if (counts[0] === 2 && counts[1] === 2) {
    rank = HAND_RANKS['Two Pair'];
    handName = 'Two Pair';
  } else if (counts[0] === 2) {
    rank = HAND_RANKS['One Pair'];
    handName = 'One Pair';
  } else {
    rank = HAND_RANKS['High Card'];
    handName = 'High Card';
  }
  
  return { rank, handName, highCard: values[0], cards: sorted };
}

function getBestPokerHand(holeCards, communityCards) {
  const allCards = [...holeCards, ...communityCards];
  let bestHand = null;
  
  // Try all combinations of 5 cards
  for (let i = 0; i < allCards.length; i++) {
    for (let j = i + 1; j < allCards.length; j++) {
      for (let k = j + 1; k < allCards.length; k++) {
        for (let l = k + 1; l < allCards.length; l++) {
          for (let m = l + 1; m < allCards.length; m++) {
            const hand = [allCards[i], allCards[j], allCards[k], allCards[l], allCards[m]];
            const evaluation = evaluatePokerHand(hand);
            if (!bestHand || evaluation.rank > bestHand.rank || 
                (evaluation.rank === bestHand.rank && evaluation.highCard > bestHand.highCard)) {
              bestHand = evaluation;
            }
          }
        }
      }
    }
  }
  
  return bestHand;
}

function createPokerState(players) {
  const playerIds = Array.from(players.keys()).filter(id => id !== 'AI_PLAYER');
  const deck = createDeck();
  
  // Deal 2 cards to each player
  const hands = {};
  playerIds.forEach(id => {
    hands[id] = [deck.pop(), deck.pop()];
  });
  
  return {
    deck,
    hands,
    communityCards: [],
    playerOrder: playerIds,
    currentPlayerIndex: 0,
    phase: 'preflop', // preflop, flop, turn, river, showdown
    pot: 0,
    bets: Object.fromEntries(playerIds.map(id => [id, 0])),
    chips: Object.fromEntries(playerIds.map(id => [id, 1000])),
    folded: [],
    round: 1,
    maxRounds: 5,
    scores: Object.fromEntries(playerIds.map(id => [id, 0])),
    status: 'betting' // betting, showdown, finished
  };
}

function advancePokerPhase(state) {
  switch (state.phase) {
    case 'preflop':
      // Deal flop (3 cards)
      state.communityCards.push(state.deck.pop(), state.deck.pop(), state.deck.pop());
      state.phase = 'flop';
      break;
    case 'flop':
      // Deal turn (1 card)
      state.communityCards.push(state.deck.pop());
      state.phase = 'turn';
      break;
    case 'turn':
      // Deal river (1 card)
      state.communityCards.push(state.deck.pop());
      state.phase = 'river';
      break;
    case 'river':
      state.phase = 'showdown';
      break;
  }
  return state;
}

function determinePokerWinner(state) {
  const activePlayers = state.playerOrder.filter(id => !state.folded.includes(id));
  
  if (activePlayers.length === 1) {
    return { winner: activePlayers[0], handName: 'Everyone else folded' };
  }
  
  let bestHand = null;
  let winner = null;
  
  for (const playerId of activePlayers) {
    const hand = getBestPokerHand(state.hands[playerId], state.communityCards);
    if (!bestHand || hand.rank > bestHand.rank || 
        (hand.rank === bestHand.rank && hand.highCard > bestHand.highCard)) {
      bestHand = hand;
      winner = playerId;
    }
  }
  
  return { winner, handName: bestHand.handName, hand: bestHand };
}

// ============================================
// BLACKJACK GAME 🎰
// ============================================

function createBlackjackDeck() {
  const deck = [];
  // Use 6 decks like casinos
  for (let d = 0; d < 6; d++) {
    for (const suit of CARD_SUITS) {
      for (const value of CARD_VALUES) {
        deck.push({ suit, value, display: `${value}${suit}` });
      }
    }
  }
  return shuffleDeck(deck);
}

function getBlackjackValue(cards) {
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
  
  // Adjust for aces
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  
  return value;
}

function createBlackjackState(players) {
  const playerIds = Array.from(players.keys()).filter(id => id !== 'AI_PLAYER');
  const deck = createBlackjackDeck();
  
  // Deal initial cards
  const hands = {};
  playerIds.forEach(id => {
    hands[id] = [deck.pop(), deck.pop()];
  });
  
  // Dealer hand
  const dealerHand = [deck.pop(), deck.pop()];
  
  return {
    deck,
    hands,
    dealerHand,
    dealerHidden: true, // Second card hidden
    playerOrder: playerIds,
    currentPlayerIndex: 0,
    status: 'playing', // playing, dealerTurn, finished
    stood: [],
    busted: [],
    chips: Object.fromEntries(playerIds.map(id => [id, 1000])),
    bets: Object.fromEntries(playerIds.map(id => [id, 50])),
    round: 1,
    maxRounds: 5,
    scores: Object.fromEntries(playerIds.map(id => [id, 0])),
    results: {}
  };
}

function blackjackHit(state, playerId) {
  if (state.busted.includes(playerId) || state.stood.includes(playerId)) {
    return { error: 'Cannot hit' };
  }
  
  const card = state.deck.pop();
  state.hands[playerId].push(card);
  const value = getBlackjackValue(state.hands[playerId]);
  
  if (value > 21) {
    state.busted.push(playerId);
    return { card, value, busted: true };
  }
  
  if (value === 21) {
    state.stood.push(playerId);
    return { card, value, blackjack: true };
  }
  
  return { card, value };
}

function blackjackStand(state, playerId) {
  if (!state.stood.includes(playerId)) {
    state.stood.push(playerId);
  }
  return { stood: true };
}

function playDealerHand(state) {
  state.dealerHidden = false;
  
  // Dealer hits until 17+
  while (getBlackjackValue(state.dealerHand) < 17) {
    state.dealerHand.push(state.deck.pop());
  }
  
  return getBlackjackValue(state.dealerHand);
}

function determineBlackjackResults(state) {
  const dealerValue = getBlackjackValue(state.dealerHand);
  const dealerBusted = dealerValue > 21;
  const results = {};
  
  for (const playerId of state.playerOrder) {
    const playerValue = getBlackjackValue(state.hands[playerId]);
    const playerBusted = state.busted.includes(playerId);
    
    if (playerBusted) {
      results[playerId] = { result: 'lose', reason: 'Busted' };
      state.scores[playerId] = (state.scores[playerId] || 0) - 1;
    } else if (dealerBusted) {
      results[playerId] = { result: 'win', reason: 'Dealer busted' };
      state.scores[playerId] = (state.scores[playerId] || 0) + 2;
    } else if (playerValue > dealerValue) {
      results[playerId] = { result: 'win', reason: `${playerValue} beats ${dealerValue}` };
      state.scores[playerId] = (state.scores[playerId] || 0) + 2;
    } else if (playerValue < dealerValue) {
      results[playerId] = { result: 'lose', reason: `${dealerValue} beats ${playerValue}` };
      state.scores[playerId] = (state.scores[playerId] || 0) - 1;
    } else {
      results[playerId] = { result: 'push', reason: 'Tie' };
    }
  }
  
  state.results = results;
  return results;
}

// ============================================
// 24 GAME 🔢 (Make 24 with 4 numbers)
// ============================================

function generate24Puzzle() {
  // Pre-defined solvable puzzles
  const puzzles = [
    { numbers: [1, 2, 3, 4], solutions: ['(1+2+3)*4', '4*(1+2+3)', '(4-1)*(2+3+1)'] },
    { numbers: [1, 3, 4, 6], solutions: ['6/(1-3/4)', '(6-4+1)*3'] },
    { numbers: [2, 3, 4, 6], solutions: ['(6-2)*(4+3-1)', '6*(4-2+3-3)'] },
    { numbers: [1, 5, 5, 5], solutions: ['(5-1/5)*5'] },
    { numbers: [3, 3, 8, 8], solutions: ['8/(3-8/3)'] },
    { numbers: [2, 3, 5, 12], solutions: ['(5-3)*12', '12*(5-3)'] },
    { numbers: [1, 4, 5, 6], solutions: ['4*(6-1/5)', '(6+1-5)*4'] },
    { numbers: [2, 4, 6, 8], solutions: ['(8-4)*(6+2-2)', '8+6+4*2+2'] },
    { numbers: [1, 2, 7, 7], solutions: ['(1+7)*(7-2-2)'] },
    { numbers: [3, 4, 7, 8], solutions: ['(7-3)*(8-4+2)'] },
    { numbers: [2, 2, 5, 8], solutions: ['8*(5-2-2+2)'] },
    { numbers: [1, 6, 6, 8], solutions: ['(6-1-6+8)*6'] },
    { numbers: [4, 4, 7, 7], solutions: ['(7-4)*(7+4-3)'] },
    { numbers: [2, 5, 7, 8], solutions: ['(7-5)*8+2*4'] },
    { numbers: [3, 6, 6, 9], solutions: ['(9-6)*(6+3-1)'] }
  ];
  
  // Shuffle numbers within the puzzle
  const puzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
  const shuffledNumbers = [...puzzle.numbers].sort(() => Math.random() - 0.5);
  
  return {
    numbers: shuffledNumbers,
    originalNumbers: puzzle.numbers
  };
}

function evaluate24Expression(expr, numbers) {
  try {
    // Sanitize expression - only allow numbers, operators, and parentheses
    const sanitized = expr.replace(/\s/g, '').replace(/×/g, '*').replace(/÷/g, '/');
    if (!/^[\d+\-*/().]+$/.test(sanitized)) {
      return { valid: false, error: 'Invalid characters' };
    }
    
    // Check that all numbers are used exactly once
    const usedNumbers = sanitized.match(/\d+/g)?.map(n => parseInt(n)) || [];
    const sortedUsed = [...usedNumbers].sort((a, b) => a - b);
    const sortedExpected = [...numbers].sort((a, b) => a - b);
    
    if (sortedUsed.length !== 4 || sortedUsed.join(',') !== sortedExpected.join(',')) {
      return { valid: false, error: 'Must use all 4 numbers exactly once' };
    }
    
    // Evaluate
    const result = Function('"use strict"; return (' + sanitized + ')')();
    
    if (Math.abs(result - 24) < 0.0001) {
      return { valid: true, result: 24 };
    } else {
      return { valid: false, error: `= ${result}, not 24` };
    }
  } catch (e) {
    return { valid: false, error: 'Invalid expression' };
  }
}

function create24GameState(players) {
  const playerIds = Array.from(players.keys()).filter(id => id !== 'AI_PLAYER');
  const puzzle = generate24Puzzle();
  
  return {
    numbers: puzzle.numbers,
    originalNumbers: puzzle.originalNumbers,
    playerOrder: playerIds,
    scores: Object.fromEntries(playerIds.map(id => [id, 0])),
    round: 1,
    maxRounds: 8,
    solved: false,
    solvedBy: null,
    timePerRound: 60,
    roundStartTime: Date.now(),
    status: 'playing' // playing, solved, timeout, finished
  };
}

function process24Guess(state, playerId, expression) {
  if (state.solved) {
    return { error: 'Already solved' };
  }
  
  const result = evaluate24Expression(expression, state.numbers);
  
  if (result.valid) {
    state.solved = true;
    state.solvedBy = playerId;
    state.scores[playerId] = (state.scores[playerId] || 0) + 10;
    state.status = 'solved';
    
    return {
      correct: true,
      expression,
      points: 10
    };
  }
  
  return {
    correct: false,
    error: result.error,
    expression
  };
}

function start24NewRound(state) {
  const puzzle = generate24Puzzle();
  state.numbers = puzzle.numbers;
  state.originalNumbers = puzzle.originalNumbers;
  state.solved = false;
  state.solvedBy = null;
  state.roundStartTime = Date.now();
  state.status = 'playing';
  state.round++;
  
  if (state.round > state.maxRounds) {
    state.status = 'finished';
  }
  
  return state;
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
  
  // Reaction Test / Word Scramble
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
  endDrawingRound,
  
  // Poker
  createDeck,
  shuffleDeck,
  createPokerState,
  advancePokerPhase,
  determinePokerWinner,
  getBestPokerHand,
  evaluatePokerHand,
  
  // Blackjack
  createBlackjackState,
  blackjackHit,
  blackjackStand,
  playDealerHand,
  determineBlackjackResults,
  getBlackjackValue,
  
  // 24 Game
  create24GameState,
  generate24Puzzle,
  process24Guess,
  start24NewRound,
  evaluate24Expression
};

// ============================================
// 👤 PLAYER PROFILE & STATISTICS SYSTEM
// ============================================

// Available avatars based on shows
const AVATARS = {
  strangerthings: [
    { id: 'eleven', name: 'Eleven', emoji: '👧', unlockLevel: 1 },
    { id: 'dustin', name: 'Dustin', emoji: '🧢', unlockLevel: 1 },
    { id: 'mike', name: 'Mike', emoji: '🚲', unlockLevel: 1 },
    { id: 'lucas', name: 'Lucas', emoji: '🎯', unlockLevel: 1 },
    { id: 'will', name: 'Will', emoji: '🎨', unlockLevel: 1 },
    { id: 'max', name: 'Max', emoji: '🛹', unlockLevel: 3 },
    { id: 'nancy', name: 'Nancy', emoji: '📰', unlockLevel: 3 },
    { id: 'steve', name: 'Steve', emoji: '🦇', unlockLevel: 5 },
    { id: 'robin', name: 'Robin', emoji: '🎵', unlockLevel: 5 },
    { id: 'hopper', name: 'Hopper', emoji: '👮', unlockLevel: 7 },
    { id: 'joyce', name: 'Joyce', emoji: '💡', unlockLevel: 7 },
    { id: 'eddie', name: 'Eddie', emoji: '🎸', unlockLevel: 10 },
    { id: 'vecna', name: 'Vecna', emoji: '🕰️', unlockLevel: 15 },
    { id: 'demogorgon', name: 'Demogorgon', emoji: '👹', unlockLevel: 20 }
  ],
  wednesday: [
    { id: 'wednesday', name: 'Wednesday', emoji: '🖤', unlockLevel: 1 },
    { id: 'enid', name: 'Enid', emoji: '🐺', unlockLevel: 1 },
    { id: 'thing', name: 'Thing', emoji: '🖐️', unlockLevel: 1 },
    { id: 'xavier', name: 'Xavier', emoji: '🎨', unlockLevel: 3 },
    { id: 'ajax', name: 'Ajax', emoji: '🐍', unlockLevel: 3 },
    { id: 'bianca', name: 'Bianca', emoji: '🧜', unlockLevel: 5 },
    { id: 'tyler', name: 'Tyler', emoji: '☕', unlockLevel: 5 },
    { id: 'eugene', name: 'Eugene', emoji: '🐝', unlockLevel: 7 },
    { id: 'weems', name: 'Principal Weems', emoji: '👩‍💼', unlockLevel: 10 },
    { id: 'morticia', name: 'Morticia', emoji: '🌹', unlockLevel: 12 },
    { id: 'gomez', name: 'Gomez', emoji: '🗡️', unlockLevel: 12 },
    { id: 'fester', name: 'Uncle Fester', emoji: '💡', unlockLevel: 15 },
    { id: 'lurch', name: 'Lurch', emoji: '🚪', unlockLevel: 18 },
    { id: 'hyde', name: 'Hyde', emoji: '🦇', unlockLevel: 25 }
  ]
};

// Titles based on level
const TITLES = [
  { level: 1, title: 'Newcomer', icon: '🌱' },
  { level: 3, title: 'Apprentice', icon: '📚' },
  { level: 5, title: 'Explorer', icon: '🔍' },
  { level: 8, title: 'Adventurer', icon: '⚔️' },
  { level: 10, title: 'Veteran', icon: '🎖️' },
  { level: 15, title: 'Expert', icon: '🏆' },
  { level: 20, title: 'Master', icon: '👑' },
  { level: 25, title: 'Champion', icon: '🌟' },
  { level: 30, title: 'Legend', icon: '💎' },
  { level: 40, title: 'Mythic', icon: '🔮' },
  { level: 50, title: 'Immortal', icon: '⚡' }
];

// XP required per level (exponential curve)
function getXPForLevel(level) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Calculate level from total XP
function getLevelFromXP(totalXP) {
  let level = 1;
  let xpNeeded = 0;
  
  while (xpNeeded + getXPForLevel(level) <= totalXP) {
    xpNeeded += getXPForLevel(level);
    level++;
  }
  
  return {
    level,
    currentXP: totalXP - xpNeeded,
    xpForNextLevel: getXPForLevel(level),
    totalXP
  };
}

// Get title for level
function getTitleForLevel(level) {
  let title = TITLES[0];
  for (const t of TITLES) {
    if (level >= t.level) {
      title = t;
    }
  }
  return title;
}

// XP rewards for actions
const XP_REWARDS = {
  game_win: 25,
  game_loss: 5,
  game_draw: 10,
  perfect_game: 50,
  streak_bonus: 10, // per game in streak
  daily_login: 15,
  achievement_unlock: 20,
  first_game_of_day: 10,
  ai_win_easy: 15,
  ai_win_medium: 25,
  ai_win_hard: 40,
  ai_win_insane: 75,
  room_created: 5,
  chat_message: 1
};

// Create default player stats
function createDefaultStats() {
  return {
    // Basic info
    joinDate: Date.now(),
    lastSeen: Date.now(),
    totalXP: 0,
    
    // Game stats
    totalGames: 0,
    totalWins: 0,
    totalLosses: 0,
    totalDraws: 0,
    
    // Streaks
    currentStreak: 0,
    bestStreak: 0,
    dailyStreak: 0,
    lastPlayDate: null,
    
    // Per-game stats
    gameStats: {
      tictactoe: { played: 0, wins: 0, losses: 0, draws: 0 },
      chess: { played: 0, wins: 0, losses: 0, draws: 0 },
      memory: { played: 0, wins: 0, losses: 0, draws: 0 },
      trivia: { played: 0, wins: 0, losses: 0, draws: 0 },
      hangman: { played: 0, wins: 0, losses: 0, draws: 0 },
      wordchain: { played: 0, wins: 0, losses: 0, draws: 0 },
      reaction: { played: 0, wins: 0, losses: 0, draws: 0, bestTime: null },
      battleship: { played: 0, wins: 0, losses: 0, draws: 0 },
      drawing: { played: 0, wins: 0, losses: 0, draws: 0 },
      connect4: { played: 0, wins: 0, losses: 0, draws: 0 },
      sudoku: { played: 0, wins: 0, losses: 0, draws: 0 },
      molewhack: { played: 0, wins: 0, losses: 0, draws: 0, bestScore: 0 },
      mathquiz: { played: 0, wins: 0, losses: 0, draws: 0, bestScore: 0 }
    },
    
    // AI stats
    aiGamesPlayed: 0,
    aiWins: 0,
    aiInsaneWin: false,
    
    // Social stats
    roomsCreated: 0,
    roomsJoined: 0,
    messagesSent: 0,
    uniqueOpponents: [],
    
    // Achievements
    achievements: [],
    achievementPoints: 0,
    
    // Trophies
    trophies: 0,
    
    // Special
    perfectGames: 0,
    themedWins: {
      strangerthings: 0,
      wednesday: 0
    },
    
    // Preferences
    avatar: 'eleven',
    theme: 'default',
    soundEnabled: true,
    
    // Reaction test specific
    bestReactionTime: null,
    averageReactionTime: null,
    reactionTests: 0
  };
}

// Update stats after a game
function updateGameStats(stats, game, result, options = {}) {
  const now = Date.now();
  const today = new Date().toDateString();
  const lastPlay = stats.lastPlayDate ? new Date(stats.lastPlayDate).toDateString() : null;
  
  // Update last seen
  stats.lastSeen = now;
  
  // Update totals
  stats.totalGames++;
  
  // Update game-specific stats
  if (!stats.gameStats[game]) {
    stats.gameStats[game] = { played: 0, wins: 0, losses: 0, draws: 0 };
  }
  stats.gameStats[game].played++;
  
  let xpEarned = 0;
  
  if (result === 'win') {
    stats.totalWins++;
    stats.gameStats[game].wins++;
    stats.currentStreak++;
    
    if (stats.currentStreak > stats.bestStreak) {
      stats.bestStreak = stats.currentStreak;
    }
    
    xpEarned = XP_REWARDS.game_win + (stats.currentStreak * XP_REWARDS.streak_bonus);
    
    // AI win bonuses
    if (options.isAI) {
      stats.aiWins++;
      if (options.difficulty === 'easy') xpEarned += XP_REWARDS.ai_win_easy;
      else if (options.difficulty === 'medium') xpEarned += XP_REWARDS.ai_win_medium;
      else if (options.difficulty === 'hard') xpEarned += XP_REWARDS.ai_win_hard;
      else if (options.difficulty === 'insane') {
        xpEarned += XP_REWARDS.ai_win_insane;
        stats.aiInsaneWin = true;
      }
    }
    
    // Perfect game bonus
    if (options.perfect) {
      stats.perfectGames++;
      xpEarned += XP_REWARDS.perfect_game;
    }
    
    // Themed wins
    if (options.theme && stats.themedWins[options.theme] !== undefined) {
      stats.themedWins[options.theme]++;
    }
    
  } else if (result === 'loss') {
    stats.totalLosses++;
    stats.gameStats[game].losses++;
    stats.currentStreak = 0;
    xpEarned = XP_REWARDS.game_loss;
    
  } else if (result === 'draw') {
    stats.totalDraws++;
    stats.gameStats[game].draws++;
    xpEarned = XP_REWARDS.game_draw;
  }
  
  // Daily streak
  if (lastPlay !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (lastPlay === yesterday.toDateString()) {
      stats.dailyStreak++;
    } else if (lastPlay !== today) {
      stats.dailyStreak = 1;
    }
    
    xpEarned += XP_REWARDS.first_game_of_day;
  }
  stats.lastPlayDate = now;
  
  // AI games
  if (options.isAI) {
    stats.aiGamesPlayed++;
  }
  
  // Unique opponents
  if (options.opponentId && !stats.uniqueOpponents.includes(options.opponentId)) {
    stats.uniqueOpponents.push(options.opponentId);
  }
  
  // Special game stats
  if (game === 'reaction' && options.reactionTime) {
    stats.reactionTests++;
    if (!stats.bestReactionTime || options.reactionTime < stats.bestReactionTime) {
      stats.bestReactionTime = options.reactionTime;
    }
    // Update average
    if (stats.averageReactionTime) {
      stats.averageReactionTime = ((stats.averageReactionTime * (stats.reactionTests - 1)) + options.reactionTime) / stats.reactionTests;
    } else {
      stats.averageReactionTime = options.reactionTime;
    }
  }
  
  if (game === 'molewhack' && options.score) {
    if (!stats.gameStats.molewhack.bestScore || options.score > stats.gameStats.molewhack.bestScore) {
      stats.gameStats.molewhack.bestScore = options.score;
    }
  }
  
  if (game === 'mathquiz' && options.score) {
    if (!stats.gameStats.mathquiz.bestScore || options.score > stats.gameStats.mathquiz.bestScore) {
      stats.gameStats.mathquiz.bestScore = options.score;
    }
  }
  
  // Add XP
  stats.totalXP += xpEarned;
  
  return { stats, xpEarned };
}

// Generate profile card HTML
function generateProfileCard(user, stats) {
  const levelInfo = getLevelFromXP(stats.totalXP);
  const title = getTitleForLevel(levelInfo.level);
  const winRate = stats.totalGames > 0 ? Math.round((stats.totalWins / stats.totalGames) * 100) : 0;
  
  // Find avatar
  let avatarEmoji = '👤';
  for (const category of Object.values(AVATARS)) {
    const found = category.find(a => a.id === stats.avatar);
    if (found) {
      avatarEmoji = found.emoji;
      break;
    }
  }
  
  return `
    <div class="profile-card">
      <div class="profile-header">
        <div class="profile-avatar">${avatarEmoji}</div>
        <div class="profile-info">
          <div class="profile-name">${escapeHtml(user.displayName || user.username)}</div>
          <div class="profile-title">${title.icon} ${title.title}</div>
        </div>
        <div class="profile-level">
          <span class="level-number">Lv.${levelInfo.level}</span>
        </div>
      </div>
      
      <div class="profile-xp">
        <div class="xp-bar">
          <div class="xp-fill" style="width: ${(levelInfo.currentXP / levelInfo.xpForNextLevel) * 100}%"></div>
        </div>
        <div class="xp-text">${levelInfo.currentXP} / ${levelInfo.xpForNextLevel} XP</div>
      </div>
      
      <div class="profile-stats-grid">
        <div class="stat-item">
          <span class="stat-value">${stats.totalGames}</span>
          <span class="stat-label">Games</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${stats.totalWins}</span>
          <span class="stat-label">Wins</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${winRate}%</span>
          <span class="stat-label">Win Rate</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${stats.bestStreak}</span>
          <span class="stat-label">Best Streak</span>
        </div>
      </div>
      
      <div class="profile-achievements">
        <div class="achievements-header">
          <span>🏆 Achievements</span>
          <span class="achievement-count">${stats.achievements.length}</span>
        </div>
        <div class="achievements-preview">
          ${stats.achievements.slice(-5).map(id => {
            const achievement = ACHIEVEMENTS?.[id];
            return achievement ? `<span class="achievement-icon" title="${achievement.name}">${achievement.icon}</span>` : '';
          }).join('')}
        </div>
      </div>
      
      <div class="profile-trophies">
        <span class="trophy-icon">🏅</span>
        <span class="trophy-count">${stats.trophies} Trophies</span>
        <span class="trophy-points">${stats.achievementPoints} Points</span>
      </div>
    </div>
  `;
}

// Generate detailed stats HTML
function generateDetailedStats(stats) {
  const levelInfo = getLevelFromXP(stats.totalXP);
  
  // Find favorite game
  let favoriteGame = { name: 'None', played: 0 };
  for (const [game, gameStats] of Object.entries(stats.gameStats)) {
    if (gameStats.played > favoriteGame.played) {
      favoriteGame = { name: game, played: gameStats.played };
    }
  }
  
  // Format game name
  const gameNames = {
    tictactoe: 'Tic-Tac-Toe',
    chess: 'Chess',
    memory: 'Memory Match',
    trivia: 'Trivia',
    hangman: 'Hangman',
    wordchain: 'Word Chain',
    reaction: 'Reaction Test',
    battleship: 'Battleship',
    drawing: 'Drawing Guess',
    connect4: 'Connect 4',
    sudoku: 'Sudoku',
    molewhack: 'Mole Whack',
    mathquiz: 'Math Quiz'
  };
  
  return `
    <div class="detailed-stats">
      <div class="stats-section">
        <h3>📊 Overall Statistics</h3>
        <div class="stats-table">
          <div class="stats-row">
            <span>Total Games</span>
            <span>${stats.totalGames}</span>
          </div>
          <div class="stats-row">
            <span>Wins / Losses / Draws</span>
            <span>${stats.totalWins} / ${stats.totalLosses} / ${stats.totalDraws}</span>
          </div>
          <div class="stats-row">
            <span>Current Streak</span>
            <span>${stats.currentStreak} 🔥</span>
          </div>
          <div class="stats-row">
            <span>Best Streak</span>
            <span>${stats.bestStreak} 🏆</span>
          </div>
          <div class="stats-row">
            <span>Daily Login Streak</span>
            <span>${stats.dailyStreak} days</span>
          </div>
          <div class="stats-row">
            <span>Favorite Game</span>
            <span>${gameNames[favoriteGame.name] || favoriteGame.name}</span>
          </div>
          <div class="stats-row">
            <span>Total XP</span>
            <span>${stats.totalXP}</span>
          </div>
        </div>
      </div>
      
      <div class="stats-section">
        <h3>🤖 AI Battles</h3>
        <div class="stats-table">
          <div class="stats-row">
            <span>AI Games Played</span>
            <span>${stats.aiGamesPlayed}</span>
          </div>
          <div class="stats-row">
            <span>AI Wins</span>
            <span>${stats.aiWins}</span>
          </div>
          <div class="stats-row">
            <span>Insane Mode Victory</span>
            <span>${stats.aiInsaneWin ? '✅ Yes!' : '❌ Not yet'}</span>
          </div>
        </div>
      </div>
      
      <div class="stats-section">
        <h3>👥 Social</h3>
        <div class="stats-table">
          <div class="stats-row">
            <span>Rooms Created</span>
            <span>${stats.roomsCreated}</span>
          </div>
          <div class="stats-row">
            <span>Rooms Joined</span>
            <span>${stats.roomsJoined}</span>
          </div>
          <div class="stats-row">
            <span>Messages Sent</span>
            <span>${stats.messagesSent}</span>
          </div>
          <div class="stats-row">
            <span>Unique Opponents</span>
            <span>${stats.uniqueOpponents.length}</span>
          </div>
        </div>
      </div>
      
      ${stats.bestReactionTime ? `
        <div class="stats-section">
          <h3>⚡ Reaction Test</h3>
          <div class="stats-table">
            <div class="stats-row">
              <span>Best Time</span>
              <span>${stats.bestReactionTime}ms</span>
            </div>
            <div class="stats-row">
              <span>Average Time</span>
              <span>${Math.round(stats.averageReactionTime)}ms</span>
            </div>
            <div class="stats-row">
              <span>Tests Taken</span>
              <span>${stats.reactionTests}</span>
            </div>
          </div>
        </div>
      ` : ''}
      
      <div class="stats-section">
        <h3>🎮 Per-Game Statistics</h3>
        <div class="game-stats-grid">
          ${Object.entries(stats.gameStats).map(([game, gs]) => `
            <div class="game-stat-card">
              <div class="game-stat-name">${gameNames[game] || game}</div>
              <div class="game-stat-row">
                <span>Played:</span> <span>${gs.played}</span>
              </div>
              <div class="game-stat-row">
                <span>W/L/D:</span> <span>${gs.wins}/${gs.losses}/${gs.draws}</span>
              </div>
              ${gs.bestScore !== undefined ? `
                <div class="game-stat-row">
                  <span>Best:</span> <span>${gs.bestScore}</span>
                </div>
              ` : ''}
              ${gs.bestTime !== undefined ? `
                <div class="game-stat-row">
                  <span>Best:</span> <span>${gs.bestTime}ms</span>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="stats-section">
        <h3>📅 Activity</h3>
        <div class="stats-table">
          <div class="stats-row">
            <span>Member Since</span>
            <span>${new Date(stats.joinDate).toLocaleDateString()}</span>
          </div>
          <div class="stats-row">
            <span>Last Active</span>
            <span>${new Date(stats.lastSeen).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Export for browser
if (typeof window !== 'undefined') {
  window.AVATARS = AVATARS;
  window.TITLES = TITLES;
  window.XP_REWARDS = XP_REWARDS;
  window.getXPForLevel = getXPForLevel;
  window.getLevelFromXP = getLevelFromXP;
  window.getTitleForLevel = getTitleForLevel;
  window.createDefaultStats = createDefaultStats;
  window.updateGameStats = updateGameStats;
  window.generateProfileCard = generateProfileCard;
  window.generateDetailedStats = generateDetailedStats;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AVATARS,
    TITLES,
    XP_REWARDS,
    getXPForLevel,
    getLevelFromXP,
    getTitleForLevel,
    createDefaultStats,
    updateGameStats,
    generateProfileCard,
    generateDetailedStats
  };
}

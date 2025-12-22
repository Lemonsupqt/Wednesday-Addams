// ============================================
// 🏆 ACHIEVEMENTS SYSTEM
// ============================================

const ACHIEVEMENTS = {
  // Game Wins
  first_win: {
    id: 'first_win',
    name: 'First Blood',
    description: 'Win your first game',
    icon: '🎯',
    category: 'wins',
    requirement: { type: 'total_wins', count: 1 },
    points: 10,
    rarity: 'common'
  },
  ten_wins: {
    id: 'ten_wins',
    name: 'Rising Star',
    description: 'Win 10 games',
    icon: '⭐',
    category: 'wins',
    requirement: { type: 'total_wins', count: 10 },
    points: 25,
    rarity: 'common'
  },
  fifty_wins: {
    id: 'fifty_wins',
    name: 'Champion',
    description: 'Win 50 games',
    icon: '🏆',
    category: 'wins',
    requirement: { type: 'total_wins', count: 50 },
    points: 50,
    rarity: 'rare'
  },
  hundred_wins: {
    id: 'hundred_wins',
    name: 'Legend',
    description: 'Win 100 games',
    icon: '👑',
    category: 'wins',
    requirement: { type: 'total_wins', count: 100 },
    points: 100,
    rarity: 'epic'
  },
  
  // Streaks
  win_streak_3: {
    id: 'win_streak_3',
    name: 'Hot Streak',
    description: 'Win 3 games in a row',
    icon: '🔥',
    category: 'streaks',
    requirement: { type: 'win_streak', count: 3 },
    points: 20,
    rarity: 'common'
  },
  win_streak_5: {
    id: 'win_streak_5',
    name: 'Unstoppable',
    description: 'Win 5 games in a row',
    icon: '💪',
    category: 'streaks',
    requirement: { type: 'win_streak', count: 5 },
    points: 40,
    rarity: 'rare'
  },
  win_streak_10: {
    id: 'win_streak_10',
    name: 'Demogorgon Slayer',
    description: 'Win 10 games in a row',
    icon: '👹',
    category: 'streaks',
    requirement: { type: 'win_streak', count: 10 },
    points: 100,
    rarity: 'legendary'
  },
  
  // Game Specific
  ttt_master: {
    id: 'ttt_master',
    name: 'Tic-Tac-Pro',
    description: 'Win 20 Tic-Tac-Toe games',
    icon: '⭕',
    category: 'games',
    requirement: { type: 'game_wins', game: 'tictactoe', count: 20 },
    points: 30,
    rarity: 'rare'
  },
  chess_master: {
    id: 'chess_master',
    name: 'Grandmaster',
    description: 'Win 10 Chess games',
    icon: '♟️',
    category: 'games',
    requirement: { type: 'game_wins', game: 'chess', count: 10 },
    points: 50,
    rarity: 'epic'
  },
  memory_master: {
    id: 'memory_master',
    name: 'Perfect Recall',
    description: 'Win 15 Memory games',
    icon: '🧠',
    category: 'games',
    requirement: { type: 'game_wins', game: 'memory', count: 15 },
    points: 35,
    rarity: 'rare'
  },
  trivia_master: {
    id: 'trivia_master',
    name: 'Know-It-All',
    description: 'Win 15 Trivia games',
    icon: '📚',
    category: 'games',
    requirement: { type: 'game_wins', game: 'trivia', count: 15 },
    points: 35,
    rarity: 'rare'
  },
  hangman_master: {
    id: 'hangman_master',
    name: 'Word Wizard',
    description: 'Win 15 Hangman games',
    icon: '📝',
    category: 'games',
    requirement: { type: 'game_wins', game: 'hangman', count: 15 },
    points: 35,
    rarity: 'rare'
  },
  reaction_master: {
    id: 'reaction_master',
    name: 'Lightning Reflexes',
    description: 'Get under 200ms reaction time',
    icon: '⚡',
    category: 'games',
    requirement: { type: 'reaction_time', time: 200 },
    points: 50,
    rarity: 'epic'
  },
  battleship_master: {
    id: 'battleship_master',
    name: 'Admiral',
    description: 'Win 10 Battleship games',
    icon: '🚢',
    category: 'games',
    requirement: { type: 'game_wins', game: 'battleship', count: 10 },
    points: 40,
    rarity: 'rare'
  },
  
  // Social
  first_room: {
    id: 'first_room',
    name: 'Host',
    description: 'Create your first room',
    icon: '🏠',
    category: 'social',
    requirement: { type: 'rooms_created', count: 1 },
    points: 5,
    rarity: 'common'
  },
  social_butterfly: {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Play with 10 different players',
    icon: '🦋',
    category: 'social',
    requirement: { type: 'unique_opponents', count: 10 },
    points: 30,
    rarity: 'rare'
  },
  chat_master: {
    id: 'chat_master',
    name: 'Chatterbox',
    description: 'Send 100 chat messages',
    icon: '💬',
    category: 'social',
    requirement: { type: 'messages_sent', count: 100 },
    points: 20,
    rarity: 'common'
  },
  
  // AI Battles
  ai_slayer: {
    id: 'ai_slayer',
    name: 'AI Slayer',
    description: 'Beat Wednesday AI 10 times',
    icon: '🤖',
    category: 'ai',
    requirement: { type: 'ai_wins', count: 10 },
    points: 40,
    rarity: 'rare'
  },
  ai_nightmare: {
    id: 'ai_nightmare',
    name: 'Nightmare Conqueror',
    description: 'Beat Wednesday AI on Insane difficulty',
    icon: '😈',
    category: 'ai',
    requirement: { type: 'ai_insane_win', count: 1 },
    points: 75,
    rarity: 'epic'
  },
  
  // Special
  night_owl: {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Play a game between midnight and 4am',
    icon: '🦉',
    category: 'special',
    requirement: { type: 'time_played', hours: [0, 1, 2, 3] },
    points: 15,
    rarity: 'rare'
  },
  dedication: {
    id: 'dedication',
    name: 'Dedicated',
    description: 'Play games on 7 consecutive days',
    icon: '📅',
    category: 'special',
    requirement: { type: 'daily_streak', count: 7 },
    points: 50,
    rarity: 'epic'
  },
  perfectionist: {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Win a game without making any mistakes',
    icon: '✨',
    category: 'special',
    requirement: { type: 'perfect_game', count: 1 },
    points: 30,
    rarity: 'rare'
  },
  
  // Themed
  stranger_fan: {
    id: 'stranger_fan',
    name: 'Stranger Things Fan',
    description: 'Win 5 games with Stranger Things theme',
    icon: '🔦',
    category: 'themed',
    requirement: { type: 'themed_wins', theme: 'strangerthings', count: 5 },
    points: 25,
    rarity: 'rare'
  },
  wednesday_fan: {
    id: 'wednesday_fan',
    name: 'Wednesday Devotee',
    description: 'Win 5 games with Wednesday theme',
    icon: '🦇',
    category: 'themed',
    requirement: { type: 'themed_wins', theme: 'wednesday', count: 5 },
    points: 25,
    rarity: 'rare'
  },
  
  // Trophies
  first_trophy: {
    id: 'first_trophy',
    name: 'Trophy Hunter',
    description: 'Earn your first trophy',
    icon: '🏅',
    category: 'trophies',
    requirement: { type: 'trophies', count: 1 },
    points: 15,
    rarity: 'common'
  },
  trophy_collector: {
    id: 'trophy_collector',
    name: 'Trophy Collector',
    description: 'Earn 10 trophies',
    icon: '🎖️',
    category: 'trophies',
    requirement: { type: 'trophies', count: 10 },
    points: 50,
    rarity: 'rare'
  },
  trophy_hoarder: {
    id: 'trophy_hoarder',
    name: 'Trophy Hoarder',
    description: 'Earn 50 trophies',
    icon: '💎',
    category: 'trophies',
    requirement: { type: 'trophies', count: 50 },
    points: 150,
    rarity: 'legendary'
  }
};

const ACHIEVEMENT_CATEGORIES = {
  wins: { name: 'Victories', icon: '🏆', color: '#fbbf24' },
  streaks: { name: 'Streaks', icon: '🔥', color: '#ef4444' },
  games: { name: 'Game Masters', icon: '🎮', color: '#8b5cf6' },
  social: { name: 'Social', icon: '👥', color: '#3b82f6' },
  ai: { name: 'AI Battles', icon: '🤖', color: '#10b981' },
  special: { name: 'Special', icon: '⭐', color: '#f59e0b' },
  themed: { name: 'Themed', icon: '🎬', color: '#ec4899' },
  trophies: { name: 'Trophies', icon: '🏅', color: '#6366f1' }
};

const RARITY_COLORS = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#8b5cf6',
  legendary: '#f59e0b'
};

// Check if user has earned an achievement
function checkAchievement(achievement, userStats) {
  const req = achievement.requirement;
  
  switch (req.type) {
    case 'total_wins':
      return userStats.totalWins >= req.count;
    case 'win_streak':
      return userStats.currentStreak >= req.count || userStats.bestStreak >= req.count;
    case 'game_wins':
      return (userStats.gameWins?.[req.game] || 0) >= req.count;
    case 'rooms_created':
      return (userStats.roomsCreated || 0) >= req.count;
    case 'unique_opponents':
      return (userStats.uniqueOpponents?.size || 0) >= req.count;
    case 'messages_sent':
      return (userStats.messagesSent || 0) >= req.count;
    case 'ai_wins':
      return (userStats.aiWins || 0) >= req.count;
    case 'ai_insane_win':
      return userStats.aiInsaneWin === true;
    case 'trophies':
      return (userStats.trophies || 0) >= req.count;
    case 'reaction_time':
      return userStats.bestReactionTime && userStats.bestReactionTime <= req.time;
    case 'time_played':
      const hour = new Date().getHours();
      return req.hours.includes(hour);
    case 'daily_streak':
      return (userStats.dailyStreak || 0) >= req.count;
    case 'perfect_game':
      return userStats.perfectGames >= req.count;
    case 'themed_wins':
      return (userStats.themedWins?.[req.theme] || 0) >= req.count;
    default:
      return false;
  }
}

// Get newly earned achievements
function getNewAchievements(userStats, previousAchievements = []) {
  const newAchievements = [];
  
  for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
    if (!previousAchievements.includes(id) && checkAchievement(achievement, userStats)) {
      newAchievements.push(achievement);
    }
  }
  
  return newAchievements;
}

// Calculate total achievement points
function calculateAchievementPoints(earnedAchievements) {
  return earnedAchievements.reduce((total, id) => {
    const achievement = ACHIEVEMENTS[id];
    return total + (achievement?.points || 0);
  }, 0);
}

// Get achievement progress
function getAchievementProgress(achievement, userStats) {
  const req = achievement.requirement;
  let current = 0;
  let max = req.count || 1;
  
  switch (req.type) {
    case 'total_wins':
      current = userStats.totalWins || 0;
      break;
    case 'win_streak':
      current = Math.max(userStats.currentStreak || 0, userStats.bestStreak || 0);
      break;
    case 'game_wins':
      current = userStats.gameWins?.[req.game] || 0;
      break;
    case 'rooms_created':
      current = userStats.roomsCreated || 0;
      break;
    case 'unique_opponents':
      current = userStats.uniqueOpponents?.size || 0;
      break;
    case 'messages_sent':
      current = userStats.messagesSent || 0;
      break;
    case 'ai_wins':
      current = userStats.aiWins || 0;
      break;
    case 'trophies':
      current = userStats.trophies || 0;
      break;
    case 'daily_streak':
      current = userStats.dailyStreak || 0;
      break;
    default:
      current = 0;
  }
  
  return { current, max, percentage: Math.min(100, (current / max) * 100) };
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ACHIEVEMENTS,
    ACHIEVEMENT_CATEGORIES,
    RARITY_COLORS,
    checkAchievement,
    getNewAchievements,
    calculateAchievementPoints,
    getAchievementProgress
  };
}

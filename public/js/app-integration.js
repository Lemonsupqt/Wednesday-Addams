// ============================================
// 🚀 APP INTEGRATION - NEW FEATURES
// ============================================
// This file integrates all new features into the main app

// ============================================
// NEW SCREENS SETUP
// ============================================

// Add new screens to the screens object
if (typeof screens !== 'undefined') {
  screens.profileScreen = document.getElementById('profileScreen');
  screens.achievementsScreen = document.getElementById('achievementsScreen');
  screens.settingsScreen = document.getElementById('settingsScreen');
}

// ============================================
// THEME SYSTEM
// ============================================

function initThemeSystem() {
  const savedTheme = localStorage.getItem('selectedTheme') || 'default';
  setTheme(savedTheme);
  
  // Setup theme selector
  const themeSelector = document.getElementById('themeSelector');
  if (themeSelector) {
    themeSelector.querySelectorAll('.theme-option').forEach(option => {
      option.addEventListener('click', () => {
        const theme = option.dataset.theme;
        setTheme(theme);
        
        // Update active state
        themeSelector.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
        option.classList.add('active');
      });
      
      // Set initial active state
      if (option.dataset.theme === savedTheme) {
        option.classList.add('active');
      }
    });
  }
}

function setTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem('selectedTheme', themeName);
  
  // Update meta theme color based on theme
  const themeColors = {
    default: '#050508',
    strangerthings: '#0d0d0d',
    wednesday: '#050508',
    upsidedown: '#0f1419',
    nevermore: '#1a1a2e',
    hawkinslab: '#0a0f0a'
  };
  
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', themeColors[themeName] || '#050508');
  }
}

// ============================================
// SETTINGS SYSTEM
// ============================================

function initSettingsSystem() {
  // Sound toggle
  const soundToggle = document.getElementById('soundToggle');
  if (soundToggle) {
    const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    soundToggle.classList.toggle('active', soundEnabled);
    soundToggle.addEventListener('click', () => {
      const enabled = !soundToggle.classList.contains('active');
      soundToggle.classList.toggle('active', enabled);
      localStorage.setItem('soundEnabled', enabled);
    });
  }
  
  // Chat sound toggle
  const chatSoundToggle = document.getElementById('chatSoundToggle');
  if (chatSoundToggle) {
    const chatSoundEnabled = localStorage.getItem('chatSoundEnabled') !== 'false';
    chatSoundToggle.classList.toggle('active', chatSoundEnabled);
    chatSoundToggle.addEventListener('click', () => {
      const enabled = !chatSoundToggle.classList.contains('active');
      chatSoundToggle.classList.toggle('active', enabled);
      localStorage.setItem('chatSoundEnabled', enabled);
    });
  }
  
  // Animations toggle
  const animationsToggle = document.getElementById('animationsToggle');
  if (animationsToggle) {
    const animationsEnabled = localStorage.getItem('animationsEnabled') !== 'false';
    animationsToggle.classList.toggle('active', animationsEnabled);
    animationsToggle.addEventListener('click', () => {
      const enabled = !animationsToggle.classList.contains('active');
      animationsToggle.classList.toggle('active', enabled);
      localStorage.setItem('animationsEnabled', enabled);
      document.body.classList.toggle('reduce-motion', !enabled);
    });
  }
  
  // Auto-scroll toggle
  const autoScrollToggle = document.getElementById('autoScrollToggle');
  if (autoScrollToggle) {
    const autoScrollEnabled = localStorage.getItem('autoScrollEnabled') !== 'false';
    autoScrollToggle.classList.toggle('active', autoScrollEnabled);
    autoScrollToggle.addEventListener('click', () => {
      const enabled = !autoScrollToggle.classList.contains('active');
      autoScrollToggle.classList.toggle('active', enabled);
      localStorage.setItem('autoScrollEnabled', enabled);
    });
  }
}

// ============================================
// PROFILE SYSTEM
// ============================================

function showProfileScreen() {
  showScreen('profileScreen');
  loadProfileContent();
}

function loadProfileContent() {
  const profileContent = document.getElementById('profileContent');
  const tabContent = document.getElementById('profileTabContent');
  
  if (!profileContent || !tabContent) return;
  
  // Get user stats
  const stats = state.userStats || createDefaultStats();
  const user = {
    username: state.username || 'Guest',
    displayName: state.playerName || 'Guest Player'
  };
  
  // Generate profile card
  if (typeof generateProfileCard === 'function') {
    profileContent.innerHTML = generateProfileCard(user, stats);
  } else {
    profileContent.innerHTML = `
      <div class="profile-card">
        <div class="profile-header">
          <div class="profile-avatar">👤</div>
          <div class="profile-info">
            <div class="profile-name">${escapeHtml(user.displayName)}</div>
            <div class="profile-title">🌱 Newcomer</div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Load overview tab by default
  loadProfileTab('overview');
  
  // Setup tab switching
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadProfileTab(tab.dataset.tab);
    });
  });
}

function loadProfileTab(tabName) {
  const tabContent = document.getElementById('profileTabContent');
  if (!tabContent) return;
  
  const stats = state.userStats || (typeof createDefaultStats === 'function' ? createDefaultStats() : {});
  
  switch (tabName) {
    case 'overview':
      if (typeof generateDetailedStats === 'function') {
        tabContent.innerHTML = generateDetailedStats(stats);
      } else {
        tabContent.innerHTML = '<p>Statistics loading...</p>';
      }
      break;
      
    case 'stats':
      tabContent.innerHTML = generateGameStatsView(stats);
      break;
      
    case 'avatar':
      tabContent.innerHTML = generateAvatarSelector(stats);
      setupAvatarSelection();
      break;
      
    default:
      tabContent.innerHTML = '<p>Tab content not found</p>';
  }
}

function generateGameStatsView(stats) {
  const gameStats = stats.gameStats || {};
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
    mathquiz: 'Math Quiz',
    psychic: 'Psychic Showdown',
    ludo: 'Ludo'
  };
  
  let html = '<div class="game-stats-detailed">';
  
  for (const [game, gs] of Object.entries(gameStats)) {
    if (gs.played > 0) {
      const winRate = gs.played > 0 ? Math.round((gs.wins / gs.played) * 100) : 0;
      html += `
        <div class="game-stat-detailed-card glass">
          <h4>${gameNames[game] || game}</h4>
          <div class="stat-bars">
            <div class="stat-bar-item">
              <span>Games Played</span>
              <span class="stat-value">${gs.played}</span>
            </div>
            <div class="stat-bar-item">
              <span>Wins</span>
              <span class="stat-value win">${gs.wins}</span>
            </div>
            <div class="stat-bar-item">
              <span>Losses</span>
              <span class="stat-value loss">${gs.losses}</span>
            </div>
            <div class="stat-bar-item">
              <span>Win Rate</span>
              <span class="stat-value">${winRate}%</span>
            </div>
          </div>
        </div>
      `;
    }
  }
  
  if (html === '<div class="game-stats-detailed">') {
    html += '<p class="no-stats">No game statistics yet. Play some games to see your stats!</p>';
  }
  
  html += '</div>';
  return html;
}

function generateAvatarSelector(stats) {
  const currentAvatar = stats.avatar || 'eleven';
  const currentLevel = typeof getLevelFromXP === 'function' ? getLevelFromXP(stats.totalXP || 0).level : 1;
  
  let html = '<div class="avatar-selector">';
  
  if (typeof AVATARS !== 'undefined') {
    // Stranger Things avatars
    html += `
      <div class="avatar-category">
        <h4 class="avatar-category-title">⚡ Stranger Things</h4>
        <div class="avatar-grid">
    `;
    
    for (const avatar of AVATARS.strangerthings || []) {
      const isLocked = avatar.unlockLevel > currentLevel;
      const isSelected = avatar.id === currentAvatar;
      html += `
        <div class="avatar-option ${isLocked ? 'locked' : ''} ${isSelected ? 'selected' : ''}" 
             data-avatar="${avatar.id}" ${isLocked ? 'title="Unlock at level ' + avatar.unlockLevel + '"' : ''}>
          <span class="avatar-emoji">${avatar.emoji}</span>
          <span class="avatar-name">${avatar.name}</span>
          ${isLocked ? `<span class="avatar-unlock">Lv.${avatar.unlockLevel}</span>` : ''}
        </div>
      `;
    }
    
    html += '</div></div>';
    
    // Wednesday avatars
    html += `
      <div class="avatar-category">
        <h4 class="avatar-category-title">🦇 Wednesday</h4>
        <div class="avatar-grid">
    `;
    
    for (const avatar of AVATARS.wednesday || []) {
      const isLocked = avatar.unlockLevel > currentLevel;
      const isSelected = avatar.id === currentAvatar;
      html += `
        <div class="avatar-option ${isLocked ? 'locked' : ''} ${isSelected ? 'selected' : ''}" 
             data-avatar="${avatar.id}" ${isLocked ? 'title="Unlock at level ' + avatar.unlockLevel + '"' : ''}>
          <span class="avatar-emoji">${avatar.emoji}</span>
          <span class="avatar-name">${avatar.name}</span>
          ${isLocked ? `<span class="avatar-unlock">Lv.${avatar.unlockLevel}</span>` : ''}
        </div>
      `;
    }
    
    html += '</div></div>';
  } else {
    html += '<p>Avatar system loading...</p>';
  }
  
  html += '</div>';
  return html;
}

function setupAvatarSelection() {
  document.querySelectorAll('.avatar-option:not(.locked)').forEach(option => {
    option.addEventListener('click', () => {
      const avatarId = option.dataset.avatar;
      
      // Update UI
      document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      
      // Save to state and server
      if (state.userStats) {
        state.userStats.avatar = avatarId;
      }
      
      // Save to server if authenticated
      if (state.isAuthenticated && socket) {
        socket.emit('updateProfile', { avatar: avatarId });
      }
      
      localStorage.setItem('selectedAvatar', avatarId);
      showSuccess('Avatar updated!');
    });
  });
}

// ============================================
// ACHIEVEMENTS SCREEN
// ============================================

function showAchievementsScreen() {
  showScreen('achievementsScreen');
  loadAchievementsContent();
}

function loadAchievementsContent() {
  const stats = state.userStats || (typeof createDefaultStats === 'function' ? createDefaultStats() : { achievements: [] });
  const unlockedAchievements = stats.achievements || [];
  
  // Update header stats
  const countEl = document.getElementById('achievementCount');
  const pointsEl = document.getElementById('achievementPoints');
  const percentEl = document.getElementById('achievementPercent');
  
  if (typeof ACHIEVEMENTS !== 'undefined') {
    const totalAchievements = Object.keys(ACHIEVEMENTS).length;
    const totalPoints = unlockedAchievements.reduce((sum, id) => {
      return sum + (ACHIEVEMENTS[id]?.points || 0);
    }, 0);
    const percent = Math.round((unlockedAchievements.length / totalAchievements) * 100);
    
    if (countEl) countEl.textContent = `${unlockedAchievements.length}/${totalAchievements}`;
    if (pointsEl) pointsEl.textContent = totalPoints;
    if (percentEl) percentEl.textContent = `${percent}%`;
    
    // Generate categories
    const categories = [...new Set(Object.values(ACHIEVEMENTS).map(a => a.category))];
    const categoriesEl = document.getElementById('achievementCategories');
    if (categoriesEl) {
      categoriesEl.innerHTML = `
        <button class="category-btn active" data-category="all">All</button>
        ${categories.map(cat => `
          <button class="category-btn" data-category="${cat}">${cat}</button>
        `).join('')}
      `;
      
      categoriesEl.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          categoriesEl.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderAchievements(btn.dataset.category, unlockedAchievements);
        });
      });
    }
    
    // Render achievements
    renderAchievements('all', unlockedAchievements);
  }
}

function renderAchievements(category, unlockedAchievements) {
  const listEl = document.getElementById('achievementsList');
  if (!listEl || typeof ACHIEVEMENTS === 'undefined') return;
  
  const achievements = Object.entries(ACHIEVEMENTS)
    .filter(([id, a]) => category === 'all' || a.category === category)
    .sort((a, b) => {
      // Sort: unlocked first, then by points
      const aUnlocked = unlockedAchievements.includes(a[0]);
      const bUnlocked = unlockedAchievements.includes(b[0]);
      if (aUnlocked !== bUnlocked) return bUnlocked ? 1 : -1;
      return b[1].points - a[1].points;
    });
  
  listEl.innerHTML = achievements.map(([id, achievement]) => {
    const isUnlocked = unlockedAchievements.includes(id);
    return `
      <div class="achievement-card ${isUnlocked ? 'earned' : 'locked'}">
        <div class="achievement-icon-large">${achievement.icon}</div>
        <div class="achievement-details">
          <div class="achievement-name">${achievement.name}</div>
          <div class="achievement-description">${achievement.description}</div>
          <div class="achievement-meta">
            <span class="achievement-points">+${achievement.points} pts</span>
            <span class="achievement-rarity ${achievement.rarity}">${achievement.rarity}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// NAVIGATION SETUP
// ============================================

function setupNewScreenNavigation() {
  // Profile button
  const profileBtn = document.getElementById('profileBtn');
  if (profileBtn) {
    profileBtn.addEventListener('click', showProfileScreen);
  }
  
  // Back from profile
  const backFromProfileBtn = document.getElementById('backFromProfileBtn');
  if (backFromProfileBtn) {
    backFromProfileBtn.addEventListener('click', () => showScreen('mainMenu'));
  }
  
  // Achievements button
  const achievementsBtn = document.getElementById('achievementsBtn');
  if (achievementsBtn) {
    achievementsBtn.addEventListener('click', showAchievementsScreen);
  }
  
  // Back from achievements
  const backFromAchievementsBtn = document.getElementById('backFromAchievementsBtn');
  if (backFromAchievementsBtn) {
    backFromAchievementsBtn.addEventListener('click', () => showScreen('mainMenu'));
  }
  
  // Settings button
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => showScreen('settingsScreen'));
  }
  
  // Back from settings
  const backFromSettingsBtn = document.getElementById('backFromSettingsBtn');
  if (backFromSettingsBtn) {
    backFromSettingsBtn.addEventListener('click', () => showScreen('mainMenu'));
  }
}

// ============================================
// VICTORY/DEFEAT ANIMATIONS
// ============================================

function showVictoryAnimation() {
  const overlay = document.getElementById('victoryOverlay');
  if (!overlay) return;
  
  overlay.style.display = 'flex';
  
  // Create confetti
  createConfetti();
  
  // Hide after 3 seconds
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 3000);
}

function createConfetti() {
  const container = document.getElementById('confettiContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  const colors = ['#9333ea', '#e50914', '#22c55e', '#f59e0b', '#3b82f6'];
  
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.animationDelay = `${Math.random() * 2}s`;
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
    container.appendChild(confetti);
  }
  
  // Clear after animation
  setTimeout(() => {
    container.innerHTML = '';
  }, 5000);
}

function showLevelUpAnimation(newLevel) {
  const overlay = document.getElementById('levelUpOverlay');
  const levelEl = document.getElementById('newLevel');
  
  if (!overlay || !levelEl) return;
  
  levelEl.textContent = newLevel;
  overlay.style.display = 'flex';
  
  // Check for unlocked avatars
  const rewardsEl = document.getElementById('levelUpRewards');
  if (rewardsEl && typeof AVATARS !== 'undefined') {
    const newAvatars = [];
    for (const category of Object.values(AVATARS)) {
      for (const avatar of category) {
        if (avatar.unlockLevel === newLevel) {
          newAvatars.push(avatar);
        }
      }
    }
    
    if (newAvatars.length > 0) {
      rewardsEl.innerHTML = `
        <p>New avatars unlocked!</p>
        <div class="unlocked-avatars">
          ${newAvatars.map(a => `<span class="unlocked-avatar">${a.emoji} ${a.name}</span>`).join('')}
        </div>
      `;
    } else {
      rewardsEl.innerHTML = '';
    }
  }
  
  // Hide after 3 seconds
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 3000);
}

function showAchievementNotification(achievementId) {
  if (typeof ACHIEVEMENTS === 'undefined') return;
  
  const achievement = ACHIEVEMENTS[achievementId];
  if (!achievement) return;
  
  const container = document.getElementById('achievementNotifications');
  if (!container) return;
  
  const notification = document.createElement('div');
  notification.className = 'achievement-notification';
  notification.innerHTML = `
    <div class="achievement-notification-icon">${achievement.icon}</div>
    <div class="achievement-notification-content">
      <div class="achievement-notification-title">Achievement Unlocked!</div>
      <div class="achievement-notification-name">${achievement.name}</div>
    </div>
  `;
  
  container.appendChild(notification);
  
  // Remove after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'notificationExit 0.3s ease-in forwards';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// ============================================
// SUCCESS TOAST
// ============================================

function showSuccess(message) {
  const toast = document.getElementById('successToast');
  if (!toast) {
    // Fallback to error toast with success styling
    const errorToast = document.getElementById('errorToast');
    if (errorToast) {
      errorToast.textContent = message;
      errorToast.classList.remove('error');
      errorToast.classList.add('success', 'show');
      setTimeout(() => {
        errorToast.classList.remove('show', 'success');
        errorToast.classList.add('error');
      }, 3000);
    }
    return;
  }
  
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============================================
// INITIALIZE ALL NEW FEATURES
// ============================================

function initNewFeatures() {
  initThemeSystem();
  initSettingsSystem();
  setupNewScreenNavigation();
  
  // Initialize achievements system if available
  if (typeof initAchievements === 'function') {
    initAchievements();
  }
  
  console.log('✨ New features initialized');
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNewFeatures);
} else {
  initNewFeatures();
}

// Export functions for use in main app
window.showVictoryAnimation = showVictoryAnimation;
window.showLevelUpAnimation = showLevelUpAnimation;
window.showAchievementNotification = showAchievementNotification;
window.showSuccess = showSuccess;
window.showProfileScreen = showProfileScreen;
window.showAchievementsScreen = showAchievementsScreen;

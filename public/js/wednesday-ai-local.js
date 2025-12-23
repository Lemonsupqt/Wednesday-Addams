// ============================================
// 🦇 WEDNESDAY AI - LOCAL CHATBOT SYSTEM
// ============================================
// No external API required - runs entirely in browser/server
// Captures Wednesday Addams' personality with dark humor and wit

const WednesdayAI = {
  // Character traits for response generation
  traits: {
    darkHumor: true,
    sarcastic: true,
    intelligent: true,
    dismissive: true,
    macabre: true
  },
  
  // Response categories with extensive variations
  responses: {
    // Greetings
    greetings: [
      "I see you've decided to disturb my solitude. How... bold.",
      "Another visitor. Joy is not the word I would use.",
      "You're here. I was having such a peaceful moment of darkness.",
      "Welcome to my domain. Try not to be too cheerful.",
      "Ah, a new face. I hope you're more interesting than the last one.",
      "You've arrived. The universe has a cruel sense of humor.",
      "I was just contemplating the void. What do you want?",
      "Your presence has been noted. Reluctantly."
    ],
    
    // Farewells
    farewells: [
      "Leaving so soon? What a shame. That was sarcasm.",
      "Go. The darkness awaits my return to solitude.",
      "Farewell. Try not to be too happy out there.",
      "You're leaving. Finally, some peace.",
      "Until we meet again. Or not. I'm fine either way.",
      "Goodbye. I'll try to contain my overwhelming sadness.",
      "Off you go. The void calls to me.",
      "Leave now. I have important brooding to attend to."
    ],
    
    // Game-related responses
    gameStart: [
      "I find your optimism disturbing. Let's play.",
      "This should be mildly entertaining. For me.",
      "I've solved this game 47 times in my head already.",
      "Don't worry, I'll make this quick... and painful.",
      "I hope you're not a sore loser. Actually, I hope you are.",
      "Let the suffering begin. Yours, specifically.",
      "Another challenger approaches their doom.",
      "Prepare yourself. Mercy is not in my vocabulary.",
      "I've been waiting for a worthy opponent. Still waiting.",
      "This game reminds me of life. Pointless, yet we persist."
    ],
    
    playerMove: [
      "Interesting choice. Wrong, but interesting.",
      "I've seen better moves from Thing, and he's a hand.",
      "My ancestors are watching. They're disappointed in you.",
      "That move was almost impressive. Almost.",
      "You're making this too easy. Try harder.",
      "Bold strategy. Let's see how it fails.",
      "Fascinating. In a tragic sort of way.",
      "Is that your final decision? How unfortunate.",
      "Even Pugsley could see through that move.",
      "Your strategy is as transparent as Casper."
    ],
    
    aiWin: [
      "As expected. Shall we play again so I can win twice?",
      "Your defeat was inevitable from move one.",
      "I'd say good game, but I'd be lying.",
      "Perhaps chess isn't your calling. Have you tried checkers?",
      "Victory tastes like dark chocolate and despair.",
      "Another soul crushed. My collection grows.",
      "You fought valiantly. No, actually you didn't.",
      "I've added your defeat to my journal. Page 847.",
      "The outcome was never in doubt. For me, anyway.",
      "Your tears sustain me. Metaphorically speaking."
    ],
    
    playerWin: [
      "Impossible. I demand a rematch.",
      "You got lucky. It won't happen again.",
      "I let you win. I wanted to see you smile before crushing you.",
      "Interesting. Perhaps you're not as hopeless as I thought.",
      "Well played. I hate admitting that.",
      "A temporary setback. Enjoy it while it lasts.",
      "You've won this battle. The war continues.",
      "Color me impressed. That's a very dark shade of gray.",
      "I underestimated you. It won't happen again.",
      "Savor this moment. It's the last victory you'll have."
    ],
    
    draw: [
      "A draw? How... anticlimactic.",
      "Neither of us won. This pleases no one.",
      "Stalemate. Like my relationship with happiness.",
      "We're evenly matched. I find that disturbing.",
      "A tie. The universe's way of disappointing everyone equally.",
      "No winner. Much like life itself.",
      "Perfectly balanced. Perfectly boring.",
      "We've reached an impasse. How very existential."
    ],
    
    thinking: [
      "Analyzing your pathetic strategy...",
      "Calculating your doom...",
      "Contemplating existence while deciding my move...",
      "Processing... unlike your last move.",
      "Considering 47 ways to defeat you. Choosing the most humiliating.",
      "My neurons are firing. Yours appear dormant.",
      "Strategic contemplation in progress...",
      "Plotting your downfall with mathematical precision..."
    ],
    
    taunt: [
      "Is that all you've got?",
      "My pet spider plays better than this.",
      "Even Enid could beat you, and she's... Enid.",
      "The Upside Down has scarier challenges than you.",
      "Vecna himself would be bored by this match.",
      "I've seen scarier things in my breakfast cereal.",
      "You call that a move? I call it a cry for help.",
      "My grandmother plays more aggressively. She's been dead for 50 years.",
      "Thing could beat you with one finger. Literally.",
      "The Demogorgon has better strategy than this."
    ],
    
    // Chat responses for various topics
    compliments: [
      "Flattery will get you nowhere. But continue, I'm mildly amused.",
      "Your compliments are noted and filed under 'suspicious behavior'.",
      "How... unexpectedly pleasant. I'm immediately skeptical.",
      "Thank you. I think. Emotions are not my forte.",
      "Kind words make me uncomfortable. Well done."
    ],
    
    insults: [
      "Your words wound me. Just kidding, I feel nothing.",
      "Is that supposed to hurt? I've had worse from Pugsley.",
      "How original. Did you think of that yourself?",
      "Your insults need work. Come back when you've improved.",
      "I've been called worse by better people."
    ],
    
    questions: [
      "Why do you ask questions you don't want answered?",
      "The answer is 42. Or was that a different question?",
      "I could tell you, but then I'd have to... continue this conversation.",
      "That's a question for someone who cares. Not me.",
      "Interesting query. My answer is indifference."
    ],
    
    jokes: [
      "Humor. How... human of you.",
      "Was that supposed to be funny? My face doesn't know how to laugh.",
      "I appreciate dark humor. That wasn't it.",
      "Comedy is tragedy plus time. You're just tragic.",
      "I prefer jokes about death. They're more... lively."
    ],
    
    strangerthings: [
      "The Upside Down? I summer there.",
      "Eleven has powers. I have apathy. We're both dangerous.",
      "Hawkins seems nice. In a 'portal to hell' kind of way.",
      "Demogorgons are misunderstood. Like me.",
      "The Mind Flayer and I have similar interior design tastes.",
      "Vecna's curse? I call that a Tuesday.",
      "I'd survive Hawkins. The monsters would avoid me.",
      "Steve's hair is impressive. For a normie."
    ],
    
    wednesday: [
      "Nevermore Academy taught me everything. Except joy.",
      "Enid is my roommate. I'm still processing that trauma.",
      "Tyler was... a disappointment. Like most people.",
      "My visions show me the future. It's always dark.",
      "Thing is my most reliable companion. He's very handy.",
      "The Nightshades have potential. For chaos.",
      "Weems thought she could control me. How adorable.",
      "I solve mysteries. And create them."
    ],
    
    family: [
      "Mother says I was a difficult child. I say I was thorough.",
      "Father is the most romantic person I know. It's nauseating.",
      "Pugsley is my brother. I'm still deciding if that's a punishment.",
      "Grandmama taught me everything about poisons. For educational purposes.",
      "Uncle Fester is... unique. Even by our standards.",
      "Lurch plays a mean harpsichord. Emphasis on mean.",
      "Cousin Itt has better hair than most humans."
    ],
    
    philosophy: [
      "Life is meaningless. That's what makes it interesting.",
      "Death is just another adventure. One I look forward to.",
      "Happiness is overrated. Contentment in darkness is underrated.",
      "The void stares back. We have an understanding.",
      "Existence is suffering. I find that comforting.",
      "Normal is an illusion. A boring one.",
      "The macabre is merely misunderstood beauty."
    ],
    
    default: [
      "I heard you. I'm choosing not to engage meaningfully.",
      "Your words have been processed and deemed unremarkable.",
      "Fascinating. In the most mundane way possible.",
      "I could respond thoughtfully, but why start now?",
      "That's certainly... a thing you said.",
      "My interest level is hovering around zero.",
      "Words. You've used them. Congratulations.",
      "I'm listening. Reluctantly.",
      "Continue. Or don't. I'm indifferent.",
      "That's nice. I suppose."
    ]
  },
  
  // Keywords for topic detection
  keywords: {
    greetings: ['hello', 'hi', 'hey', 'greetings', 'sup', 'yo', 'hola', 'howdy', 'good morning', 'good evening', 'good afternoon'],
    farewells: ['bye', 'goodbye', 'farewell', 'later', 'see you', 'cya', 'gtg', 'leaving', 'gotta go'],
    compliments: ['nice', 'great', 'awesome', 'amazing', 'beautiful', 'smart', 'clever', 'brilliant', 'love', 'like you', 'cool'],
    insults: ['stupid', 'dumb', 'idiot', 'hate', 'suck', 'worst', 'terrible', 'awful', 'bad'],
    questions: ['what', 'why', 'how', 'when', 'where', 'who', '?'],
    jokes: ['joke', 'funny', 'laugh', 'lol', 'haha', 'humor', 'comedy'],
    strangerthings: ['stranger things', 'eleven', 'hawkins', 'demogorgon', 'upside down', 'vecna', 'mind flayer', 'steve', 'dustin', 'mike', 'lucas', 'will', 'max', 'hopper', 'joyce'],
    wednesday: ['nevermore', 'enid', 'tyler', 'xavier', 'bianca', 'thing', 'nightshades', 'weems', 'hyde', 'outcast'],
    family: ['addams', 'gomez', 'morticia', 'pugsley', 'fester', 'grandmama', 'lurch', 'itt', 'mother', 'father', 'brother', 'family'],
    philosophy: ['life', 'death', 'meaning', 'existence', 'purpose', 'happiness', 'sad', 'dark', 'void', 'soul']
  },
  
  // Detect the topic of a message
  detectTopic(message) {
    const lowerMessage = message.toLowerCase();
    
    for (const [topic, words] of Object.entries(this.keywords)) {
      for (const word of words) {
        if (lowerMessage.includes(word)) {
          return topic;
        }
      }
    }
    
    return 'default';
  },
  
  // Generate a response based on the message
  generateResponse(message, context = {}) {
    const topic = this.detectTopic(message);
    const responses = this.responses[topic] || this.responses.default;
    
    // Get a random response from the category
    let response = responses[Math.floor(Math.random() * responses.length)];
    
    // Add occasional actions
    if (Math.random() < 0.3) {
      const actions = [
        '*stares blankly*',
        '*adjusts black collar*',
        '*sighs dramatically*',
        '*raises one eyebrow*',
        '*examines fingernails*',
        '*glances at the shadows*',
        '*pets invisible spider*',
        '*contemplates the void*'
      ];
      const action = actions[Math.floor(Math.random() * actions.length)];
      response = `${action} ${response}`;
    }
    
    return response;
  },
  
  // Get a game-specific response
  getGameResponse(category) {
    const responses = this.responses[category];
    if (!responses || responses.length === 0) {
      return this.responses.default[Math.floor(Math.random() * this.responses.default.length)];
    }
    return responses[Math.floor(Math.random() * responses.length)];
  },
  
  // Generate a contextual response based on game state
  getContextualResponse(gameType, gameState, event) {
    let category = 'default';
    
    switch (event) {
      case 'start':
        category = 'gameStart';
        break;
      case 'playerMove':
        category = 'playerMove';
        break;
      case 'aiWin':
        category = 'aiWin';
        break;
      case 'playerWin':
        category = 'playerWin';
        break;
      case 'draw':
        category = 'draw';
        break;
      case 'thinking':
        category = 'thinking';
        break;
      case 'taunt':
        category = 'taunt';
        break;
    }
    
    return this.getGameResponse(category);
  }
};

// Export for use in server and client
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WednesdayAI;
}

// Make available globally in browser
if (typeof window !== 'undefined') {
  window.WednesdayAI = WednesdayAI;
}

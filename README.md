# ⚡ UPSIDE DOWN NEVERMORE GAMES ⚡

> *A real-time multiplayer gaming webapp for long-distance BFFs*
> 
> **🎬 Stranger Things × 🦇 Wednesday Addams**

![Theme](https://img.shields.io/badge/Theme-Stranger%20Things%20%2B%20Wednesday-red?style=for-the-badge)
![Multiplayer](https://img.shields.io/badge/Multiplayer-Real--time-purple?style=for-the-badge)
![Games](https://img.shields.io/badge/Games-5%20Goated-gold?style=for-the-badge)

## 🚀 ONE-CLICK DEPLOY BACKEND

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/lemonsupqt/Wednesday-Addams)

👆 **Click this button to deploy the multiplayer server for FREE!**

---

## 🎮 Features

### 5 Peak Goated Games

| Game | Description | Players |
|------|-------------|---------|
| ⭕❌ **Upside Down Tic-Tac-Toe** | Classic game with Demogorgon vs Eleven vibes | 2 |
| 🃏 **Vecna's Memory Match** | Match cards featuring characters & items from both universes | 2+ |
| ♟️👑 **Vecna's Chess** | Full chess with gothic dark/light board | 2 |
| 🔮⚡ **Psychic Showdown** | Vision vs Mind vs Power (Rock-Paper-Scissors reimagined) | 2+ |
| 🧠📺 **Nevermore Trivia** | Test your knowledge of Stranger Things & Wednesday | 2+ |

### Real-Time Multiplayer
- **WebSocket-powered** instant synchronization
- **Room-based** system with shareable codes
- **Live chat** - The Séance Circle for trash talking your BFF
- **Score tracking** across all games
- Up to **8 players** per room

### Dark Gothic UI
- 🔴 Stranger Things neon red glow aesthetic
- 🖤 Wednesday's monochrome gothic elegance
- ✨ Floating particle effects
- 📱 Fully responsive design

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm

### Installation

```bash
# Clone or download the repo
cd upside-down-nevermore-games

# Install dependencies
npm install

# Start the server
npm start
```

### Play!

1. Open `http://localhost:3000` in your browser
2. Enter your name
3. **Create a room** or **Join** with a code
4. Share the room code with your BFF
5. Choose a game and start playing!

---

## 🎲 Game Rules

### ⭕❌ Upside Down Tic-Tac-Toe
Classic Tic-Tac-Toe, but make it spooky! First player uses 🔴 (Eleven's power), second uses 💀 (Death). Three in a row wins.

### 🃏 Vecna's Memory Match
Flip cards to find matching pairs of iconic items and characters. Take turns - match a pair, go again. Most matches wins!

**Cards include:** Demogorgon, Eleven, Wednesday, Thing, Eggo Waffles, Cello, Spider, Christmas Lights, and more!

### ♟️👑 Vecna's Chess
Full chess game with a dark gothic aesthetic! Play as White or Black on a beautifully styled board. Standard chess rules apply - capture the opponent's King to win!

### 🔮⚡ Psychic Showdown
Choose your power each round:
- 👁️ **Vision** (Wednesday's sight) beats 🧠 Mind
- 🧠 **Mind** (Vecna's control) beats ⚡ Power
- ⚡ **Power** (Eleven's force) beats 👁️ Vision

10 rounds - highest score wins!

### 🧠📺 Nevermore Trivia
Answer 10 questions about Stranger Things and Wednesday. Faster correct answers = more points!

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express, Socket.io
- **Frontend:** Vanilla HTML/CSS/JS
- **Real-time:** WebSockets via Socket.io
- **Styling:** Custom CSS with Google Fonts

---

## 📁 Project Structure

```
/workspace
├── server.js          # Express + Socket.io server
├── package.json       # Dependencies
├── public/
│   ├── index.html     # Main HTML
│   ├── styles.css     # Gothic themed CSS
│   └── app.js         # Client-side game logic
└── README.md
```

---

## 🎨 Customization

### Add More Trivia Questions
Edit the `triviaQuestions` array in `server.js`:
```javascript
{ 
  q: "Your question here?", 
  options: ["A", "B", "C", "D"], 
  correct: 0 // Index of correct answer
}
```

### Add More Drawing Prompts
Edit the `drawingPrompts` array in `server.js`:
```javascript
const drawingPrompts = [
  "New prompt",
  // ...
];
```

---

## 🌐 Deployment

For deploying to the cloud:

1. **Heroku/Railway/Render:**
   ```bash
   git push heroku main
   ```

2. **Environment Variables:**
   - `PORT` - Server port (default: 3000)
   - `MONGODB_URI` - MongoDB Atlas connection string (optional, for persistent user accounts)
   - `OPENAI_API_KEY` - OpenAI API key for Wednesday AI chatbot (optional)

### 🖤 Wednesday AI Chatbot

The Wednesday AI chatbot in the chat supports two modes:

1. **With OpenAI API** (recommended): Set the `OPENAI_API_KEY` environment variable to enable GPT-powered responses. Wednesday will have dynamic, contextual conversations.

2. **Fallback Mode**: Without an API key, Wednesday uses curated static responses that still feel in-character.

To enable the AI chatbot:
```bash
export OPENAI_API_KEY=your-api-key-here
npm start
```

---

## 💀 Easter Eggs

- The title "UPSIDE DOWN" appears inverted (like the Upside Down dimension!)
- Particle effects switch between Stranger Things pink and Wednesday purple
- Each game has themed elements from both shows
- Chat is called "The Séance Circle" 👻

---

## 🤝 Playing with Friends

1. One person creates a room
2. Share the 6-character room code
3. Friends enter the code to join
4. Host selects a game
5. Battle it out!
6. Return to lobby for another game

---

## 📜 License

Made with 🖤 for all the outcasts and Hawkins heroes out there.

*"I'm not going to stop until I find you." - Eleven*

*"I act as if I don't care if people dislike me. Deep down, I secretly enjoy it." - Wednesday*

---

**⚡ NOW GO GAME WITH YOUR LONG-DISTANCE BFF! ⚡**

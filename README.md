<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://unfit.cards/img/unfit_logo.png">
  <source media="(prefers-color-scheme: light)" srcset="https://unfit.cards/img/unfit_logo_dark.png">
  <img alt="UNFIT FOR PRINT Logo" src="https://unfit.cards/img/unfit_logo.png">
</picture>

![Appwrite](https://img.shields.io/badge/Appwrite-%23FD366E.svg?style=flat&logo=appwrite&logoColor=white)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/MyndPhreak/unfit-for-print/release.yml)
![GitHub License](https://img.shields.io/github/license/MyndPhreak/unfit-for-print)
![GitHub package.json version (branch)](https://img.shields.io/github/package-json/v/MyndPhreak/unfit-for-print/main)

# UNFIT FOR PRINT

## About the Game

**UNFIT FOR PRINT - A PARTY GAME FOR HIDEOUS PEOPLE** is a hilarious and outrageous online card game designed to bring out your inner comedian. Inspired by games like Cards Against Humanity, it's the perfect party game for those who love to laugh and compete with friends or strangers online.

## How to Play

### Game Setup
1. **Create or Join a Lobby**: Start by creating a new lobby or joining an existing one using a lobby code.
2. **Invite Friends**: Share your lobby code with friends so they can join your game.
3. **Configure Settings**: The host can customize game settings including:
    - Maximum points to win
    - Cards per player
    - Card packs to include
    - Privacy settings

### Gameplay
1. **Roles**: Each round, one player is designated as the "Judge" (rotates each round).
2. **Black Card**: The Judge reveals a black card with a prompt or fill-in-the-blank statement.
3. **White Cards**: Other players select one or more white cards from their hand to respond to the black card.
4. **Judging**: The Judge reviews all submissions (anonymously) and selects the funniest or most outrageous response.
5. **Scoring**: The player with the winning submission earns a point.
6. **New Round**: A new Judge is selected, and a new black card is drawn.
7. **Game End**: The first player to reach the point limit (default: 10 points) wins the game.

### Player Types
- **Participants**: Active players who submit cards and can win rounds
- **Spectators**: Observers who can watch the game but don't participate
- **Host**: The player who created the lobby and has special privileges

## Features

### Core Gameplay
- **Real-time Card Play**: Submit cards and see results instantly
- **Card Reveal Animation**: Dramatic reveal of submissions during judging
- **Rotating Judge System**: Everyone gets a turn to be the Judge
- **Multiple Card Selection**: Some black cards require multiple white cards

### Social Features
- **Lobby System**: Create private or public game rooms
- **Chat System**: In-game chat to communicate with other players
- **Player Management**: Kick players or convert spectators to participants

### Customization
- **Game Settings**: Customize point limits, cards per player, and more
- **Card Packs**: Choose from different themed card packs
- **Player Profiles**: Customize your name and avatar

### Technical Features
- **Responsive Design**: Play on desktop or mobile devices
- **Real-time Updates**: See game state changes instantly
- **Persistent Sessions**: Rejoin games if you get disconnected
- **Sound Effects**: Immersive audio enhances the gameplay experience

## Game Flow

1. **Lobby Phase**:
    - Players join the lobby
    - Host configures game settings
    - Game starts when ready (minimum 3 players)

2. **Submission Phase**:
    - Judge waits while other players select cards
    - Players choose from their hand to respond to the black card
    - Timer ensures the game keeps moving

3. **Judging Phase**:
    - All submissions are revealed (anonymously)
    - Judge reviews and selects the winner
    - Winning player and card are highlighted

4. **Round End**:
    - Points are awarded
    - Brief countdown to next round
    - New Judge is selected

5. **Game End**:
    - Final scores are displayed
    - Winner is celebrated
    - Players can return to lobby for another game

## Technical Implementation

UNFIT FOR PRINT is built using modern web technologies:

- **Frontend**: Vue.js/Nuxt.js for a responsive and interactive UI
- **Backend**: Serverless functions for game logic
- **Database**: Appwrite for real-time data storage and synchronization
- **Authentication**: Support for anonymous play, Google login, and Discord login

## Getting Started

### As a Player
1. Visit the game website
2. Create an account or play anonymously
3. Create a new game or join an existing one with a code
4. Share your lobby code with friends
5. Have fun!

### For Developers
1. Clone the repository
2. Install dependencies with `npm install`
3. Configure environment variables
4. Run the development server with `npm run dev`
5. Build for production with `npm run build`

## Card Types

### Black Cards
- **Question Cards**: Pose a question that players answer with white cards
- **Fill-in-the-Blank Cards**: Contain sentences with blanks for players to complete
- **Pick 2/3 Cards**: Require players to submit multiple white cards for a complete response

### White Cards
- **Answer Cards**: Contain phrases, objects, or concepts to respond to black cards
- **Special Cards**: Rare cards with unique effects or particularly outrageous content

## Community and Support

- **Report Issues**: Help improve the game by reporting bugs
- **Suggest Features**: Share your ideas for new features or card content
- **Join the Community**: Connect with other players on Discord

---

### OVERPROMISE, UNDERDELIVER!

*This game contains mature content and is intended for adult players only.*

// types/gamesettings.d.ts
import type { Models } from "appwrite";
export interface GameSettings extends Models.Row {
  // Game configuration
  maxPoints: number; // Maximum points to win the game
  numPlayerCards: number; // Number of cards each player holds
  cardPacks: string[]; // Array of card pack IDs to use
  isPrivate: boolean; // Whether the lobby is private

  // Lobby information
  lobbyId: string | Models.Row; // Reference to the lobby
  password?: string; // Optional password for private lobbies
  lobbyName: string; // Name of the lobby
}

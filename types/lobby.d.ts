// types/lobby.ts
export interface Lobby {
    $id: string
    $createdAt: string
    $updatedAt: string
    code: string
    hostUserId: string
    players: string[]
    status: 'waiting' | 'playing' | 'complete'
    round: number
    gameState: string
    roundEndCountdownDuration: number; // Host-configurable countdown duration (seconds)
    revealedSubmissions?: Record<string, boolean> | string
}

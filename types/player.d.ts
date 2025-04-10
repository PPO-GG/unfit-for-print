// types/player.ts

export interface Player {
    $id: string;
    userId: string;
    lobbyId: string;
    name: string;
    avatar: string;
    isHost: boolean;
    joinedAt: string;
    provider: string;
}
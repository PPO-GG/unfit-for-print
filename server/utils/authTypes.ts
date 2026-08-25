declare module "#auth-utils" {
  interface User {
    id: string;
    discordUserId: string | null;
    isGuest: boolean;
    name: string;
    avatarUrl: string | null;
    activeDecoration: string | null;
    isAdmin: boolean;
  }
}

export {};

// types/auth.d.ts
export interface AuthUser {
  id: string;
  discordUserId: string | null;
  isGuest: boolean;
  name: string;
  avatarUrl: string | null;
  activeDecoration: string | null;
  isAdmin: boolean;
}

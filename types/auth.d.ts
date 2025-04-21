// types/auth.d.ts
import { Models } from 'appwrite'

export interface AuthUser extends Models.User<Models.Preferences> {
    provider: 'discord' | 'google' | 'anonymous';
    prefs: Models.Preferences & {
        avatar?: string;
        discordUserId?: string;
        name?: string;
        email?: string;
    };
}
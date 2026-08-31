// composables/useUserUtils.ts
import type { AuthUser } from "~/types/auth";

export function isAuthenticatedUser(user: AuthUser | null): user is AuthUser {
    return !!user && !user.isGuest;
}

export function isAnonymousUser(user: AuthUser | null): boolean {
    return !!user && user.isGuest;
}

/** A guest, or someone without a session, must choose their lobby name. */
export function requiresJoinUsername(user: AuthUser | null): boolean {
    return !isAuthenticatedUser(user);
}

export function isAdminUser(user: AuthUser | null): boolean {
    return !!user?.isAdmin;
}

export const useUserAccess = () => {
    const userStore = useUserStore()

    return {
        showIfAnonymous: computed(() => isAnonymousUser(userStore.user)),
        showIfAuthenticated: computed(() => isAuthenticatedUser(userStore.user)),
        showIfAdmin: computed(() => isAdminUser(userStore.user)),
    }
}

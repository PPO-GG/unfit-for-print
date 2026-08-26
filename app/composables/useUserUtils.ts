// composables/useUserUtils.ts
import type { AuthUser } from "~/types/auth";

export function isAuthenticatedUser(user: any): user is AuthUser {
    return !!user && user.isGuest === false;
}

export function isAnonymousUser(user: any): boolean {
    return !!user && user.isGuest === true;
}

export function isAdminUser(user: any): boolean {
    return !!user && user.isAdmin === true;
}

export const useUserAccess = () => {
    const userStore = useUserStore()

    return {
        showIfAnonymous: computed(() => isAnonymousUser(userStore.user)),
        showIfAuthenticated: computed(() => isAuthenticatedUser(userStore.user)),
        showIfAdmin: computed(() => isAdminUser(userStore.user)),
    }
}

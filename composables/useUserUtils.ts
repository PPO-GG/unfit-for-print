// composables/useUserUtils.ts
import type { Models } from "appwrite";

export function isAuthenticatedUser(user: any): user is Models.User<Models.Preferences> {
    return !!user && user.provider !== 'anonymous' && 'prefs' in user;
}

export function isAnonymousUser(user: any): boolean {
    return !!user && user.provider === 'anonymous';
}

export function isAdminUser(user: any): boolean {
    return !!user && user.prefs?.role === 'admin';
}

export function isAuthenticatedSession(session: Models.Session | null): boolean {
    return !!session && session.provider !== "anonymous";
}

export function getPlayerPermissions(user: Models.User<Models.Preferences>) {
    if (isAnonymousUser(user)) {
        return ['read("any")', 'update("users")', 'delete("users")'];
    }

    return [
        `read("any")`,
        `update("user:${user.$id}")`,
        `delete("user:${user.$id}")`,
    ];
}

export const useUserAccess = () => {
    const userStore = useUserStore()

    return {
        showIfAnonymous: computed(() => isAnonymousUser(userStore.user)),
        showIfAuthenticated: computed(() => isAuthenticatedUser(userStore.user)),
        showIfAdmin: computed(() => isAdminUser(userStore.user)),
    }
}
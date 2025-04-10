// middleware/lobby-access.ts
export default defineNuxtRouteMiddleware(async () => {
    const userStore = useUserStore();
    const { account } = useAppwrite();
    if (!account) throw new Error("Appwrite account not initialized");

    if (!userStore.session) {
        try {
            await account.createAnonymousSession();
            await userStore.fetchUserSession();
        } catch (err) {
            return navigateTo("/join?error=session_failed");
        }
    }
});

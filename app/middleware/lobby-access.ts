// middleware/lobby-access.ts
import { useLobby } from "~/composables/useLobby";
export default defineNuxtRouteMiddleware(async (to) => {
    const userStore = useUserStore();
    const { isInLobby, getLobbyByCode } = useLobby();

    const code = to.params.code || to.query.code;

    await userStore.fetchUserSession();

    const user = userStore.user;
    const lobby = await getLobbyByCode(<string>code);
    if (!user || !lobby) return navigateTo('/join');

    const stillIn = await isInLobby(user.$id, lobby.$id);
    if (!stillIn) {
        return navigateTo(`/join?code=${code}&error=kicked`);
    }
});
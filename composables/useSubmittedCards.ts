// composables/useSubmittedCards.ts
import { ref } from 'vue';
import { getAppwrite } from '~/utils/appwrite';
import type { PlayerCard } from '~/types/playerCard';

export const useSubmittedCards = (lobbyId: string) => {
    const submittedCards = ref<PlayerCard[]>([]);

    const loadSubmittedCards = async (playedCards: Record<string, string>) => {
        const { databases } = getAppwrite();
        const config = useRuntimeConfig();

        const entries = Object.entries(playedCards || {}) as [string, string][];
        const promises = entries.map(async ([userId, cardId]) => {
            const doc = await databases.getDocument(
                config.public.appwriteDatabaseId,
                config.public.appwriteWhiteCardCollectionId,
                cardId
            );
            return { userId, cardId, text: doc.text };
        });

        submittedCards.value = await Promise.all(promises);
    };

    return {
        submittedCards,
        loadSubmittedCards,
    };
};

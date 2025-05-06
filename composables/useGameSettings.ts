// composables/useGameSettings.ts
import { ref } from 'vue';
import { ID, Permission, Role, Query } from 'appwrite';
import { getAppwrite } from '~/utils/appwrite';
import type { GameSettings } from '~/types/gamesettings';

export function useGameSettings() {
    const { databases } = getAppwrite();
    const settings = ref<GameSettings | null>(null);
    const loading = ref(false);
    const error = ref<Error | null>(null);

    // Get game settings for a lobby
    const getGameSettings = async (lobbyId: string): Promise<GameSettings | null> => {
        const config = useRuntimeConfig();
        loading.value = true;
        error.value = null;

        try {
            // Query for settings with the given lobbyId
            const response = await databases.listDocuments(
                config.public.appwriteDatabaseId,
                config.public.appwriteGameSettingsCollectionId,
                [
                    // Query for the specific lobbyId using exact match
                    Query.equal('lobbyId', lobbyId)
                ]
            );

            if (response.documents.length > 0) {
                settings.value = response.documents[0] as unknown as GameSettings;
                return settings.value;
            }

            // If no settings found, return null
            settings.value = null;
            return null;
        } catch (err) {
            console.error('Error fetching game settings:', err);
            error.value = err as Error;
            settings.value = null;
            return null;
        } finally {
            loading.value = false;
        }
    };

    // Create default game settings
    const createDefaultGameSettings = async (lobbyId: string, lobbyName: string, hostUserId?: string): Promise<GameSettings> => {
        const config = useRuntimeConfig();

        const defaultSettings: Omit<GameSettings, '$id' | '$createdAt' | '$updatedAt'> = {
            maxPoints: 10,
            numPlayerCards: 10,
            cardPacks: ['base'],
            isPrivate: false,
            lobbyId,
            lobbyName
        };

        try {
            // Define permissions array
            const permissions = [
                Permission.read(Role.any()), // Anyone can read the settings
            ];

            // If hostUserId is provided, give them specific permissions
            if (hostUserId) {
                permissions.push(
                    Permission.update(Role.user(hostUserId)), // Host can update
                    Permission.delete(Role.user(hostUserId))  // Host can delete
                );
            } else {
                // Fallback to general user permissions if no host specified
                permissions.push(Permission.update(Role.users()));
            }

            const response = await databases.createDocument(
                config.public.appwriteDatabaseId,
                config.public.appwriteGameSettingsCollectionId,
                ID.unique(),
                defaultSettings,
                permissions
            );

            settings.value = response as unknown as GameSettings;
            return settings.value;
        } catch (err) {
            console.error('Error creating game settings:', err);
            error.value = err as Error;
            throw err;
        }
    };

    // Save game settings
    const saveGameSettings = async (lobbyId: string, newSettings: GameSettings, hostUserId?: string): Promise<GameSettings> => {
        const config = useRuntimeConfig();

        try {
            // If settings already exist, update them
            if (newSettings.$id) {
                const response = await databases.updateDocument(
                    config.public.appwriteDatabaseId,
                    config.public.appwriteGameSettingsCollectionId,
                    newSettings.$id,
                    {
                        maxPoints: newSettings.maxPoints,
                        numPlayerCards: newSettings.numPlayerCards,
                        cardPacks: newSettings.cardPacks,
                        isPrivate: newSettings.isPrivate,
                        password: newSettings.password,
                        lobbyName: newSettings.lobbyName
                    }
                );

                settings.value = response as unknown as GameSettings;
                return settings.value;
            } 

            // If no settings exist, create them with host permissions
            return await createDefaultGameSettings(lobbyId, newSettings.lobbyName, hostUserId);
        } catch (err) {
            console.error('Error saving game settings:', err);
            error.value = err as Error;
            throw err;
        }
    };

    return {
        settings,
        loading,
        error,
        getGameSettings,
        createDefaultGameSettings,
        saveGameSettings
    };
}

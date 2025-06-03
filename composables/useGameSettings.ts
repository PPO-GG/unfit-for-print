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
            // console.log('Fetching game settings for lobbyId:', lobbyId, 'type:', typeof lobbyId);

            // Query for settings with the given lobbyId
            const response = await databases.listDocuments(
                config.public.appwriteDatabaseId,
                config.public.appwriteGameSettingsCollectionId,
                [
                    // Get all settings (we'll filter manually to handle type mismatches)
                    Query.limit(1000)
                ]
            );

            // console.log('Found', response.documents.length, 'game settings documents');

            if (response.documents.length > 0) {
                // First try direct match
                let matchingSettings = response.documents.find(
                    doc => doc.lobbyId === lobbyId
                );

                // console.log('Direct match result:', matchingSettings ? 'Found' : 'Not found');

                // If not found, try string comparison
                if (!matchingSettings) {
                    matchingSettings = response.documents.find(
                        doc => String(doc.lobbyId) === String(lobbyId)
                    );
                    // console.log('String comparison match result:', matchingSettings ? 'Found' : 'Not found');
                }

                // If still not found, check if lobbyId is a relationship object
                if (!matchingSettings) {
                    matchingSettings = response.documents.find(doc => {
                        // Check if lobbyId is an object with an $id property
                        if (doc.lobbyId && typeof doc.lobbyId === 'object' && doc.lobbyId.$id) {
                            return doc.lobbyId.$id === lobbyId;
                        }
                        return false;
                    });
                    // console.log('Relationship match result:', matchingSettings ? 'Found' : 'Not found');
                }

                if (matchingSettings) {
                    // console.log('Found matching settings:', matchingSettings);
                    settings.value = matchingSettings as unknown as GameSettings;
                    return settings.value;
                }
            }

            console.log('No matching game settings found for lobbyId:', lobbyId);
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

        // First, check if settings already exist for this lobby
        try {
            const existingSettings = await getGameSettings(lobbyId);
            if (existingSettings) {
                // console.log('Game settings already exist for lobby, returning existing settings:', lobbyId);
                return existingSettings;
            }
        } catch (err) {
            console.warn('Error checking for existing game settings:', err);
            // Continue with creation attempt even if check fails
        }

        // Check if we need to create a relationship object for lobbyId
        // In Appwrite, relationships can be created by passing the ID as a string
        // The server will convert it to a relationship object
        const defaultSettings: Omit<GameSettings, '$id' | '$createdAt' | '$updatedAt'> = {
            maxPoints: 10,
            numPlayerCards: 10,
            cardPacks: ['CAH Base Set'],
            isPrivate: false,
            lobbyId, // This will be converted to a relationship by Appwrite if the collection is configured for relationships
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

            // Use a deterministic ID based on the lobbyId to prevent duplicates
            const documentId = `settings-${lobbyId}`;

            try {
                const response = await databases.createDocument(
                    config.public.appwriteDatabaseId,
                    config.public.appwriteGameSettingsCollectionId,
                    documentId,
                    defaultSettings,
                    permissions
                );

                settings.value = response as unknown as GameSettings;
                return settings.value;
            } catch (createErr: any) {
                // If document already exists (409 Conflict), try to get it
                if (createErr.code === 409) {
                    // console.log('Document already exists, fetching existing settings');
                    const existingSettings = await getGameSettings(lobbyId);
                    if (existingSettings) {
                        return existingSettings;
                    }
                }
                throw createErr;
            }
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
                // Note: We don't update the lobbyId field here because it's a relationship
                // and we don't want to change the relationship between settings and lobby
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

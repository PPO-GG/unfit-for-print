<template>
  <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md">
    <h2 class="text-xl font-bold mb-4 text-center text-primary-600 dark:text-primary-400">Create New Lobby</h2>
    <UForm :state="formState" @submit="onSubmit" class="space-y-4">
      <UFormField label="Lobby Name (optional)" name="name">
        <UInput 
          v-model="formState.name" 
          placeholder="Optional Lobby Name" 
          icon="i-heroicons-user-group"
          class="focus:ring-primary-500"
        />
      </UFormField>
      <UButton 
        type="submit" 
        block 
        class="mt-6 bg-primary-500 hover:bg-primary-600 transition-colors" 
        :loading="creating"
      >
        <span class="flex items-center gap-2">
          <i class="i-heroicons-play-circle"></i>
          Create Lobby
        </span>
      </UButton>
    </UForm>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useLobby } from '~/composables/useLobby';
import { useUserStore } from '~/stores/userStore';
import { useNotifications } from '~/composables/useNotifications';

const emit = defineEmits<{
  (e: 'created', code: string): void;
}>();

const { createLobby } = useLobby();
const userStore = useUserStore();
const { notify } = useNotifications();

const formState = reactive({ name: '' });
const creating = ref(false);

const onSubmit = async () => {
  try {
    creating.value = true;

    if (!userStore.user?.$id) {
      throw new Error('User not authenticated');
    }

    // Log runtime configuration for debugging
    const config = useRuntimeConfig();
    console.log('Runtime configuration in CreateLobbyDialog:', {
      databaseId: config.public.appwriteDatabaseId,
      lobbyCollectionId: config.public.appwriteLobbyCollectionId,
      playerCollectionId: config.public.appwritePlayerCollectionId
    });

    // Pass the lobby name if it's not empty
    const lobbyName = formState.name.trim() || undefined;
    const lobby = await createLobby(userStore.user.$id, lobbyName);

    if (!lobby?.code) {
      throw new Error('Invalid lobby response');
    }

    // Show success notification
    notify({
      title: 'Lobby Created',
      description: `Your lobby has been created successfully${lobbyName ? ` with name: ${lobbyName}` : ''}`,
      color: "success"
    });

    emit('created', lobby.code);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    notify({
      title: 'Failed to create lobby',
      description: errorMessage,
      color: "error"
    });

    console.error('Lobby creation failed:', errorMessage);
  } finally {
    creating.value = false;
  }
};

</script>

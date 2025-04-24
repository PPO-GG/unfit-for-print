<template>
  <UForm :state="formState" @submit="onSubmit">
    <UFormField label="Lobby Name (optional)" name="name">
      <UInput v-model="formState.name" placeholder="Optional display name" />
    </UFormField>
    <UButton type="submit" block class="mt-4" :loading="creating">Create Lobby</UButton>
  </UForm>
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

    const lobby = await createLobby(userStore.user.$id);

    if (!lobby?.code) {
      throw new Error('Invalid lobby response');
    }

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

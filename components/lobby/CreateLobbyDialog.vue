<template>
  <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md">
    <h2 class="text-xl font-bold mb-4 text-center text-primary-600 dark:text-primary-400">{{ t('modal.create_lobby') }}</h2>
    <UForm :state="formState" @submit="onSubmit" class="space-y-4">
      <UFormField :label="t('modal.lobby_name')" name="name">
        <UInput 
          v-model="formState.name" 
          :placeholder="t('modal.lobby_name')"
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
          {{ t('modal.create_lobby') }}
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
const { t } = useI18n()

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

    // Pass the lobby name if it's not empty
    const lobbyName = formState.name.trim() || undefined;
    const lobby = await createLobby(userStore.user.$id, lobbyName);

    if (!lobby?.code) {
      throw new Error('Invalid lobby response');
    }

    // Show success notification
	  notify({
		  title: lobbyName
				  ? `${t('modal.lobby_created')} ${t('modal.lobby_created_with_name', { name: lobbyName })}`
				  : t('modal.lobby_created'),
		  color: "success"
	  })

    emit('created', lobby.code);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    notify({
      title: t('modal.error_create_lobby'),
      description: errorMessage,
      color: "error"
    });

    console.error('Lobby creation failed:', errorMessage);
  } finally {
    creating.value = false;
  }
};

</script>

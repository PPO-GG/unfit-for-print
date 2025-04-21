<template>
  <UForm :state="formState" @submit="onSubmit">
    <UFormField label="Lobby Name (optional)" name="name">
      <UInput v-model="formState.name" placeholder="Optional display name" />
    </UFormField>
    <UButton type="submit" block class="mt-4">Create Lobby</UButton>
  </UForm>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useRouter } from 'vue-router';
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

const onSubmit = async () => {
  try {
    if (!userStore.user?.$id) throw new Error('User not authenticated');

    const lobby = await createLobby(userStore.user.$id);
    emit('created', lobby.code, true);
  } catch (err) {
    notify({
      title: 'Failed to create lobby',
      color: "error"
    });
    console.error(err);
  }
};
</script>

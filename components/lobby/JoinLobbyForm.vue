<template>
  <UForm :state="formState" @submit="onSubmit">
      <UFormField v-if="showIfAnonymous" label="Username" name="username">
        <UInput
            v-model="formState.username"
            placeholder="e.g. RizzMaster69"
            autocomplete="off"
        />
      </UFormField>

      <UFormField label="Lobby Code" name="code">
      <UInput
          v-model="formState.code"
          placeholder="e.g. ABC123"
          autocomplete="off"
          class="uppercase"
      />
      </UFormField>

    <UButton type="submit" block class="mt-4" :loading="joining">
      Join Lobby
    </UButton>

    <p v-if="error" class="text-sm text-red-500 mt-2">{{ error }}</p>
  </UForm>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { useUserAccess } from '~/composables/useUserUtils';
import { useJoinLobby } from '~/composables/useJoinLobby';
defineEmits<{
  (e: 'joined', code: string): void;
}>();
const props = defineProps<{ initialCode?: string }>()
const { showIfAnonymous } = useUserAccess();
const { joinLobbyWithSession, initSessionIfNeeded } = useJoinLobby();

const formState = reactive({
  username: '',
  code: ''
});

const error = ref('');
const joining = ref(false);

onMounted(initSessionIfNeeded);

const onSubmit = async () => {
  await joinLobbyWithSession(
      formState.username,
      formState.code,
      (msg) => (error.value = msg),
      (val) => (joining.value = val)
  );
};
</script>

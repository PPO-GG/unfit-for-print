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
import {onMounted, reactive, ref, computed} from 'vue';
import {useUserAccess} from '~/composables/useUserUtils';
import {useJoinLobby} from '~/composables/useJoinLobby';
import {useUserStore} from '~/stores/userStore';

// only *one* defineEmits
const emit = defineEmits<{
  (e: 'joined', code: string): void;
}>();

const props = defineProps<{ initialCode?: string }>();
const {showIfAnonymous} = useUserAccess();
const {joinLobbyWithSession, initSessionIfNeeded} = useJoinLobby();
const userStore = useUserStore();

const formState = reactive({
  username: '',
  code: ''
});

/**
 * Get the authenticated user's username if available
 * This is used to automatically fill the username for authenticated users
 * instead of requiring them to enter it manually
 */
const authenticatedUsername = computed(() => {
  if (userStore.user && !showIfAnonymous.value) {
    return userStore.user.prefs?.name || userStore.user.name || '';
  }
  return '';
});

const error = ref('');
const joining = ref(false);

onMounted(() => {
  initSessionIfNeeded();

  // pre-fill code from URL
  if (props.initialCode) {
    formState.code = props.initialCode.toUpperCase();
  }
});

const onSubmit = async () => {
  // Use authenticated username if available, otherwise use the form input
  let username = showIfAnonymous.value ? formState.username : authenticatedUsername.value;

  // Ensure username is not empty for authenticated users
  if (!showIfAnonymous.value && (!username || username.trim() === '')) {
    username = 'Player_' + Math.floor(Math.random() * 1000);
    console.warn('Empty username for authenticated user, using fallback:', username);
  }

  console.log('Using username:', username, 'isAnonymous:', showIfAnonymous.value);

  const ok = await joinLobbyWithSession(
      username,
      formState.code,
      (msg) => (error.value = msg),
      (val) => (joining.value = val)
  );

  console.log('🟢 join result:', ok, formState.code);

  if (ok) {
    emit('joined', formState.code);
  }
};
</script>

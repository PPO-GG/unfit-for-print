<template>
  <UForm :state="formState" @submit="onSubmit" class="">
    <UFormField
      v-if="needsUsername"
      :label="t('modal.join_username')"
      name="username"
    >
      <UInput
        v-model="formState.username"
        placeholder="RizzMaster69"
        autocomplete="off"
      />
    </UFormField>

    <UFormField :label="t('lobby.lobby_code')" name="code">
      <UInput
        v-model="formState.code"
        placeholder="ABC123"
        autocomplete="off"
        class="uppercase"
      />
    </UFormField>
    <UFormField
      v-if="requiresPassword"
      :label="t('modal.join_password')"
      name="password"
    >
      <UInput
        v-model="formState.password"
        type="password"
        autocomplete="off"
      />
    </UFormField>

    <UFieldGroup size="lg" class="">
      <UButton
        type="submit"
        class="mt-4 cursor-pointer"
        :loading="joining"
        color="primary"
        variant="subtle"
        icon="i-solar-hand-shake-line-duotone"
        :label="t('game.joingame')"
      />
      <UButton
        class="mt-4 cursor-pointer"
        color="warning"
        variant="subtle"
        icon="i-solar-exit-bold-duotone"
        to="/"
        :label="t('nav.home')"
      />
    </UFieldGroup>
    <p v-if="error" class="text-sm text-red-500 mt-2">{{ error }}</p>
  </UForm>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed, watch } from "vue";
import { requiresJoinUsername, useUserAccess } from "~/composables/useUserUtils";
import { useJoinLobby } from "~/composables/useJoinLobby";
import { useUserStore } from "~/stores/userStore";

const { t } = useI18n();
// only *one* defineEmits
const emit = defineEmits<{
  (e: "joined", code: string): void;
}>();

const props = defineProps<{ initialCode?: string }>();
const { showIfAnonymous } = useUserAccess();
const { joinLobbyWithSession, initSessionIfNeeded } = useJoinLobby();
const userStore = useUserStore();

const formState = reactive({
  username: "",
  code: "",
  password: "",
});

/**
 * Whether to ask for a name. NOT `showIfAnonymous` — that is
 * `!!user && user.isGuest`, which is FALSE for a visitor with no session at
 * all, so a fresh tab was never asked and fell through to a Player_XXX
 * fallback. JoinTakeover has always used this predicate; the two join surfaces
 * disagreed.
 */
const needsUsername = computed(() => requiresJoinUsername(userStore.user));

// Reveal the password field as soon as the typed code names a protected lobby,
// so the player is asked before committing rather than after a rejection.
const requiresPassword = ref(false);
watch(
  () => formState.code,
  async (raw) => {
    const code = (raw || "").trim().toUpperCase();
    if (code.length !== 4) {
      requiresPassword.value = false;
      return;
    }
    try {
      const lobby = await $fetch<{ hasPassword?: boolean } | null>(
        `/api/lobby/by-code/${code}`,
      );
      requiresPassword.value = !!lobby?.hasPassword;
    } catch {
      requiresPassword.value = false;
    }
  },
);

/**
 * Get the authenticated user's username if available
 * This is used to automatically fill the username for authenticated users
 * instead of requiring them to enter it manually
 */
const authenticatedUsername = computed(() => {
  if (userStore.user && !showIfAnonymous.value) {
    return userStore.user.name || "";
  }
  return "";
});

const error = ref("");
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
  let username = needsUsername.value
    ? formState.username
    : authenticatedUsername.value;

  // Ensure username is not empty for authenticated users
  if (!needsUsername.value && (!username || username.trim() === "")) {
    let randomSuffix: number = 0;
    do {
      randomSuffix = crypto.getRandomValues(new Uint32Array(1))[0] as number;
    } while (randomSuffix >= 4294967000); // Discard values >= 2^32 - (2^32 % 1000)
    randomSuffix %= 1000;
    username = "Player_" + randomSuffix;
    // console.warn('Empty username for authenticated user, using fallback:', username);
  }

  // console.log('Using username:', username, 'isAnonymous:', showIfAnonymous.value);

  const ok = await joinLobbyWithSession(
    username,
    formState.code,
    (msg) => (error.value = msg),
    (val) => (joining.value = val),
    formState.password || undefined,
  );

  // console.log('🟢 join result:', ok, formState.code);

  if (ok) {
    emit("joined", formState.code);
  }
};
</script>

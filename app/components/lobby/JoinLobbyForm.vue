<template>
  <UForm :state="formState" @submit="onSubmit" class="">
    <UFormField
      v-if="showIfAnonymous"
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
        @blur="checkLobbyPrivacy"
      />
    </UFormField>

    <UFormField
      v-if="isPrivateLobby"
      :label="t('modal.join_password')"
      name="password"
    >
      <UInput
        v-model="formState.password"
        type="password"
        placeholder="*********"
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
import { onMounted, reactive, ref, computed } from "vue";
import { useUserAccess } from "~/composables/useUserUtils";
import { useJoinLobby } from "~/composables/useJoinLobby";
import { useUserStore } from "~/stores/userStore";
import { useGameSettings } from "~/composables/useGameSettings";
import { useLobby } from "~/composables/useLobby";

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

const isPrivateLobby = ref(false);

/**
 * Get the authenticated user's username if available
 * This is used to automatically fill the username for authenticated users
 * instead of requiring them to enter it manually
 */
const authenticatedUsername = computed(() => {
  if (userStore.user && !showIfAnonymous.value) {
    return userStore.user.prefs?.name || userStore.user.name || "";
  }
  return "";
});

const error = ref("");
const joining = ref(false);

const checkLobbyPrivacy = async () => {
  if (!formState.code || formState.code.trim() === "") {
    isPrivateLobby.value = false;
    return;
  }

  try {
    const { getLobbyByCode } = useLobby();
    const { getGameSettings } = useGameSettings();

    // Get the lobby by code
    const lobby = await getLobbyByCode(formState.code.trim().toUpperCase());
    if (!lobby) {
      return;
    }

    // Get the game settings for the lobby
    const settings = await getGameSettings(lobby.$id);
    isPrivateLobby.value = !!(settings && settings.isPrivate);
  } catch (err) {
    // console.error('Error checking lobby privacy:', err);
    isPrivateLobby.value = false;
  }
};

onMounted(() => {
  initSessionIfNeeded();

  // pre-fill code from URL
  if (props.initialCode) {
    formState.code = props.initialCode.toUpperCase();
    // Check if the lobby is private when initialCode is provided
    checkLobbyPrivacy();
  }
});

const onSubmit = async () => {
  // Use authenticated username if available, otherwise use the form input
  let username = showIfAnonymous.value
    ? formState.username
    : authenticatedUsername.value;

  // Ensure username is not empty for authenticated users
  if (!showIfAnonymous.value && (!username || username.trim() === "")) {
    let randomSuffix: number = 0;
    do {
      randomSuffix = crypto.getRandomValues(new Uint32Array(1))[0] as number;
    } while (randomSuffix >= 4294967000); // Discard values >= 2^32 - (2^32 % 1000)
    randomSuffix %= 1000;
    username = "Player_" + randomSuffix;
    // console.warn('Empty username for authenticated user, using fallback:', username);
  }

  // Check if the lobby is private and validate password
  if (isPrivateLobby.value) {
    // If the lobby is private but no password is provided
    if (!formState.password || formState.password.trim() === "") {
      error.value = t("modal.error_lobby_needs_password");
      return;
    }

    try {
      const { getLobbyByCode } = useLobby();
      const { getGameSettings } = useGameSettings();

      // Get the lobby by code
      const lobby = await getLobbyByCode(formState.code.trim().toUpperCase());
      if (!lobby) {
        error.value = t("lobby.not_found");
        return;
      }

      // Get the game settings for the lobby
      const settings = await getGameSettings(lobby.$id);
      if (settings && settings.isPrivate) {
        // Validate the password
        if (settings.password !== formState.password) {
          error.value = t("modal.error_join_wrong_password");
          return;
        }
      }
    } catch (err) {
      // console.error('Error validating lobby password:', err);
      error.value = "Failed to validate lobby password.";
      return;
    }
  }

  // console.log('Using username:', username, 'isAnonymous:', showIfAnonymous.value);

  const ok = await joinLobbyWithSession(
    username,
    formState.code,
    (msg) => (error.value = msg),
    (val) => (joining.value = val),
  );

  // console.log('🟢 join result:', ok, formState.code);

  if (ok) {
    emit("joined", formState.code);
  }
};
</script>

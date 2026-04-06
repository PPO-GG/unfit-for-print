<template>
  <div class="p-6 space-y-6">
    <!-- Always shown: join form -->
    <JoinLobbyForm @joined="handleJoined" />

    <!-- Only shown for logged-in users -->
    <UButton v-if="showIfAuthenticated" :loading="isCreating" @click="checkForActiveLobbyAndCreate">
      {{ t('modal.create_lobby') }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { useUserAccess } from '~/composables/useUserUtils';
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

const { showIfAuthenticated } = useUserAccess();
const { isCreating, checkForActiveLobbyAndCreate, handleJoined } = useLobbyActions();
</script>

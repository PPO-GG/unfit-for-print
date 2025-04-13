<template>
  <div class="p-6 space-y-6">
    <!-- Always shown: join form -->
    <JoinLobbyForm @joined="handleJoined" />

    <!-- Only shown for logged-in users -->
    <UButton v-if="showIfAuthenticated" @click="showCreate = true">
      Create Lobby
    </UButton>

    <!-- Create lobby dialog -->
    <CreateLobbyDialog v-model="showCreate" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserAccess } from '~/composables/useUserUtils';

const { showIfAuthenticated } = useUserAccess();
const showCreate = ref(false);

const handleJoined = (code: string) => {
  useRouter().push(`/game/${code}`);
};
</script>
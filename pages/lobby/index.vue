<script setup lang="ts">
import { onMounted } from 'vue';
import { useSessionLobbyRedirect } from '~/composables/useSessionLobbyRedirect';

const { checkAndRedirect } = useSessionLobbyRedirect();

onMounted(() => {
  checkAndRedirect();
});
</script>

<template>
  <div class="text-white p-6">
    <p>Checking your session...</p>
    <Icon name="line-md:loading-twotone-loop"  class="align-middle text-slate-100"/>
  </div>
</template>

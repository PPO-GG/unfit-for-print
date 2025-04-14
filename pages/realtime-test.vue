<!-- pages/realtime.vue -->
<script setup lang="ts">
import { getAppwrite } from '~/utils/appwrite';
import { onMounted } from 'vue';

onMounted(async () => {
  const { client, account } = getAppwrite();

  // Step 1: Ensure we're bound to a session
  try {
    const session = await account.getSession('current');
    console.log('✅ Session bound:', session.$id);
  } catch {
    await account.createAnonymousSession();
    const session = await account.getSession('current');
    console.log('👤 Anonymous session created:', session.$id);
  }

  // Step 2: Subscribe explicitly
  client.subscribe(
      ['databases.ufp-db.collections.players.documents.*'],
      (res) => {
        console.log('🔥 EVENT:', res);
      }
  );
  console.log('📡 Subscribed to players collection');
});

function resubscribe() {
  const { client } = getAppwrite();
  client.subscribe(
      ['databases.ufp-db.collections.players.documents.*'],
      (res) => {
        console.log('🔥 MANUAL SUB:', res);
      }
  );
}
</script>

<template>
  <div class="p-6 text-white bg-black">
    <h1 class="text-2xl font-bold">Realtime Test</h1>
    <p>Check the console for realtime events.</p>
    <UButton @click="resubscribe">Resubscribe</UButton>
  </div>
</template>

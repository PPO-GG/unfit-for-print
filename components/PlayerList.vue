<script setup lang="ts">
const props = defineProps<{
  players: {
    $id: string;
    userId: string;
    name: string;
    avatar: string;
    isHost: boolean;
    joinedAt: string;
  }[],
  hostUserId: string
}>()

const sortedPlayers = computed(() =>
  props.players.slice().sort((a, b) => {
    if (a.userId === props.hostUserId) return -1
    if (b.userId === props.hostUserId) return 1
    return 0
  })
)
</script>

<template>
  <div class="mt-6 font-['Bebas_Neue'] bg-slate-600 rounded-xl p-6 shadow-lg w-1/12 ">
    <h2 class="text-3xl font-bold mb-2">Players</h2>
    <ul class="uppercase text-lg">
      <li
        v-for="player in sortedPlayers"
        :key="player.$id"
        class="flex items-center gap-2 uppercase]"
      >
        <span v-if="player.userId === hostUserId"><Icon name="solar:crown-minimalistic-bold"  class="align-middle text-slate-100"/></span>
        <span>{{ player.name || "Unknown Player" }}</span>
      </li>
    </ul>
  </div>
</template>
<style scoped>
</style>
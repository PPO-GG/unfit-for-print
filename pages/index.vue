<template>
  <div
      class="bg-slate-700 min-h-screen w-screen p-4 flex items-center justify-center flex-col"
  >
    <div class="flex flex-wrap justify-center gap-8">
        <BlackCard
            v-if="blackCard"
            @click="blackCardFlipped = !blackCardFlipped"
            :cardText=blackCard.text
            :cardPack=blackCard.pack
            :flipped="blackCardFlipped"
            :threeDeffect="threeDeffect"
            :shine="shine"
            :numPick="numPick"
        />
        <div v-else class="text-white mt-4">Loading card...</div>

      <div>
          <WhiteCard
              v-if="whiteCard"
              @click="whiteCardFlipped = !whiteCardFlipped"
              :cardText="whiteCard.text"
              :cardPack="whiteCard.pack"
              :flipped="whiteCardFlipped"
              :threeDeffect="threeDeffect"
              :shine="shine"
          />
          <div v-else class="text-white mt-4">Loading card...</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {useCards} from "~/composables/useCards";

const whiteCard = ref<any>(null);
const blackCard = ref<any>(null);
const blackCardFlipped = ref(true);
const whiteCardFlipped = ref(true);
const threeDeffect = ref(true);
const numPick = ref(1);
const shine = ref(true);
const {fetchRandomWhiteCard, fetchRandomBlackCard} = useCards();

onMounted(() => {
  if (import.meta.client) {
    fetchRandomBlackCard().then(card => {
      blackCard.value = card
    })
    fetchRandomWhiteCard().then(card => {
      whiteCard.value = card
    })
  }
})
</script>

<template>
  <div
    class="bg-slate-700 min-h-screen w-screen p-4 flex items-center justify-center flex-col"
  >
    <div class="flex flex-wrap justify-center gap-8">
      <div @click="" >
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
      </div>

      <div>
        <ClientOnly>
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
        </ClientOnly>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useCards } from "~/composables/useCards";
import { useNotifications } from "~/composables/useNotifications";

const { notify } = useNotifications();
const whiteCard = ref<any>(null);
const blackCard = ref<any>(null);
const blackCardFlipped = ref(true);
const whiteCardFlipped = ref(true);
const threeDeffect = ref(true);
const numPick = ref(1);
const shine = ref(true);
const { fetchRandomWhiteCard, fetchRandomBlackCard } = useCards();
const { account } = useAppwrite();

try {
  whiteCard.value = await fetchRandomWhiteCard();
  blackCard.value = await fetchRandomBlackCard();
} catch (err) {
  notify("Failed to fetch cards", "error");
}
</script>

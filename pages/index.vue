<template>
  <div class="p-6 space-y-6 text-white bg-transparent mt-24">
	  <img
			class="mx-auto mb-4 w-xl"
			src="/img/unfit_logo.png"
			alt="Logo"
	  />

    <div class="flex justify-center gap-4">
      <BlackCard
          v-if="blackCard"
          @click="blackCardFlipped = !blackCardFlipped"
          :card-id="blackCard.$id"
          :text="blackCard.text"
          :cardPack=blackCard.pack
          :flipped="blackCardFlipped"
          :threeDeffect="threeDeffect"
          :num-pick="randomCard.pick"
          :shine="shine"
          :back-logo-url="'/img/unfit_logo_alt.png'"
          :mask-url="'/img/textures/hexa.png'"
      />
      <div v-else class="text-white mt-4">Loading card...</div>

      <div>
        <WhiteCard
            v-if="whiteCard"
            @click="whiteCardFlipped = !whiteCardFlipped"
            :card-id="whiteCard.$id"
            :text="whiteCard.text"
            :card-pack="whiteCard.pack"
            :flipped="whiteCardFlipped"
            :three-deffect="threeDeffect"
            :shine="shine"
            :back-logo-url="'/img/unfit_logo_alt_dark.png'"
            :mask-url="'/img/textures/hexa2.png'"
        />
        <div v-else class="text-white mt-4">Loading card...</div>
      </div>
    </div>
	  <div class="flex flex-col items-center mt-8">
		  <UButton
				  loading-auto
				  @click="fetchNewCards"
				  class="text-xl py-2 px-4 cursor-pointer font-['Bebas_Neue']" color="secondary" variant="subtle" icon="i-solar-layers-minimalistic-bold-duotone"
		  >
			  TRY ME
		  </UButton>
	  </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {useCards} from "~/composables/useCards";
useHead({
  title: `Unfit for Print`,
})

const whiteCard = ref<any>(null);
const blackCard = ref<any>(null);
const blackCardFlipped = ref(true);
const whiteCardFlipped = ref(true);
const threeDeffect = ref(true);
const shine = ref(true);
const {fetchRandomWhiteCard, fetchRandomBlackCard} = useCards();
const randomCard = ref<any>(null); // Use a proper type/interface if available
const {playSfx} = useSfx();
const { notify } = useNotifications()

const fetchNewCards = async () => {
	whiteCardFlipped.value = true;
	blackCardFlipped.value = true;
	await playSfx('/sounds/sfx/submit.wav',{ pitch: [0.8, 1.2], volume: 0.75});
  return new Promise<void>(res => setTimeout(res, 1000)
  ).then(() => {
    fetchRandomWhiteCard().then((card: any) => {
      whiteCard.value = card;
	    whiteCardFlipped.value = false;
    });
	  randomCard.value = fetchRandomBlackCard(1).then((card: any) => {
      blackCard.value = card;
	    blackCardFlipped.value = false;
    });
    notify({
      title: 'Fetched New Cards',
      icon: "i-mdi-cards",
      color: 'info',
      duration: 1000,
    })
  });
};

onMounted(() => {
		if (import.meta.client) {
			fetchRandomWhiteCard().then((card: any) => {
				whiteCardFlipped.value = true;
				whiteCard.value = card;
			});
			randomCard.value = fetchRandomBlackCard(1).then((card: any) => {
				blackCardFlipped.value = true;
				blackCard.value = card;
			});
			notify({
				title: 'Fetched New Cards',
				icon: "i-mdi-cards",
				color: 'info',
				duration: 1000,
			})
		}
});
</script>

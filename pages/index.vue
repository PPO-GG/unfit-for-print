<template>
  <div class="p-6 space-y-6 text-white">
    <div class="flex flex-wrap justify-center gap-8">
      <BlackCard
          v-if="blackCard"
          @click="blackCardFlipped = !blackCardFlipped"
          :card-id="blackCard.$id"
          :text="blackCard.text"
          :cardPack=blackCard.pack
          :flipped="blackCardFlipped"
          :threeDeffect="threeDeffect"
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
    <UButton
        loading-auto
        @click="fetchNewCards"
        class="mt-8 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-lg"
    >
      New Cards
    </UButton>

    <div class="space-x-4">
      <UButton size="lg" @click="showJoin = true">Join Game</UButton>
      <UButton size="lg" v-if="showIfAuthenticated" @click="showCreate = true">Create Game</UButton>
    </div>

    <!-- Modals -->
    <UModal v-model:open="showJoin" title="Join a Lobby">
      <template #body>
        <JoinLobbyForm @joined="handleJoined" />
      </template>
    </UModal>

    <UModal v-model:open="showCreate" title="Create a Lobby">
      <template #body>
        <CreateLobbyDialog @created="handleJoined" />
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {useCards} from "~/composables/useCards";
import { useRouter } from 'vue-router';
import { useUserAccess } from '~/composables/useUserUtils';

const whiteCard = ref<any>(null);
const blackCard = ref<any>(null);
const blackCardFlipped = ref(true);
const whiteCardFlipped = ref(true);
const threeDeffect = ref(true);
const shine = ref(true);
const {fetchRandomWhiteCard, fetchRandomBlackCard} = useCards();
const {playSfx} = useSfx();
const { notify } = useNotifications()
const { client } = useAppwrite()

const showJoin = ref(false);
const showCreate = ref(false);
const router = useRouter();
const { showIfAuthenticated } = useUserAccess();

const fetchNewCards = async () => {
  playSfx('/sounds/sfx/click1.wav');
  return new Promise<void>(res => setTimeout(res, 250)
  ).then(() => {
    fetchRandomWhiteCard().then((card: any) => {
      whiteCardFlipped.value = true;
      whiteCard.value = card;
    });
    fetchRandomBlackCard().then((card: any) => {
      blackCardFlipped.value = true;
      blackCard.value = card;
    });
    notify({
      title: 'Fetched New Cards',
      icon: "i-mdi-cards",
      color: 'info',
      duration: 1000,
    })
  });
};

const handleJoined = (code: string) => {
  router.push(`/game/${code}`);
};

onMounted(() => {
  if (import.meta.client) {
    fetchNewCards();
  }
  console.log(client.config.project);
})
</script>

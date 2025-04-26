<template>
  <div class="p-6 space-y-6 text-white bg-transparent">
    <ScrollingBackground
        :scale="0.5"
        :gap="12"
        :speedPx="15"
    />

    <div class="flex flex-wrap justify-center gap-4">
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
      <UButton size="lg" @click="checkForActiveLobbyAndJoin" :loading="isJoining">Join Game</UButton>
      <UButton size="lg" v-if="showIfAuthenticated" @click="checkForActiveLobbyAndCreate" :loading="isCreating">Create Game</UButton>
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
import { useLobby } from '~/composables/useLobby';
import { useUserStore } from '~/stores/userStore';
import ScrollingBackground from "~/components/ScrollingBackground.vue";
const route = useRoute()
const code = route.params.code as string
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
const {playSfx} = useSfx();
const { notify } = useNotifications()
const { client } = useAppwrite()

const showJoin = ref(false);
const showCreate = ref(false);
const isJoining = ref(false);
const isCreating = ref(false);
const router = useRouter();
const userStore = useUserStore();
const { getActiveLobbyForUser } = useLobby();
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

const handleJoined = (code: string, isCreator = false) => {
  notify({
    title: 'Loading game lobby...',
    color: 'info',
    icon: 'i-mdi-loading i-spin',
    duration: 3000,
  });
  router.push(`/game/${code}${isCreator ? '?creator=true' : ''}`);
};

const checkForActiveLobbyAndCreate = async () => {
  try {
    isCreating.value = true;

    if (!userStore.user) {
      showCreate.value = true;
      return;
    }

    // Log runtime configuration for debugging
    const config = useRuntimeConfig();
    console.log('Runtime configuration before creating lobby:', {
      databaseId: config.public.appwriteDatabaseId,
      lobbyCollectionId: config.public.appwriteLobbyCollectionId,
      playerCollectionId: config.public.appwritePlayerCollectionId
    });

    const activeLobby = await getActiveLobbyForUser(userStore.user.$id);
    if (activeLobby) {
      notify({
        title: 'Redirecting to your active game',
        color: 'info',
        icon: 'i-mdi-controller',
        duration: 2000,
      });
      await router.push(`/game/${activeLobby.code}`);
    } else {
      showCreate.value = true;
    }
  } catch (error: unknown) {
    // Check if it's an AppwriteException with collection not found error
    if (error instanceof Error &&
        'code' in error &&
        error.code === 404 &&
        error.message?.includes('Collection with the requested ID could not be found')) {
      console.warn('Collections not initialized, showing create dialog');
      showCreate.value = true;
      return;
    }

    console.error('Error checking for active lobby:', error);
    showCreate.value = true;
  } finally {
    isCreating.value = false;
  }
};

const checkForActiveLobbyAndJoin = async () => {
  try {
    isJoining.value = true;

    if (!userStore.user) {
      showJoin.value = true;
      return;
    }

    const activeLobby = await getActiveLobbyForUser(userStore.user.$id);
    if (activeLobby) {
      notify({
        title: 'Redirecting to your active game',
        color: 'info',
        icon: 'i-mdi-controller',
        duration: 2000,
      });
      await router.push(`/game/${activeLobby.code}`);
    } else {
      showJoin.value = true;
    }
  } catch (error: unknown) {
    // Check if it's an AppwriteException with collection not found error
    if (error instanceof Error &&
        'code' in error &&
        error.code === 404 &&
        error.message?.includes('Collection with the requested ID could not be found')) {
      console.warn('Collections not initialized, showing join dialog');
      showJoin.value = true;
      return;
    }

    console.error('Error checking for active lobby:', error);
    showJoin.value = true;
  } finally {
    isJoining.value = false;
  }
};

onMounted(() => {
  if (import.meta.client) {
    fetchNewCards();
  }
  console.log(client.config.project);
})
</script>

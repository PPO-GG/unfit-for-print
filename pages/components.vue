<script setup lang="ts">
import {ref} from "vue";
import UserHand from "~/components/game/UserHand.vue";
const cardFlipped = ref(true);
const props = {
  players: [
    {
      $id: 'player1',
      userId: 'player1',
      lobbyId: 'lobby123',
      name: 'Alice',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
      isHost: true,
      joinedAt: '2023-10-01T12:00:00Z',
      provider: 'google',
    },
    {
      $id: 'player2',
      userId: 'player2',
      lobbyId: 'lobby123',
      name: 'Bob',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
      isHost: true,
      joinedAt: '2023-10-01T12:00:00Z',
      provider: 'google',
    },
    {
      $id: 'player3',
      userId: 'player3',
      lobbyId: 'lobby123',
      name: 'Joe',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
      isHost: true,
      joinedAt: '2023-10-01T12:00:00Z',
      provider: 'google',
    },
  ],
  hostUserId: 'player1',
  lobbyId: 'lobby123',
	judgeId: 'player2',
  submissions: [
    { playerId: 'player1', cardId: 'card1', text: 'Mock submission 1' },
    { playerId: 'player3', cardId: 'card2', text: 'Mock submission 2' },
  ],
  gamePhase: 'submission', // or 'judging', 'roundEnd'
  scores: {
    player1: 2,
    player2: 1,
    player3: 3
  },
}
const cards = [
  { id: "card1", text: "Dick Fingers." },
  { id: "card2", text: "A surprising amount of sand." },
  { id: "card3", text: "Vigorous jazz hands." },
  { id: "card4", text: "A tiny horse." },
  { id: "card5", text: "My inner demons." },
  { id: "card6", text: "Grandma's ashes." },
  { id: "card7", text: "A pyramid of severed heads." }
]
const sliderValue = ref(2);
</script>

<template>
  <UContainer>
  <div class="p-8 gap-3 bg-transparent flex">
  <BlackCard
      @click="cardFlipped = !cardFlipped"
      card-id="1234"
      text="blackCard.text"
      cardPack=blackCard.pack
      :flipped="cardFlipped"
      :three-deffect=true
      :shine=true
      back-logo-url="/img/unfit_logo_alt.png"
      mask-url="/img/textures/hexa.png"
  />
    <WhiteCard
        @click="cardFlipped = !cardFlipped"
        card-id="1234"
        text="whiteCard.text"
        card-pack="whiteCard.pack"
        :flipped="cardFlipped"
        :three-deffect=true
        :shine=true
        back-logo-url="/img/unfit_logo_alt_dark.png"
        mask-url="/img/textures/hexa2.png"
    />
  </div>
  <PlayerList
      :players="props.players"
      :host-user-id="props.hostUserId"
      :lobby-id="props.lobbyId"
      :czar-id="props.judgeId"
      :scores="props.scores"
  />
    <USlider v-model="sliderValue" :min="1" :max="7" :default-value="2" class="w-64 mt-4" /><p>{{sliderValue}} cards</p>
  </UContainer>
  <UserHand
      :cards="cards"
			:cards-to-select=sliderValue
      :disabled=false
  />
<!--  <NewUserHand-->
<!--      :cards="cards"-->
<!--      :disabled=false-->
<!--      :cards-to-select=sliderValue-->
<!--  />-->
</template>

<style scoped>

</style>
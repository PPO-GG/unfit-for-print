<script setup lang="ts">
import { useLobbyActions } from "~/composables/useLobbyActions";

useHead({ title: "About · Unfit for Print" });

const {
  isJoining,
  isCreating,
  showJoin,
  showCreate,
  checkForActiveLobbyAndJoin,
  checkForActiveLobbyAndCreate,
  handleJoined,
} = useLobbyActions();

const { t } = useI18n();
const userStore = useUserStore();

const gamePhases = [
  {
    icon: "i-mdi-account-group-outline",
    color: "text-sky-400",
    title: "Lobby Phase",
    description:
      "Players join the lobby, the host configures game settings, and the game begins once at least 3 players are ready.",
  },
  {
    icon: "i-mdi-cards",
    color: "text-violet-400",
    title: "Submission Phase",
    description:
      "The Judge waits while all other players secretly select one (or more) white cards from their hand in response to the black card prompt.",
  },
  {
    icon: "i-mdi-scale-balance",
    color: "text-amber-400",
    title: "Judging Phase",
    description:
      "All submissions are revealed anonymously. The Judge reviews every response and picks the funniest or most outrageous winner.",
  },
  {
    icon: "i-mdi-trophy",
    color: "text-emerald-400",
    title: "Round End",
    description:
      "The winning player earns a point. A new Judge is selected, hands are replenished, and the next round begins.",
  },
];

const faqItems = [
  {
    label: "How many players do I need?",
    content:
      "You need a minimum of 3 players to start a game. There's no hard upper limit, but larger groups make judging more hilarious.",
  },
  {
    label: "How do I join a game?",
    content:
      "Click \"Join Game\" in the navigation bar and enter the lobby code shared by your host. If you've played before and your session is still active, you'll be redirected back to your game automatically.",
  },
  {
    label: "Do I need an account to play?",
    content:
      "You can play as an anonymous player without an account. However, logging in with Discord unlocks persistent profiles, custom avatars, and the ability to create lobbies.",
  },
  {
    label: "How do I create a lobby?",
    content:
      'Click "Create Game" in the header. You\'ll need to be logged in with Discord. Once created, share the lobby code with your friends so they can join.',
  },
  {
    label: "What are card packs?",
    content:
      "Card packs are themed sets of black and white cards. The host can mix and match packs in the lobby settings to tailor the content to your group's preferences.",
  },
  {
    label: "What is a Spectator?",
    content:
      "Spectators can watch the game in real time without submitting cards or competing for points. The host can convert spectators to active participants at any time.",
  },
  {
    label: "What happens if I disconnect?",
    content:
      "Your session is persistent — simply rejoin the lobby using the same code and you'll be restored to your previous position in the game.",
  },
  {
    label: "How does the Judge role work?",
    content:
      "The Judge role rotates each round. When it's your turn, you sit out the card submission phase and instead review all anonymous submissions, picking your favourite to award the round point.",
  },
  {
    label: "Can I submit multiple white cards?",
    content:
      "Some black cards require multiple white cards (indicated by the pick number on the card). You'll need to select exactly that many before your submission is locked in.",
  },
  {
    label: "How do I win?",
    content:
      "The first player to reach the configured point limit (default: 10 points) wins the game. The host can adjust this in the lobby settings before starting.",
  },
  {
    label: "Can I host a private game?",
    content:
      "Yes! The host can set a password in the lobby settings to make the game private and invite friends by sharing the lobby code.",
  },
  {
    label: "I have an issue with a card.",
    content:
      "Every Card has a little card icon in the bottom left corner. Click it to bring up a popup to report the issue.",
  },
];

const navLinks = [
  { label: "How to Play", to: "#how-to-play" },
  { label: "Game Setup", to: "#game-setup" },
  { label: "Gameplay", to: "#gameplay" },
  { label: "Player Types", to: "#player-types" },
  { label: "Game Phases", to: "#game-phases" },
  { label: "FAQ", to: "#faq" },
];
</script>

<template>
  <div>
    <div class="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16">
      <UPage>
        <template #left>
          <UPageAside>
            <div class="space-y-6 justify-center items-center flex flex-col">
              <!-- Logo + tagline -->
              <div class="flex flex-col gap-2">
                <img
                  src="/img/ufp2.svg"
                  alt="Unfit for Print"
                  class="h-16 w-auto shrink-0"
                />
              </div>

              <USeparator />

              <!-- Section navigation -->
              <nav class="space-y-1">
                <p
                  class="text-2xl font-semibold text-muted uppercase tracking-widest mb-3"
                >
                  On this page
                </p>
                <NuxtLink
                  v-for="link in navLinks"
                  :key="link.to"
                  :to="link.to"
                  class="block text-xl text-muted hover:text-highlighted transition-colors duration-150 py-1"
                >
                  {{ link.label }}
                </NuxtLink>
              </nav>

              <USeparator />

              <!-- Quick links -->
              <div class="space-y-2 justify-center items-center flex flex-col">
                <p
                  class="text-2xl font-semibold text-muted uppercase tracking-widest mb-3"
                >
                  Quick links
                </p>
                <UButton
                  to="https://github.com/PPO-GG/unfit-for-print"
                  target="_blank"
                  icon="i-simple-icons-github"
                  variant="link"
                  color="neutral"
                  size="xl"
                  class="w-full text-left pl-0"
                >
                  GitHub
                </UButton>
                <UButton
                  to="/changelog"
                  icon="i-solar-clock-circle-bold-duotone"
                  variant="link"
                  color="neutral"
                  size="xl"
                  class="w-full text-left pl-0"
                >
                  Changelog
                </UButton>
              </div>
            </div>
          </UPageAside>
        </template>

        <UPageBody>
          <div class="mb-12 pb-10 border-b border-default">
            <h1 class="text-5xl font-bold tracking-tight text-highlighted mb-3">
              About Unfit for Print
            </h1>
            <p class="text-2xl text-muted max-w-2xl leading-relaxed">
              <strong class="text-default">Unfit for Print</strong> is an online
              party card game for 3+ players, built by
              <a
                href="https://ppo.gg"
                target="_blank"
                class="text-primary hover:underline"
                >MYND @ PPO.GG</a
              >. Fill in the blanks and let the Judge decide who's the most
              beautifully unhinged.
            </p>
            <p class="text-xs text-muted mt-2">
              * This is a fan-made project and is not affiliated with Cards
              Against Humanity LLC.
            </p>
          </div>

          <section id="how-to-play" class="mb-12 scroll-mt-20">
            <h2 class="text-4xl font-bold tracking-tight text-highlighted mb-1">
              How to Play
            </h2>
            <p class="text-muted mb-8 text-2xl">
              Everything you need to know to jump in and start playing.
            </p>

            <div id="game-setup" class="mb-10 scroll-mt-20">
              <h3
                class="text-4xl font-semibold text-highlighted mb-4 flex items-center gap-2"
              >
                <UIcon
                  name="i-solar-settings-bold-duotone"
                  class="text-primary"
                />
                Game Setup
              </h3>
              <ol class="space-y-4 text-xl">
                <li
                  v-for="(step, i) in [
                    'Create a new Game.',
                    'Share the lobby code with friends so they can join.',
                    'The host configures game settings — point limit, cards per player, and which card packs to include.',
                    'Start the game once at least 3 players are ready.',
                  ]"
                  :key="i"
                  class="flex items-start gap-4"
                >
                  <span
                    class="flex-shrink-0 w-7 h-7 rounded-full bg-primary/15 text-primary text-sm font-bold flex items-center justify-center ring-1 ring-primary/30"
                    >{{ i + 1 }}</span
                  >
                  <p class="text-default leading-relaxed pt-0.5">{{ step }}</p>
                </li>
              </ol>
            </div>

            <div id="gameplay" class="mb-10 scroll-mt-20">
              <h3
                class="text-4xl font-semibold text-highlighted mb-4 flex items-center gap-2"
              >
                <UIcon
                  name="i-solar-gamepad-bold-duotone"
                  class="text-secondary"
                />
                Gameplay
              </h3>
              <ol class="space-y-4 text-xl">
                <li
                  v-for="(step, i) in [
                    'Each round, one player is designated as the Judge (role rotates every round).',
                    'The Judge reveals a black card — a prompt or fill-in-the-blank statement.',
                    'All other players secretly pick one or more white cards from their hand to respond.',
                    'The Judge reviews all anonymous submissions and picks the funniest or most outrageous.',
                    'The winner earns a point. First to the point limit wins the game.',
                  ]"
                  :key="i"
                  class="flex items-start gap-4"
                >
                  <span
                    class="flex-shrink-0 w-7 h-7 rounded-full bg-secondary/15 text-secondary text-sm font-bold flex items-center justify-center ring-1 ring-secondary/30"
                    >{{ i + 1 }}</span
                  >
                  <p class="text-default leading-relaxed pt-0.5">{{ step }}</p>
                </li>
              </ol>
            </div>

            <div id="player-types" class="mb-2 scroll-mt-20">
              <h3
                class="text-4xl font-semibold text-highlighted mb-4 flex items-center gap-2"
              >
                <UIcon
                  name="i-solar-users-group-two-rounded-bold-duotone"
                  class="text-amber-400"
                />
                Player Types
              </h3>
              <div class="grid sm:grid-cols-3 gap-4">
                <div
                  v-for="type in [
                    {
                      icon: 'i-solar-user-bold-duotone',
                      color: 'text-violet-400',
                      bg: 'bg-violet-400/10 ring-violet-400/20',
                      title: 'Participant',
                      desc: 'Active players who submit cards and compete for points each round.',
                    },
                    {
                      icon: 'i-solar-eye-bold-duotone',
                      color: 'text-sky-400',
                      bg: 'bg-sky-400/10 ring-sky-400/20',
                      title: 'Spectator',
                      desc: 'Observers who watch the game live but don\'t submit cards or earn points.',
                    },
                    {
                      icon: 'i-solar-crown-bold-duotone',
                      color: 'text-amber-400',
                      bg: 'bg-amber-400/10 ring-amber-400/20',
                      title: 'Host',
                      desc: 'The lobby creator with special privileges: configuring settings and managing players.',
                    },
                  ]"
                  :key="type.title"
                  :class="['rounded-xl p-4 ring-1', type.bg]"
                >
                  <UIcon
                    :name="type.icon"
                    :class="['text-2xl mb-2', type.color]"
                  />
                  <p class="font-semibold text-highlighted text-2xl mb-1">
                    {{ type.title }}
                  </p>
                  <p class="text-lg text-muted leading-relaxed">
                    {{ type.desc }}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section id="game-phases" class="mb-12 scroll-mt-20">
            <h2 class="text-4xl font-bold tracking-tight text-highlighted mb-1">
              Game Phases
            </h2>
            <p class="text-muted mb-6 text-2xl">
              Each round flows through four predictable phases.
            </p>

            <div class="relative">
              <!-- Connecting line -->
              <div
                class="absolute left-5 top-6 bottom-6 w-px bg-gradient-to-b from-sky-400 via-violet-400 via-amber-400 to-emerald-400 opacity-30 hidden sm:block"
              />

              <div class="space-y-6">
                <div
                  v-for="(phase, i) in gamePhases"
                  :key="phase.title"
                  class="flex items-start gap-5"
                >
                  <div
                    class="flex-shrink-0 w-10 h-10 rounded-full bg-white/5 ring-1 ring-white/10 flex items-center justify-center"
                  >
                    <UIcon
                      :name="phase.icon"
                      :class="['text-xl', phase.color]"
                    />
                  </div>
                  <div
                    class="flex-1 rounded-xl p-4 bg-white/3 backdrop-blur-sm ring-1 ring-white/8"
                  >
                    <p class="font-semibold text-highlighted mb-1 text-2xl">
                      <span class="text-muted font-normal mr-2 text-sm">{{
                        String(i + 1).padStart(2, "0")
                      }}</span>
                      {{ phase.title }}
                    </p>
                    <p class="text-lg text-muted leading-relaxed">
                      {{ phase.description }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="faq" class="mb-12 scroll-mt-20">
            <h2 class="text-4xl font-bold tracking-tight text-highlighted mb-1">
              FAQ
            </h2>
            <p class="text-muted mb-6 text-2xl">Frequently asked questions.</p>

            <UAccordion
              :items="faqItems"
              :ui="{
                root: 'divide-y divide-default',
                item: 'py-1',
                trigger:
                  'font-medium hover:text-highlighted transition-colors py-3 text-2xl',
                content:
                  'data-[state=open]:animate-[accordion-down_200ms_ease-out_forwards] data-[state=closed]:animate-[accordion-up_200ms_ease-out_forwards] overflow-hidden',
                body: 'text-xl text-muted leading-relaxed pb-4',
              }"
            />
          </section>

          <div
            class="rounded-2xl p-6 bg-primary/8 ring-1 ring-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div>
              <p class="font-semibold text-highlighted text-2xl">
                Ready to play?
              </p>
              <p class="text-xl text-muted">
                Jump into a game now — no account required.
              </p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <UButton
                :loading="isJoining"
                icon="i-solar-hand-shake-line-duotone"
                color="primary"
                variant="subtle"
                size="md"
                @click="checkForActiveLobbyAndJoin"
              >
                Join a Game
              </UButton>

              <UButton
                :disabled="!isAuthenticatedUser(userStore.user)"
                :loading="isCreating"
                :icon="
                  isAuthenticatedUser(userStore.user)
                    ? 'i-solar-magic-stick-3-bold-duotone'
                    : 'i-solar-lock-keyhole-bold-duotone'
                "
                color="warning"
                variant="subtle"
                size="md"
                @click="checkForActiveLobbyAndCreate"
              >
                {{
                  isAuthenticatedUser(userStore.user)
                    ? "Create a Game"
                    : "Login to Create"
                }}
              </UButton>
            </div>
          </div>
        </UPageBody>
      </UPage>
    </div>

    <UModal v-model:open="showJoin" :title="t('modal.join_lobby')">
      <template #body>
        <JoinLobbyForm @joined="handleJoined" />
      </template>
    </UModal>

    <UModal v-model:open="showCreate" :title="t('modal.create_lobby')">
      <template #body>
        <CreateLobbyDialog @created="handleJoined" />
      </template>
    </UModal>
  </div>
</template>

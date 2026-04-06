<template>
  <div class="hub-root">
    <!-- Header -->
    <div class="hub-header">
      <img src="/img/ufp2.svg" alt="Unfit For Print" class="hub-logo" />
      <div class="hub-channel" v-if="channelId">
        Voice Channel
      </div>
    </div>

    <!-- VC Join Nudge -->
    <Transition name="nudge">
      <div v-if="nudgeUser" class="nudge">
        <span class="nudge-icon">👋</span>
        <span><strong>{{ nudgeUser }}</strong> just joined the voice channel</span>
      </div>
    </Transition>

    <div class="hub-layout">
      <!-- Left column: VC Members -->
      <div class="col-left">
        <div class="panel">
          <div class="panel-label">
            Voice Channel <span class="count">{{ vcParticipants.length }}</span>
          </div>
          <div class="vc-list">
            <div
              v-for="participant in vcParticipants"
              :key="participant.id"
              class="vc-row"
              :class="{ 'vc-row--dimmed': recentJoins.has(participant.id) }"
            >
              <div class="vc-avatar">
                <img
                  v-if="participant.avatarUrl"
                  :src="participant.avatarUrl"
                  :alt="participant.username"
                />
                <span v-else>{{ participant.username.charAt(0).toUpperCase() }}</span>
              </div>
              <div class="vc-name">{{ participant.username }}</div>
              <span v-if="getParticipantStatus(participant.id) === 'host'" class="vc-tag tag--host">HOST</span>
              <span v-if="getParticipantStatus(participant.id) === 'ingame'" class="vc-tag tag--ingame">IN GAME</span>
              <span v-else-if="getParticipantStatus(participant.id) === 'not-joined'" class="vc-tag tag--notjoined">NOT JOINED</span>
              <span v-if="recentJoins.has(participant.id)" class="vc-tag tag--new">JUST JOINED</span>
            </div>
            <div v-if="vcParticipants.length === 0" class="vc-empty">
              No one else is here yet
            </div>
          </div>
        </div>
      </div>

      <!-- Right column: Games + Actions -->
      <div class="col-right">
        <!-- Active Games -->
        <div v-for="lobby in channelLobbies" :key="lobby.$id" class="panel panel--accent">
          <div class="panel-label">Active Game</div>
          <div class="game-card">
            <div class="game-info">
              <h3>{{ getLobbyDisplayName(lobby) }}</h3>
              <div class="game-meta">
                {{ lobby.status === 'playing' ? 'In Progress' : 'Waiting' }}
              </div>
            </div>
            <button class="btn btn--join" @click="handleJoin(lobby)">
              Join
            </button>
          </div>
        </div>

        <!-- No games message -->
        <div v-if="channelLobbies.length === 0 && !loading" class="panel">
          <div class="no-games">
            No active games in this channel. Create one!
          </div>
        </div>

        <!-- Privacy Toggle (only shown when user is host of a lobby) -->
        <div v-if="hostedLobby" class="panel">
          <div class="privacy-row">
            <span>VC Members Only</span>
            <button
              class="toggle-track"
              :class="{ 'toggle--on': hostedLobby.vcOnly !== false }"
              @click="togglePrivacy"
            >
              <div class="toggle-thumb" />
            </button>
          </div>
          <div class="privacy-hint">
            When off, the game appears in the public lobby browser
          </div>
        </div>

        <!-- Actions -->
        <button v-if="hostedLobby" class="btn btn--resume" @click="router.replace(`/game/${hostedLobby.code}`)">
          Resume My Game
        </button>
        <button v-else class="btn btn--create" @click="handleCreate" :disabled="creating">
          {{ creating ? 'Creating...' : 'Create New Game' }}
        </button>

        <div v-if="createError" class="create-error">{{ createError }}</div>

        <button class="btn btn--invite" @click="inviteFriends">
          Invite Friends
        </button>

        <button class="btn btn--close" @click="close">
          Close Activity
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useUserStore } from '~/stores/userStore'
import { useLobby } from '~/composables/useLobby'
import type { Lobby } from '~/types/lobby'
import type { DiscordParticipant } from '~/composables/useDiscordSDK'

definePageMeta({ layout: 'activity' })

const router = useRouter()
const userStore = useUserStore()
const {
  vcParticipants: realVcParticipants,
  channelId: realChannelId,
  isDiscordActivity,
  inviteFriends,
  close,
  getSdk,
} = useDiscordSDK()

// Dev mode: mock data when accessing outside Discord Activity
const isDevMode = import.meta.dev && !isDiscordActivity.value
const mockParticipants: DiscordParticipant[] = [
  { id: 'dev-1', username: 'Dylan', avatar: null, avatarUrl: null, global_name: 'Dylan', bot: false },
  { id: 'dev-2', username: 'Marcus', avatar: null, avatarUrl: null, global_name: 'Marcus', bot: false },
  { id: 'dev-3', username: 'Sarah', avatar: null, avatarUrl: null, global_name: 'Sarah', bot: false },
  { id: 'dev-4', username: 'Jake', avatar: null, avatarUrl: null, global_name: 'Jake', bot: false },
]
const vcParticipants = isDevMode ? ref(mockParticipants) : realVcParticipants
const channelId = isDevMode ? ref('dev-channel-123') : realChannelId

const {
  createLobby,
  joinLobby,
  getLobbiesByChannelId,
  updateLobbyPrivacy,
  getActiveLobbyForUser,
} = useLobby()

const channelLobbies = ref<Lobby[]>([])
const loading = ref(true)
const creating = ref(false)
const createError = ref<string | null>(null)
const nudgeUser = ref<string | null>(null)
const recentJoins = ref(new Set<string>())
let nudgeTimeout: ReturnType<typeof setTimeout> | null = null

// Track previous participant IDs to detect new arrivals
const prevParticipantIds = ref(new Set<string>())

// The lobby the current user is hosting (if any)
const hostedLobby = computed(() => {
  const userId = userStore.user?.$id
  if (!userId) return null
  return channelLobbies.value.find((l) => l.hostUserId === userId) ?? null
})

function getLobbyDisplayName(lobby: Lobby): string {
  return `Game ${lobby.code}`
}

function getParticipantStatus(discordId: string): 'host' | 'ingame' | 'not-joined' {
  // Check if this Discord user is the host or a player in any channel lobby
  // We match by Discord user ID stored in the lobby's hostUserId field
  // Note: Appwrite user IDs may differ from Discord IDs, so we check lobby
  // player lists via the Appwrite player collection when available.
  // For now, a simple check: if the participant's Discord ID matches any
  // lobby host's Discord identity, they're the host.
  for (const lobby of channelLobbies.value) {
    if (lobby.hostUserId === discordId) return 'host'
  }
  // Without a player-to-Discord mapping, we can't determine in-game status
  // precisely. We'll show "not-joined" by default.
  return 'not-joined'
}

async function loadChannelLobbies() {
  if (!channelId.value) return
  loading.value = true
  channelLobbies.value = await getLobbiesByChannelId(channelId.value)
  loading.value = false
}

async function handleCreate() {
  const userId = userStore.user?.$id
  if (!userId || creating.value) return

  createError.value = null
  creating.value = true
  try {
    const sdk = getSdk()
    const lobby = await createLobby(
      userId,
      `${userStore.user?.name ?? 'Unknown'}'s Game`,
      false,
      undefined,
      sdk?.instanceId ?? undefined,
      channelId.value ?? undefined,
      true, // vcOnly by default
    )
    if (lobby) {
      await router.replace(`/game/${lobby.code}`)
    }
  } catch (err: any) {
    console.error('[VC Hub] Failed to create lobby:', err)
    // If they already have an active lobby elsewhere, redirect them there
    if (err?.message?.includes('already have an active lobby')) {
      const existing = await getActiveLobbyForUser(userId).catch(() => null)
      if (existing) {
        await router.replace(`/game/${existing.code}`)
        return
      }
    }
    createError.value = err?.message ?? 'Failed to create game. Please try again.'
  } finally {
    creating.value = false
  }
}

async function handleJoin(lobby: Lobby) {
  try {
    await joinLobby(lobby.code, {
      username: userStore.user?.name ?? 'Unknown',
    })
    await router.replace(`/game/${lobby.code}`)
  } catch (err: any) {
    console.error('[VC Hub] Failed to join lobby:', err)
  }
}

async function togglePrivacy() {
  if (!hostedLobby.value) return
  const newValue = hostedLobby.value.vcOnly === false
  await updateLobbyPrivacy(hostedLobby.value.$id, newValue)
  // Refresh the list to get updated data
  await loadChannelLobbies()
}

// Watch for new VC participants and show nudge
watch(vcParticipants, (newList) => {
  const newIds = new Set(newList.map((p) => p.id))

  // Find genuinely new participants (not in previous set)
  if (prevParticipantIds.value.size > 0) {
    for (const p of newList) {
      if (!prevParticipantIds.value.has(p.id)) {
        // New participant joined
        recentJoins.value.add(p.id)
        nudgeUser.value = p.username

        if (nudgeTimeout) clearTimeout(nudgeTimeout)
        nudgeTimeout = setTimeout(() => {
          nudgeUser.value = null
          recentJoins.value.delete(p.id)
        }, 5000)
      }
    }
  }

  prevParticipantIds.value = newIds
}, { deep: true })

// Load lobbies on mount and poll every 10s
let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  // Initialize previous participants (everyone present at page load)
  prevParticipantIds.value = new Set(vcParticipants.value.map((p) => p.id))

  await loadChannelLobbies()

  pollTimer = setInterval(loadChannelLobbies, 10_000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  if (nudgeTimeout) clearTimeout(nudgeTimeout)
})
</script>

<style scoped>
.hub-root {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px;
  color: var(--ui-text);
}

/* Header */
.hub-header {
  text-align: center;
  padding: 12px 0 16px;
}
.hub-logo {
  width: 80px;
  height: auto;
  margin: 0 auto 8px;
}
.hub-channel {
  font-size: 0.8rem;
  color: var(--ui-text-muted, #94a3b8);
}

/* Panels — sidebar style */
.panel {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(100, 116, 139, 0.2);
  border-radius: 0.875rem;
  padding: 16px;
  margin-bottom: 0.85rem;
}
.panel--accent {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(15, 23, 42, 0.95));
  border-color: rgba(139, 92, 246, 0.35);
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
.panel-label {
  font-size: 0.75rem;
  color: var(--ui-text-dimmed, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.panel-label .count {
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
  font-size: 0.65rem;
  padding: 1px 7px;
  border-radius: 99px;
  font-weight: 600;
}

/* VC Members */
.vc-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.vc-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 8px;
  transition: background 0.15s ease;
}
.vc-row:hover {
  background: rgba(139, 92, 246, 0.06);
}
.vc-row--dimmed {
  opacity: 0.5;
}
.vc-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
  overflow: hidden;
}
.vc-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.vc-name {
  font-size: 0.9rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vc-tag {
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}
.tag--host {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.3);
}
.tag--ingame {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.2);
}
.tag--notjoined {
  color: var(--ui-text-dimmed, #64748b);
  background: rgba(100, 116, 139, 0.1);
  border: 1px solid rgba(100, 116, 139, 0.15);
}
.tag--new {
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.2);
  animation: pulse-glow 2s ease-in-out infinite;
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: none; }
  50% { box-shadow: 0 0 8px rgba(96, 165, 250, 0.3); }
}
.vc-empty {
  font-size: 0.85rem;
  color: var(--ui-text-dimmed, #64748b);
  text-align: center;
  padding: 12px 0;
}

/* Game Card */
.game-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.game-info h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ui-text, #f1f5f9);
}
.game-meta {
  font-size: 0.75rem;
  color: var(--ui-text-muted, #94a3b8);
  margin-top: 2px;
}
.no-games {
  font-size: 0.85rem;
  color: var(--ui-text-dimmed, #64748b);
  text-align: center;
  padding: 8px 0;
}

/* Buttons */
.btn {
  display: block;
  width: 100%;
  border: none;
  border-radius: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 0.95rem;
  padding: 12px 20px;
  letter-spacing: 0.02em;
  margin-bottom: 8px;
  text-align: center;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn--join {
  width: auto;
  background: #8b5cf6;
  color: #fff;
  padding: 10px 24px;
  border-radius: 10px;
  box-shadow: 0 0 12px rgba(139, 92, 246, 0.3);
  margin-bottom: 0;
}
.btn--join:hover { box-shadow: 0 0 20px rgba(139, 92, 246, 0.5); }
.btn--create {
  background: #16a34a;
  color: #fff;
  box-shadow: 0 0 16px rgba(22, 163, 74, 0.25);
}
.btn--create:hover { box-shadow: 0 0 24px rgba(22, 163, 74, 0.4); }
.btn--resume {
  background: #0284c7;
  color: #fff;
  box-shadow: 0 0 16px rgba(2, 132, 199, 0.25);
}
.btn--resume:hover { box-shadow: 0 0 24px rgba(2, 132, 199, 0.4); }
.create-error {
  font-size: 0.8rem;
  color: #f87171;
  text-align: center;
  padding: 8px 4px 0;
  margin-top: -4px;
}
.btn--invite {
  background: #5865f2;
  color: #fff;
  box-shadow: 0 0 12px rgba(88, 101, 242, 0.2);
}
.btn--invite:hover { box-shadow: 0 0 20px rgba(88, 101, 242, 0.4); }
.btn--close {
  background: transparent;
  border: 1px solid rgba(100, 116, 139, 0.2);
  color: var(--ui-text-dimmed, #64748b);
  font-size: 0.8rem;
  font-weight: 500;
  padding: 8px;
}

/* Privacy Toggle */
.privacy-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--ui-text-muted, #94a3b8);
}
.toggle-track {
  width: 36px;
  height: 20px;
  background: rgba(100, 116, 139, 0.3);
  border: none;
  border-radius: 99px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s ease;
}
.toggle--on {
  background: rgba(139, 92, 246, 0.5);
}
.toggle-thumb {
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: left 0.2s ease;
}
.toggle--on .toggle-thumb {
  left: 18px;
}
.privacy-hint {
  font-size: 0.7rem;
  color: var(--ui-text-dimmed, #64748b);
  margin-top: 4px;
}

/* Nudge Banner */
.nudge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(96, 165, 250, 0.08);
  border: 1px solid rgba(96, 165, 250, 0.15);
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 0.85rem;
  font-size: 0.8rem;
  color: #93c5fd;
}
.nudge-icon {
  font-size: 1.1rem;
}
.nudge-enter-active,
.nudge-leave-active {
  transition: all 0.3s ease;
}
.nudge-enter-from,
.nudge-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Responsive Layout */
.hub-layout {
  display: flex;
  flex-direction: column;
  gap: 0;
}
@media (min-width: 540px) {
  .hub-layout {
    flex-direction: row;
    gap: 0.85rem;
  }
  .col-left { flex: 1; }
  .col-right { flex: 1.1; }
}
</style>

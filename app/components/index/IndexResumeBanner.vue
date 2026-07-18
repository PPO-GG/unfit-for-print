<template>
  <NuxtLink
    v-if="activeLobby"
    :to="`/game/${activeLobby.code}`"
    class="panel index-resume"
  >
    <div class="index-resume-dots">
      <div
        v-for="(dot, i) in lobbyPlayers"
        :key="i"
        class="index-resume-dot"
        :style="{ background: dot.color }"
      >
        {{ dot.label }}
      </div>
    </div>
    <div class="index-resume-meta">
      <div class="index-resume-eyebrow font-mono">Resume</div>
      <div class="index-resume-name font-display">
        {{ activeLobby.name || activeLobby.code || "Your live lobby" }}
      </div>
      <div class="index-resume-sub font-cond">Tap to jump back in</div>
    </div>
    <BrandNeonButton
      variant="primary"
      class="index-resume-cta"
      @click.prevent="$router.push(`/game/${activeLobby.code}`)"
    >
      <BrandIcon name="bolt" :size="14" />
      Resume
    </BrandNeonButton>
  </NuxtLink>
</template>

<script setup lang="ts">
import { useUserStore } from "~/stores/userStore";
import { useLobby } from "~/composables/useLobby";
import { getAppwrite } from "~/utils/appwrite";
import { Query } from "appwrite";

const userStore = useUserStore();
const { getActiveLobbyForUser } = useLobby();
const config = useRuntimeConfig();

const activeLobby = ref<{ id: string; code: string; name?: string } | null>(null);
const lobbyPlayers = ref<{ label: string; color: string }[]>([]);

const colors = ["#f43f5e", "#f59e0b", "#22d3ee", "#84cc16", "#a855f7"];

watch(
  () => userStore.user?.$id,
  async (userId) => {
    if (!userId) {
      activeLobby.value = null;
      lobbyPlayers.value = [];
      return;
    }
    try {
      const lobby: any = await getActiveLobbyForUser(userId);
      if (lobby && lobby.$id) {
        activeLobby.value = { id: lobby.$id, code: lobby.code, name: lobby.name };
        await fetchLobbyPlayers(lobby.$id);
      } else {
        activeLobby.value = null;
        lobbyPlayers.value = [];
      }
    } catch (err) {
      console.warn("[IndexResumeBanner] active lobby lookup failed", err);
    }
  },
  { immediate: true },
);

async function fetchLobbyPlayers(lobbyId: string) {
  if (import.meta.server) return;
  const { tables } = getAppwrite();
  try {
    const res = await tables.listRows({
      databaseId: config.public.appwriteDatabaseId,
      tableId: config.public.appwritePlayerCollectionId,
      queries: [Query.equal("lobbyId", lobbyId), Query.limit(5)],
    });

    lobbyPlayers.value = res.rows.map((row: any, i) => {
      const name = row.name || "Unknown";
      const parts = name.trim().split(" ").filter(Boolean);
      let initials = "??";
      if (parts.length >= 2) {
        initials = (parts[0][0] + parts[1][0]).toUpperCase();
      } else if (parts.length === 1) {
        initials = parts[0].substring(0, 2).toUpperCase();
      }
      return {
        label: initials,
        color: colors[i % colors.length] || "#f43f5e",
      };
    });
  } catch (err) {
    console.warn("[IndexResumeBanner] Failed to fetch lobby players", err);
  }
}
</script>

<style scoped>
.index-resume {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-color: var(--accent-3);
  background: rgba(10, 13, 28, 0.85);
  transition:
    transform 140ms,
    border-color 140ms;
}
.index-resume:hover {
  transform: translateY(-1px);
  border-color: var(--accent);
}

.index-resume-dots {
  display: flex;
}

.index-resume-dot {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Archivo Black", sans-serif;
  font-size: 10px;
  border: 2px solid var(--bg-0);
  color: #0d0f1a;
}
.index-resume-dot + .index-resume-dot {
  margin-left: -8px;
}

.index-resume-meta {
  flex: 1;
  min-width: 0;
}

.index-resume-eyebrow {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--ink-muted);
}

.index-resume-name {
  font-size: 14px;
  line-height: 1.1;
  margin-top: 2px;
}

.index-resume-sub {
  font-size: 12px;
  color: var(--ink-dim);
  margin-top: 2px;
}

.index-resume-cta {
  padding: 8px 12px !important;
  font-size: 12px !important;
}
</style>

<template>
  <section class="lobby-player-grid lobby-panel lobby-panel-striped">
    <header class="lpg-header">
      <h1 class="lpg-title">{{ lobbyName || t("lobby.compact.untitled") }}</h1>
      <div class="lpg-share">
        <button class="lpg-code lpg-copy-code" :title="t('lobby.cards.copy_code')" @click="copyCode">
          <span class="lpg-code-text">{{ code }}</span>
          <UIcon :name="codeCopied ? 'i-solar-check-read-linear' : 'i-solar-copy-bold-duotone'" />
        </button>
        <button class="lb-btn lb-btn--secondary lb-btn--sm lpg-copy-link" @click="copyLink">
          <UIcon name="i-solar-link-bold-duotone" />
          {{ linkCopied ? t("lobby.cards.copied") : t("lobby.cards.copy_invite") }}
        </button>
      </div>
    </header>

    <div class="lpg-grid" :class="{ 'lpg-grid--crowded': players.length > 8 }">
      <LobbyPlayerCard
        v-for="pl in players"
        :key="pl.$id"
        :player="pl"
        :is-host-user="isHostUser"
        :is-me="pl.userId === myId"
        @kick="$emit('kick', $event)"
      />
      <LobbyPlayerCard
        v-for="n in openSeats"
        :key="`open-${n}`"
        :player="null"
        :is-host-user="isHostUser"
        @add-bot="$emit('add-bot')"
        @invite="copyLink"
      />
    </div>
  </section>
</template>

<script lang="ts" setup>
import type { Player } from "~/types/player";

const props = defineProps<{
  code: string;
  lobbyName: string;
  players: Player[];
  myId: string;
  isHostUser: boolean;
  maxSeats: number;
}>();

defineEmits<{
  (e: "add-bot"): void;
  (e: "kick", playerId: string): void;
}>();

const { t } = useI18n();
const { notify } = useNotifications();
const config = useRuntimeConfig();

const openSeats = computed(() => Math.max(0, props.maxSeats - props.players.length));

const codeCopied = ref(false);
const linkCopied = ref(false);

async function copy(text: string, flag: typeof codeCopied, successTitle: string) {
  if (typeof window === "undefined") return;
  try {
    await navigator.clipboard.writeText(text);
    flag.value = true;
    notify({ title: successTitle, color: "success", icon: "i-mdi-clipboard-check" });
    setTimeout(() => { flag.value = false; }, 1500);
  } catch {
    notify({ title: t("lobby.error_code_copied"), color: "error", icon: "i-mdi-alert-circle" });
  }
}

function copyCode() {
  return copy(props.code, codeCopied, t("lobby.code_copied"));
}

function copyLink() {
  return copy(`${config.public.baseUrl}/game/${props.code}`, linkCopied, t("lobby.link_copied"));
}
</script>

<style scoped>
.lobby-player-grid {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 16px 20px;
  overflow: hidden;
  container-type: size;
  container-name: lpg;
}
.lpg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  min-width: 0;
}
.lpg-title {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: "Archivo Black", sans-serif;
  font-size: 18px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--lb-ink);
}
.lpg-share { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.lpg-code {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border: 1.5px solid var(--lb-line-strong);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--lb-ink-dim);
  cursor: pointer;
}
.lpg-code:hover { border-color: var(--lb-accent); color: var(--lb-ink); }
.lpg-code:focus-visible { outline: 2px solid var(--lb-accent); outline-offset: 2px; }
.lpg-code-text {
  font-family: "Archivo Black", sans-serif;
  font-size: 16px;
  letter-spacing: 0.22em;
  color: var(--lb-accent);
}
.lpg-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  justify-items: center;
  align-content: safe center;
  gap: 18px;
  padding: 10px 10px 14px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--lb-line-strong) transparent;
}
@container lpg (min-width: 900px) {
  .lpg-grid { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); --lpc-max: 250px; }
}
.lpg-grid--crowded { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); --lpc-max: 200px; gap: 14px; }
</style>

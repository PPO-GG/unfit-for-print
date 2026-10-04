<script setup lang="ts">
import type { Lobby } from "~/types/lobby";
import type { Player } from "~/types/player";
import type { GameState } from "~/types/game";
import type { LobbySettings } from "~/composables/useLobbyReactive";
import { useReportProblem } from "~/composables/useReportProblem";

const open = defineModel<boolean>("open", { default: false });
const props = defineProps<{
  lobby: Lobby;
  players: Player[];
  state: GameState | null;
  settings: LobbySettings | null;
  isHost: boolean;
  myId: string;
}>();
const emit = defineEmits<{
  leave: [];
  "skip-judge": [];
  "skip-player": [playerId: string];
  "reset-game": [];
  "convert-spectator": [playerId: string];
}>();

const { t } = useI18n();
const { open: openReport } = useReportProblem();
// SettingsSlideover is not mounted globally on /game/* routes (app.vue), so
// the compact menu owns an instance for "My settings".
const settingsOpen = ref(false);
const copied = ref(false);

function report() {
  open.value = false;
  openReport();
}

function copyInvite() {
  if (!navigator.clipboard || !props.lobby?.code) return;
  navigator.clipboard
    .writeText(`${window.location.origin}/game/${props.lobby.code}`)
    .then(() => {
      copied.value = true;
      setTimeout(() => (copied.value = false), 2000);
    })
    .catch((err) => console.error("Failed to copy invite link:", err));
}
</script>

<template>
  <UDrawer
    v-model:open="open"
    direction="bottom"
    :title="t('compact.menu')"
    :ui="{ content: 'lobby-tokens max-h-[88dvh]', body: 'overflow-y-auto' }"
  >
    <template #body>
      <div class="cms-quick">
        <button type="button" class="cms-quick-btn cms-report" @click="report">
          <Icon name="i-solar-danger-triangle-linear" />
          {{ t("report.title", "Report a Problem") }}
        </button>
        <button type="button" class="cms-quick-btn cms-settings" @click="settingsOpen = true">
          <Icon name="i-solar-settings-linear" />
          {{ t("compact.my_settings") }}
        </button>
      </div>
      <GameSidebarContent
        mobile
        :lobby="lobby"
        :players="players"
        :state="state"
        :game-settings="settings"
        :is-host="isHost"
        :is-starting="false"
        :is-waiting="false"
        :joined-lobby="true"
        :my-id="myId"
        :copied="copied"
        @copy-link="copyInvite"
        @leave="emit('leave')"
        @convert-spectator="(id: string) => emit('convert-spectator', id)"
        @skip-player="(id: string) => emit('skip-player', id)"
        @skip-judge="emit('skip-judge')"
        @reset-game="emit('reset-game')"
        @close="open = false"
      />
    </template>
  </UDrawer>
  <SettingsSlideover v-model:open="settingsOpen" />
</template>

<style scoped>
.cms-quick {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}
.cms-quick-btn {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 12px;
  border: 1px solid var(--lb-line-strong);
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 600;
  font-size: 1rem;
  color: var(--lb-ink);
}
</style>

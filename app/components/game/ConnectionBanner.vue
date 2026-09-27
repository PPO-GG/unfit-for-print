<script lang="ts" setup>
import { computed } from "vue";
import { refDebounced } from "@vueuse/core";

// Tells the player their link to the lobby is down. Without it a dropped
// socket looks exactly like a frozen game: the doc stops changing and nothing
// says why, which is how it reached us as a "stuck" report.
const { t } = useI18n();
const { connectionState } = useLobbyDoc();

// "idle" is no lobby at all, not a broken one.
const down = computed(
  () => !["connected", "idle"].includes(connectionState.value),
);

// A heartbeat blip reconnects in well under a second; only a drop that
// outlasts that is worth interrupting the game for. Showing is debounced,
// hiding is not — the banner goes the moment the link is back.
const downSettled = refDebounced(down, 2000);
const visible = computed(() => down.value && downSettled.value);

const reload = () => window.location.reload();
</script>

<template>
  <Transition name="page">
    <div
      v-if="visible"
      role="status"
      aria-live="polite"
      class="fixed top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full bg-amber-500/95 px-4 py-2 text-sm font-medium text-slate-950 shadow-lg"
    >
      <UIcon name="svg-spinners:ring-resize" class="size-4 shrink-0" />
      <span>{{ t("game.reconnecting") }}</span>
      <UButton
        size="xs"
        color="neutral"
        variant="solid"
        :label="t('game.refresh_page')"
        @click="reload"
      />
    </div>
  </Transition>
</template>

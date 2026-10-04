<script setup lang="ts">
import type { Player } from "~/types/player";

const props = defineProps<{
  winnerId: string | null;
  players: Player[];
  scores: Record<string, number>;
  goal: number;
  round: number;
  skipped: boolean;
}>();
const { t } = useI18n();

function displayName(p: Player | undefined): string {
  return p?.name?.trim() || t("compact.player_fallback");
}

const winnerName = computed(() =>
  displayName(props.players.find((p) => p.userId === props.winnerId)),
);

const race = computed(() =>
  props.players
    .filter((p) => p.playerType !== "spectator")
    .map((p) => {
      const score = props.scores[p.userId] ?? 0;
      return {
        id: p.userId,
        name: displayName(p),
        score,
        pct: props.goal > 0 ? Math.min(100, (score / props.goal) * 100) : 0,
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
);
</script>

<template>
  <section class="cre">
    <p class="cre-kicker">
      {{ skipped ? t("game.prompt_skipped") : t("compact.round_won", { round }) }}
    </p>
    <h2 v-if="!skipped && winnerId" class="cre-winner">
      {{ t("compact.winner_plus", { name: winnerName }) }}
    </h2>
    <div class="cre-race">
      <p class="cre-label">{{ t("compact.race_to", { goal }) }}</p>
      <div
        v-for="row in race"
        :key="row.id"
        class="cre-row"
        :class="{ 'is-winner': !skipped && row.id === winnerId }"
      >
        <span class="cre-name">{{ row.name }}</span>
        <span class="cre-bar"><i :style="{ width: `${row.pct}%` }" /></span>
        <span class="cre-score">
          {{ row.score }}
          <em v-if="!skipped && row.id === winnerId" class="cre-plus">+1</em>
        </span>
      </div>
    </div>
    <div class="cre-timer" aria-hidden="true"><i /></div>
  </section>
</template>

<style scoped>
.cre {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 16px 8px;
  min-height: 0;
  overflow-y: auto;
}
.cre-kicker,
.cre-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lb-ink-dim);
  text-align: center;
}
.cre-label { text-align: left; margin-bottom: 2px; }
.cre-winner {
  margin: 0;
  text-align: center;
  font-family: "Archivo Black", sans-serif;
  font-size: 1.5rem;
  text-transform: uppercase;
  color: var(--lb-accent-yellow);
}
.cre-race { display: flex; flex-direction: column; gap: 6px; }
.cre-row {
  display: grid;
  grid-template-columns: minmax(0, 5.5rem) 1fr auto;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 1rem;
}
.cre-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cre-row.is-winner .cre-name { color: var(--lb-accent-yellow); }
.cre-bar {
  height: 8px;
  border-radius: 4px;
  background: var(--lb-line);
  overflow: hidden;
}
.cre-bar i {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: var(--lb-accent);
}
.cre-row.is-winner .cre-bar i { background: var(--lb-accent-yellow); }
.cre-plus {
  display: inline-block;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  font-style: normal;
  color: var(--lb-accent-lime);
}
.cre-timer {
  height: 4px;
  border-radius: 2px;
  background: var(--lb-line);
  overflow: hidden;
  margin-top: 4px;
}
/* Mirrors GameBoard's 5s auto-advance (scheduleNextRound(5000)). */
.cre-timer i {
  display: block;
  height: 100%;
  background: var(--lb-accent);
  transform-origin: left center;
  animation: cre-countdown 5s linear forwards;
}
@keyframes cre-countdown {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}
@media (prefers-reduced-motion: reduce) {
  .cre-timer { display: none; }
}
</style>

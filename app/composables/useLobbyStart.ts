import { computed, onScopeDispose, ref, watch, type Ref } from "vue";
import type { Player } from "~/types/player";

export const MIN_PLAYERS = 3;
export const COUNTDOWN_SECONDS = 5;

/**
 * Lobby ready/start rules and the auto-start countdown, shared by the desktop
 * start bar and the compact lobby so the two can never disagree about when a
 * game may start. Bots are always ready; every human must be.
 */
export function useLobbyStart(opts: {
  players: Ref<Player[]>;
  myId: Ref<string>;
  isHost: Ref<boolean>;
  isStarting: Ref<boolean>;
  onStart: () => void;
}) {
  const nonBots = computed(() =>
    opts.players.value.filter((p) => p.playerType !== "bot"),
  );
  const readyCount = computed(
    () => opts.players.value.filter((p) => p.playerType === "bot" || p.ready).length,
  );
  const allNonBotsReady = computed(
    () => nonBots.value.length > 0 && nonBots.value.every((p) => p.ready),
  );
  const enoughPlayers = computed(() => opts.players.value.length >= MIN_PLAYERS);
  const canStart = computed(() => enoughPlayers.value && allNonBotsReady.value);
  const myReady = computed(
    () => opts.players.value.find((p) => p.userId === opts.myId.value)?.ready ?? false,
  );

  const countdown = ref<number | null>(null);
  let timer: ReturnType<typeof setInterval> | null = null;
  let startFired = false;

  function clearTimer() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function fire() {
    if (startFired) return;
    startFired = true;
    opts.onStart();
  }

  function startCountdown() {
    clearTimer();
    startFired = false;
    countdown.value = COUNTDOWN_SECONDS;
    timer = setInterval(() => {
      if (countdown.value === null) return clearTimer();
      countdown.value -= 1;
      if (countdown.value <= 0) {
        clearTimer();
        if (opts.isHost.value) fire();
      }
    }, 1000);
  }

  function handleStart() {
    if (!canStart.value || opts.isStarting.value) return;
    clearTimer();
    fire();
  }

  watch(canStart, (now) => {
    if (now) {
      startCountdown();
    } else {
      clearTimer();
      countdown.value = null;
      startFired = false;
    }
  });

  // A start that fails flips isStarting back to false; re-arm so the host's
  // Start button (and a re-formed countdown) can fire again.
  watch(opts.isStarting, (now, before) => {
    if (before && !now) startFired = false;
  });

  onScopeDispose(clearTimer);

  return {
    enoughPlayers,
    allNonBotsReady,
    readyCount,
    canStart,
    myReady,
    countdown,
    handleStart,
  };
}

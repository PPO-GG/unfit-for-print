// app/composables/useDiscordPresence.ts

import { watch, onScopeDispose, type Ref } from "vue";
import type { GameState } from "~/types/game";

interface PresenceInput {
  phase: GameState["phase"];
  round: number;
  playerCount: number;
  startTimestamp: number | null;
}

export interface DiscordActivity {
  type: number;
  details: string;
  state: string;
  assets: {
    large_image: string;
    large_text: string;
    small_image: string;
    small_text: string;
  };
  timestamps?: { start: number };
  party: { size: [number, number] };
}

const MAX_PARTY_SIZE = 8;

export function mapGameStateToActivity(input: PresenceInput): DiscordActivity {
  const { phase, round, playerCount, startTimestamp } = input;
  const playerLabel = playerCount === 1 ? "1 player" : `${playerCount} players`;

  let details: string;
  let stateText: string;
  let smallText: string;

  switch (phase) {
    case "waiting":
      details = "In Lobby";
      stateText = playerLabel;
      smallText = "In Lobby";
      break;
    case "submitting":
    case "submitting-complete":
      details = `Playing Round ${round}`;
      stateText = `Picking cards \u2014 ${playerLabel}`;
      smallText = "Picking cards";
      break;
    case "judging":
      details = `Playing Round ${round}`;
      stateText = `Judging \u2014 ${playerLabel}`;
      smallText = "Judging";
      break;
    case "roundEnd":
      details = `Playing Round ${round}`;
      stateText = `Round results \u2014 ${playerLabel}`;
      smallText = "Round results";
      break;
    case "complete":
      details = "Game Over";
      stateText = playerLabel;
      smallText = "Game Over";
      break;
    default:
      details = "In Game";
      stateText = playerLabel;
      smallText = "In Game";
  }

  const activity: DiscordActivity = {
    type: 0,
    details,
    state: stateText,
    assets: {
      large_image: "large_image",
      large_text: "Unfit for Print",
      small_image: "small_image",
      small_text: smallText,
    },
    party: { size: [playerCount, MAX_PARTY_SIZE] },
  };

  if (startTimestamp != null) {
    activity.timestamps = { start: startTimestamp };
  }

  return activity;
}

interface UseDiscordPresenceOptions {
  phase: Ref<string>;
  round: Ref<number>;
  playerCount: Ref<number>;
}

export function useDiscordPresence(options: UseDiscordPresenceOptions) {
  const { isDiscordActivity, getSdk } = useDiscordSDK();

  if (!isDiscordActivity.value) return;

  let startTimestamp: number | null = null;

  function updatePresence() {
    const sdk = getSdk();
    if (!sdk) return;

    const phase = options.phase.value;
    const round = options.round.value;
    const playerCount = options.playerCount.value;

    // Set start timestamp on first transition out of waiting
    if (phase !== "waiting" && startTimestamp == null) {
      startTimestamp = Math.floor(Date.now() / 1000);
    }

    const activity = mapGameStateToActivity({
      phase,
      round,
      playerCount,
      startTimestamp,
    });

    sdk.commands.setActivity({ activity }).catch((err: unknown) => {
      console.warn("[Discord Presence] setActivity failed:", err);
    });
  }

  // Watch all three reactive inputs
  watch(
    [options.phase, options.round, options.playerCount],
    updatePresence,
    { immediate: true },
  );

  // Clear presence on scope disposal (navigating away from game page)
  onScopeDispose(() => {
    const sdk = getSdk();
    if (!sdk) return;
    sdk.commands.setActivity({ activity: null }).catch(() => {});
  });
}

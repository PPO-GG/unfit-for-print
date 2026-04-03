// app/composables/useDiscordPresence.ts

interface PresenceInput {
  phase: string;
  round: number;
  playerCount: number;
  startTimestamp: number | null;
}

interface DiscordActivity {
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

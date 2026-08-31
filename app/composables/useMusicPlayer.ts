import { ref } from "vue";

const MUSIC_PLAYLIST_ID = "PLRJLE319jodBWToEdKwnulvHgvvHX3doK";
const YT_API_URL = "https://www.youtube.com/iframe_api";
export const MUSIC_PLAYER_CONTAINER_ID = "music-player-yt-target";

let player: any = null;
let apiReadyPromise: Promise<void> | null = null;
let creatingPlayer: Promise<any> | null = null;
let pendingVolume = 70;

const isPlaying = ref(false);
const isReady = ref(false);

export function clampVolume(volume: number): number {
  return Math.min(100, Math.max(0, Math.round(volume)));
}

export function buildPlayerVars(playlistId: string) {
  return {
    listType: "playlist" as const,
    list: playlistId,
    autoplay: 0 as const,
    controls: 0 as const,
  };
}

function loadYouTubeApi(): Promise<void> {
  if (apiReadyPromise) return apiReadyPromise;

  apiReadyPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    if ((window as any).YT?.Player) {
      resolve();
      return;
    }

    const previousCallback = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve();
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${YT_API_URL}"]`,
    );
    if (existingScript) {
      // A tag is already present and hasn't errored — a failed attempt's
      // tag is removed from the DOM below, so finding one here means it's
      // still genuinely in flight (or about to invoke
      // onYouTubeIframeAPIReady above) — just wait for it.
      existingScript.addEventListener("error", () => {
        existingScript.remove();
        reject(new Error("Failed to load YouTube IFrame API"));
      });
      return;
    }

    const script = document.createElement("script");
    script.src = YT_API_URL;
    script.onerror = () => {
      // Remove the failed tag so a later retry creates a fresh <script>
      // instead of finding this dead one via the querySelector above and
      // waiting on an error event that will never fire again.
      script.remove();
      reject(new Error("Failed to load YouTube IFrame API"));
    };
    document.head.appendChild(script);
  }).catch((err) => {
    // A definite load failure (e.g. the script was blocked) must not leave
    // the API promise cached forever — clear it so a later call can retry.
    apiReadyPromise = null;
    throw err;
  });

  return apiReadyPromise;
}

function ensurePlayer(): Promise<any> {
  if (player) return Promise.resolve(player);
  if (creatingPlayer) return creatingPlayer;
  if (typeof window === "undefined") return Promise.resolve(null);

  creatingPlayer = loadYouTubeApi()
    .then(
      () =>
        new Promise((resolve) => {
          const YT = (window as any).YT;
          player = new YT.Player(MUSIC_PLAYER_CONTAINER_ID, {
            height: "0",
            width: "0",
            playerVars: buildPlayerVars(MUSIC_PLAYLIST_ID),
            events: {
              onReady: () => {
                isReady.value = true;
                player.setVolume(pendingVolume);
                resolve(player);
              },
              onStateChange: (event: any) => {
                isPlaying.value = event.data === YT.PlayerState.PLAYING;
              },
            },
          });
        }),
    )
    .catch((err) => {
      // Don't let a failed creation (API load failure, or the YT.Player
      // constructor throwing) permanently poison future attempts.
      creatingPlayer = null;
      player = null;
      throw err;
    });

  return creatingPlayer;
}

export function useMusicPlayer() {
  const play = async () => {
    const activePlayer = await ensurePlayer();
    activePlayer?.playVideo();
  };

  const pause = () => {
    player?.pauseVideo();
  };

  const toggle = () => {
    if (isPlaying.value) {
      pause();
    } else {
      // Fire-and-forget: play() may reject if the player fails to load or
      // construct. toggle() has no way to surface that to a caller, so
      // swallow it here rather than letting it become an unhandled
      // rejection — play() itself still rejects for callers that await it.
      void play().catch(() => {});
    }
  };

  const setVolume = (volume: number) => {
    pendingVolume = clampVolume(volume);
    player?.setVolume(pendingVolume);
  };

  return { play, pause, toggle, setVolume, isPlaying, isReady };
}

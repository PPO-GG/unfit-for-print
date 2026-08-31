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

  apiReadyPromise = new Promise((resolve) => {
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

    if (!document.querySelector(`script[src="${YT_API_URL}"]`)) {
      const script = document.createElement("script");
      script.src = YT_API_URL;
      document.head.appendChild(script);
    }
  });

  return apiReadyPromise;
}

function ensurePlayer(): Promise<any> {
  if (player) return Promise.resolve(player);
  if (creatingPlayer) return creatingPlayer;
  if (typeof window === "undefined") return Promise.resolve(null);

  creatingPlayer = loadYouTubeApi().then(
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
  );

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
      void play();
    }
  };

  const setVolume = (volume: number) => {
    pendingVolume = clampVolume(volume);
    player?.setVolume(pendingVolume);
  };

  return { play, pause, toggle, setVolume, isPlaying, isReady };
}

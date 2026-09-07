/**
 * Backs the host's "Shuffle packs" control, which rolls a random spread of
 * card packs instead of making the host toggle two dozen chips by hand.
 *
 * The control appears twice — on the Card Packs field in the settings drawer
 * and beside "Active Packs" in the lobby-room summary — so the roster load,
 * the roll and the Y.Doc write live here rather than in both components.
 *
 * The roster comes from `useCardPacks`, which is already a shared load-once
 * cache, so a second shuffle re-rolls without a second round trip. The write
 * goes through `mutations.updateSettings` exactly like `togglePack` does, and
 * replicates to every client over Yjs — there is no server route for this.
 */

import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useCardPacks } from "~/composables/useCardPacks";
import { useLobby } from "~/composables/useLobby";
import { useNotifications } from "~/composables/useNotifications";
import { useSfx } from "~/composables/useSfx";
import { SFX } from "~/config/sfx.config";
import { pickRandomPacks } from "~/utils/cardPacks";

export interface ShuffleResult {
  packs: string[];
  /** Combined white+black active cards across the rolled packs. */
  total: number;
}

export function useShufflePacks() {
  const { tiles, load } = useCardPacks();
  const { mutations } = useLobby();
  const { notify } = useNotifications();
  const { t } = useI18n();
  const { playSfx } = useSfx();
  const pending = ref(false);

  /**
   * Rolls a new pack selection and writes it to the lobby.
   *
   * `current` is fed back to `pickRandomPacks` as `exclude`, so clicking
   * Shuffle twice in a row doesn't light up the same chips. Returns null when
   * the roll could not be applied, leaving the existing packs untouched — a
   * shuffle that empties the deck would be worse than one that does nothing.
   */
  async function shuffle(current: string[] = []): Promise<ShuffleResult | null> {
    pending.value = true;
    try {
      // `load()` swallows its own errors and leaves the roster empty, which is
      // the same failure shape as a genuinely empty library.
      await load();
      const roster = tiles.value;
      const packs = pickRandomPacks(roster, { exclude: current });

      if (packs.length === 0) {
        notify({
          title: t("game.settings.shuffle_packs_error"),
          icon: "i-solar-danger-circle-bold-duotone",
          color: "error",
        });
        return null;
      }

      // Fires on the roll, not the click: the roster fetch sits in front of it
      // on the first shuffle, and a shuffle sound ahead of an error toast would
      // read as success. Every later roll is served from cache, so it lands
      // immediately. Same cue the deck-draw uses in GameBoard.
      playSfx(SFX.cardShuffle, { volume: 0.5 });

      const chosen = new Set(packs);
      const total = roster
        .filter((tile) => chosen.has(tile.pack))
        .reduce((sum, tile) => sum + tile.total, 0);

      await mutations.updateSettings({ cardPacks: packs });
      notify({
        title: t("game.settings.shuffle_packs_done", {
          packs: packs.length,
          cards: total.toLocaleString(),
        }),
        icon: "i-solar-shuffle-bold-duotone",
        color: "success",
      });

      return { packs, total };
    } finally {
      pending.value = false;
    }
  }

  return { shuffle, pending };
}

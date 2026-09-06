import { ref } from "vue";
import { useNotifications } from "~/composables/useNotifications";
import {
  diceSimilarity,
  normalizeCardText,
  type DuplicateCluster,
  type ScannableCard,
} from "~/utils/duplicateScan";

export const useCardSimilarity = () => {
  const { notify } = useNotifications();

  const processingAllSimilarCards = ref(false);
  const loadingSimilarity = ref(false);
  const similarCards = ref<any[]>([]);
  const duplicateClusters = ref<DuplicateCluster<any>[]>([]);
  const showSimilarCardsModal = ref(false);
  const selectedCard = ref<any>(null);
  const similarityThreshold = ref(0.7);

  /** 0–1 progress reported by the worker during a scan. */
  const scanProgress = ref(0);

  // ── Per-card similarity (used by the single-card modal path) ─────────────────
  const findSimilarCards = async (card: any, cardsList: any[]) => {
    loadingSimilarity.value = true;
    selectedCard.value = card;
    showSimilarCardsModal.value = true;
    similarCards.value = [];

    await new Promise((r) => setTimeout(r, 100));

    try {
      const results = [];
      const targetText = normalizeCardText(card.text);

      for (const otherCard of cardsList) {
        if (otherCard.id === card.id) continue;

        const similarity = diceSimilarity(
          targetText,
          normalizeCardText(otherCard.text),
        );

        if (similarity >= similarityThreshold.value) {
          results.push({
            ...otherCard,
            similarity,
            similarityScore: Math.round(similarity * 100),
          });
        }
      }

      similarCards.value = results.sort((a, b) => b.similarity - a.similarity);

      if (results.length === 0) {
        notify({
          title: "No Similar Cards",
          description: "No similar cards were found in the current list.",
          color: "info",
        });
        showSimilarCardsModal.value = false;
      }
    } catch (err) {
      console.error("Failed to find similar cards:", err);
      notify({
        title: "Error",
        description: "Failed to find similar cards.",
        color: "error",
      });
    } finally {
      loadingSimilarity.value = false;
    }
  };

  // ── Full scan via Web Worker ─────────────────────────────────────────────────
  /**
   * Offloads the scan to a dedicated Web Worker so Vue reactivity and the UI
   * stay unblocked. Results come back as clusters — N mutually-similar cards
   * are one group to review, not N² separate pairs.
   */
  const findAllSimilarCards = (
    cardsList: ScannableCard[],
    cardType: string,
    samePackOnly = false,
  ): Promise<void> => {
    return new Promise((resolve) => {
      processingAllSimilarCards.value = true;
      duplicateClusters.value = [];
      scanProgress.value = 0;

      // `new URL(..., import.meta.url)` rather than Vite's `?worker` helper:
      // under Nuxt's `_nuxt` base the helper emits a broken `@fs` path that
      // 404s in dev, taking the worker down with an empty error event.
      const worker = new Worker(
        new URL("../workers/cardSimilarity.worker.ts", import.meta.url),
        { type: "module" },
      );

      const finish = () => {
        processingAllSimilarCards.value = false;
        worker.terminate();
        resolve();
      };

      worker.onmessage = (event: MessageEvent) => {
        const data = event.data as {
          type: string;
          progress?: number;
          clusters?: DuplicateCluster<any>[];
          message?: string;
        };

        if (data.type === "progress") {
          scanProgress.value = data.progress ?? 0;
          return;
        }

        if (data.type === "result") {
          duplicateClusters.value = data.clusters ?? [];
          scanProgress.value = 1;
          finish();

          const count = duplicateClusters.value.length;
          if (count > 0) {
            const cards = duplicateClusters.value.reduce(
              (total, cluster) => total + cluster.cards.length,
              0,
            );
            notify({
              title: "Duplicates Found",
              description: `${count} group${count === 1 ? "" : "s"} covering ${cards} cards.`,
              color: "success",
            });
          } else {
            notify({
              title: "No Duplicates",
              description: "No cards were similar enough to flag.",
              color: "info",
            });
          }
          return;
        }

        if (data.type === "error") {
          console.error("Worker scan error:", data.message);
          notify({
            title: "Scan Error",
            description: data.message || "Failed to scan for similar cards.",
            color: "error",
          });
          finish();
        }
      };

      worker.onerror = (err: ErrorEvent) => {
        console.error("Worker crashed:", err);
        notify({
          title: "Scan Error",
          description: "The scan worker encountered an unexpected error.",
          color: "error",
        });
        finish();
      };

      // Only plain card data crosses the boundary — no Vue proxies.
      worker.postMessage({
        type: "scan",
        cards: JSON.parse(JSON.stringify(cardsList)),
        threshold: similarityThreshold.value,
        cardType,
        samePackOnly,
      });
    });
  };

  return {
    processingAllSimilarCards,
    loadingSimilarity,
    similarCards,
    duplicateClusters,
    showSimilarCardsModal,
    selectedCard,
    similarityThreshold,
    scanProgress,
    findSimilarCards,
    findAllSimilarCards,
  };
};

import { ref } from "vue";
import { compareTwoStrings } from "string-similarity";
import { useNotifications } from "~/composables/useNotifications";

export const useCardSimilarity = () => {
  const { notify } = useNotifications();

  const processingAllSimilarCards = ref(false);
  const loadingSimilarity = ref(false);
  const similarCards = ref<any[]>([]);
  const allSimilarPairs = ref<
    { card1: any; card2: any; similarity: number; similarityScore?: number }[]
  >([]);
  const showSimilarCardsModal = ref(false);
  const showAllSimilarCardsModal = ref(false);
  const selectedCard = ref<any>(null);
  const similarityThreshold = ref(0.7);

  /** 0–1 progress reported by the worker during a scan. */
  const scanProgress = ref(0);
  /** Human-readable pair counts reported mid-scan. */
  const scanStats = ref({ processed: 0, total: 0 });

  // ── Per-card similarity (used by the single-card modal path) ─────────────────
  const findSimilarCards = async (card: any, cardsList: any[]) => {
    loadingSimilarity.value = true;
    selectedCard.value = card;
    showSimilarCardsModal.value = true;
    similarCards.value = [];

    await new Promise((r) => setTimeout(r, 100));

    try {
      const results = [];
      const targetText = card.text.toLowerCase();

      for (const otherCard of cardsList) {
        if (otherCard.$id === card.$id) continue;

        const similarity = compareTwoStrings(
          targetText,
          otherCard.text.toLowerCase(),
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

  // ── Full-scan via Web Worker ──────────────────────────────────────────────────
  /**
   * Offloads the O(n²) scan to a dedicated Web Worker so the main thread
   * (and Vue reactivity / UI) stays completely unblocked during processing.
   *
   * Progress is reported ~every 1 % of pairs processed via `scanProgress`.
   */
  const findAllSimilarCards = (cardsList: any[]): Promise<void> => {
    return new Promise((resolve) => {
      processingAllSimilarCards.value = true;
      allSimilarPairs.value = [];
      scanProgress.value = 0;
      scanStats.value = { processed: 0, total: 0 };

      const worker = new Worker("/workers/cardSimilarity.worker.js");

      worker.onmessage = (event) => {
        const data = event.data as {
          type: string;
          progress?: number;
          processed?: number;
          total?: number;
          pairs?: any[];
          message?: string;
        };

        if (data.type === "progress") {
          scanProgress.value = data.progress ?? 0;
          scanStats.value = {
            processed: data.processed ?? 0,
            total: data.total ?? 0,
          };
          return;
        }

        if (data.type === "result") {
          allSimilarPairs.value = data.pairs ?? [];
          processingAllSimilarCards.value = false;
          scanProgress.value = 1;
          worker.terminate();

          if (allSimilarPairs.value.length > 0) {
            showAllSimilarCardsModal.value = true;
            notify({
              title: "Similar Cards Found",
              description: `Found ${allSimilarPairs.value.length} pairs of similar cards.`,
              color: "success",
            });
          } else {
            notify({
              title: "No Similar Cards",
              description:
                "No similar cards were found above the similarity threshold.",
              color: "info",
            });
          }

          resolve();
          return;
        }

        if (data.type === "error") {
          console.error("Worker scan error:", data.message);
          notify({
            title: "Scan Error",
            description: data.message || "Failed to scan for similar cards.",
            color: "error",
          });
          processingAllSimilarCards.value = false;
          worker.terminate();
          resolve();
        }
      };

      worker.onerror = (err) => {
        console.error("Worker crashed:", err);
        notify({
          title: "Scan Error",
          description: "The scan worker encountered an unexpected error.",
          color: "error",
        });
        processingAllSimilarCards.value = false;
        worker.terminate();
        resolve();
      };

      // Kick off the scan — only the plain card data is transferred (no Vue proxies)
      worker.postMessage({
        type: "scan",
        cards: JSON.parse(JSON.stringify(cardsList)),
        threshold: similarityThreshold.value,
      });
    });
  };

  return {
    processingAllSimilarCards,
    loadingSimilarity,
    similarCards,
    allSimilarPairs,
    showSimilarCardsModal,
    showAllSimilarCardsModal,
    selectedCard,
    similarityThreshold,
    scanProgress,
    scanStats,
    findSimilarCards,
    findAllSimilarCards,
  };
};

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

  const findSimilarCards = async (card: any, cardsList: any[]) => {
    loadingSimilarity.value = true;
    selectedCard.value = card;
    showSimilarCardsModal.value = true;
    similarCards.value = [];

    // Simulate slight delay for UI responsiveness
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

  const findAllSimilarCards = async (cardsList: any[]) => {
    processingAllSimilarCards.value = true;
    allSimilarPairs.value = [];

    // Allow UI to update
    await new Promise((r) => setTimeout(r, 100));

    try {
      const processedPairs = new Set<string>();
      const similarPairs = [];

      let totalPairs = 0;
      let filteredByLength = 0;

      for (let i = 0; i < cardsList.length; i++) {
        const card1 = cardsList[i];

        if (i % 100 === 0) {
          // just yield to event loop briefly
          await new Promise((r) => setTimeout(r, 0));
        }

        for (let j = i + 1; j < cardsList.length; j++) {
          const card2 = cardsList[j];
          totalPairs++;

          const pairKey = [card1.$id, card2.$id].sort().join("-");
          if (processedPairs.has(pairKey)) continue;

          const lengthDiff = Math.abs(card1.text.length - card2.text.length);
          const maxLength = Math.max(card1.text.length, card2.text.length);
          if (lengthDiff / maxLength > 0.3) {
            filteredByLength++;
            continue;
          }

          const similarity = compareTwoStrings(
            card1.text.toLowerCase(),
            card2.text.toLowerCase(),
          );

          if (similarity >= similarityThreshold.value) {
            similarPairs.push({
              card1,
              card2,
              similarity,
              similarityScore: Math.round(similarity * 100),
            });
            processedPairs.add(pairKey);
          }
        }
      }

      allSimilarPairs.value = similarPairs.sort(
        (a, b) => b.similarity - a.similarity,
      );

      console.debug(
        `Length prefiltering: ${filteredByLength}/${totalPairs} pairs skipped (${Math.round((filteredByLength / totalPairs) * 100)}% reduction)`,
      );
      console.debug(
        `Found ${similarPairs.length} similar pairs out of ${totalPairs - filteredByLength} compared (${Math.round((similarPairs.length / (totalPairs - filteredByLength)) * 100)}% match rate)`,
      );

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
    } catch (err) {
      console.error("Failed to find all similar cards:", err);
      notify({
        title: "Error",
        description: "Failed to find all similar cards.",
        color: "error",
      });
    } finally {
      processingAllSimilarCards.value = false;
    }
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
    findSimilarCards,
    findAllSimilarCards,
  };
};

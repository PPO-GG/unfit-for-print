<script setup lang="ts">
import { getAppwrite } from "~/utils/appwrite";
import { Query } from "appwrite";
import type { Databases } from "appwrite";
import { useNotifications } from "~/composables/useNotifications";
import { ref, computed, watch, onMounted } from "vue";
import { watchDebounced } from "@vueuse/core";
import stringSimilarity from "string-similarity";
import type { RadioGroupItem, RadioGroupValue } from "@nuxt/ui";
import { useCardSearch } from "~/composables/useCardSearch";

const { databases, tables } = getAppwrite();
const config = useRuntimeConfig();
const { notify } = useNotifications();

// Use the shared card search state
const { searchTerm, cardType } = useCardSearch();

const selectedPack = ref<string | undefined>(undefined);
const availablePacks = ref<string[]>([]);
const cards = ref<any[]>([]);
const loading = ref(false);
const totalCards = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);
const showEditModal = ref(false);
const editingCard = ref<any>(null);
const newCardText = ref("");
const editingCardPicks = ref(1);
const numPick = ref(1);

// Add single card feature
const showAddCardModal = ref(false);
const newSingleCardText = ref("");
const newSingleCardPack = ref("");
const newSingleCardType = ref<"white" | "black">("white");
const newSingleCardPicks = ref(1);

// Similar cards feature
const showSimilarCardsModal = ref(false);
const selectedCard = ref<any>(null);
const similarCards = ref<any[]>([]);
const cardToKeep = ref<string>("original"); // 'original' or 'similar'
const similarityThreshold = ref(0.7); // Similarity threshold (0.0 to 1.0)

// All similar cards feature
const showAllSimilarCardsModal = ref(false);
const allSimilarPairs = ref<{ card1: any; card2: any; similarity: number }[]>(
  [],
);
const currentPairIndex = ref(0);
const processingAllSimilarCards = ref(false);

// Radio group options
const similarCardOptions = ref<RadioGroupItem[]>([
  {
    label: "Original Card",
    id: "original",
  },
  {
    label: "Similar Card",
    id: "similar",
  },
]);

const allSimilarCardOptions = ref<RadioGroupItem[]>([
  {
    label: "Card 1",
    id: "card1",
  },
  {
    label: "Card 2",
    id: "card2",
  },
]);

// Computed property to determine the active status of the selected pack
const selectedPackStatus = computed(() => {
  if (!selectedPack.value) return null;

  const packCards = cards.value.filter(
    (card) => card.pack === selectedPack.value,
  );
  if (packCards.length === 0) return null;

  const activeCount = packCards.filter((card) => card.active).length;

  if (activeCount === 0) return "inactive";
  if (activeCount === packCards.length) return "active";
  return "partial";
});

const DB_ID = config.public.appwriteDatabaseId;

const CARD_COLLECTIONS = {
  black: config.public.appwriteBlackCardCollectionId as string,
  white: config.public.appwriteWhiteCardCollectionId as string,
};
const CARD_COLLECTION = computed(() => CARD_COLLECTIONS[cardType.value]);

// Computed property to determine if numPick input should be disabled
const isNumPickDisabled = computed(() => cardType.value === "white");

// Fetch available card packs on mount
onMounted(async () => {
  if (!databases) return;
  try {
    // First get total count of cards
    const countResult = await tables.listRows({
      databaseId: DB_ID,
      tableId: CARD_COLLECTION.value,
      queries: [Query.limit(1)],
    });
    const totalCards = countResult.total;

    // Fetch all cards to extract packs (using a reasonable chunk size)
    const chunkSize = 1000;
    const allPacks = new Set<string>();

    // Fetch cards in chunks to get all packs
    for (let offset = 0; offset < totalCards; offset += chunkSize) {
      const result = await tables.listRows({
        databaseId: DB_ID,
        tableId: CARD_COLLECTION.value,
        queries: [Query.limit(chunkSize), Query.offset(offset)],
      });

      // Extract packs from this chunk
      result.rows.forEach((doc) => {
        if (doc.pack) allPacks.add(doc.pack);
      });

      // If we got fewer documents than requested, we've reached the end
      if (result.rows.length < chunkSize) break;
    }

    availablePacks.value = Array.from(allPacks).sort();
    console.log(`Found ${availablePacks.value.length} card packs`);

    // Initial fetch of cards
    await fetchCards();
  } catch (err) {
    console.error("Failed to load packs:", err);
  }
});

// Watch for card type changes to reload packs
watch(cardType, async () => {
  if (!databases) return;
  try {
    // First get total count of cards
    const countResult = await tables.listRows({
      databaseId: DB_ID,
      tableId: CARD_COLLECTION.value,
      queries: [Query.limit(1)],
    });
    const totalCards = countResult.total;

    // Fetch all cards to extract packs (using a reasonable chunk size)
    const chunkSize = 1000;
    const allPacks = new Set<string>();

    // Fetch cards in chunks to get all packs
    for (let offset = 0; offset < totalCards; offset += chunkSize) {
      const result = await tables.listRows({
        databaseId: DB_ID,
        tableId: CARD_COLLECTION.value,
        queries: [Query.limit(chunkSize), Query.offset(offset)],
      });

      // Extract packs from this chunk
      result.rows.forEach((doc) => {
        if (doc.pack) allPacks.add(doc.pack);
      });

      // If we got fewer documents than requested, we've reached the end
      if (result.rows.length < chunkSize) break;
    }

    availablePacks.value = Array.from(allPacks).sort();
    console.log(
      `Found ${availablePacks.value.length} card packs for ${cardType.value} cards`,
    );

    // Reset page and refetch cards
    currentPage.value = 1;
    await fetchCards();
  } catch (err) {
    console.error("Failed to load packs:", err);
  }
});

// Fetch cards
const fetchCards = async () => {
  if (!databases) return;
  loading.value = true;

  try {
    // First get total count of cards with filters applied
    const queries = [];

    // Apply filters for pack selection
    if (selectedPack.value) {
      queries.push(Query.equal("pack", selectedPack.value));
    }

    // Apply filter for numPick when card type is black
    if (cardType.value === "black" && numPick.value > 0) {
      queries.push(Query.equal("pick", numPick.value));
    }

    // Handle text search - try server-side search first, but be prepared to fall back to client-side filtering
    let useServerSideSearch = false;
    let clientSideFilterNeeded = false;

    if (searchTerm.value) {
      try {
        // Check if the search term might be an ID (no spaces, alphanumeric)
        const isIdSearch =
          /^[a-zA-Z0-9]+$/.test(searchTerm.value) &&
          !searchTerm.value.includes(" ");

        if (isIdSearch) {
          // If it looks like an ID, try to search by ID first
          queries.push(Query.search("$id", searchTerm.value));
        } else {
          // Otherwise, search by text content
          queries.push(Query.search("text", searchTerm.value));
        }
        useServerSideSearch = true;

        // Test the query to see if it works
        await tables.listRows({
          databaseId: DB_ID,
          tableId: CARD_COLLECTION.value,
          queries: [...queries, Query.limit(1)],
        });
      } catch (searchErr) {
        // If server-side search fails, remove the search query and note that we'll need client-side filtering
        // This is expected behavior if fulltext indexes are still being created or propagated
        console.info(
          "Using client-side filtering (fulltext indexes may still be propagating)",
        );
        queries.pop(); // Remove the search query
        useServerSideSearch = false;
        clientSideFilterNeeded = true;
      }
    }

    // First get count of matching cards (without search if we're doing client-side filtering)
    const countResult = await tables.listRows({
      databaseId: DB_ID,
      tableId: CARD_COLLECTION.value,
      queries: [...queries, Query.limit(1)],
    });
    let totalMatchingCards = countResult.total;

    // If no cards match the filters, return early
    if (totalMatchingCards === 0) {
      cards.value = [];
      currentPage.value = 1;
      loading.value = false;
      return;
    }

    // Fetch all matching cards in chunks
    const chunkSize = 1000;
    const allCards = [];

    // Fetch cards in chunks
    for (let offset = 0; offset < totalMatchingCards; offset += chunkSize) {
      const result = await tables.listRows({
        databaseId: DB_ID,
        tableId: CARD_COLLECTION.value,
        queries: [...queries, Query.limit(chunkSize), Query.offset(offset)],
      });

      allCards.push(...result.rows);

      // If we got fewer documents than requested, we've reached the end
      if (result.rows.length < chunkSize) break;
    }

    // Apply client-side text filtering if needed
    let filteredCards = allCards;
    if (clientSideFilterNeeded && searchTerm.value) {
      const searchTermLower = searchTerm.value.toLowerCase();
      filteredCards = allCards.filter(
        (card) =>
          // Search by text content
          card.text.toLowerCase().includes(searchTermLower) ||
          // Search by ID
          card.$id.toLowerCase().includes(searchTermLower),
      );
      // Only log this at debug level since it's expected behavior while indexes propagate
      if (filteredCards.length !== allCards.length) {
        console.debug(
          `Client-side filtering: ${filteredCards.length}/${allCards.length} cards match`,
        );
      }
    }

    cards.value = filteredCards;
    totalCards.value = filteredCards.length;

    // Reset to page 1 when fetching new cards
    currentPage.value = 1;

    // Use debug level for routine operation logs
    console.debug(
      `Fetched ${filteredCards.length}/${totalMatchingCards} cards`,
    );
  } catch (err) {
    console.error("Failed to fetch cards:", err);
  } finally {
    loading.value = false;
  }
};

// Filtered cards - now we're applying filters on the server side
// so this just returns all cards that were fetched
const filteredCards = computed(() => cards.value);

// Paginated cards
const paginatedCards = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredCards.value.slice(start, end);
});

// Total pages for pagination
const totalPages = computed(() => {
  return Math.ceil(filteredCards.value.length / pageSize.value);
});

// Reset page when search or filter changes
watchDebounced(
  [searchTerm, selectedPack, numPick],
  () => {
    currentPage.value = 1;
    fetchCards();
  },
  { debounce: 500, maxWait: 1000 },
);

// Watch for card type changes
watch(cardType, (newType) => {
  currentPage.value = 1;

  // Reset numPick to default when switching to white cards
  if (newType === "white") {
    numPick.value = 1;
  }
});

// Add console log for debugging pagination
watch(currentPage, (newPage) => {
  console.debug(`Page changed to ${newPage}`);
});

const toggleCardActive = async (card: any) => {
  try {
    const updated = await tables.updateRow({
      databaseId: DB_ID,
      tableId: CARD_COLLECTION.value,
      rowId: card.$id,
      data: {
        active: !card.active,
      },
    });
    card.active = updated.active;
    notify({
      title: `Card ${updated.active ? "Activated" : "Deactivated"}`,
      description: card.text,
      color: "success",
    });
  } catch (err) {
    console.error("Failed to update card:", err);
    notify({
      title: "Update Failed",
      description: "Could not toggle card status.",
      color: "error",
    });
  }
};

const togglePackActive = async (pack: string, setActive: boolean) => {
  if (!pack) return;

  try {
    loading.value = true;

    // Get all cards from the selected pack
    const packCards = cards.value.filter((card) => card.pack === pack);

    // Update each card in the pack
    const updatePromises = packCards.map((card) =>
      tables.updateRow({
        databaseId: DB_ID,
        tableId: CARD_COLLECTION.value,
        rowId: card.$id,
        data: {
          active: setActive,
        },
      }),
    );

    await Promise.all(updatePromises);

    // Update local state
    packCards.forEach((card) => {
      card.active = setActive;
    });

    notify({
      title: `Pack ${setActive ? "Activated" : "Deactivated"}`,
      description: `All cards in "${pack}" pack have been ${setActive ? "activated" : "deactivated"}.`,
      color: "success",
    });
  } catch (err) {
    console.error("Failed to update pack:", err);
    notify({
      title: "Update Failed",
      description: "Could not toggle pack status.",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

const deleteCard = async (card: any) => {
  if (
    !confirm(`Are you sure you want to delete this card?\n\n"${card.text}"`)
  ) {
    return;
  }

  try {
    await tables.deleteRow({
      databaseId: DB_ID,
      tableId: CARD_COLLECTION.value,
      rowId: card.$id,
    });
    // Remove from local list
    cards.value = cards.value.filter((c) => c.$id !== card.$id);
    totalCards.value--;

    notify({
      title: "Card Deleted",
      description: "The card was successfully deleted.",
      color: "success",
    });
  } catch (err) {
    console.error("Failed to delete card:", err);
    notify({
      title: "Delete Failed",
      description: "Could not delete the card.",
      color: "error",
    });
  }
};

const openEditModal = (card: any) => {
  editingCard.value = card;
  newCardText.value = card.text;
  // Set picks value if it's a black card
  if (cardType.value === "black" && card.pick) {
    editingCardPicks.value = card.pick;
  } else {
    editingCardPicks.value = 1; // Default value
  }
  showEditModal.value = true;
};

const saveCardEdit = async () => {
  if (!editingCard.value || !newCardText.value.trim()) {
    return;
  }

  try {
    // Create update data object
    const updateData = {
      text: newCardText.value.trim(),
    };

    // Add pick property for black cards
    if (cardType.value === "black") {
      // @ts-ignore - Adding pick property dynamically
      updateData.pick = parseInt(editingCardPicks.value.toString()) || 1;
    }

    const updated = await tables.updateRow({
      databaseId: DB_ID,
      tableId: CARD_COLLECTION.value,
      rowId: editingCard.value.$id,
      data: updateData,
    });

    // Update in local list
    const index = cards.value.findIndex((c) => c.$id === updated.$id);
    if (index !== -1) {
      cards.value[index].text = updated.text;
      // Update pick value for black cards
      if (cardType.value === "black" && updated.pick) {
        cards.value[index].pick = updated.pick;
      }
    }

    showEditModal.value = false;
    editingCard.value = null;
    newCardText.value = "";
    editingCardPicks.value = 1; // Reset to default

    notify({
      title: "Card Updated",
      description: "The card was successfully updated.",
      color: "success",
    });
  } catch (err) {
    console.error("Failed to update card:", err);
    notify({
      title: "Update Failed",
      description: "Could not update the card.",
      color: "error",
    });
  }
};

// Function to add a single card to an existing pack
const addSingleCard = async () => {
  if (!newSingleCardText.value.trim() || !newSingleCardPack.value) {
    return;
  }

  try {
    loading.value = true;

    // Get the collection ID based on the selected card type
    const collectionId = CARD_COLLECTIONS[newSingleCardType.value];

    // Create card data object
    const cardData = {
      text: newSingleCardText.value.trim(),
      pack: newSingleCardPack.value,
      active: true, // Default to active
    };

    // Add pick property for black cards
    if (newSingleCardType.value === "black") {
      // @ts-ignore - Adding pick property dynamically
      cardData.pick = parseInt(newSingleCardPicks.value.toString()) || 1;
    }

    // Create the new card document
    const newCard = await tables.createRow({
      databaseId: DB_ID,
      tableId: collectionId,
      rowId: "unique()",
      data: cardData,
    });

    // Add to local list if the current view includes this pack and type
    if (
      cardType.value === newSingleCardType.value &&
      (!selectedPack.value || selectedPack.value === newSingleCardPack.value)
    ) {
      cards.value.unshift(newCard);
      totalCards.value++;
    }

    // Reset form and close modal
    showAddCardModal.value = false;
    newSingleCardText.value = "";
    newSingleCardPack.value = "";
    newSingleCardType.value = "white"; // Reset to default
    newSingleCardPicks.value = 1; // Reset to default

    notify({
      title: "Card Added",
      description: `New card added to pack "${newCard.pack}"`,
      color: "success",
    });
  } catch (err) {
    console.error("Failed to add card:", err);
    notify({
      title: "Add Failed",
      description: "Could not add the new card.",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

// Find similar cards function
const findSimilarCards = (card: any) => {
  loading.value = true;
  selectedCard.value = card;
  similarCards.value = [];

  try {
    // Get all cards of the same type (excluding the selected card)
    // Also ensure we only include cards that still exist (haven't been deleted)
    const otherCards = cards.value.filter((c) => c.$id !== card.$id);

    // Prefilter by text length to reduce the number of expensive comparisons
    const filteredOtherCards = otherCards.filter((otherCard) => {
      const lengthDiff = Math.abs(card.text.length - otherCard.text.length);
      const maxLength = Math.max(card.text.length, otherCard.text.length);
      // Skip if length difference is more than 30%
      return lengthDiff / maxLength <= 0.3;
    });

    // Log how many cards were filtered out
    console.debug(
      `Length prefiltering: ${filteredOtherCards.length}/${otherCards.length} cards remain after filtering (${Math.round((1 - filteredOtherCards.length / otherCards.length) * 100)}% reduction)`,
    );

    // Calculate similarity scores
    const similarities = filteredOtherCards.map((otherCard) => {
      const similarity = stringSimilarity.compareTwoStrings(
        card.text.toLowerCase(),
        otherCard.text.toLowerCase(),
      );
      return { card: otherCard, similarity };
    });

    // Filter by threshold and sort by similarity (highest first)
    const filteredSimilarities = similarities
      .filter((item) => item.similarity >= similarityThreshold.value)
      .sort((a, b) => b.similarity - a.similarity);

    // Extract just the cards
    similarCards.value = filteredSimilarities.map((item) => ({
      ...item.card,
      similarityScore: Math.round(item.similarity * 100), // Convert to percentage
    }));

    // Open the modal if similar cards are found
    if (similarCards.value.length > 0) {
      showSimilarCardsModal.value = true;
      cardToKeep.value = "original"; // Reset to default
    } else {
      notify({
        title: "No Similar Cards",
        description:
          "No similar cards were found above the similarity threshold.",
        color: "info",
      });
    }
  } catch (err) {
    console.error("Failed to find similar cards:", err);
    notify({
      title: "Error",
      description: "Failed to find similar cards.",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

// Find all similar cards across the database
const findAllSimilarCards = () => {
  processingAllSimilarCards.value = true;
  allSimilarPairs.value = [];
  currentPairIndex.value = 0;

  try {
    // Get all cards
    const allCards = cards.value;
    const processedPairs = new Set<string>(); // To avoid duplicate pairs
    const similarPairs = [];

    // Counters for tracking filtering effectiveness
    let totalPairs = 0;
    let filteredByLength = 0;

    // Compare each card with all other cards
    for (let i = 0; i < allCards.length; i++) {
      const card1 = allCards[i];

      // Progress update for large datasets
      if (i % 100 === 0) {
        console.log(`Processing card ${i} of ${allCards.length}`);
      }

      for (let j = i + 1; j < allCards.length; j++) {
        const card2 = allCards[j];
        totalPairs++;

        // Skip if we've already processed this pair
        const pairKey = [card1.$id, card2.$id].sort().join("-");
        if (processedPairs.has(pairKey)) continue;

        // Skip cards with very different lengths (unlikely to be similar)
        const lengthDiff = Math.abs(card1.text.length - card2.text.length);
        const maxLength = Math.max(card1.text.length, card2.text.length);
        if (lengthDiff / maxLength > 0.3) {
          filteredByLength++;
          continue; // Skip if length difference is more than 30%
        }

        // Calculate similarity
        const similarity = stringSimilarity.compareTwoStrings(
          card1.text.toLowerCase(),
          card2.text.toLowerCase(),
        );

        // Add to similar pairs if above threshold
        if (similarity >= similarityThreshold.value) {
          similarPairs.push({
            card1,
            card2,
            similarity,
            similarityScore: Math.round(similarity * 100), // Convert to percentage
          });
          processedPairs.add(pairKey);
        }
      }
    }

    // Sort by similarity (highest first)
    allSimilarPairs.value = similarPairs.sort(
      (a, b) => b.similarity - a.similarity,
    );

    // Log filtering statistics
    console.debug(
      `Length prefiltering: ${filteredByLength}/${totalPairs} pairs skipped (${Math.round((filteredByLength / totalPairs) * 100)}% reduction)`,
    );
    console.debug(
      `Found ${similarPairs.length} similar pairs out of ${totalPairs - filteredByLength} compared (${Math.round((similarPairs.length / (totalPairs - filteredByLength)) * 100)}% match rate)`,
    );

    // Open the modal if similar pairs are found
    if (allSimilarPairs.value.length > 0) {
      showAllSimilarCardsModal.value = true;
      cardToKeep.value = "card1"; // Reset to default

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

// Handle keeping one card and deleting the other
const handleSimilarCardAction = async (similarCard: any) => {
  try {
    loading.value = true;

    // Determine which card to delete based on user selection
    const cardToDelete =
      cardToKeep.value === "original" ? similarCard : selectedCard.value;

    // Delete the card
    await tables.deleteRow({
      databaseId: DB_ID,
      tableId: CARD_COLLECTION.value,
      rowId: cardToDelete.$id,
    });

    // Remove from local list
    cards.value = cards.value.filter((c) => c.$id !== cardToDelete.$id);
    totalCards.value--;

    // If we're deleting the original card, we need to update the selected card
    if (cardToKeep.value === "similar") {
      selectedCard.value = similarCard;
      // Remove the current similar card from the list
      similarCards.value = similarCards.value.filter(
        (c) => c.$id !== similarCard.$id,
      );
    } else {
      // Just remove the current similar card from the list
      similarCards.value = similarCards.value.filter(
        (c) => c.$id !== similarCard.$id,
      );
    }

    // Filter out any cards that have been deleted in other comparisons
    // This ensures we don't show cards that no longer exist
    similarCards.value = similarCards.value.filter((c) =>
      cards.value.some((card) => card.$id === c.$id),
    );

    // If no more similar cards, close the modal
    if (similarCards.value.length === 0) {
      showSimilarCardsModal.value = false;
      selectedCard.value = null;
    }

    notify({
      title: "Card Deleted",
      description: `The ${cardToKeep.value === "original" ? "similar" : "original"} card was deleted.`,
      color: "success",
    });
  } catch (err) {
    console.error("Failed to handle similar card action:", err);
    notify({
      title: "Action Failed",
      description: "Could not complete the requested action.",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

// Handle keeping one card and deleting the other for all similar cards
const handleAllSimilarCardAction = async () => {
  try {
    loading.value = true;

    if (
      allSimilarPairs.value.length === 0 ||
      currentPairIndex.value >= allSimilarPairs.value.length
    ) {
      return;
    }

    // Filter out any pairs that contain cards that have been deleted in other comparisons
    allSimilarPairs.value = allSimilarPairs.value.filter(
      (pair) =>
        cards.value.some((card) => card.$id === pair.card1.$id) &&
        cards.value.some((card) => card.$id === pair.card2.$id),
    );

    // If no more pairs after filtering, close the modal
    if (allSimilarPairs.value.length === 0) {
      showAllSimilarCardsModal.value = false;
      notify({
        title: "All Done",
        description: "No more similar cards to process.",
        color: "success",
      });
      loading.value = false;
      return;
    }

    // Adjust current index if needed after filtering
    if (currentPairIndex.value >= allSimilarPairs.value.length) {
      currentPairIndex.value = allSimilarPairs.value.length - 1;
    }

    const currentPair = allSimilarPairs.value[currentPairIndex.value];
    if (!currentPair) return;

    // Determine which card to delete based on user selection
    const cardToDelete =
      cardToKeep.value === "card1" ? currentPair.card2 : currentPair.card1;
    const cardToKeepObj =
      cardToKeep.value === "card1" ? currentPair.card1 : currentPair.card2;

    // Confirm deletion
    if (
      !confirm(
        `Are you sure you want to delete this card?\n\n"${cardToDelete.text}"\n\nAnd keep:\n"${cardToKeepObj.text}"`,
      )
    ) {
      loading.value = false;
      return;
    }

    // Delete the card
    await tables.deleteRow({
      databaseId: DB_ID,
      tableId: CARD_COLLECTION.value,
      rowId: cardToDelete.$id,
    });

    // Remove from local list
    cards.value = cards.value.filter((c) => c.$id !== cardToDelete.$id);
    totalCards.value--;

    // Remove the current pair from the list
    allSimilarPairs.value.splice(currentPairIndex.value, 1);

    // If no more pairs, close the modal
    if (allSimilarPairs.value.length === 0) {
      showAllSimilarCardsModal.value = false;
      notify({
        title: "All Done",
        description: "No more similar cards to process.",
        color: "success",
      });
    } else {
      // Adjust current index if needed
      if (currentPairIndex.value >= allSimilarPairs.value.length) {
        currentPairIndex.value = allSimilarPairs.value.length - 1;
      }

      notify({
        title: "Card Deleted",
        description: `Card deleted. ${allSimilarPairs.value.length} pairs remaining.`,
        color: "success",
      });
    }
  } catch (err) {
    console.error("Failed to handle similar card action:", err);
    notify({
      title: "Action Failed",
      description: "Could not complete the requested action.",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

// Navigation functions for all similar cards
const goToNextPair = () => {
  if (currentPairIndex.value < allSimilarPairs.value.length - 1) {
    currentPairIndex.value++;
  }
};

const goToPreviousPair = () => {
  if (currentPairIndex.value > 0) {
    currentPairIndex.value--;
  }
};

// Form states
const customPackState = reactive({
  packName: "",
  whiteCards: [""],
  blackCards: [{ text: "", pick: 1 }],
});

const uploadState = reactive({
  file: null as File | null,
  fileContent: null as string | null,
});

// Other reactive variables
const uploading = ref(false);
const submitting = ref(false);
const showPreview = ref(false);
const previewData = ref<any[]>([]);
const previewStats = ref<{
  packs: number;
  whiteCards: number;
  blackCards: number;
}>({
  packs: 0,
  whiteCards: 0,
  blackCards: 0,
});
const uploadProgress = ref(0);
const showProgress = ref(false);

// Handle file input change
const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  uploadState.file = target.files?.[0] || null;
};

// Parse JSON file and update preview
const parseJsonFile = async () => {
  if (!uploadState.file) return;

  try {
    // Read the file content
    uploadState.fileContent = await uploadState.file.text();

    // Parse the JSON
    const jsonData = JSON.parse(uploadState.fileContent);

    if (!Array.isArray(jsonData)) {
      throw new Error("Invalid JSON format: Expected an array of card packs");
    }

    // Update preview data
    previewData.value = jsonData;

    // Calculate statistics
    let totalWhiteCards = 0;
    let totalBlackCards = 0;

    for (const pack of jsonData) {
      totalWhiteCards += pack.white?.length || 0;
      totalBlackCards += pack.black?.length || 0;
    }

    previewStats.value = {
      packs: jsonData.length,
      whiteCards: totalWhiteCards,
      blackCards: totalBlackCards,
    };

    // Show preview
    showPreview.value = true;
  } catch (err) {
    console.error("Error parsing JSON file:", err);
    notify({
      title: "Invalid JSON",
      description:
        "The selected file contains invalid JSON or has an incorrect format.",
      color: "error",
    });

    // Reset
    uploadState.fileContent = null;
    showPreview.value = false;
  }
};
// Watch for file changes
watch(
  () => uploadState.file,
  (newFile) => {
    if (newFile) {
      parseJsonFile();
    } else {
      uploadState.fileContent = null;
      showPreview.value = false;
    }
  },
);

// Additional reactive state for detailed progress
const seedingStats = ref({
  totalCards: 0,
  totalPacks: 0,
  whiteCardCount: 0,
  blackCardCount: 0,
  insertedCards: 0,
  skippedDuplicates: 0,
  skippedSimilar: 0,
  skippedLongText: 0,
  failedCards: 0,
  currentPack: "",
  currentCardType: "",
  position: null as string | null,
  warnings: [] as string[],
  errors: [] as string[],
});

// For resuming from failures
const resumePosition = ref(null);
const showResumePrompt = ref(false);

const uploadJsonFile = async (resumeFromPosition: string | null = null) => {
  if (!uploadState.file || !uploadState.fileContent) {
    notify({
      title: "Upload Error",
      description: "No file selected or file content could not be read",
      color: "error",
    });
    return;
  }

  uploading.value = true;
  showProgress.value = true;
  uploadProgress.value = 0;

  // Reset stats
  seedingStats.value = {
    totalCards: 0,
    totalPacks: 0,
    whiteCardCount: 0,
    blackCardCount: 0,
    insertedCards: 0,
    skippedDuplicates: 0,
    skippedSimilar: 0,
    skippedLongText: 0, // Add counter for cards skipped due to text > 255 chars
    failedCards: 0,
    currentPack: "",
    currentCardType: "",
    position: null,
    warnings: [],
    errors: [],
  };

  // First send the data via POST request
  try {
    const payload: Record<string, string | null> = {
      file: uploadState.fileContent,
      sessionId: Date.now().toString(), // Generate a session ID
    };

    // Add resume position if provided
    if (resumeFromPosition) {
      payload.resumeFrom = resumeFromPosition;
    }

    // Send the initial POST request to submit the data
    const response = await fetch("/api/dev/seed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Check if the POST request was successful
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to submit data");
    }

    // Parse the response to get the session ID
    const responseData = await response.json();
    const sessionId = responseData.sessionId;

    if (!sessionId) {
      throw new Error("No session ID returned from server");
    }

    console.log(`Card seeding started with session ID: ${sessionId}`);

    // Now create the EventSource to listen for progress updates
    const eventSource = new EventSource(
      `/api/dev/seed/progress?sessionId=${sessionId}`,
    );

    // Set up event listeners
    eventSource.addEventListener("start", (event) => {
      const data = JSON.parse(event.data);
      console.log("Seeding started:", data.message);
    });

    eventSource.addEventListener("progress", (event) => {
      const data = JSON.parse(event.data);
      uploadProgress.value = data.progress;

      // Update detailed stats
      if (data.totalCards) seedingStats.value.totalCards = data.totalCards;
      if (data.totalPacks) seedingStats.value.totalPacks = data.totalPacks;
      if (data.whiteCardCount)
        seedingStats.value.whiteCardCount = data.whiteCardCount;
      if (data.blackCardCount)
        seedingStats.value.blackCardCount = data.blackCardCount;
      if (data.insertedCards)
        seedingStats.value.insertedCards = data.insertedCards;
      if (data.skippedDuplicates)
        seedingStats.value.skippedDuplicates = data.skippedDuplicates;
      if (data.skippedSimilar)
        seedingStats.value.skippedSimilar = data.skippedSimilar;
      if (data.skippedLongText)
        seedingStats.value.skippedLongText = data.skippedLongText; // Update skippedLongText counter
      if (data.failedCards) seedingStats.value.failedCards = data.failedCards;
      if (data.currentPack) seedingStats.value.currentPack = data.currentPack;
      if (data.currentCardType)
        seedingStats.value.currentCardType = data.currentCardType;
      if (data.position) seedingStats.value.position = data.position;
      if (data.warnings) seedingStats.value.warnings = data.warnings;
      if (data.errors) seedingStats.value.errors = data.errors;
    });

    eventSource.addEventListener("complete", (event) => {
      const data = JSON.parse(event.data);
      uploadProgress.value = 1;

      // Close the event source
      eventSource.close();

      // Show completion notification
      notify({
        title: "Upload Complete",
        description: data.message || "Seed complete.",
        color: "success",
      });

      // If there are warnings, show them
      if (data.warnings && data.warnings.length > 0) {
        console.log(
          `Seeding completed with ${data.warnings.length} warnings:`,
          data.warnings,
        );
      }

      // Reset preview after successful upload
      showPreview.value = false;

      // Hide progress bar after a delay
      setTimeout(() => {
        showProgress.value = false;
      }, 1000);

      uploading.value = false;
    });

    eventSource.addEventListener("error", (event) => {
      const msgEvent = event as MessageEvent;
      const data = msgEvent.data
        ? JSON.parse(msgEvent.data)
        : { message: "Unknown error occurred" };
      console.error("Seeding error:", data);

      // Close the event source
      eventSource.close();

      // If we have a resume position, store it
      if (data.resumePosition) {
        resumePosition.value = data.resumePosition;
        showResumePrompt.value = true;
      }

      // Show error notification
      notify({
        title: "Upload Failed",
        description: data.message || "Failed to seed cards",
        color: "error",
      });

      uploading.value = false;
    });

    // Handle general errors
    eventSource.onerror = (err) => {
      console.error("EventSource error:", err);
      eventSource.close();

      notify({
        title: "Connection Error",
        description: "Lost connection to the server",
        color: "error",
      });

      uploading.value = false;
      showProgress.value = false;
    };
  } catch (err: unknown) {
    console.error("Failed to initiate seeding:", err);

    notify({
      title: "Upload Failed",
      description:
        (err instanceof Error ? err.message : undefined) ||
        "Could not start the seeding process",
      color: "error",
    });

    uploading.value = false;
    showProgress.value = false;
  }
};

// Function to resume from a failure
const resumeUpload = () => {
  if (resumePosition.value) {
    uploadJsonFile(resumePosition.value);
    showResumePrompt.value = false;
  }
};
</script>

<template>
  <div class="space-y-4">
    <UInput
      v-model="searchTerm"
      placeholder="Search card text..."
      class="flex w-full"
      icon="i-solar-magnifer-broken"
    />
    <div class="flex items-center">
      <UFieldGroup class="w-full flex">
        <USelectMenu
          v-model="selectedPack"
          :items="availablePacks"
          placeholder="Filter by pack"
          clearable
          class="w-1/3"
        />
        <USelectMenu
          v-model="cardType"
          :items="['black', 'white']"
          class="w-1/3"
        />
        <UInputNumber
          v-model="numPick"
          :min="0"
          :max="10"
          :default-value="1"
          class="w-1/3"
          :disabled="isNumPickDisabled"
        />
      </UFieldGroup>
      <div class="flex items-center gap-2">
        <div v-if="selectedPack" class="flex gap-1">
          <UTooltip text="Activate all cards in this pack">
            <UButton
              color="success"
              variant="soft"
              icon="i-solar-check-circle-bold-duotone"
              size="sm"
              :disabled="selectedPackStatus === 'active'"
              @click="togglePackActive(selectedPack, true)"
            />
          </UTooltip>
          <UTooltip text="Deactivate all cards in this pack">
            <UButton
              color="error"
              variant="soft"
              icon="i-solar-close-circle-bold-duotone"
              size="sm"
              :disabled="selectedPackStatus === 'inactive'"
              @click="togglePackActive(selectedPack, false)"
            />
          </UTooltip>
          <div v-if="selectedPackStatus" class="ml-1 flex items-center">
            <UBadge
              v-if="selectedPackStatus === 'active'"
              color="success"
              variant="subtle"
              size="sm"
              >All Active</UBadge
            >
            <UBadge
              v-else-if="selectedPackStatus === 'inactive'"
              color="error"
              variant="subtle"
              size="sm"
              >All Inactive</UBadge
            >
            <UBadge v-else color="warning" variant="subtle" size="sm"
              >Partially Active</UBadge
            >
          </div>
        </div>
      </div>
    </div>

    <div class="flex justify-between items-center">
      <div class="text-sm text-gray-400">
        {{ totalCards }} total cards loaded
      </div>
      <div class="flex gap-2">
        <UButton
          color="success"
          icon="i-solar-add-circle-bold-duotone"
          @click="showAddCardModal = true"
        >
          Add Single Card
        </UButton>
        <UButton
          color="info"
          icon="i-solar-copy-bold-duotone"
          :loading="processingAllSimilarCards"
          @click="findAllSimilarCards"
        >
          Find All Similar Cards
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="space-y-3">
      <!-- Skeleton cards -->
      <div
        v-for="i in 5"
        :key="i"
        class="bg-slate-700 rounded p-4 flex justify-between items-center relative"
      >
        <div class="max-w-xl mb-4 w-full">
          <USkeleton class="h-5 w-full" />
          <USkeleton class="h-5 w-3/4 mt-2" />
        </div>
        <div class="flex gap-2 absolute left-0 bottom-0 m-2">
          <span class="ml-2 flex items-center">
            <USkeleton class="h-4 w-20" />
          </span>
          <span class="ml-2 flex items-center">
            <USkeleton class="h-4 w-20" />
          </span>
        </div>
        <div class="flex items-center gap-1">
          <USkeleton class="h-8 w-8 rounded" />
          <USkeleton class="h-8 w-8 rounded" />
          <USkeleton class="h-8 w-8 rounded" />
          <USkeleton class="h-8 w-8 rounded" />
        </div>
      </div>
    </div>

    <div v-else-if="!cards.length && (searchTerm || selectedPack)">
      <p class="text-gray-400 text-center py-8">
        No cards found matching your criteria.
      </p>
    </div>

    <div v-else-if="!cards.length">
      <p class="text-gray-400 text-center py-8">
        Enter a search term or select a pack to view cards.
      </p>
    </div>

    <ul v-else class="space-y-3">
      <li
        v-for="card in paginatedCards"
        :key="card.$id"
        class="bg-slate-700 rounded p-4 flex justify-between items-center relative"
      >
        <div class="text-sm font-mono text-white max-w-xl mb-4">
          {{ card.text }}
        </div>
        <div class="flex gap-2 absolute left-0 bottom-0 m-2">
          <span class="ml-2 text-xs text-slate-400 flex items-center">
            <UIcon
              name="i-solar-inbox-line-bold-duotone"
              class="mr-1 text-info-300"
            />
            ({{ card.pack }})
          </span>
          <span class="ml-2 text-xs text-slate-400 flex items-center">
            <UIcon
              name="i-solar-info-square-bold-duotone"
              class="mr-1 text-info-300"
            />
            ({{ card.$id }})
          </span>
        </div>
        <div class="flex items-center gap-1">
          <USwitch v-model="card.active" @click.stop="toggleCardActive(card)" />
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-solar-pen-new-square-line-duotone"
            size="md"
            @click="openEditModal(card)"
          />
          <UTooltip text="Find similar cards">
            <UButton
              color="info"
              variant="ghost"
              icon="i-solar-copy-bold-duotone"
              size="md"
              @click="findSimilarCards(card)"
            />
          </UTooltip>
          <UButton
            color="error"
            variant="ghost"
            icon="i-solar-trash-bin-trash-bold-duotone"
            size="md"
            @click="deleteCard(card)"
          />
        </div>
      </li>
    </ul>

    <!-- Pagination -->
    <div
      v-if="filteredCards.length > pageSize"
      class="flex justify-between items-center mt-4"
    >
      <div class="text-sm text-gray-400">
        Showing {{ (currentPage - 1) * pageSize + 1 }}-{{
          Math.min(currentPage * pageSize, filteredCards.length)
        }}
        of {{ filteredCards.length }} cards
      </div>
      <UPagination
        v-model:page="currentPage"
        :total="filteredCards.length"
        :page-count="totalPages"
        :page-size="pageSize"
        class="flex items-center gap-1"
      />
    </div>

    <UCard>
      <template #header>
        <h3 class="text-2xl font-bold">Upload Pack JSON</h3>
      </template>

      <UForm :state="uploadState">
        <div
          class="border border-gray-300 rounded p-2 bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
        >
          <input
            type="file"
            accept=".json"
            @change="handleFileChange"
            class="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-slate-500 dark:file:bg-slate-700 dark:file:text-slate-200"
          />
        </div>
        <p class="text-lg text-slate-500 mt-1">
          Upload a JSON file with card packs
        </p>

        <!-- JSON Preview Section -->
        <div
          v-if="showPreview"
          class="mt-4 border rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
        >
          <h4 class="font-semibold mb-2">Preview</h4>

          <!-- Summary Stats -->
          <div class="flex gap-4 mb-4">
            <div
              class="bg-primary-50 dark:bg-primary-900 p-2 rounded flex-1 text-center"
            >
              <div class="text-lg font-bold">{{ previewStats.packs }}</div>
              <div class="text-xs text-gray-500">Packs</div>
            </div>
            <div
              class="bg-primary-50 dark:bg-primary-900 p-2 rounded flex-1 text-center"
            >
              <div class="text-lg font-bold">{{ previewStats.whiteCards }}</div>
              <div class="text-xs text-gray-500">White Cards</div>
            </div>
            <div
              class="bg-primary-50 dark:bg-primary-900 p-2 rounded flex-1 text-center"
            >
              <div class="text-lg font-bold">{{ previewStats.blackCards }}</div>
              <div class="text-xs text-gray-500">Black Cards</div>
            </div>
          </div>

          <!-- Pack List -->
          <div class="max-h-60 overflow-y-auto">
            <div
              v-for="(pack, i) in previewData"
              :key="i"
              class="mb-2 p-2 border-b"
            >
              <div class="font-medium">
                {{ pack.name || `Pack ${pack.pack || i + 1}` }}
              </div>
              <div class="text-xs text-gray-500">
                {{ pack.white?.length || 0 }} white cards,
                {{ pack.black?.length || 0 }} black cards
              </div>
            </div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div v-if="showProgress" class="mt-4 space-y-3">
          <div class="flex justify-between text-xs text-gray-500 mb-1">
            <span>
              {{
                seedingStats.currentPack
                  ? `Processing pack: ${seedingStats.currentPack}`
                  : "Seeding cards..."
              }}
              <span v-if="seedingStats.currentCardType" class="ml-1"
                >({{ seedingStats.currentCardType }} cards)</span
              >
            </span>
            <span>{{ Math.round(uploadProgress * 100) }}%</span>
          </div>
          <UProgress :value="uploadProgress" color="primary" />

          <!-- Detailed Stats -->
          <div
            v-if="seedingStats.totalCards > 0"
            class="text-xs text-gray-400 grid grid-cols-2 gap-x-4 gap-y-1 mt-2"
          >
            <div>Total Cards: {{ seedingStats.totalCards }}</div>
            <div>Packs: {{ seedingStats.totalPacks }}</div>
            <div>White Cards: {{ seedingStats.whiteCardCount }}</div>
            <div>Black Cards: {{ seedingStats.blackCardCount }}</div>
            <div>Inserted: {{ seedingStats.insertedCards }}</div>
            <div>Skipped Duplicates: {{ seedingStats.skippedDuplicates }}</div>
            <div>Skipped Similar: {{ seedingStats.skippedSimilar }}</div>
            <div>Skipped Long Text: {{ seedingStats.skippedLongText }}</div>
            <div>Failed: {{ seedingStats.failedCards }}</div>
          </div>

          <!-- Warnings -->
          <div
            v-if="seedingStats.warnings && seedingStats.warnings.length > 0"
            class="mt-2"
          >
            <UAccordion
              :items="[
                {
                  label: `Warnings (${seedingStats.warnings.length})`,
                  slot: 'warnings',
                  defaultOpen: false,
                },
              ]"
            >
              <template #warnings>
                <div class="text-xs text-amber-500 max-h-32 overflow-y-auto">
                  <div
                    v-for="(warning, i) in seedingStats.warnings.slice(0, 10)"
                    :key="i"
                    class="py-1"
                  >
                    {{ warning }}
                  </div>
                  <div
                    v-if="seedingStats.warnings.length > 10"
                    class="py-1 italic"
                  >
                    ...and {{ seedingStats.warnings.length - 10 }} more warnings
                  </div>
                </div>
              </template>
            </UAccordion>
          </div>

          <!-- Errors -->
          <div
            v-if="seedingStats.errors && seedingStats.errors.length > 0"
            class="mt-2"
          >
            <UAccordion
              :items="[
                {
                  label: `Errors (${seedingStats.errors.length})`,
                  slot: 'errors',
                  defaultOpen: false,
                },
              ]"
            >
              <template #errors>
                <div class="text-xs text-red-500 max-h-32 overflow-y-auto">
                  <div
                    v-for="(error, i) in seedingStats.errors.slice(0, 10)"
                    :key="i"
                    class="py-1"
                  >
                    {{ error }}
                  </div>
                  <div
                    v-if="seedingStats.errors.length > 10"
                    class="py-1 italic"
                  >
                    ...and {{ seedingStats.errors.length - 10 }} more errors
                  </div>
                </div>
              </template>
            </UAccordion>
          </div>
        </div>

        <!-- Resume Prompt -->
        <div
          v-if="showResumePrompt"
          class="mt-4 p-3 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded-lg"
        >
          <div class="font-medium mb-2">Upload failed</div>
          <p class="text-sm mb-3">
            The upload process was interrupted. Would you like to resume from
            where it left off?
          </p>
          <div class="flex gap-2">
            <UButton size="sm" color="warning" @click="resumeUpload"
              >Resume Upload</UButton
            >
            <UButton size="sm" variant="ghost" @click="showResumePrompt = false"
              >Cancel</UButton
            >
          </div>
        </div>

        <UButton
          :loading="uploading"
          :disabled="!uploadState.file || !uploadState.fileContent"
          @click="uploadJsonFile()"
          color="primary"
          class="mt-4"
          variant="subtle"
        >
          Upload & Seed
        </UButton>
      </UForm>
    </UCard>

    <!-- Edit Modal -->
    <UModal v-model:open="showEditModal">
      <template #header>
        <h3 class="text-lg font-medium">Edit Card</h3>
      </template>
      <template #body>
        <div class="space-y-4">
          <UTextarea
            v-model="newCardText"
            placeholder="Enter card text..."
            class="w-full"
            :rows="5"
            autofocus
          />
          <div v-if="cardType === 'black'">
            <label class="block text-sm font-medium mb-1"
              >Number of Picks</label
            >
            <UInput
              v-model="editingCardPicks"
              type="number"
              min="1"
              max="3"
              placeholder="Number of cards to pick"
              class="w-full"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="soft"
            @click="showEditModal = false"
          >
            Cancel
          </UButton>
          <UButton
            color="primary"
            @click="saveCardEdit"
            :disabled="!newCardText.trim()"
          >
            Save Changes
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Similar Cards Modal -->
    <UModal v-model:open="showSimilarCardsModal" size="xl">
      <template #header>
        <h3 class="text-lg font-medium">Similar Cards</h3>
      </template>
      <template #body>
        <div v-if="loading" class="space-y-6">
          <div class="text-sm text-gray-400 mb-4">
            <USkeleton class="h-4 w-full" />
            <USkeleton class="h-4 w-3/4 mt-2" />
          </div>

          <!-- Skeleton for similar cards -->
          <div
            v-for="i in 2"
            :key="i"
            class="border border-gray-700 rounded-lg p-4"
          >
            <div class="flex justify-between items-start mb-4">
              <div class="text-sm text-gray-400">
                <USkeleton class="h-4 w-32" />
              </div>
              <USkeleton class="h-6 w-20 rounded-full" />
            </div>

            <div class="grid grid-cols-2 gap-6">
              <!-- Original Card Skeleton -->
              <div class="space-y-2">
                <h4 class="font-medium">Original Card</h4>
                <div class="bg-slate-800 rounded p-3 border-2 border-gray-600">
                  <USkeleton class="h-5 w-full" />
                  <USkeleton class="h-5 w-3/4 mt-2" />
                </div>
                <div class="text-xs text-gray-400">
                  <USkeleton class="h-3 w-48" />
                </div>
              </div>

              <!-- Similar Card Skeleton -->
              <div class="space-y-2">
                <h4 class="font-medium">Similar Card</h4>
                <div class="bg-slate-800 rounded p-3 border-2 border-gray-600">
                  <USkeleton class="h-5 w-full" />
                  <USkeleton class="h-5 w-3/4 mt-2" />
                </div>
                <div class="text-xs text-gray-400">
                  <USkeleton class="h-3 w-48" />
                </div>
              </div>
            </div>

            <div class="flex justify-center mt-6 w-full">
              <USkeleton class="h-10 w-full rounded" />
            </div>
          </div>
        </div>
        <div
          v-else-if="selectedCard && similarCards.length > 0"
          class="space-y-6"
        >
          <div class="text-sm text-gray-400 mb-4">
            Select which card to keep and which to delete. Cards with higher
            similarity scores are more likely to be duplicates.
          </div>

          <div
            v-for="similarCard in similarCards"
            :key="similarCard.$id"
            class="border border-gray-700 rounded-lg p-4"
          >
            <div class="flex justify-between items-start mb-4">
              <div class="text-sm text-gray-400">
                Similarity:
                <span class="font-bold text-info-400"
                  >{{ similarCard.similarityScore }}%</span
                >
              </div>
              <UBadge color="info" variant="subtle">{{
                similarCard.pack
              }}</UBadge>
            </div>

            <div class="grid grid-cols-2 gap-6">
              <!-- Original Card -->
              <div class="space-y-2">
                <h4 class="font-medium">Original Card</h4>
                <div
                  class="bg-slate-800 rounded p-3 text-sm font-mono text-white cursor-pointer border-2"
                  :class="
                    cardToKeep === 'original'
                      ? 'border-green-500'
                      : 'border-red-500'
                  "
                  @click="cardToKeep = 'original'"
                >
                  {{ selectedCard.text }}
                </div>
                <div class="text-xs text-gray-400">
                  Pack: {{ selectedCard.pack }} | ID: {{ selectedCard.$id }}
                </div>
              </div>

              <!-- Similar Card -->
              <div class="space-y-2">
                <h4 class="font-medium">Similar Card</h4>
                <div
                  class="bg-slate-800 rounded p-3 text-sm font-mono text-white cursor-pointer border-2"
                  :class="
                    cardToKeep === 'similar'
                      ? 'border-green-500'
                      : 'border-red-500'
                  "
                  @click="cardToKeep = 'similar'"
                >
                  {{ similarCard.text }}
                </div>
                <div class="text-xs text-gray-400">
                  Pack: {{ similarCard.pack }} | ID: {{ similarCard.$id }}
                </div>
              </div>
            </div>

            <div class="flex justify-center mt-6 w-full">
              <UButton
                color="error"
                @click="handleSimilarCardAction(similarCard)"
                :loading="loading"
                class="w-full"
                :disabled="!cardToKeep"
              >
                Delete
                {{ cardToKeep === "original" ? "Similar" : "Original" }} Card
              </UButton>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-8 text-gray-400">
          No similar cards found.
        </div>
      </template>
      <template #footer>
        <div class="flex justify-between items-center">
          <div class="text-sm text-gray-400">
            Showing {{ similarCards.length }} similar cards
          </div>
          <UButton
            color="neutral"
            variant="soft"
            @click="showSimilarCardsModal = false"
          >
            Close
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- All Similar Cards Modal -->
    <UModal v-model:open="showAllSimilarCardsModal" size="xl">
      <template #header>
        <h3 class="text-lg font-medium">All Similar Cards</h3>
      </template>
      <template #body>
        <div v-if="processingAllSimilarCards" class="flex justify-center py-8">
          <UIcon
            name="i-solar-restart-circle-line-duotone"
            class="animate-spin h-8 w-8 text-gray-400"
          />
          <span class="ml-2 text-gray-400"
            >Processing cards... This may take a moment.</span
          >
        </div>
        <div v-else-if="allSimilarPairs.length > 0" class="space-y-6">
          <div class="text-sm text-gray-400 mb-4">
            Select which card to keep and which to delete. Navigate through all
            similar pairs using the buttons below.
          </div>

          <div
            v-if="allSimilarPairs[currentPairIndex]"
            class="border border-gray-700 rounded-lg p-4"
          >
            <div class="flex justify-between items-start mb-4">
              <div class="text-sm text-gray-400">
                Similarity:
                <span class="font-bold text-info-400"
                  >{{
                    Math.round(
                      allSimilarPairs[currentPairIndex]!.similarity * 100,
                    )
                  }}%</span
                >
              </div>
              <div class="flex gap-2">
                <UBadge color="info" variant="subtle"
                  >Pair {{ currentPairIndex + 1 }} of
                  {{ allSimilarPairs.length }}</UBadge
                >
              </div>
            </div>

            <div class="grid grid-cols-2 gap-6">
              <!-- Card 1 -->
              <div class="space-y-2">
                <h4 class="font-medium">Card 1</h4>
                <div
                  class="bg-slate-800 rounded p-3 text-sm font-mono text-white cursor-pointer border-2"
                  :class="
                    cardToKeep === 'card1'
                      ? 'border-green-500'
                      : 'border-red-500'
                  "
                  @click="cardToKeep = 'card1'"
                >
                  {{ allSimilarPairs[currentPairIndex]!.card1.text }}
                </div>
                <div class="text-xs text-gray-400">
                  Pack: {{ allSimilarPairs[currentPairIndex]!.card1.pack }} |
                  ID:
                  {{ allSimilarPairs[currentPairIndex]!.card1.$id }}
                </div>
              </div>

              <!-- Card 2 -->
              <div class="space-y-2">
                <h4 class="font-medium">Card 2</h4>
                <div
                  class="bg-slate-800 rounded p-3 text-sm font-mono text-white cursor-pointer border-2"
                  :class="
                    cardToKeep === 'card2'
                      ? 'border-green-500'
                      : 'border-red-500'
                  "
                  @click="cardToKeep = 'card2'"
                >
                  {{ allSimilarPairs[currentPairIndex]!.card2.text }}
                </div>
                <div class="text-xs text-gray-400">
                  Pack: {{ allSimilarPairs[currentPairIndex]!.card2.pack }} |
                  ID:
                  {{ allSimilarPairs[currentPairIndex]!.card2.$id }}
                </div>
              </div>
            </div>

            <div class="flex justify-center mt-6 w-full">
              <UButton
                color="error"
                @click="handleAllSimilarCardAction"
                :loading="loading"
                class="w-full"
                :disabled="!cardToKeep"
              >
                Delete {{ cardToKeep === "card1" ? "Card 2" : "Card 1" }}
              </UButton>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-8 text-gray-400">
          No similar cards found.
        </div>
      </template>
      <template #footer>
        <div class="flex justify-between items-center">
          <div class="text-sm text-gray-400">
            {{ allSimilarPairs.length }} similar pairs found
          </div>
          <div class="flex gap-2">
            <UButton
              color="neutral"
              variant="soft"
              icon="i-solar-arrow-left-line-duotone"
              :disabled="currentPairIndex === 0 || allSimilarPairs.length === 0"
              @click="goToPreviousPair"
            >
              Previous
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              icon-right="i-solar-arrow-right-line-duotone"
              :disabled="
                currentPairIndex >= allSimilarPairs.length - 1 ||
                allSimilarPairs.length === 0
              "
              @click="goToNextPair"
            >
              Next
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              @click="showAllSimilarCardsModal = false"
            >
              Close
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Add Single Card Modal -->
    <UModal v-model:open="showAddCardModal">
      <template #header>
        <h3 class="text-lg font-medium">Add Single Card</h3>
      </template>
      <template #body>
        <div class="space-y-4">
          <UTextarea
            v-model="newSingleCardText"
            placeholder="Enter card text..."
            class="w-full"
            :rows="5"
            autofocus
          />
          <div>
            <label class="block text-sm font-medium mb-1">Select Pack</label>
            <div class="flex gap-2">
              <USelectMenu
                v-model="newSingleCardPack"
                :items="availablePacks"
                placeholder="Select existing pack"
                class="flex-1"
              />
              <UInput
                v-if="!availablePacks.includes(newSingleCardPack)"
                v-model="newSingleCardPack"
                placeholder="Or enter new pack name"
                class="flex-1"
              />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Card Type</label>
            <USelectMenu
              v-model="newSingleCardType"
              :items="['black', 'white']"
              placeholder="Select card type"
              class="w-full"
            />
          </div>
          <div v-if="newSingleCardType === 'black'">
            <label class="block text-sm font-medium mb-1"
              >Number of Picks</label
            >
            <UInput
              v-model="newSingleCardPicks"
              type="number"
              min="1"
              max="3"
              placeholder="Number of cards to pick"
              class="w-full"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="soft"
            @click="showAddCardModal = false"
          >
            Cancel
          </UButton>
          <UButton
            color="success"
            @click="addSingleCard"
            :disabled="!newSingleCardText.trim() || !newSingleCardPack"
          >
            Add Card
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

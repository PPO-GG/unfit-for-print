export const useCards = () => {
  const fetchRandomCard = async (
    type: "white" | "black",
    pick: number = 1,
    cardPacks?: string[],
  ) => {
    if (import.meta.server) return null;
    try {
      return await $fetch("/api/cards/random", {
        query: { type, pick: type === "black" ? pick : undefined, pack: cardPacks?.[0] },
      });
    } catch (err) {
      console.error(`Failed to fetch ${type} card:`, err);
      return null;
    }
  };

  const fetchRandomWhiteCard = (cardPacks?: string[]) => fetchRandomCard("white", 1, cardPacks);
  const fetchRandomBlackCard = (pick: number = 1, cardPacks?: string[]) =>
    fetchRandomCard("black", pick, cardPacks);

  return { fetchRandomCard, fetchRandomWhiteCard, fetchRandomBlackCard };
};

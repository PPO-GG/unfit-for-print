import type { AdminCard } from "~/types/adminCard";
import type { CardFilter } from "~/utils/explorerQuery";
import { cardRate } from "~/composables/useAdminCardStats";

export type CardSortKey = "text" | "type" | "pack" | "played" | "rate" | "active";
export interface CardSort {
  key: CardSortKey;
  desc: boolean;
}

export function filterCards(cards: AdminCard[], opts: { type: CardFilter; q: string }): AdminCard[] {
  const term = opts.q.trim().toLowerCase();
  return cards.filter((c) => {
    if (opts.type === "inactive" && c.active !== false) return false;
    if ((opts.type === "white" || opts.type === "black") && c.type !== opts.type) return false;
    return !term || (c.text ?? "").toLowerCase().includes(term);
  });
}

const lower = (s: string | null) => (s ?? "").toLocaleLowerCase();

export function sortCards(cards: AdminCard[], sort: CardSort | null): AdminCard[] {
  const copy = [...cards];
  if (!sort) return copy;
  const dir = sort.desc ? -1 : 1;

  if (sort.key === "rate") {
    // A card without enough plays has no rank: always last, whichever direction.
    return copy.sort((a, b) => {
      const ra = cardRate(a).value;
      const rb = cardRate(b).value;
      if (ra === null && rb === null) return 0;
      if (ra === null) return 1;
      if (rb === null) return -1;
      return (ra - rb) * dir;
    });
  }

  const value = (c: AdminCard): string | number => {
    switch (sort.key) {
      case "type":
        return c.type;
      case "pack":
        return lower(c.pack);
      case "played":
        return c.timesPlayed ?? 0;
      case "active":
        return c.active ? 1 : 0;
      default:
        return lower(c.text);
    }
  };
  return copy.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });
}

export function cardCounts(cards: AdminCard[]) {
  return {
    all: cards.length,
    white: cards.filter((c) => c.type === "white").length,
    black: cards.filter((c) => c.type === "black").length,
    inactive: cards.filter((c) => c.active === false).length,
  };
}

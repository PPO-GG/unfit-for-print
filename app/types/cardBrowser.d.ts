import type { CardAttachmentConfig } from "~/types/card";

/** A card row as returned by `GET /api/cards/browse`. */
export interface BrowsableCard {
  id: string;
  text: string | null;
  pack: string | null;
  imageKey: string | null;
  imageFormat: string | null;
  attachment: CardAttachmentConfig | null;
  /** Black cards only. */
  pick?: number;
}

export interface CardBrowseResponse {
  cards: BrowsableCard[];
  total: number;
  page: number;
  perPage: number;
}

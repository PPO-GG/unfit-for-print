import type { CardAttachmentConfig } from "~/types/card";

/** A card row as returned by `GET /api/cards/browse`. */
export interface BrowsableCard {
  id: string;
  text: string | null;
  /** The pack's current name. */
  pack: string | null;
  packId: string | null;
  /** Retired: no longer sent by the server. */
  packDisplayName?: string | null;
  packSeries: string | null;
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

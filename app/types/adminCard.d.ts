import type { CardAttachmentConfig } from "~/types/card";

export type AdminCardType = "white" | "black";

export interface AdminCardCounts {
  total: number;
  active: number;
}

export interface AdminPack {
  id: string;
  name: string;
  series: string | null;
  description: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  official: boolean;
  nsfw: boolean;
  isDefault: boolean;
  legacyKey: string | null;
  white: AdminCardCounts;
  black: AdminCardCounts;
}

export interface AdminCard {
  id: string;
  type: AdminCardType;
  text: string | null;
  packId: string | null;
  pack: string | null;
  active: boolean;
  pick?: number;
  imageKey?: string | null;
  imageFormat?: string | null;
  attachment?: CardAttachmentConfig | null;
  timesPlayed?: number;
  timesWon?: number;
  timesSkipped?: number;
}

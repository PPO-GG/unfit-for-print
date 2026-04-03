import type { Component } from "vue";

export type DecorationSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface DecorationEntry {
  component: () => Promise<{ default: Component }>;
  name: string;
  description: string;
  type: string;
  rarity: string;
}

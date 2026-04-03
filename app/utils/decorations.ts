import type { DecorationEntry } from "~/types/decoration";

export const decorationRegistry: Record<string, DecorationEntry> = {
  "founder-ring": {
    component: () => import("~/components/decorations/FounderRing.vue"),
    name: "Founder's Ring",
    description: "A golden swirling ring with sparkles for game supporters",
    type: "ring",
    rarity: "legendary",
  },
};

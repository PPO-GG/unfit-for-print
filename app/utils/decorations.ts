import type { DecorationRegistryEntry } from "~/types/decoration";

export const decorationRegistry: Record<string, DecorationRegistryEntry> = {
  "founder-ring": {
    component: () => import("~/components/decorations/FounderRing.vue"),
  },
};

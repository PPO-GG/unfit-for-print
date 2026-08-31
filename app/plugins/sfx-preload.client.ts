import { defineNuxtPlugin } from "#app";
import { preloadSfx } from "~/composables/useSfx";
import { SFX } from "~/config/sfx.config";

// Warm the shared audio decode cache as soon as the app boots, so the
// first time any card/UI sound plays there's no fetch+decode latency.
export default defineNuxtPlugin(() => {
  preloadSfx(Object.values(SFX));
});

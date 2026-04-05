<script setup lang="ts">
import { computed, defineAsyncComponent, type Component } from "vue";
import { decorationRegistry } from "~/utils/decorations";
import { getDecorationImageUrl } from "~/utils/decorationImage";
import type {
  DecorationCatalogEntry,
  AttachmentConfig,
} from "~/types/decoration";

const props = defineProps<{
  decorationId?: string | null;
  /** Optional catalog entry — short-circuits the internal lookup when provided */
  catalogEntry?: DecorationCatalogEntry | null;
}>();

// ─── Shared Catalog Cache ────────────────────────────────────────────
// Singleton across all AvatarDecoration instances. Fetched once, shared forever.
// This lets every consumer (game, header, profile) render attachments
// without threading catalogEntry props through the full tree.

const catalogCache = useState<Map<string, DecorationCatalogEntry>>(
  "decoration-catalog-cache",
  () => new Map(),
);
const catalogFetched = useState("decoration-catalog-fetched", () => false);
const catalogFetching = useState("decoration-catalog-fetching", () => false);

async function ensureCatalog() {
  if (catalogFetched.value || catalogFetching.value) return;
  catalogFetching.value = true;
  try {
    const data = await $fetch<DecorationCatalogEntry[]>(
      "/api/decorations/catalog",
    );
    const map = new Map<string, DecorationCatalogEntry>();
    for (const entry of data) {
      map.set(entry.decorationId, entry);
    }
    catalogCache.value = map;
    catalogFetched.value = true;
  } catch {
    // Silently fail — bespoke effects still work, attachments just won't show
  }
  catalogFetching.value = false;
}

// Trigger fetch on mount (deduped by the flags above)
onMounted(ensureCatalog);

// ─── Component Cache ─────────────────────────────────────────────────
const componentCache = new Map<string, Component>();

const AvatarAttachmentComponent = defineAsyncComponent(
  () => import("~/components/decorations/AvatarAttachment.vue"),
);

const AvatarLottieComponent = defineAsyncComponent(
  () => import("~/components/decorations/AvatarLottie.vue"),
);

// ─── Resolve: registry → prop → cache ────────────────────────────────
const resolved = computed(() => {
  if (!props.decorationId) return null;

  // 1. Check static registry for bespoke effect components
  const entry = decorationRegistry[props.decorationId];
  if (entry) {
    let cached = componentCache.get(props.decorationId);
    if (!cached) {
      cached = defineAsyncComponent(() =>
        entry.component().then((mod) => mod.default),
      );
      componentCache.set(props.decorationId, cached);
    }
    return { type: "effect" as const, component: cached };
  }

  // 2. Check catalog entry — prefer prop, fall back to shared cache
  const catalog =
    props.catalogEntry ?? catalogCache.value.get(props.decorationId) ?? null;

  if (
    catalog?.type === "attachment" &&
    catalog.imageFileId &&
    catalog.attachment
  ) {
    const isLottie =
      catalog.imageFormat === "lottie" || catalog.imageFormat === "dotlottie";

    return {
      type: "attachment" as const,
      component: isLottie ? AvatarLottieComponent : AvatarAttachmentComponent,
      imageUrl: getDecorationImageUrl(catalog.imageFileId),
      attachment: catalog.attachment as AttachmentConfig,
    };
  }

  return null;
});
</script>

<template>
  <ClientOnly>
    <!-- Bespoke effect component -->
    <component
      :is="resolved.component"
      v-if="resolved?.type === 'effect'"
    >
      <slot />
    </component>

    <!-- Data-driven attachment component -->
    <component
      :is="resolved.component"
      v-else-if="resolved?.type === 'attachment'"
      :image-url="resolved.imageUrl"
      :attachment="resolved.attachment"
    >
      <slot />
    </component>

    <!-- No decoration — passthrough -->
    <slot v-else />
  </ClientOnly>
</template>

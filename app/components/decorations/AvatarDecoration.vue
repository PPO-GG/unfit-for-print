<script setup lang="ts">
/**
 * The one entry point every avatar in the app goes through (header, seats,
 * player lists, profile…). Props are unchanged from the registry era: it
 * resolves the decoration's layer stack and hands it to DecorationStack, or
 * passes the avatar straight through when there's nothing to draw.
 */
import { computed, onMounted } from "vue";
import type { DecorationCatalogEntry } from "~/types/decoration";
import DecorationStack from "./DecorationStack.vue";

const props = defineProps<{
  decorationId?: string | null;
  /** Optional catalog entry: short-circuits the shared-cache lookup. */
  catalogEntry?: DecorationCatalogEntry | null;
}>();

// Singleton across every instance: fetched once, shared forever, so no
// consumer has to thread catalog entries through the component tree.
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
    const data = await $fetch<DecorationCatalogEntry[]>("/api/decorations/catalog");
    catalogCache.value = new Map(data.map((entry) => [entry.decorationId, entry]));
    catalogFetched.value = true;
  } catch {
    // Fail quiet: the avatar still renders, just undecorated.
  }
  catalogFetching.value = false;
}

onMounted(ensureCatalog);

const layers = computed(() => {
  if (!props.decorationId) return null;
  const entry = props.catalogEntry ?? catalogCache.value.get(props.decorationId) ?? null;
  return entry?.layers?.layers.length ? entry.layers : null;
});
</script>

<template>
  <ClientOnly>
    <DecorationStack v-if="layers" :layers="layers">
      <slot />
    </DecorationStack>
    <slot v-else />
  </ClientOnly>
</template>

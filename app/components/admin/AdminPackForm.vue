<script setup lang="ts">
/**
 * Edits one pack's metadata row. The row is optional — a pack with no row is
 * the normal case — so the form opens on blank defaults and the POST upserts.
 *
 * Empty strings are sent as null so clearing a field actually clears it,
 * rather than storing "" and having every reader test for both.
 *
 * Display name and series start pre-filled from the same derived guess
 * AdminPackTile shows (`splitPackName`/`seriesPrefix`) whenever the row has
 * no explicit value of its own, so opening the form for one of the ~106
 * "Cards Against Humanity: …" packs is a one-click Save to turn the guess
 * into real, editable data instead of retyping it.
 */
import { ref, computed, watch } from "vue";
import { useNotifications } from "~/composables/useNotifications";
import { splitPackName } from "~/utils/packName";
import { normalizePackText, looksShouted } from "#shared/packMetaText";
import type { CardPackMeta } from "~/types/cardPack";

const props = defineProps<{
  pack: string;
  meta: CardPackMeta | null;
  /** Shared series prefix across the loaded packs, from `commonPackPrefix`. */
  seriesPrefix?: string;
}>();

const emit = defineEmits<{
  saved: [CardPackMeta];
}>();

const { $activityFetch } = useNuxtApp();
const { notify } = useNotifications();

const saving = ref(false);

const blank = () => ({
  displayName: "",
  description: "",
  icon: "",
  color: "",
  series: "",
  sortOrder: 0,
  official: false,
  nsfw: false,
});

const form = ref(blank());

const derived = computed(() => splitPackName(props.pack, props.seriesPrefix ?? ""));
// splitPackName falls back to the whole raw name as `label` when nothing
// splits off — suggesting that back as a "display name" would just echo the
// pack key, so there's only a real suggestion once a series actually split.
const suggestedName = computed(() => (derived.value.series ? derived.value.label : ""));
// The derived series carries the trailing separator (": ") that makes sense
// concatenated in a tile's headline, not as a value someone actually saves —
// same stripping the bulk "Set series…" popover does before prefilling.
const suggestedSeries = computed(() => derived.value.series.replace(/[:\s]+$/, ""));

function seed() {
  form.value = props.meta
    ? {
        displayName: props.meta.displayName ?? suggestedName.value,
        description: props.meta.description ?? "",
        icon: props.meta.icon ?? "",
        color: props.meta.color ?? "",
        series: props.meta.series ?? suggestedSeries.value,
        sortOrder: props.meta.sortOrder ?? 0,
        official: props.meta.official ?? false,
        nsfw: props.meta.nsfw ?? false,
      }
    : { ...blank(), displayName: suggestedName.value, series: suggestedSeries.value };
}
seed();
// Also on `pack` changing: switching packs discards whatever was mid-edit
// rather than resuming it against the newly selected pack.
watch(
  () => [props.pack, props.meta],
  () => seed(),
);

/**
 * Every text field goes through the shared normalizer — trimmed, internal
 * whitespace collapsed, blank becomes null — so the row cannot pick up the
 * defects that are invisible in a UI that uppercases everything in CSS.
 */
const orNull = normalizePackText;

// Advisory, not a gate. Casing is the admin's call; this just makes the
// consequence visible at the point of entry, since every surface that renders
// these uppercases them anyway and would hide a shouted value.
const shoutedFields = computed(() =>
  (["displayName", "series"] as const).filter((key) =>
    looksShouted(form.value[key]),
  ),
);

async function save() {
  saving.value = true;
  // Write the normalized values back into the form first: saving silently
  // different text than the box shows is how "I fixed that already" happens.
  form.value.displayName = orNull(form.value.displayName) ?? "";
  form.value.series = orNull(form.value.series) ?? "";
  try {
    const row = await $activityFetch<CardPackMeta>("/api/admin/cards/pack-meta", {
      method: "POST",
      body: {
        pack: props.pack,
        displayName: orNull(form.value.displayName),
        description: orNull(form.value.description),
        icon: orNull(form.value.icon),
        color: orNull(form.value.color),
        series: orNull(form.value.series),
        sortOrder: Number(form.value.sortOrder) || 0,
        official: form.value.official,
        nsfw: form.value.nsfw,
      },
    });
    emit("saved", row);
  } catch {
    notify({
      title: "Save Failed",
      description: `Could not save details for "${props.pack}".`,
      color: "error",
    });
  } finally {
    saving.value = false;
  }
}

defineExpose({ form, save });
</script>

<template>
  <div class="flex flex-col gap-4">
    <UFormField label="Display name">
      <UInput v-model="form.displayName" class="w-full" placeholder="Shown instead of the raw pack name" />
    </UFormField>

    <UFormField label="Series / brand">
      <UInput v-model="form.series" class="w-full" placeholder="e.g. Cards Against Humanity" />
    </UFormField>

    <p
      v-if="shoutedFields.length"
      data-testid="pack-shout-hint"
      class="-mt-2 text-xs text-amber-400/90"
    >
      Type {{ shoutedFields.length > 1 ? "these" : "this" }} the way you'd write
      it in a sentence — every screen uppercases pack names already, and stored
      caps can't be turned back into title case.
    </p>

    <UFormField label="Description">
      <UTextarea v-model="form.description" class="w-full" :rows="3" placeholder="What is in this pack?" />
    </UFormField>

    <div class="grid grid-cols-2 gap-3">
      <UFormField label="Icon">
        <UInput v-model="form.icon" class="w-full" placeholder="🎴" />
      </UFormField>
      <UFormField label="Accent colour">
        <UInput v-model="form.color" class="w-full" placeholder="#3b82f6" />
      </UFormField>
    </div>

    <UFormField label="Sort order">
      <UInput v-model="form.sortOrder" type="number" class="w-full" />
    </UFormField>

    <div class="flex items-center justify-between">
      <USwitch v-model="form.official" label="Official pack" />
    </div>

    <div class="flex items-center justify-between">
      <USwitch v-model="form.nsfw" label="NSFW" />
    </div>

    <div class="flex justify-end">
      <UButton color="primary" :loading="saving" @click="save">Save details</UButton>
    </div>
  </div>
</template>

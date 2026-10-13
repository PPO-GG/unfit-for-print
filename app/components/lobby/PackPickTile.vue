<template>
  <UTooltip :text="tile.description ?? ''" :disabled="!tile.description">
    <button
      type="button"
      class="ppt"
      :class="{ 'ppt--on': selected }"
      :aria-pressed="selected"
      :disabled="disabled"
      @click="$emit('toggle', tile.id)"
    >
      <span class="ppt-check" aria-hidden="true">
        <UIcon v-if="selected" name="i-solar-check-read-linear" />
      </span>
      <span v-if="label.series" class="ppt-series">{{ label.series }}</span>
      <span class="ppt-name">{{ label.name }}</span>
      <span class="ppt-foot">
        <span class="ppt-counts">
          <span class="ppt-count ppt-count--white"><i />{{ t("lobby.editor.answers_short", { count: tile.white }) }}</span>
          <span class="ppt-count ppt-count--black"><i />{{ t("lobby.editor.prompts_short", { count: tile.black }) }}</span>
        </span>
        <span class="ppt-marks">
          <span v-if="tile.isDefault" class="ppt-mark ppt-mark--default">{{ t("lobby.editor.mark_default") }}</span>
          <span v-if="tile.official" class="ppt-mark">{{ t("labs.pack_official") }}</span>
          <span v-if="tile.nsfw" class="ppt-mark ppt-mark--nsfw">{{ t("labs.pack_nsfw") }}</span>
        </span>
      </span>
    </button>
  </UTooltip>
</template>

<script lang="ts" setup>
import type { PackTile } from "~/utils/cardPacks";
import { packLabel } from "~/utils/packName";

const props = defineProps<{
  tile: PackTile;
  selected: boolean;
  seriesPrefix: string;
  disabled?: boolean;
}>();

defineEmits<{ (e: "toggle", id: string): void }>();

const { t } = useI18n();
const label = computed(() => packLabel(props.tile.pack, props.tile, props.seriesPrefix));
</script>

<style scoped>
.ppt {
  position: relative;
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 9px 10px;
  border: 1.5px solid var(--lb-line);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  color: var(--lb-ink);
  text-align: left;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease;
}
.ppt:hover:not(:disabled) { border-color: var(--lb-line-strong); background: rgba(255, 255, 255, 0.04); }
.ppt:focus-visible { outline: 2px solid var(--lb-accent); outline-offset: 2px; }
.ppt:disabled { cursor: default; }
.ppt--on { border-color: var(--lb-accent-lime); background: oklch(80% 0.20 140 / 0.08); }
.ppt--on:hover:not(:disabled) { border-color: var(--lb-accent-lime); background: oklch(80% 0.20 140 / 0.12); }

.ppt-check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 15px;
  height: 15px;
  border-radius: 4px;
  border: 1.5px solid var(--lb-line-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0d0f1a;
  font-size: 11px;
}
.ppt--on .ppt-check { background: var(--lb-accent-lime); border-color: var(--lb-accent-lime); }

.ppt-series {
  padding-right: 20px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lb-ink-muted);
}
.ppt-name {
  padding-right: 20px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
  font-family: 'Archivo Black', sans-serif;
  font-size: 12px;
  line-height: 1.15;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.ppt-foot { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: auto; }
.ppt-counts {
  display: flex;
  gap: 8px;
  white-space: nowrap;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: var(--lb-ink-dim);
}
.ppt-count i { display: inline-block; width: 7px; height: 9px; margin-right: 3px; border-radius: 1px; vertical-align: -1px; }
.ppt-count--white i { background: var(--lb-ink); }
.ppt-count--black i { background: #0b0e1d; border: 1px solid var(--lb-ink-dim); }
.ppt-marks { display: flex; gap: 3px; flex-wrap: wrap; justify-content: flex-end; }
.ppt-mark {
  padding: 1px 5px;
  border: 1px solid var(--lb-line-strong);
  border-radius: 999px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lb-ink-dim);
}
.ppt-mark--default { border-color: oklch(80% 0.20 140 / 0.55); color: oklch(85% 0.20 140); }
.ppt-mark--nsfw { border-color: oklch(65% 0.22 25 / 0.6); color: oklch(72% 0.20 25); }

@media (prefers-reduced-motion: reduce) { .ppt { transition: none; } }
</style>

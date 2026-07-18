<!--
  Colored menu tile used in the arcade-layout grid. Renders as either
  a button (emitting click) or a NuxtLink, depending on the `to` prop.

  Accents: yellow (signature), pink, cyan, lime, black (default dark tile).
  Use `featured` for the big primary tile (New Game).
-->
<template>
  <component
    :is="elementTag"
    :to="to"
    :type="elementTag === 'button' ? 'button' : undefined"
    :disabled="elementTag === 'button' ? disabled : undefined"
    :class="['menu-card', accentClass]"
    :style="cardStyle"
    @click="onClick"
  >
    <BrandStamp v-if="badge" class="menu-card-badge" :style="badgeStyle">
      {{ badge }}
    </BrandStamp>

    <div class="menu-card-head">
      <div class="menu-card-icon" :style="iconStyle">
        <BrandIcon :name="icon" :size="featured ? 22 : 18" />
      </div>
      <div v-if="featured" class="menu-card-rec font-mono">
        <span class="menu-card-rec-dot" />
        Recommended
      </div>
    </div>

    <div :class="featured ? 'menu-card-body featured' : 'menu-card-body'">
      <div
        class="menu-card-label font-display"
        :style="{ fontSize: featured ? '44px' : '22px' }"
      >
        {{ label }}
      </div>
      <div class="menu-card-sub font-mono">{{ sub }}</div>
      <slot name="rightSlot" />
    </div>

    <div class="menu-card-foot">
      <div class="menu-card-foot-right">
        <span v-if="footNote" class="menu-card-foot-note font-mono">{{
          footNote
        }}</span>
        <span v-if="kbd" class="menu-card-kbd font-mono" :style="kbdStyle">{{
          kbd
        }}</span>
      </div>
    </div>
  </component>
</template>

<script setup lang="ts">
import { resolveComponent } from "vue";
import type { CSSProperties } from "vue";
import type { BrandIconName } from "~/components/brand/BrandIcon.vue";

const props = withDefaults(
  defineProps<{
    accent: "yellow" | "pink" | "cyan" | "lime" | "black";
    icon: BrandIconName;
    label: string;
    sub: string;
    kbd?: string;
    badge?: string;
    featured?: boolean;
    footNote?: string;
    to?: string;
    disabled?: boolean;
  }>(),
  { accent: "black" },
);

const emit = defineEmits<{ click: [ev: MouseEvent] }>();

const NuxtLink = resolveComponent("NuxtLink");

const elementTag = computed(() => (props.to ? NuxtLink : "button"));

const isDark = computed(() => props.accent === "black");

const accentClass = computed(() =>
  props.accent === "black" ? "" : `accent-${props.accent}`,
);

const cardStyle = computed<CSSProperties>(() => ({
  aspectRatio: "auto",
  minHeight: props.featured ? "300px" : "140px",
  padding: props.featured ? "22px 20px" : "16px",
}));

const iconStyle = computed<CSSProperties>(() => ({
  width: props.featured ? "44px" : "36px",
  height: props.featured ? "44px" : "36px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "6px",
  flexShrink: 0,
  background: isDark.value ? "rgba(255,255,255,0.06)" : "rgba(13,15,26,0.12)",
  border: isDark.value
    ? "1px solid var(--line)"
    : "1px solid rgba(13,15,26,0.2)",
  color: isDark.value ? "var(--ink)" : "#0d0f1a",
}));

const badgeStyle = computed<CSSProperties>(() => ({
  color: isDark.value ? "var(--accent-2)" : "rgba(13,15,26,0.75)",
}));

const brandStyle = computed<CSSProperties>(() => ({
  fontFamily: "Archivo Black, sans-serif",
  fontSize: "8.5px",
  lineHeight: "0.95",
  opacity: "0.45",
  textTransform: "uppercase",
  color: isDark.value ? "rgba(255,255,255,0.55)" : "rgba(13,15,26,0.65)",
}));

const kbdStyle = computed<CSSProperties>(() => ({
  borderColor: isDark.value ? "var(--line-strong)" : "rgba(13,15,26,0.3)",
  color: isDark.value ? "var(--ink-dim)" : "rgba(13,15,26,0.7)",
  background: isDark.value ? "transparent" : "rgba(13,15,26,0.06)",
}));

function onClick(ev: MouseEvent) {
  if (props.disabled) {
    ev.preventDefault();
    return;
  }
  emit("click", ev);
}
</script>

<style scoped>
.menu-card-badge {
  position: absolute;
  top: 12px;
  right: 12px;
}

.menu-card-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.menu-card-rec {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: rgba(13, 15, 26, 0.65);
}

.menu-card-rec-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #0d0f1a;
}

.menu-card-body {
  margin-top: 12px;
}
.menu-card-body.featured {
  margin-top: auto;
}

.menu-card-label {
  line-height: 1;
}

.menu-card-sub {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  opacity: 0.7;
  margin-top: 8px;
}

.menu-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}

.menu-card-foot-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.menu-card-foot-note {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: rgba(13, 15, 26, 0.6);
}

.menu-card-kbd {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid currentColor;
}

.menu-card-brand {
  letter-spacing: 0.02em;
}
</style>
